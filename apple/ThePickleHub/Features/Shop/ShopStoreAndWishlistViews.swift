import SwiftUI

struct ShopStoreView: View {
    let storeSlug: String
    let repository: any ShopRepository
    let analytics: any ShopAnalytics
    @State private var store: ShopStorefront?
    @State private var products: [ShopProductCardSummary] = []
    @State private var loaded = false
    @State private var errorMessage: String?
    @State private var hasMore = false
    @State private var cursorAt: Date?
    @State private var cursorID: UUID?
    @State private var isLoadingMore = false
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    init(storeSlug: String, repository: any ShopRepository = ShopRepositoryFactory.appRepository(),
         analytics: any ShopAnalytics = FirebaseShopAnalytics()) {
        self.storeSlug = storeSlug
        self.repository = repository
        self.analytics = analytics
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: TLSpacing.xl) {
                if let store {
                    header(store)
                    Text("Sản phẩm").font(TLType.titleSans(20))
                    if products.isEmpty && loaded {
                        TLEmptyState(icon: "shippingbox", title: "Shop chưa có sản phẩm", subtitle: "Sản phẩm được duyệt sẽ xuất hiện tại đây.")
                    } else {
                        LazyVGrid(columns: productColumns, spacing: TLSpacing.md) {
                            ForEach(products) { product in
                                NavigationLink(value: ShopRoute.product(product.slug)) {
                                    ShopProductCard(product: product)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        if hasMore {
                            ProgressView().tint(TLColor.accentText).frame(maxWidth: .infinity)
                                .task { await loadMore() }
                        }
                    }
                    policy(store)
                } else if let errorMessage {
                    TLErrorState(message: errorMessage) { Task { await load() } }
                } else if loaded {
                    TLEmptyState(icon: "storefront", title: "Shop không khả dụng", subtitle: "Shop có thể đang tạm ngưng hoặc không còn công khai.")
                } else {
                    TLLoadingView(rows: 4)
                }
            }
            .padding(TLSpacing.lg).padding(.bottom, 44)
        }
        .background(TLColor.bg).navigationTitle("Cửa hàng").navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async {
        loaded = false
        errorMessage = nil
        do {
            async let loadedStore = repository.store(slug: storeSlug)
            async let loadedProducts = repository.productPage(
                ShopPublicSearchRequest(shopSlug: storeSlug, limit: 24)
            )
            store = try await loadedStore
            if store != nil { await analytics.track(.storeViewed(storeSlug: storeSlug)) }
            let page = try await loadedProducts
            products = page.products
            hasMore = page.hasMore
            cursorAt = page.nextCursorAt
            cursorID = page.nextCursorID
        } catch { errorMessage = error.localizedDescription }
        loaded = true
    }

    private func loadMore() async {
        guard hasMore, !isLoadingMore, let cursorAt, let cursorID else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        do {
            let page = try await repository.productPage(ShopPublicSearchRequest(
                shopSlug: storeSlug, cursorAt: cursorAt, cursorID: cursorID, limit: 24
            ))
            products += page.products.filter { item in !products.contains(where: { $0.id == item.id }) }
            hasMore = page.hasMore
            self.cursorAt = page.nextCursorAt
            self.cursorID = page.nextCursorID
        } catch { }
    }

    private func header(_ store: ShopStorefront) -> some View {
        VStack(alignment: .leading, spacing: TLSpacing.md) {
            HStack(spacing: TLSpacing.md) {
                Text(initials(store.name)).font(TLType.dataMono(18)).foregroundStyle(TLColor.accentInk)
                    .frame(width: 70, height: 70).background(TLColor.accent, in: Circle())
                VStack(alignment: .leading, spacing: 5) {
                    HStack { Text(store.name).font(TLType.titleSans(20)); if store.isVerified { ShopVerificationBadge() } }
                    Label(store.region ?? "Khu vực chưa công bố", systemImage: "mappin.and.ellipse")
                        .font(TLType.bodySans(11)).foregroundStyle(TLColor.fg3)
                }
            }
            if let intro = store.intro, !intro.isEmpty {
                Text(intro).font(TLType.bodySans(12)).foregroundStyle(TLColor.fg2)
            }
            contactSection(store)
        }
    }

    @ViewBuilder
    private func contactSection(_ store: ShopStorefront) -> some View {
        if store.contacts.isEmpty {
            Label("Shop chưa công bố kênh liên hệ", systemImage: "phone.down")
                .font(TLType.titleSans(13))
                .foregroundStyle(TLColor.fg3)
                .frame(maxWidth: .infinity, minHeight: 50)
                .background(TLColor.surface2, in: Capsule())
                .accessibilityHint("Chỉ kênh liên hệ đã được duyệt mới được hiển thị")
        } else {
            ForEach(store.contacts) { contact in
                Link(destination: contact.href) {
                    Label(contact.label ?? "Liên hệ shop", systemImage: "arrow.up.right")
                        .frame(maxWidth: .infinity, minHeight: 50)
                }
                .buttonStyle(.borderedProminent)
                .tint(TLColor.accent)
                .foregroundStyle(TLColor.accentInk)
            }
        }
    }

    private func policy(_ store: ShopStorefront) -> some View {
        VStack(alignment: .leading, spacing: TLSpacing.sm) {
            Label("Thông tin shop", systemImage: "checkmark.shield").font(TLType.titleSans(16))
            Text(store.shippingNote ?? "Shop chưa công bố thông tin giao hàng.").font(TLType.bodySans(12)).foregroundStyle(TLColor.fg2)
            Text(store.returnPolicy ?? "Shop chưa công bố chính sách đổi trả.").font(TLType.bodySans(12)).foregroundStyle(TLColor.fg3)
            Text("Huy hiệu xác minh xác nhận trạng thái hồ sơ; không bảo đảm chất lượng từng sản phẩm.")
                .font(TLType.bodySans(10)).foregroundStyle(TLColor.fg4)
        }
        .padding(TLSpacing.lg).background(TLColor.surface2, in: RoundedRectangle(cornerRadius: TLRadius.lg))
    }

    private var productColumns: [GridItem] {
        let count = dynamicTypeSize.isAccessibilitySize ? 1 : 2
        return Array(repeating: GridItem(.flexible(minimum: 0), spacing: TLSpacing.md), count: count)
    }

    private func initials(_ name: String) -> String { name.split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined() }
}

enum ShopWishlistPresentationState: Equatable, Sendable {
    case loading
    case empty
    case loaded([ShopProductCardSummary])
    case unavailable
}

struct ShopWishlistView: View {
    /// Normal app navigation remains honest until C2 supplies authenticated,
    /// RLS-protected persistence. Fixture rows must be injected explicitly by
    /// a review/test caller; they are never selected from production defaults.
    let state: ShopWishlistPresentationState

    init(state: ShopWishlistPresentationState = .unavailable) {
        self.state = state
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: TLSpacing.lg) {
                Text("Đã lưu").font(TLType.titleSans(26))
                switch state {
                case .loading:
                    TLLoadingView(rows: 3)
                case .empty:
                    TLEmptyState(icon: "heart", title: "Chưa lưu sản phẩm", subtitle: "Nhấn biểu tượng trái tim để xem lại sản phẩm tại đây.")
                case .loaded(let products):
                    ForEach(products) { product in
                        HStack(spacing: TLSpacing.md) {
                            NavigationLink(value: ShopRoute.product(product.slug)) {
                                ShopProductSummaryRow(product: product, mediaSize: 86, showsChevron: false)
                            }
                            .buttonStyle(.plain)
                            Spacer()
                            Image(systemName: "heart.fill")
                                .foregroundStyle(ShopTokens.verified)
                                .frame(
                                    minWidth: ShopTokens.minimumTouchTarget,
                                    minHeight: ShopTokens.minimumTouchTarget
                                )
                                .accessibilityLabel("Đã lưu \(product.title)")
                        }
                    }
                case .unavailable:
                    TLEmptyState(
                        icon: "heart.slash",
                        title: "Danh sách đã lưu chưa khả dụng",
                        subtitle: "Tính năng đồng bộ sẽ được mở sau khi hoàn tất bảo vệ tài khoản."
                    )
                }
            }
            .padding(TLSpacing.lg).padding(.bottom, 44)
        }
        .background(TLColor.bg).navigationTitle("Đã lưu").navigationBarTitleDisplayMode(.inline)
    }
}
