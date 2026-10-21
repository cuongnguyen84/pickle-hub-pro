import Foundation
import Testing
@testable import ThePickleHub

@Suite("Shop foundation")
struct ShopFoundationTests {
    @MainActor
    @Test("Wishlist defaults to an honest unavailable state before C2")
    func wishlistProductionDefault() {
        #expect(ShopWishlistView().state == .unavailable)
    }

    @MainActor
    @Test("Wishlist review rows require explicit public summaries")
    func wishlistReviewInjection() async throws {
        let summaries = try await MockShopRepository().featuredProducts()
        let view = ShopWishlistView(state: .loaded(Array(summaries.prefix(2))))
        #expect(view.state == .loaded(Array(summaries.prefix(2))))
    }

    @Test("VND uses integer grouping")
    func vndFormatting() {
        #expect(ShopMoney.vnd(2_390_000) == "2.390.000 ₫")
        #expect(ShopMoney.vnd(0) == "0 ₫")
    }

    @Test("Paddle specs use buyer-facing labels, units and production order")
    func paddleSpecPresentation() {
        let rows = ShopProductSpecs.rows(category: .paddles, attributes: [
            "grip_mm": "107", "brand": "Joola", "weight_g": "220",
            "core_mm": "16 mm",
        ])
        #expect(rows.map(\.label) == ["Thương hiệu", "Trọng lượng", "Độ dày lõi", "Chu vi cán"])
        #expect(rows.map(\.value) == ["Joola", "220 g", "16 mm", "107 mm"])
        #expect(!rows.map(\.label).contains("grip_mm"))
    }

    @Test("Variant requires a complete option selection")
    func completeVariantSelection() {
        let product = ShopFixtures.products[1]
        #expect(product.matchingVariant(selection: ["Màu": "Xanh"]) == nil)
        #expect(product.matchingVariant(selection: ["Màu": "Xanh", "Kích cỡ": "39"])?.sku == "CP-B-39")
    }

    @Test("Compatible values respect prior selections")
    func compatibleValues() {
        let product = ShopFixtures.products[1]
        let sizes = product.values(for: "Kích cỡ", compatibleWith: ["Màu": "Trắng"])
        #expect(sizes == ["39", "40"])
    }

    @Test("Search is case and diacritic insensitive")
    func search() async throws {
        let repository = MockShopRepository()
        let result = try await repository.products(category: nil, query: "vot carbon")
        #expect(result.map(\.slug) == ["vot-carbon-16mm-control"])
    }

    @Test("Price range is derived only from variants of one product")
    func honestPriceRange() {
        let product = ShopFixtures.products[1]
        #expect(product.minimumPriceVND == 1_590_000)
        #expect(product.maximumPriceVND == 1_690_000)
        #expect(product.hasPriceRange)
    }

    @MainActor
    @Test("Semantic price component preserves honest range and from labels")
    func semanticPriceLabels() {
        let product = ShopFixtures.products[1]
        #expect(ShopPriceText(product: product).label == "1.590.000 ₫ – 1.690.000 ₫")
        #expect(ShopPriceText(product: product, showsFromPrefix: true).label == "Từ 1.590.000 ₫")
        let premiumVariant = product.variants.first { $0.priceVND == product.maximumPriceVND }
        #expect(ShopPriceText(product: product, variant: premiumVariant).label == "1.690.000 ₫")
    }

    @Test("Selected variant carries its media mapping atomically")
    func variantMediaMapping() {
        let product = ShopFixtures.products[1]
        let variant = product.matchingVariant(selection: ["Màu": "Xanh", "Kích cỡ": "39"])
        #expect(variant?.sku == "CP-B-39")
        #expect(variant?.priceVND == 1_690_000)
        #expect(variant?.mediaID == product.media[1].id)
        #expect(product.mediaIndex(for: variant) == 1)
    }

    @Test("Unknown stock remains honestly available without invented quantity")
    func unknownInventory() {
        let product = ShopFixtures.products[1]
        let variant = product.matchingVariant(selection: ["Màu": "Xanh", "Kích cỡ": "40"])
        #expect(variant?.stockOnHand == nil)
        #expect(variant?.isAvailable == true)
    }

    @MainActor
    @Test("Category search uses public card summaries without fabricated variants")
    func categoryCards() async {
        let model = ShopSearchViewModel(repository: MockShopRepository(), query: "", category: .paddles)
        await model.search()
        #expect(model.products.map(\.slug) == ["vot-carbon-16mm-control"])
        #expect(model.products.first?.priceMinVND == 2_390_000)
        #expect(model.attributeFacets.isEmpty)
    }

    @MainActor
    @Test("Search sort uses honest variant minimum prices")
    func searchSort() async {
        let model = ShopSearchViewModel(repository: MockShopRepository(), query: "", category: nil)
        model.sort = .priceLow
        await model.search()
        #expect(model.products.compactMap(\.priceMinVND) == [289_000, 790_000, 1_590_000, 2_390_000])
    }

    @Test("Scenario repository exposes deterministic empty and failure states")
    func repositoryScenarios() async throws {
        let empty = ScenarioShopRepository(scenario: .empty)
        #expect(try await empty.featuredProducts().isEmpty)
        #expect(try await empty.product(slug: "vot-carbon-16mm-control") == nil)

        let unavailable = ScenarioShopRepository(scenario: .unavailable)
        await #expect(throws: ShopRepositoryError.unavailable) {
            try await unavailable.products(category: nil, query: "")
        }
    }

    @MainActor
    @Test("Home view model exposes normal, empty and unavailable presentation states")
    func homePresentationStates() async {
        let normal = ShopHomeViewModel(repository: ScenarioShopRepository(scenario: .normal))
        await normal.load()
        #expect(normal.phase == .loaded)
        #expect(!normal.products.isEmpty)

        let empty = ShopHomeViewModel(repository: ScenarioShopRepository(scenario: .empty))
        await empty.load()
        #expect(empty.phase == .loaded)
        #expect(empty.products.isEmpty)

        let unavailable = ShopHomeViewModel(repository: ScenarioShopRepository(scenario: .unavailable))
        await unavailable.load()
        guard case .failed = unavailable.phase else {
            Issue.record("Unavailable repository must produce the error presentation state")
            return
        }
    }
}
