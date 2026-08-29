// Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
// Hallmark · macrostructure: Card-First Catalogue · genre: commerce-utilitarian
import Observation
import SwiftUI

@MainActor @Observable
final class ShopHomeViewModel {
    enum Phase: Equatable {
        case loading
        case loaded
        case failed(String)
    }

    let repository: any ShopRepository
    let analytics: any ShopAnalytics
    var phase: Phase = .loading
    var categories: [ShopCategory] = []
    var products: [ShopProductCardSummary] = []

    private var hasTrackedView = false

    init(repository: any ShopRepository = ShopRepositoryFactory.appRepository(),
         analytics: any ShopAnalytics = FirebaseShopAnalytics()) {
        self.repository = repository
        self.analytics = analytics
    }

    func load() async {
        if !hasTrackedView {
            hasTrackedView = true
            await analytics.track(.homeViewed)
        }
        phase = .loading
        do {
            async let categories = repository.categories()
            async let products = repository.featuredProducts()
            self.categories = try await categories
            self.products = try await products
            phase = .loaded
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }
}

struct ShopHomeView: View {
    @State private var model: ShopHomeViewModel
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    init(repository: any ShopRepository = ShopRepositoryFactory.appRepository(),
         analytics: any ShopAnalytics = FirebaseShopAnalytics()) {
        _model = State(initialValue: ShopHomeViewModel(repository: repository, analytics: analytics))
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: TLSpacing.lg) {
                introduction
                searchEntry
                categories
                catalogue
            }
            .padding(.horizontal, TLSpacing.lg)
            .padding(.top, TLSpacing.sm)
            .padding(.bottom, 44)
        }
        .background(TLColor.bg)
        .navigationTitle("Chợ đồ pickleball")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: ShopRoute.self) { route in
            switch route {
            case .search:
                ShopSearchView(repository: model.repository)
            case .category(let category):
                ShopSearchView(initialCategory: category, repository: model.repository)
            case .product(let productSlug):
                ShopProductDetailView(productSlug: productSlug, repository: model.repository)
            case .store(let storeSlug):
                ShopStoreView(storeSlug: storeSlug, repository: model.repository)
            case .wishlist:
                AuthenticationRequiredView { ShopWishlistView() }
            case .cart:
                AuthenticationRequiredView { ShopCartView() }
            case .checkout(let shopSlug):
                AuthenticationRequiredView { ShopCheckoutView(shopSlug: shopSlug) }
            case .order(let code):
                AuthenticationRequiredView { ShopOrderDetailView(code: code) }
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) { ShopCartToolbarButton() }
        }
        .task { await model.load() }
        .refreshable { await model.load() }
    }

    private var introduction: some View {
        VStack(alignment: .leading, spacing: TLSpacing.sm) {
            Text("Chợ đồ pickleball")
                .font(TLType.titleSans(26))
                .foregroundStyle(TLColor.fg)
            Text("Vợt, giày, bóng và phụ kiện từ những shop được ThePickleHub duyệt hồ sơ và kiểm duyệt từng sản phẩm.")
                .font(TLType.bodySans(13))
                .foregroundStyle(TLColor.fg3)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var searchEntry: some View {
        NavigationLink(value: ShopRoute.search) {
            HStack(spacing: TLSpacing.sm) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(TLColor.accentText)
                Text("Tìm vợt, giày, bóng…")
                    .font(TLType.bodySans())
                    .foregroundStyle(TLColor.fg3)
                Spacer(minLength: 0)
                Text("Tìm")
                    .font(TLType.titleSans(12))
                    .foregroundStyle(TLColor.accentInk)
                    .padding(.horizontal, TLSpacing.md)
                    .frame(minHeight: 36)
                    .background(TLColor.accent, in: Capsule())
            }
            .padding(.horizontal, TLSpacing.md)
            .frame(minHeight: 52)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.lg).strokeBorder(TLColor.border))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Tìm sản phẩm trong Shop")
    }

    @ViewBuilder private var categories: some View {
        if model.phase == .loading && model.categories.isEmpty {
            HStack(spacing: TLSpacing.sm) {
                ForEach(0..<3, id: \.self) { _ in
                    Capsule().fill(TLColor.surface2).frame(width: 88, height: 44)
                }
            }
            .accessibilityLabel("Đang tải danh mục")
        } else {
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: TLSpacing.sm) {
                    ForEach(model.categories) { category in
                        NavigationLink(value: ShopRoute.category(category)) {
                            Label(category.title, systemImage: category.symbol)
                                .font(TLType.bodySans(12))
                                .foregroundStyle(TLColor.fg2)
                                .lineLimit(1)
                                .padding(.horizontal, TLSpacing.md)
                                .frame(minHeight: 44)
                                .background(TLColor.surface2, in: Capsule())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Danh mục \(category.title)")
                    }
                }
            }
        }
    }

    @ViewBuilder private var catalogue: some View {
        VStack(alignment: .leading, spacing: TLSpacing.md) {
            Text("Mới đăng")
                .font(TLType.titleSans(20))
                .foregroundStyle(TLColor.fg)

            switch model.phase {
            case .loading:
                ShopCardGridSkeleton()
            case .failed(let message):
                TLErrorState(message: message) { Task { await model.load() } }
            case .loaded where model.products.isEmpty:
                TLEmptyState(
                    icon: "shippingbox",
                    title: "Chưa có sản phẩm nào đang bán",
                    subtitle: "Shop đang thử nghiệm với những người bán đầu tiên. Anh/chị quay lại sau nhé."
                )
            case .loaded:
                LazyVGrid(columns: columns, spacing: TLSpacing.md) {
                    ForEach(model.products) { product in
                        NavigationLink(value: ShopRoute.product(product.slug)) {
                            ShopProductCard(product: product)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var columns: [GridItem] {
        let count = dynamicTypeSize.isAccessibilitySize ? 1 : 2
        return Array(repeating: GridItem(.flexible(minimum: 0), spacing: TLSpacing.md), count: count)
    }
}

struct ShopProductCard: View {
    let product: ShopProductCardSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ShopProductArtwork(product: product)
                .aspectRatio(1, contentMode: .fit)
                .overlay(alignment: .topLeading) {
                    if product.availability == .outOfStock {
                        Text("Hết hàng")
                            .font(TLType.eyebrowMono(9))
                            .foregroundStyle(TLColor.bg)
                            .padding(.horizontal, TLSpacing.sm)
                            .frame(minHeight: 28)
                            .background(ShopTokens.unavailable, in: Capsule())
                            .padding(TLSpacing.sm)
                    }
                }

            VStack(alignment: .leading, spacing: TLSpacing.sm) {
                Text(product.title)
                    .font(TLType.titleSans(15))
                    .foregroundStyle(TLColor.fg)
                    .lineLimit(2, reservesSpace: true)

                HStack(spacing: 4) {
                    if product.condition == .used { Text("Đã qua sử dụng ·") }
                    Text(product.seller.name).lineLimit(1)
                    if product.seller.isVerified {
                        ShopVerificationBadge().font(.system(size: 11))
                    }
                }
                .font(TLType.bodySans(10))
                .foregroundStyle(TLColor.fg3)

                HStack(alignment: .center, spacing: TLSpacing.sm) {
                    ShopCardPriceText(product: product, showsFromPrefix: true, size: 12)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                    Spacer(minLength: 0)
                    Image(systemName: "arrow.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(TLColor.fg)
                        .frame(width: 34, height: 34)
                        .background(TLColor.surface2, in: Circle())
                        .accessibilityHidden(true)
                }
            }
            .padding(TLSpacing.md)
        }
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20).strokeBorder(TLColor.border, lineWidth: 1))
        .accessibilityElement(children: .combine)
    }
}

private struct ShopProductArtwork: View {
    let product: ShopProductCardSummary

    var body: some View {
        ZStack {
            TLColor.surface2
            Image(systemName: product.category.symbol)
                .font(.system(size: 48, weight: .light))
                .foregroundStyle(TLColor.fg3)
            ShopRemoteImage(url: product.coverURL, contentMode: .fill) { Color.clear }
        }
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .accessibilityLabel(product.coverLabel)
    }
}

struct ShopCardPriceText: View {
    let product: ShopProductCardSummary
    var showsFromPrefix = false
    var size: CGFloat = 12

    var body: some View {
        Text(label)
            .font(TLType.dataMono(size))
            .fontWeight(.bold)
            .foregroundStyle(TLColor.fg)
    }

    var label: String {
        guard let minimum = product.priceMinVND else { return "Chưa có giá" }
        guard product.hasPriceRange, let maximum = product.priceMaxVND else { return ShopMoney.vnd(minimum) }
        return showsFromPrefix ? "Từ \(ShopMoney.vnd(minimum))" : "\(ShopMoney.vnd(minimum)) – \(ShopMoney.vnd(maximum))"
    }
}

private struct ShopCardGridSkeleton: View {
    var body: some View {
        HStack(alignment: .top, spacing: TLSpacing.md) {
            ForEach(0..<2, id: \.self) { _ in
                VStack(alignment: .leading, spacing: TLSpacing.sm) {
                    RoundedRectangle(cornerRadius: 20).fill(TLColor.surface2).aspectRatio(1, contentMode: .fit)
                    Capsule().fill(TLColor.surface2).frame(height: 14)
                    Capsule().fill(TLColor.surface2).frame(width: 92, height: 12)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .accessibilityLabel("Đang tải sản phẩm")
    }
}
