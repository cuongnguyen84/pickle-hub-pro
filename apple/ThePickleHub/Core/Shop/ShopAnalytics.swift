import Foundation

/// Stable native event schema only. No production transport is connected until
/// analytics naming and privacy rules are reconciled with the web contract.
enum ShopAnalyticsEvent: Equatable, Sendable {
    case homeViewed
    case searchSubmitted(queryLength: Int, resultCount: Int)
    case categoryViewed(category: ShopCategory)
    case productViewed(productID: UUID)
    case variantSelected(productID: UUID, variantID: UUID)
    case storeViewed(storeSlug: String)
    case wishlistAuthenticationRequired(productID: UUID?)

    var name: String {
        switch self {
        case .homeViewed: "shop_home_viewed"
        case .searchSubmitted: "shop_search_submitted"
        case .categoryViewed: "shop_category_viewed"
        case .productViewed: "shop_product_viewed"
        case .variantSelected: "shop_variant_selected"
        case .storeViewed: "shop_store_viewed"
        case .wishlistAuthenticationRequired: "shop_wishlist_auth_required"
        }
    }

    var properties: [String: String] {
        switch self {
        case .homeViewed:
            [:]
        case .searchSubmitted(let queryLength, let resultCount):
            ["query_length": String(max(0, queryLength)), "result_count": String(max(0, resultCount))]
        case .categoryViewed(let category):
            ["category": category.rawValue]
        case .productViewed(let productID):
            ["product_id": productID.uuidString.lowercased()]
        case .variantSelected(let productID, let variantID):
            [
                "product_id": productID.uuidString.lowercased(),
                "variant_id": variantID.uuidString.lowercased(),
            ]
        case .storeViewed(let storeSlug):
            ["store_slug": storeSlug]
        case .wishlistAuthenticationRequired(let productID):
            productID.map { ["product_id": $0.uuidString.lowercased()] } ?? [:]
        }
    }
}

protocol ShopAnalytics: Sendable {
    func track(_ event: ShopAnalyticsEvent) async
}

struct NoOpShopAnalytics: ShopAnalytics {
    func track(_: ShopAnalyticsEvent) async {}
}
