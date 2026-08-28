import Observation
import SwiftUI
import UIKit

@MainActor @Observable
final class ShopOrdersViewModel {
    let repository: any ShopOrderRepository
    let analytics: any ShopAnalytics
    var orders: [ShopOrderDetail] = []
    var isLoading = true
    var errorMessage: String?
    private var hasTrackedView = false

    init(repository: any ShopOrderRepository = SupabaseShopOrderRepository(),
         analytics: any ShopAnalytics = FirebaseShopAnalytics()) {
        self.repository = repository
        self.analytics = analytics
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            orders = try await repository.orders()
            if !hasTrackedView {
                hasTrackedView = true
                await analytics.track(.orderListViewed(orderCount: orders.count))
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct ShopOrdersView: View {
    @State private var model: ShopOrdersViewModel

    init(repository: any ShopOrderRepository = SupabaseShopOrderRepository(),
         analytics: any ShopAnalytics = FirebaseShopAnalytics()) {
        _model = State(initialValue: ShopOrdersViewModel(repository: repository, analytics: analytics))
    }

    var body: some View {
        Group {
            if model.isLoading && model.orders.isEmpty {
                TLLoadingView(rows: 5).padding(TLSpacing.lg)
            } else if model.orders.isEmpty {
                TLEmptyState(icon: "shippingbox", title: "Chưa có đơn mua", subtitle: "Đơn đã đặt sẽ xuất hiện tại đây.")
            } else {
                List(model.orders) { order in
                    NavigationLink(value: ShopRoute.order(order.code)) {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(order.code).font(TLType.dataMono(12))
                                Spacer()
                                Text(ShopMoney.vnd(order.totalVND)).font(TLType.dataMono(12))
                            }
                            Text(order.shop.name).font(TLType.titleSans(14))
                            Text(order.status.message).font(TLType.bodySans(11)).foregroundStyle(TLColor.fg3)
                        }
                        .padding(.vertical, 6)
                    }
                }
                .scrollContentBackground(.hidden)
            }
        }
        .background(TLColor.bg)
        .navigationTitle("Đơn mua")
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.load() }
        .refreshable { await model.load() }
        .alert("Chưa tải được đơn", isPresented: Binding(
            get: { model.errorMessage != nil },
            set: { if !$0 { model.errorMessage = nil } }
        )) { Button("Thử lại") { Task { await model.load() } } }
        message: { Text(model.errorMessage ?? "") }
    }
}

@MainActor @Observable
final class ShopOrderDetailViewModel {
    let code: String
    let repository: any ShopOrderRepository
    let analytics: any ShopAnalytics
    var order: ShopOrderDetail?
    var payment: ShopOrderPaymentInfo?
    var isLoading = true
    var isWorking = false
    var errorMessage: String?

    init(code: String, repository: any ShopOrderRepository = SupabaseShopOrderRepository(),
         analytics: any ShopAnalytics = FirebaseShopAnalytics()) {
        self.code = code
        self.repository = repository
        self.analytics = analytics
    }

    func load() async {
        isLoading = true; defer { isLoading = false }
        do {
            order = try await repository.order(code: code)
            if order?.paymentMethod == .bankTransfer { payment = try await repository.paymentInfo(code: code) }
        } catch { errorMessage = error.localizedDescription }
    }

    func claimPayment() async {
        isWorking = true; defer { isWorking = false }
        do {
            payment = try await repository.claimPayment(code: code)
            await analytics.track(.paymentClaimed)
        }
        catch { errorMessage = error.localizedDescription }
    }
}

struct ShopOrderDetailView: View {
    @State private var model: ShopOrderDetailViewModel
    init(code: String, repository: any ShopOrderRepository = SupabaseShopOrderRepository(),
         analytics: any ShopAnalytics = FirebaseShopAnalytics()) {
        _model = State(initialValue: ShopOrderDetailViewModel(
            code: code, repository: repository, analytics: analytics
        ))
    }

    var body: some View {
        Group {
            if model.isLoading { TLLoadingView(rows: 6).padding(TLSpacing.lg) }
            else if let order = model.order { content(order) }
            else { TLEmptyState(icon: "shippingbox", title: "Không tìm thấy đơn", subtitle: "Đơn không tồn tại hoặc không thuộc tài khoản này.") }
        }
        .background(TLColor.bg).navigationTitle(model.code).navigationBarTitleDisplayMode(.inline)
        .task { await model.load() }
        .alert("Chưa thể cập nhật", isPresented: Binding(get: { model.errorMessage != nil }, set: { if !$0 { model.errorMessage = nil } })) {
            Button("Đóng", role: .cancel) { model.errorMessage = nil }
        } message: { Text(model.errorMessage ?? "") }
    }

    private func content(_ order: ShopOrderDetail) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TLSpacing.lg) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(order.status.message).font(TLType.titleSans(20))
                    Text("Mã đơn \(order.code) · \(order.shop.name)").font(TLType.bodySans(11)).foregroundStyle(TLColor.fg3)
                }
                card {
                    Text("Giao đến").font(TLType.titleSans(15))
                    Text(order.recipientName + " · " + order.recipientPhone).font(TLType.bodySans(12))
                    Text(order.shippingAddress).font(TLType.bodySans(12)).foregroundStyle(TLColor.fg2)
                }
                card {
                    Text("Sản phẩm").font(TLType.titleSans(15))
                    ForEach(order.items) { item in
                        HStack(alignment: .top) {
                            VStack(alignment: .leading) { Text(item.productTitle); if let label = item.variantLabel { Text(label).font(TLType.bodySans(10)).foregroundStyle(TLColor.fg3) } }
                            Spacer(); Text("×\(item.quantity)"); Text(ShopMoney.vnd(item.lineTotalVND)).font(TLType.dataMono(11))
                        }.font(TLType.bodySans(12))
                    }
                    Divider()
                    moneyRow("Tiền hàng", order.itemsTotalVND)
                    moneyRow("Phí vận chuyển", order.shippingFeeVND)
                    moneyRow("Tổng cộng", order.totalVND, bold: true)
                }
                if let payment = model.payment { paymentCard(payment, cancelled: order.status == .cancelled) }
            }
            .padding(TLSpacing.lg)
        }
    }

    private func paymentCard(_ info: ShopOrderPaymentInfo, cancelled: Bool) -> some View {
        card {
            Text("Thanh toán chuyển khoản").font(TLType.titleSans(15))
            if info.confirmedAt != nil {
                Label("Shop đã xác nhận nhận được tiền", systemImage: "checkmark.circle.fill").foregroundStyle(TLColor.accentText)
            } else if cancelled {
                Text("Đơn đã huỷ; không chuyển khoản cho đơn này.").foregroundStyle(ShopTokens.unavailable)
            } else {
                if let bank = info.bank, let amount = info.amountVND, let memo = info.memo {
                    if let url = VietQR.imageURL(bankCode: bank.code, accountNumber: bank.accountNumber,
                                                  accountName: bank.accountName, amountVnd: amount, memo: memo) {
                        AsyncImage(url: url) { image in image.resizable().scaledToFit() } placeholder: { ProgressView() }
                            .frame(maxWidth: 240).frame(maxWidth: .infinity).accessibilityLabel("Mã VietQR thanh toán")
                    }
                    copyRow("Số tiền", ShopMoney.vnd(amount)); copyRow("Ngân hàng", bank.code)
                    copyRow("Số tài khoản", bank.accountNumber); copyRow("Chủ tài khoản", bank.accountName)
                    copyRow("Nội dung", memo)
                    Text("Nội dung chuyển khoản phải đúng mã đơn để shop đối soát thủ công.").font(TLType.bodySans(10)).foregroundStyle(TLColor.fg3)
                } else {
                    Text("Shop chưa cung cấp tài khoản nhận tiền. Anh/chị chưa nên chuyển khoản và hãy liên hệ shop.")
                        .font(TLType.bodySans(11)).foregroundStyle(TLColor.fg3)
                }
                if info.claimedAt != nil {
                    Label("Anh/chị đã báo chuyển khoản; đang chờ shop đối soát.", systemImage: "clock")
                        .font(TLType.bodySans(11)).foregroundStyle(TLColor.fg2)
                } else if info.bank != nil {
                    Button(model.isWorking ? "Đang gửi…" : "Tôi đã chuyển khoản") { Task { await model.claimPayment() } }
                        .font(TLType.titleSans(13)).foregroundStyle(TLColor.accentInk)
                        .frame(maxWidth: .infinity, minHeight: 48).background(TLColor.accent, in: Capsule())
                        .disabled(model.isWorking)
                }
            }
        }
    }

    private func card<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: TLSpacing.md, content: content)
            .frame(maxWidth: .infinity, alignment: .leading).padding(TLSpacing.lg)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.lg).strokeBorder(TLColor.border))
    }
    private func moneyRow(_ label: String, _ amount: Int, bold: Bool = false) -> some View {
        HStack { Text(label); Spacer(); Text(ShopMoney.vnd(amount)) }.font(bold ? TLType.titleSans(13) : TLType.bodySans(12))
    }
    private func copyRow(_ label: String, _ value: String) -> some View {
        HStack { Text(label).foregroundStyle(TLColor.fg3); Spacer(); Text(value).font(TLType.dataMono(11)); Button { UIPasteboard.general.string = value } label: { Image(systemName: "doc.on.doc") }.accessibilityLabel("Sao chép \(label)") }
            .font(TLType.bodySans(11))
    }
}
