import Observation
import SwiftUI

@MainActor @Observable
final class ShopCartViewModel {
    enum Phase { case loading, loaded, failed(String) }
    let repository: any ShopCartRepository
    let analytics: any ShopAnalytics
    var phase: Phase = .loading
    var groups: [ShopCartGroup] = []
    var workingItemID: UUID?
    var notice: String?
    private var hasTrackedView = false

    init(repository: any ShopCartRepository = SupabaseShopCartRepository(),
         analytics: any ShopAnalytics = FirebaseShopAnalytics()) {
        self.repository = repository
        self.analytics = analytics
    }

    func load() async {
        phase = .loading
        do {
            groups = try await repository.cart()
            phase = .loaded
            if !hasTrackedView {
                hasTrackedView = true
                let itemCount = groups.flatMap(\.lines).reduce(0) { $0 + $1.quantity }
                await analytics.track(.cartViewed(itemCount: itemCount, sellerCount: groups.count))
            }
            // Every mutation in this view routes back through load(), so this is
            // the one place the badge has to be reconciled — removing the last
            // item would otherwise leave a count on an empty cart.
            await ShopCartBadge.shared.refresh(using: repository)
        }
        catch { phase = .failed(error.localizedDescription) }
    }

    func setQuantity(_ quantity: Int, for line: ShopCartLine) async {
        workingItemID = line.id
        defer { workingItemID = nil }
        do { try await repository.setQuantity(itemID: line.id, quantity: quantity); await load() }
        catch { notice = error.localizedDescription }
    }

    func remove(_ line: ShopCartLine) async {
        workingItemID = line.id
        defer { workingItemID = nil }
        do { try await repository.remove(itemID: line.id); await load() }
        catch { notice = error.localizedDescription }
    }
}

struct ShopCartView: View {
    @State private var model: ShopCartViewModel

    init(repository: any ShopCartRepository = SupabaseShopCartRepository(),
         analytics: any ShopAnalytics = FirebaseShopAnalytics()) {
        _model = State(initialValue: ShopCartViewModel(repository: repository, analytics: analytics))
    }

    var body: some View {
        Group {
            switch model.phase {
            case .loading: TLLoadingView(rows: 5).padding(TLSpacing.lg)
            case .failed(let message): TLErrorState(message: message) { Task { await model.load() } }
            case .loaded where model.groups.isEmpty:
                TLEmptyState(icon: "cart", title: "Giỏ hàng đang trống", subtitle: "Chọn phiên bản sản phẩm rồi thêm vào giỏ để tiếp tục.")
            case .loaded: cartContent
            }
        }
        .background(TLColor.bg)
        .navigationTitle("Giỏ hàng")
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.load() }
        .refreshable { await model.load() }
        .alert("Chưa thể cập nhật", isPresented: Binding(get: { model.notice != nil }, set: { if !$0 { model.notice = nil } })) {
            Button("Đóng", role: .cancel) { model.notice = nil }
        } message: { Text(model.notice ?? "") }
    }

    private var cartContent: some View {
        ScrollView {
            LazyVStack(spacing: TLSpacing.lg) {
                ForEach(model.groups, id: \.shop.slug) { group in groupCard(group) }
            }
            .padding(TLSpacing.lg)
        }
    }

    private func groupCard(_ group: ShopCartGroup) -> some View {
        VStack(alignment: .leading, spacing: TLSpacing.md) {
            HStack {
                Text(group.shop.name).font(TLType.titleSans(17))
                Spacer()
                Text("Đặt riêng từng shop").font(TLType.bodySans(10)).foregroundStyle(TLColor.fg3)
            }
            ForEach(group.lines) { line in lineRow(line) }
            Divider()
            HStack {
                Text("Tạm tính").font(TLType.bodySans(12)).foregroundStyle(TLColor.fg3)
                Spacer()
                Text(ShopMoney.vnd(group.lines.reduce(0) { $0 + $1.lineTotalVND })).font(TLType.dataMono(13)).fontWeight(.bold)
            }
            Text(group.shop.shippingFeeVND == 0 ? "Miễn phí vận chuyển" : "Phí vận chuyển: \(ShopMoney.vnd(group.shop.shippingFeeVND))")
                .font(TLType.bodySans(10)).foregroundStyle(TLColor.fg3)
            NavigationLink(value: ShopRoute.checkout(group.shop.slug)) {
                Text("Đặt đơn tại \(group.shop.name)")
                    .font(TLType.titleSans(13)).foregroundStyle(TLColor.accentInk)
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .background(TLColor.accent, in: Capsule())
            }
            .buttonStyle(.plain)
            .disabled(group.lines.contains { $0.unavailableReason != nil })
            .opacity(group.lines.contains { $0.unavailableReason != nil } ? 0.45 : 1)
        }
        .padding(TLSpacing.lg)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg).strokeBorder(TLColor.border))
    }

    private func lineRow(_ line: ShopCartLine) -> some View {
        HStack(alignment: .top, spacing: TLSpacing.md) {
            ShopRemoteImage(url: line.cover?.publicURL, contentMode: .fill) { TLColor.surface2 }
                .frame(width: 72, height: 72).clipShape(RoundedRectangle(cornerRadius: TLRadius.lg))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 5) {
                Text(line.productTitle ?? "Sản phẩm không còn hiển thị").font(TLType.titleSans(13)).lineLimit(2)
                if let values = line.optionValues, !values.isEmpty {
                    Text(values.keys.sorted().compactMap { values[$0] }.joined(separator: " · "))
                        .font(TLType.bodySans(10)).foregroundStyle(TLColor.fg3)
                }
                Text(ShopMoney.vnd(line.unitPriceVND)).font(TLType.dataMono(11))
                if let reason = line.unavailableReason {
                    Text(reason.message).font(TLType.bodySans(10)).foregroundStyle(ShopTokens.unavailable)
                }
                HStack {
                    Stepper("Số lượng \(line.quantity)", value: Binding(
                        get: { line.quantity },
                        set: { value in Task { await model.setQuantity(value, for: line) } }
                    ), in: 1...SupabaseShopCartRepository.maximumQuantity)
                    .disabled(model.workingItemID == line.id)
                    Button("Bỏ", role: .destructive) { Task { await model.remove(line) } }
                        .font(TLType.bodySans(11)).disabled(model.workingItemID == line.id)
                }
            }
        }
        .accessibilityElement(children: .contain)
    }
}
