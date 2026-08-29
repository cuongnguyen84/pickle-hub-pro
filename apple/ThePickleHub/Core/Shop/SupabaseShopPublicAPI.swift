import Foundation
import Supabase

struct ShopPublicSearchRequest: Equatable, Sendable {
    enum Sort: String, Sendable { case recent, priceAscending = "price_asc", priceDescending = "price_desc" }
    enum CachePolicy: Sendable { case useCache, reload }
    var query: String?
    var categorySlug: String?
    var shopSlug: String?
    var condition: ShopProductCondition?
    var inStockOnly = false
    var sort: Sort = .recent
    var cursorAt: Date?
    var cursorID: UUID?
    var limit = 24
    var cachePolicy: CachePolicy = .useCache
}

protocol ShopPublicAPI: Sendable {
    func search(_ request: ShopPublicSearchRequest) async throws -> ShopPublicSearchPageDTO
    func categories(onlyStocked: Bool) async throws -> [ShopPublicCategoryDTO]
    func product(slug: String) async throws -> ShopPublicProductResultDTO
    func shop(slug: String) async throws -> ShopPublicShopResultDTO
}

struct SupabaseShopPublicAPI: ShopPublicAPI {
    private let client: SupabaseClient

    init(client: SupabaseClient = SupabaseManager.shared.client) {
        self.client = client
    }

    func search(_ request: ShopPublicSearchRequest) async throws -> ShopPublicSearchPageDTO {
        try await client.rpc("shop_public_search", params: SearchParams(request)).execute().value
    }

    func categories(onlyStocked: Bool = false) async throws -> [ShopPublicCategoryDTO] {
        try await client.rpc("shop_public_categories", params: ["_only_stocked": onlyStocked]).execute().value
    }

    func product(slug: String) async throws -> ShopPublicProductResultDTO {
        let result: ShopPublicProductResultDTO = try await client
            .rpc("shop_public_product", params: ["_slug": slug]).execute().value
        guard result.product?.respectsPublicBoundary != false else { throw ShopRepositoryError.invalidResponse }
        return result
    }

    func shop(slug: String) async throws -> ShopPublicShopResultDTO {
        try await client.rpc("shop_public_shop", params: ["_slug": slug]).execute().value
    }

    private struct SearchParams: Encodable {
        let query: String?
        let categorySlug: String?
        let shopSlug: String?
        let condition: String?
        let inStockOnly: Bool
        let sort: String
        let cursorAt: Date?
        let cursorID: UUID?
        let limit: Int

        init(_ request: ShopPublicSearchRequest) {
            query = request.query?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty
            categorySlug = request.categorySlug
            shopSlug = request.shopSlug
            condition = request.condition?.rawValue
            inStockOnly = request.inStockOnly
            sort = request.sort.rawValue
            cursorAt = request.cursorAt
            cursorID = request.cursorID
            limit = min(max(request.limit, 1), 48)
        }

        enum CodingKeys: String, CodingKey {
            case query = "_q"
            case categorySlug = "_category_slug"
            case shopSlug = "_shop_slug"
            case condition = "_condition"
            case inStockOnly = "_in_stock_only"
            case sort = "_sort"
            case cursorAt = "_cursor_at"
            case cursorID = "_cursor_id"
            case limit = "_limit"
        }
    }
}
