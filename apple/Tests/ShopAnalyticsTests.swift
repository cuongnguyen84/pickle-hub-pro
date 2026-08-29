import Foundation
import Testing
@testable import ThePickleHub

@Suite("Shop analytics schema")
struct ShopAnalyticsTests {
    private let productID = UUID(uuidString: "10000000-0000-4000-8000-000000000001")!
    private let variantID = UUID(uuidString: "20000000-0000-4000-8000-000000000001")!

    @Test("Funnel event names are stable, namespaced and unique")
    func stableNames() {
        let events: [ShopAnalyticsEvent] = [
            .homeViewed,
            .searchSubmitted(queryLength: 4, resultCount: 2),
            .categoryViewed(category: .paddles),
            .productViewed(productID: productID),
            .variantSelected(productID: productID, variantID: variantID),
            .storeViewed(storeSlug: "shop-a"),
            .wishlistAuthenticationRequired(productID: nil),
            .cartAddSucceeded(productID: productID, variantID: variantID, quantity: 2),
            .cartViewed(itemCount: 2, sellerCount: 1),
            .checkoutStarted(itemCount: 2),
            .orderCreateSucceeded(itemCount: 2, paymentMethod: .cod),
            .orderListViewed(orderCount: 1),
            .paymentClaimed,
        ]
        #expect(events.allSatisfy { $0.name.hasPrefix("shop_") && $0.name.count <= 40 })
        #expect(Set(events.map(\.name)).count == events.count)
    }

    @Test("Search stores counts but never raw query text")
    func searchPrivacy() {
        let event = ShopAnalyticsEvent.searchSubmitted(queryLength: 8, resultCount: 3)
        #expect(event.properties == ["query_length": "8", "result_count": "3"])
        #expect(!event.properties.keys.contains("query"))
    }

    @Test("Funnel properties contain no direct customer or order identity")
    func propertyAllowlist() {
        let forbidden = ["name", "phone", "address", "email", "user_id", "order_code", "memo", "bank"]
        let events: [ShopAnalyticsEvent] = [
            .cartAddSucceeded(productID: productID, variantID: variantID, quantity: 0),
            .cartViewed(itemCount: -1, sellerCount: -2),
            .checkoutStarted(itemCount: -1),
            .orderCreateSucceeded(itemCount: -1, paymentMethod: .bankTransfer),
            .orderListViewed(orderCount: -1),
        ]
        for event in events {
            #expect(event.properties.keys.allSatisfy { key in !forbidden.contains(where: key.contains) })
            #expect(event.properties.values.allSatisfy { !$0.contains("@") && !$0.hasPrefix("TPH-") })
        }
        #expect(events[0].properties["quantity"] == "1")
        #expect(events[1].properties == ["item_count": "0", "seller_count": "0"])
    }
}
