import Foundation
import Testing
@testable import ThePickleHub

@Suite("Supabase Shop repository")
struct SupabaseShopRepositoryTests {
    private let baseURL = URL(string: "https://example.supabase.co")!

    @Test("Discovery maps public cards without fabricating variants or seller UUIDs")
    func discoveryMapping() async throws {
        let api = FakeShopPublicAPI(searchPage: try searchPage())
        let repository = SupabaseShopRepository(api: api, supabaseURL: baseURL, cache: isolatedCache())

        let cards = try await repository.products(
            category: .paddles, query: "carbon", condition: .new,
            verifiedOnly: true, availableOnly: true, sort: .priceAscending
        )

        #expect(cards.count == 1)
        #expect(cards[0].seller.slug == "shop-a")
        #expect(cards[0].priceMinVND == 1_590_000)
        #expect(cards[0].availability == .unknown)
        #expect(cards[0].coverURL?.absoluteString.hasSuffix("/shop-product-media/shop-a/product-a/v1/cover.webp") == true)
        let request = await api.capturedSearch()
        #expect(request?.categorySlug == "vot")
        #expect(request?.condition == .new)
        #expect(request?.inStockOnly == true)
        #expect(request?.sort == .priceAscending)
    }

    @Test("PDP preserves server availability, approved media and contact href")
    func productMapping() async throws {
        let api = FakeShopPublicAPI(productResults: [try productResult()])
        let repository = SupabaseShopRepository(api: api, supabaseURL: baseURL)

        let product = try #require(try await repository.product(slug: "vot-carbon"))
        #expect(product.variants[0].stockOnHand == nil)
        #expect(product.variants[0].publicAvailability == .unknown)
        #expect(product.media[0].publicURL?.absoluteString.contains("/shop-product-media/") == true)
        #expect(product.contacts.first?.href.absoluteString == "https://zalo.me/84912345678")
    }

    @Test("Slug redirect is followed once without an existence probe")
    func redirect() async throws {
        let first = try JSONDecoder.shopPublic.decode(
            ShopPublicProductResultDTO.self,
            from: Data(#"{"found":false,"redirect_to":"vot-carbon"}"#.utf8)
        )
        let api = FakeShopPublicAPI(productResults: [first, try productResult()])
        let repository = SupabaseShopRepository(api: api, supabaseURL: baseURL)

        #expect(try await repository.product(slug: "old-vot")?.slug == "vot-carbon")
        #expect(await api.productSlugs() == ["old-vot", "vot-carbon"])
    }

    @Test("Leaked private fields and unsafe contacts fail closed")
    func securityBoundary() async throws {
        let leaked = try productResult(stock: "7")
        let leakedRepository = SupabaseShopRepository(
            api: FakeShopPublicAPI(productResults: [leaked]), supabaseURL: baseURL
        )
        await #expect(throws: ShopRepositoryError.invalidResponse) {
            try await leakedRepository.product(slug: "vot-carbon")
        }

        let unsafeStore = try shopResult(contactHref: "http://example.com/contact")
        let storeRepository = SupabaseShopRepository(
            api: FakeShopPublicAPI(shopResults: [unsafeStore]), supabaseURL: baseURL
        )
        await #expect(throws: ShopRepositoryError.invalidResponse) {
            try await storeRepository.store(slug: "shop-a")
        }
    }

    @Test("Search page exposes the accepted created-at plus id cursor and caches identical reads")
    func paginationAndCache() async throws {
        let api = FakeShopPublicAPI(searchPage: try searchPage(hasMore: true))
        let directory = FileManager.default.temporaryDirectory
            .appending(path: UUID().uuidString, directoryHint: .isDirectory)
        let cache = ShopCatalogueCache(directory: directory)
        let repository = SupabaseShopRepository(api: api, supabaseURL: baseURL, cache: cache)
        let request = ShopPublicSearchRequest(query: "carbon", limit: 12)

        let first = try await repository.productPage(request)
        let second = try await repository.productPage(request)

        #expect(first.hasMore)
        #expect(first.nextCursorID == first.products.last?.id)
        #expect(first.nextCursorAt == first.products.last?.createdAt)
        #expect(second == first)
        #expect(await api.searchCount() == 1)
    }

    @Test("Expired fresh data remains available as an explicit offline fallback")
    func staleFallback() async throws {
        let directory = FileManager.default.temporaryDirectory
            .appending(path: UUID().uuidString, directoryHint: .isDirectory)
        let cache = ShopCatalogueCache(directory: directory, freshFor: -1, staleFor: 60)
        let page = ShopProductPage(products: [], total: 0, hasMore: false,
                                   nextCursorAt: nil, nextCursorID: nil)
        await cache.store(page, for: "public")

        #expect(await cache.freshPage(for: "public") == nil)
        #expect(await cache.stalePage(for: "public")?.isOfflineFallback == true)
    }

    private func searchPage(hasMore: Bool = false) throws -> ShopPublicSearchPageDTO {
        try JSONDecoder.shopPublic.decode(ShopPublicSearchPageDTO.self, from: Data(#"""
        {"rows":[{"id":"20000000-0000-0000-0000-000000000001","slug":"vot-carbon","title":"Vợt carbon","condition":"new","created_at":"2026-08-12T01:02:03Z","category":{"slug":"vot","name":"Vợt"},"shop":{"slug":"shop-a","name":"Shop A","verified":true},"price_min":1590000,"price_max":1690000,"availability":"unknown","cover":{"public_path":"shop-a/product-a/v1/cover.webp","alt_text":"Vợt carbon","width":1200,"height":900}}],"total":2,"has_more":\#(hasMore)}
        """#.utf8))
    }

    private func isolatedCache() -> ShopCatalogueCache {
        ShopCatalogueCache(directory: FileManager.default.temporaryDirectory
            .appending(path: UUID().uuidString, directoryHint: .isDirectory))
    }

    private func productResult(stock: String = "null") throws -> ShopPublicProductResultDTO {
        let json = """
        {"found":true,"redirect_to":null,"contacts":[{"id":"50000000-0000-0000-0000-000000000001","type":"zalo","href":"https://zalo.me/84912345678","label":"Zalo"}],"product":{"id":"20000000-0000-0000-0000-000000000001","slug":"vot-carbon","title":"Vợt carbon","description":"Mô tả","condition":"new","category":{"slug":"vot","name":"Vợt"},"shop":{"slug":"shop-a","name":"Shop A","region":"HCM","verified":true,"shipping_note":null,"return_note":null},"option_groups":[{"name":"Màu","values":["Đen"]}],"variants":[{"id":"30000000-0000-0000-0000-000000000001","option_values":{"Màu":"Đen"},"option_key":"Màu=Đen","sku":"SKU-1","price_vnd":1590000,"availability":"unknown","stock_on_hand":\(stock),"media_id":"40000000-0000-0000-0000-000000000001"}],"media":[{"id":"40000000-0000-0000-0000-000000000001","alt_text":"Vợt đen","position":0,"path":null,"public_path":"shop-a/product-a/v1/main.webp","width":1200,"height":900}],"primary_media_id":"40000000-0000-0000-0000-000000000001","is_published":true,"is_preview":false}}
        """
        return try JSONDecoder.shopPublic.decode(ShopPublicProductResultDTO.self, from: Data(json.utf8))
    }

    private func shopResult(contactHref: String) throws -> ShopPublicShopResultDTO {
        let json = """
        {"found":true,"redirect_to":null,"contacts":[{"id":"50000000-0000-0000-0000-000000000001","type":"website","href":"\(contactHref)","label":"Website"}],"shop":{"slug":"shop-a","name":"Shop A","intro":"Giới thiệu","region":"HCM","verified":true,"verified_at":null,"shipping_note":null,"return_note":null,"primary_category_slug":"vot","product_count":1}}
        """
        return try JSONDecoder.shopPublic.decode(ShopPublicShopResultDTO.self, from: Data(json.utf8))
    }
}

private actor FakeShopPublicAPI: ShopPublicAPI {
    private let searchPage: ShopPublicSearchPageDTO
    private let categoryRows: [ShopPublicCategoryDTO]
    private var productResults: [ShopPublicProductResultDTO]
    private var shopResults: [ShopPublicShopResultDTO]
    private var searches: [ShopPublicSearchRequest] = []
    private var requestedProductSlugs: [String] = []

    init(
        searchPage: ShopPublicSearchPageDTO = .init(rows: [], total: 0, hasMore: false),
        categories: [ShopPublicCategoryDTO] = [],
        productResults: [ShopPublicProductResultDTO] = [],
        shopResults: [ShopPublicShopResultDTO] = []
    ) {
        self.searchPage = searchPage
        self.categoryRows = categories
        self.productResults = productResults
        self.shopResults = shopResults
    }

    func search(_ request: ShopPublicSearchRequest) async throws -> ShopPublicSearchPageDTO {
        searches.append(request)
        return searchPage
    }

    func categories(onlyStocked: Bool) async throws -> [ShopPublicCategoryDTO] { categoryRows }

    func product(slug: String) async throws -> ShopPublicProductResultDTO {
        requestedProductSlugs.append(slug)
        guard !productResults.isEmpty else { throw ShopRepositoryError.unavailable }
        return productResults.removeFirst()
    }

    func shop(slug: String) async throws -> ShopPublicShopResultDTO {
        guard !shopResults.isEmpty else { throw ShopRepositoryError.unavailable }
        return shopResults.removeFirst()
    }

    func capturedSearch() -> ShopPublicSearchRequest? { searches.last }
    func productSlugs() -> [String] { requestedProductSlugs }
    func searchCount() -> Int { searches.count }
}
