import Foundation
import FirebaseAnalytics
import FirebaseCore

/// Privacy-minimized Shop funnel events. Never add raw queries, names, phone
/// numbers, addresses, order codes, user IDs, bank data or error messages.
enum ShopAnalyticsEvent: Equatable, Sendable {
    case homeViewed
    case searchSubmitted(queryLength: Int, resultCount: Int)
    case categoryViewed(category: ShopCategory)
    case productViewed(productID: UUID)
    case variantSelected(productID: UUID, variantID: UUID)
    case storeViewed(storeSlug: String)
    case wishlistAuthenticationRequired(productID: UUID?)
    case cartAddSucceeded(productID: UUID, variantID: UUID, quantity: Int)
    case cartViewed(itemCount: Int, sellerCount: Int)
    case checkoutStarted(itemCount: Int)
    case orderCreateSucceeded(itemCount: Int, paymentMethod: ShopPaymentMethod)
    case orderListViewed(orderCount: Int)
    case paymentClaimed

    var name: String {
        switch self {
        case .homeViewed: "shop_home_viewed"
        case .searchSubmitted: "shop_search_submitted"
        case .categoryViewed: "shop_category_viewed"
        case .productViewed: "shop_product_viewed"
        case .variantSelected: "shop_variant_selected"
        case .storeViewed: "shop_store_viewed"
        case .wishlistAuthenticationRequired: "shop_wishlist_auth_required"
        case .cartAddSucceeded: "shop_cart_add_succeeded"
        case .cartViewed: "shop_cart_viewed"
        case .checkoutStarted: "shop_checkout_started"
        case .orderCreateSucceeded: "shop_order_create_succeeded"
        case .orderListViewed: "shop_order_list_viewed"
        case .paymentClaimed: "shop_payment_claimed"
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
        case .cartAddSucceeded(let productID, let variantID, let quantity):
            [
                "product_id": productID.uuidString.lowercased(),
                "variant_id": variantID.uuidString.lowercased(),
                "quantity": String(max(1, quantity)),
            ]
        case .cartViewed(let itemCount, let sellerCount):
            ["item_count": String(max(0, itemCount)), "seller_count": String(max(0, sellerCount))]
        case .checkoutStarted(let itemCount):
            ["item_count": String(max(0, itemCount))]
        case .orderCreateSucceeded(let itemCount, let paymentMethod):
            ["item_count": String(max(0, itemCount)), "payment_method": paymentMethod.rawValue]
        case .orderListViewed(let orderCount):
            ["order_count": String(max(0, orderCount))]
        case .paymentClaimed:
            [:]
        }
    }
}

protocol ShopAnalytics: Sendable {
    func track(_ event: ShopAnalyticsEvent) async
}

struct NoOpShopAnalytics: ShopAnalytics {
    func track(_: ShopAnalyticsEvent) async {}
}

/// Firebase is configured by `RemotePushService` before the app UI appears.
/// The guard keeps previews, unit tests and development builds deterministic.
struct FirebaseShopAnalytics: ShopAnalytics {
    func track(_ event: ShopAnalyticsEvent) async {
        guard FirebaseApp.app() != nil else { return }
        var parameters: [String: Any] = event.properties
        parameters["shop_schema_version"] = 1
        parameters["app_surface"] = "native_ios"
        Analytics.logEvent(event.name, parameters: parameters)
    }
}
