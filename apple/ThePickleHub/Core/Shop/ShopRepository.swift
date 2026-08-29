import Foundation

protocol ShopRepository: Sendable {
    func categories() async throws -> [ShopCategory]
    func featuredProducts() async throws -> [ShopProductCardSummary]
    func products(category: ShopCategory?, query: String, condition: ShopProductCondition?,
                  verifiedOnly: Bool, availableOnly: Bool,
                  sort: ShopPublicSearchRequest.Sort) async throws -> [ShopProductCardSummary]
    func productPage(_ request: ShopPublicSearchRequest) async throws -> ShopProductPage
    func product(slug: String) async throws -> ShopProduct?
    func store(slug: String) async throws -> ShopStorefront?
    func products(storeSlug: String) async throws -> [ShopProductCardSummary]
}

extension ShopRepository {
    func products(category: ShopCategory?, query: String) async throws -> [ShopProductCardSummary] {
        try await products(category: category, query: query, condition: nil,
                           verifiedOnly: false, availableOnly: false, sort: .recent)
    }


    func productPage(_ request: ShopPublicSearchRequest) async throws -> ShopProductPage {
        let category = request.categorySlug.flatMap(ShopCategory.init(rawValue:))
        let products = try await products(
            category: category, query: request.query ?? "", condition: request.condition,
            verifiedOnly: false, availableOnly: request.inStockOnly, sort: request.sort
        )
        let limited = Array(products.prefix(request.limit))
        return ShopProductPage(
            products: limited, total: products.count, hasMore: products.count > limited.count,
            nextCursorAt: limited.last?.createdAt, nextCursorID: limited.last?.id
        )
    }
}

enum ShopRepositoryError: LocalizedError, Equatable {
    case unavailable
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .unavailable: "Chưa thể kết nối Shop. Anh/chị kiểm tra mạng rồi thử lại."
        case .invalidResponse: "Dữ liệu Shop chưa đúng định dạng. Vui lòng thử lại sau."
        }
    }
}

enum ShopRepositoryFactory {
    /// Simulator screenshot hooks are deterministic by design. Every normal
    /// app launch uses the accepted C1 public RPC repository and never falls
    /// back to fixtures after a network or decoding failure.
    static func appRepository(defaults: UserDefaults = .standard) -> any ShopRepository {
        let reviewKeys = ["startShop", "startShopSearch", "startShopCategory",
                          "startShopProduct", "startShopVariant", "startShopStore"]
        return reviewKeys.contains(where: defaults.bool(forKey:))
            ? MockShopRepository()
            : SupabaseShopRepository()
    }
}
