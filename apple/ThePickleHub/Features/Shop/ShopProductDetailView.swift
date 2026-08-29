// Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4
// Hallmark · macrostructure: Product Decision Sheet · genre: commerce-utilitarian
import SwiftUI

struct ShopProductDetailView: View {
    let productSlug: String
    let repository: any ShopRepository
    let cartRepository: any ShopCartRepository
    let analytics: any ShopAnalytics
    @State private var product: ShopProduct?
    @State private var variantSelection = ShopVariantSelection()
    @State private var selectedMediaIndex = 0
    @State private var showsVariants = false
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var quantity = 1
    @State private var isAddingToCart = false
    @State private var cartMessage: String?
    @State private var showsLogin = false
    @Environment(SessionStore.self) private var session
    @Environment(\.openURL) private var openURL

    init(productSlug: String, repository: any ShopRepository = ShopRepositoryFactory.appRepository(),
         cartRepository: any ShopCartRepository = SupabaseShopCartRepository(),
         analytics: any ShopAnalytics = FirebaseShopAnalytics()) {
        self.productSlug = productSlug
        self.repository = repository
        self.cartRepository = cartRepository
        self.analytics = analytics
        _showsVariants = State(initialValue: UserDefaults.standard.bool(forKey: "startShopVariant"))
    }

    var body: some View {
        Group {
            if isLoading {
                TLLoadingView(rows: 5).padding(TLSpacing.lg)
            } else if let errorMessage {
                TLErrorState(message: errorMessage) { Task { await load() } }
            } else if let product {
                content(product)
            } else {
                TLEmptyState(
                    icon: "shippingbox",
                    title: "Sản phẩm không còn hiển thị",
                    subtitle: "Sản phẩm có thể đã được gỡ hoặc chưa được duyệt."
                )
            }
        }
        .background(TLColor.bg)
        .navigationTitle("Chi tiết")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .sheet(isPresented: $showsVariants) {
            if let product {
                ShopVariantSheet(product: product, selection: $variantSelection)
            }
        }
        .sheet(isPresented: $showsLogin) { LoginView() }
        .toolbar {
            // The screen where things get added had no way back to the cart.
            ToolbarItem(placement: .topBarTrailing) { ShopCartToolbarButton() }
        }
        .alert("Giỏ hàng", isPresented: Binding(get: { cartMessage != nil }, set: { if !$0 { cartMessage = nil } })) {
            Button("Đóng", role: .cancel) { cartMessage = nil }
        } message: { Text(cartMessage ?? "") }
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        do {
            product = try await repository.product(slug: productSlug)
            if let product { await analytics.track(.productViewed(productID: product.id)) }
        }
        catch { errorMessage = error.localizedDescription }
        isLoading = false
    }

    private func content(_ product: ShopProduct) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: TLSpacing.xl) {
                artwork(product)
                identity(product)
                seller(product.seller)
                variantSummary(product)
                trustSummary(product.seller)
                specifications(product)
                description(product)
            }
            .padding(.horizontal, TLSpacing.lg)
            .padding(.bottom, 116)
        }
        .safeAreaInset(edge: .bottom) { purchaseBar(product) }
    }

    private func artwork(_ product: ShopProduct) -> some View {
        let safeIndex = min(max(selectedMediaIndex, 0), max(product.media.count - 1, 0))
        return VStack(spacing: TLSpacing.sm) {
            TabView(selection: $selectedMediaIndex) {
                if product.media.isEmpty {
                    artworkPage(product: product, media: nil, index: 0)
                        .tag(0)
                } else {
                    ForEach(Array(product.media.enumerated()), id: \.element.id) { index, media in
                        artworkPage(product: product, media: media, index: index)
                            .tag(index)
                    }
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .frame(height: 330)
            .clipShape(RoundedRectangle(cornerRadius: TLRadius.xl, style: .continuous))

            if !product.media.isEmpty {
                HStack(spacing: 7) {
                    ForEach(product.media.indices, id: \.self) { index in
                        Button { withAnimation { selectedMediaIndex = index } } label: {
                            Capsule().fill(index == safeIndex ? TLColor.accentText : TLColor.border2)
                                .frame(width: index == safeIndex ? 22 : 8, height: 7)
                                .frame(minWidth: 24, minHeight: 28)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Ảnh \(index + 1) trên \(product.media.count)")
                        .accessibilityAddTraits(index == safeIndex ? .isSelected : [])
                    }
                    Spacer(minLength: TLSpacing.sm)
                    Text("\(safeIndex + 1)/\(product.media.count)")
                        .font(TLType.dataMono(10)).foregroundStyle(TLColor.fg3)
                }
            }
        }
        .onChange(of: variantSelection.selectedVariant(in: product)?.id) { _, _ in
            let selectedVariant = variantSelection.selectedVariant(in: product)
            let variantIndex = product.mediaIndex(for: selectedVariant)
            if product.media.indices.contains(variantIndex) {
                withAnimation { selectedMediaIndex = variantIndex }
            }
            if let selectedVariant {
                Task { await analytics.track(.variantSelected(productID: product.id, variantID: selectedVariant.id)) }
            }
        }
    }

    private func artworkPage(product: ShopProduct, media: ShopProductMedia?, index: Int) -> some View {
        ZStack {
            TLColor.surface2
            Circle().fill(TLColor.accent.opacity(0.10 + Double(index) * 0.04)).padding(54)
            Image(systemName: product.category.symbol)
                .font(.system(size: 96, weight: .ultraLight))
                .foregroundStyle(TLColor.fg2)
                .rotationEffect(.degrees(Double(index) * -6))
            ShopRemoteImage(url: media?.publicURL, contentMode: .fill) { Color.clear }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(media?.label ?? product.title)
        .accessibilityValue(product.media.isEmpty ? "Không có ảnh" : "Ảnh \(index + 1) trên \(product.media.count)")
    }

    private func identity(_ product: ShopProduct) -> some View {
        VStack(alignment: .leading, spacing: TLSpacing.sm) {
            Text(product.condition.title.uppercased())
                .font(TLType.eyebrowMono(9)).tracking(1).foregroundStyle(TLColor.accentText)
            Text(product.title)
                .font(TLType.titleSans(25)).foregroundStyle(TLColor.fg)
            ShopPriceText(product: product, size: 20)
            Text("Tạm tính sản phẩm, chưa gồm phí vận chuyển")
                .font(TLType.bodySans(11)).foregroundStyle(TLColor.fg3)
        }
    }

    private func seller(_ seller: ShopSeller) -> some View {
        NavigationLink(value: ShopRoute.store(seller.id)) {
            HStack(spacing: TLSpacing.md) {
                Text(initials(seller.name))
                    .font(TLType.dataMono()).foregroundStyle(TLColor.accentInk)
                    .frame(width: 44, height: 44).background(TLColor.accent, in: Circle())
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 4) {
                        Text(seller.name).font(TLType.titleSans(14))
                        if seller.isVerified { ShopVerificationBadge() }
                    }
                    Text(seller.city).font(TLType.bodySans(11)).foregroundStyle(TLColor.fg3)
                }
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(TLColor.fg4)
            }
            .foregroundStyle(TLColor.fg)
            .padding(TLSpacing.lg)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func variantSummary(_ product: ShopProduct) -> some View {
        Button { showsVariants = true } label: {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("PHIÊN BẢN").font(TLType.eyebrowMono(9)).foregroundStyle(TLColor.fg3)
                    Text(variantSelection.label(for: product)).font(TLType.titleSans(14)).foregroundStyle(TLColor.fg)
                }
                Spacer()
                Text("Chọn").font(TLType.titleSans(12)).foregroundStyle(TLColor.accentText)
                Image(systemName: "chevron.right").foregroundStyle(TLColor.fg4)
            }
            .padding(TLSpacing.lg)
            .overlay(RoundedRectangle(cornerRadius: TLRadius.lg).strokeBorder(TLColor.border))
        }
        .buttonStyle(.plain)
    }

    private func trustSummary(_ seller: ShopSeller) -> some View {
        VStack(spacing: 0) {
            trustRow("shippingbox", "Vận chuyển", seller.shippingNote)
            Divider()
            trustRow("arrow.uturn.backward", "Đổi trả", seller.returnPolicy ?? "Người bán chưa công bố chính sách đổi trả.")
        }
        .padding(.horizontal, TLSpacing.lg)
        .background(TLColor.surface2, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
    }

    private func trustRow(_ icon: String, _ title: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: TLSpacing.md) {
            Image(systemName: icon).foregroundStyle(TLColor.accentText).frame(width: 22)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(TLType.titleSans(13))
                Text(text).font(TLType.bodySans(11)).foregroundStyle(TLColor.fg3)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, TLSpacing.md)
    }

    private func specifications(_ product: ShopProduct) -> some View {
        let rows = ShopProductSpecs.rows(category: product.category, attributes: product.attributes)
        return VStack(alignment: .leading, spacing: TLSpacing.md) {
            if !rows.isEmpty {
                Text("Thông số").font(TLType.titleSans(20))
            }
            ForEach(rows) { row in
                HStack { Text(row.label).foregroundStyle(TLColor.fg3); Spacer(); Text(row.value) }
                    .font(TLType.bodySans(12)).padding(.vertical, 6)
                Divider()
            }
        }
    }

    private func description(_ product: ShopProduct) -> some View {
        VStack(alignment: .leading, spacing: TLSpacing.sm) {
            Text("Mô tả").font(TLType.titleSans(20))
            Text(product.description).font(TLType.bodySans(13)).foregroundStyle(TLColor.fg2)
            Text("Thông tin sản phẩm và thông số do người bán cung cấp.")
                .font(TLType.bodySans(11)).foregroundStyle(TLColor.fg4)
        }
    }

    private func purchaseBar(_ product: ShopProduct) -> some View {
        let variant = variantSelection.selectedVariant(in: product)
        let needsSelection = variant == nil && !product.optionOrder.isEmpty
        return VStack(spacing: TLSpacing.sm) {
            if let variant, !needsSelection {
                ShopQuantityControl(quantity: $quantity, maximum: min(10, variant.stockOnHand ?? 10))
            }
            ShopStickyCommerceBar(
                product: product,
                variant: variant,
                selectionLabel: variantSelection.label(for: product),
                actionTitle: needsSelection ? "Chọn phiên bản" : (isAddingToCart ? "Đang thêm…" : "Thêm vào giỏ"),
                isDisabled: isAddingToCart || (!needsSelection && variant?.isAvailable != true)
            ) {
                if needsSelection { showsVariants = true }
                else if let variant { Task { await addToCart(variant, product: product) } }
            }
        }
    }

    @MainActor private func addToCart(_ variant: ShopVariant, product: ShopProduct) async {
        guard case .signedIn = session.state else { showsLogin = true; return }
        isAddingToCart = true
        defer { isAddingToCart = false }
        do {
            try await cartRepository.add(variantID: variant.id, quantity: quantity)
            await analytics.track(.cartAddSucceeded(productID: product.id, variantID: variant.id, quantity: quantity))
            // Move the badge immediately, then reconcile against the server so a
            // partially-applied add cannot leave the count permanently wrong.
            ShopCartBadge.shared.add(quantity)
            await ShopCartBadge.shared.refresh(using: cartRepository)
            cartMessage = "Đã thêm \(quantity) sản phẩm vào giỏ."
        } catch {
            cartMessage = error.localizedDescription
        }
    }

    private func price(_ product: ShopProduct) -> String {
        product.hasPriceRange ? "\(ShopMoney.vnd(product.minimumPriceVND)) – \(ShopMoney.vnd(product.maximumPriceVND))" : ShopMoney.vnd(product.minimumPriceVND)
    }
    private func initials(_ name: String) -> String { name.split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined() }
}

struct ShopVariantSheet: View {
    let product: ShopProduct
    @Binding var selection: ShopVariantSelection
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: TLSpacing.xl) {
                    HStack(spacing: TLSpacing.md) {
                        Image(systemName: product.category.symbol).font(.system(size: 34)).frame(width: 72, height: 72)
                            .background(TLColor.surface2, in: RoundedRectangle(cornerRadius: TLRadius.lg))
                        VStack(alignment: .leading, spacing: 3) {
                            Text(product.title).font(TLType.titleSans(14)).lineLimit(2)
                            Text(currentPrice).font(TLType.dataMono(13))
                            Text(product.seller.name).font(TLType.bodySans(10)).foregroundStyle(TLColor.fg3)
                        }
                    }
                    ForEach(product.optionOrder, id: \.self) { option in optionGroup(option) }
                }
                .padding(TLSpacing.lg)
            }
            .navigationTitle("Chọn phiên bản")
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .bottom) {
                Button(helperText) { if validVariant != nil { dismiss() } }
                    .font(TLType.titleSans(14)).foregroundStyle(TLColor.accentInk)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(validVariant == nil ? TLColor.border2 : TLColor.accent, in: Capsule())
                    .disabled(validVariant == nil)
                    .padding(TLSpacing.lg).background(.ultraThinMaterial)
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func optionGroup(_ option: String) -> some View {
        ShopVariantOptionGroup(
            option: option,
            values: allValues(option),
            selectedValue: Binding(
                get: { selection.values[option] },
                set: { value in
                    if let value { selection.select(value, for: option, in: product) }
                }
            ),
            isAvailable: { isValueAvailable($0, for: option) }
        )
    }

    private var validVariant: ShopVariant? { selection.availableVariant(in: product) }
    private var currentPrice: String { validVariant.map { ShopMoney.vnd($0.priceVND) } ?? ShopMoney.vnd(product.minimumPriceVND) }
    private var helperText: String {
        guard let variant = selection.selectedVariant(in: product) else { return "Chọn đủ phiên bản" }
        return variant.isAvailable ? "Xác nhận" : "Phiên bản đã hết hàng"
    }

    private func allValues(_ option: String) -> [String] {
        product.variants.compactMap { $0.optionValues[option] }.reduce(into: [String]()) {
            if !$0.contains($1) { $0.append($1) }
        }
    }

    private func isValueAvailable(_ value: String, for option: String) -> Bool {
        let other = selection.values.filter { $0.key != option }
        return product.variants.contains { variant in
            variant.optionValues[option] == value && variant.isAvailable
                && other.allSatisfy { variant.optionValues[$0.key] == $0.value }
        }
    }
}
