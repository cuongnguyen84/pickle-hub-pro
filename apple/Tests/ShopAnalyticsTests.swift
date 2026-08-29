import Foundation
import Testing
@testable import ThePickleHub

@Suite("Shop analytics schema")
struct ShopAnalyticsTests {
    @Test("Event names are stable and namespaced")
    func stableNames() {
        let events: [ShopAnalyticsEvent] = [
            .homeViewed,
            .searchSubmitted(queryLength: 4, resultCount: 2),
            .categoryViewed(category: .paddles),
            .productViewed(productID: ShopFixtures.products[0].id),
            .storeViewed(storeSlug: ShopFixtures.gearSeller.slug),
            .wishlistAuthenticationRequired(productID: nil),
        ]
        #expect(events.allSatisfy { $0.name.hasPrefix("shop_") })
        #expect(Set(events.map(\.name)).count == events.count)
    }

    @Test("Search analytics stores counts but never raw query text")
    func searchPrivacy() {
        let event = ShopAnalyticsEvent.searchSubmitted(queryLength: 8, resultCount: 3)
        #expect(event.properties == ["query_length": "8", "result_count": "3"])
        #expect(!event.properties.keys.contains("query"))
    }

    @Test("Numeric properties cannot become negative")
    func boundedCounts() {
        let event = ShopAnalyticsEvent.searchSubmitted(queryLength: -1, resultCount: -5)
        #expect(event.properties == ["query_length": "0", "result_count": "0"])
    }
}
