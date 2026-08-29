import Foundation
import Testing
@testable import ThePickleHub

struct DeepLinkTests {

    private func parse(_ s: String) -> DeepLink? { URL(string: s).flatMap(DeepLink.parse) }

    @Test func universalLinkRegistration() {
        let token = "0a1b2c3d-0000-1111-2222-333344445555"
        #expect(parse("https://www.thepicklehub.net/dang-ky/\(token)") == .registration(token: token))
        #expect(parse("https://thepicklehub.net/vi/dang-ky/\(token)") == .registration(token: token))
        // Token viết hoa → normalize lowercase.
        #expect(parse("https://www.thepicklehub.net/dang-ky/\(token.uppercased())") == .registration(token: token))
    }

    @Test func customScheme() {
        let token = "0a1b2c3d-0000-1111-2222-333344445555"
        #expect(parse("thepicklehub://dang-ky/\(token)") == .registration(token: token))
        #expect(parse("thepicklehub://join/abc123") == .joinInvite(code: "abc123"))
        #expect(parse("thepicklehub://social/keo-toi-t7") == .socialEvent(slug: "keo-toi-t7"))
    }

    @Test func rejectsInvalid() {
        #expect(parse("https://www.thepicklehub.net/dang-ky/khong-phai-uuid") == nil)   // token không phải UUID
        #expect(parse("https://evil.com/dang-ky/0a1b2c3d-0000-1111-2222-333344445555") == nil) // host lạ
        #expect(parse("https://www.thepicklehub.net/social/x/danh-sach") == nil)        // sub-path organizer
        #expect(parse("https://www.thepicklehub.net/blog/abc") == nil)                  // route không hỗ trợ
        // URL Google Sign-In không được nuốt (để GIDSignIn xử lý).
        #expect(parse("com.googleusercontent.apps.574564887581-qhno3m28725a9c0c91tl2qp71fdv0lli://oauth") == nil)
    }

    @Test func joinUniversalLink() {
        #expect(parse("https://www.thepicklehub.net/join/XYZ789") == .joinInvite(code: "XYZ789"))
    }

    @Test func bracketLabUniversalLinksOpenNativeDetails() {
        let matchID = UUID(uuidString: "10000000-0000-4000-8000-000000000001")!
        #expect(parse("https://www.thepicklehub.net/tools/quick-tables/qt123") == .quickTable(shareID: "qt123"))
        #expect(parse("https://www.thepicklehub.net/tools/quick-tables/qt123/setup") == .quickTable(shareID: "qt123"))
        #expect(parse("https://www.thepicklehub.net/tools/quick-tables/parent/summer26") == .parentTournament(shareID: "summer26"))
        #expect(parse("https://www.thepicklehub.net/tools/doubles-elimination/de123") == .doublesElimination(shareID: "de123"))
        #expect(parse("https://www.thepicklehub.net/tools/team-match/tm123") == .teamMatch(shareID: "tm123"))
        #expect(parse("https://www.thepicklehub.net/tools/flex-tournament/fx123") == .flexTournament(shareID: "fx123"))
        #expect(parse("https://www.thepicklehub.net/tools") == .toolsHub)
        #expect(parse("https://www.thepicklehub.net/tools/quick-tables") == .toolsHub)
        #expect(parse("https://www.thepicklehub.net/tools/quick-tables/new") == .createQuickTable)
        #expect(parse("https://www.thepicklehub.net/tools/doubles-elimination/new") == .createDoublesElimination)
        #expect(parse("https://www.thepicklehub.net/tools/team-match/new") == .createTeamMatch)
        #expect(parse("https://www.thepicklehub.net/tools/flex-tournament/new") == .createFlexTournament)
        #expect(parse("https://www.thepicklehub.net/tools/dashboard") == .dashboardPicker)
        #expect(parse("https://www.thepicklehub.net/tools/dashboard/quick-table/qt123") ==
            .tournamentDashboard(type: "quick-table", id: "qt123"))
        #expect(parse("https://www.thepicklehub.net/tools/quick-tables/referee/\(matchID.uuidString)") ==
            .quickTableScore(matchID: matchID))
        #expect(parse("https://www.thepicklehub.net/tools/team-match/match/\(matchID.uuidString)/score") ==
            .teamMatchScore(matchID: matchID))
        #expect(parse("https://www.thepicklehub.net/tools/doubles-elimination/match/\(matchID.uuidString)/score") ==
            .doublesEliminationScore(matchID: matchID))
        // AASA nhận toàn bộ /tools/*: route organizer chưa map cụ thể vẫn phải
        // vào được hub native thay vì hiện sheet trống.
        #expect(parse("https://www.thepicklehub.net/tools/a-future-route") == .toolsHub)
    }

    @Test func remotePushRoutesSupportedPayloads() {
        let liveID = "10000000-0000-4000-8000-000000000001"
        #expect(RemoteNotificationRoute.deepLink(from: [
            "livestreamID": liveID,
        ]) == .livestream(id: UUID(uuidString: liveID)!))
        #expect(RemoteNotificationRoute.deepLink(from: [
            "event_slug": "giao-luu-quan-7",
        ]) == .socialEvent(slug: "giao-luu-quan-7"))
        #expect(RemoteNotificationRoute.deepLink(from: [
            "link_url": "/social/giao-luu-quan-7/danh-sach",
        ]) == .socialEvent(slug: "giao-luu-quan-7"))
    }

    @Test func remotePushRejectsUnknownOrMalformedDestinations() {
        #expect(RemoteNotificationRoute.deepLink(from: ["event_id": "not-a-route"]) == nil)
        #expect(RemoteNotificationRoute.deepLink(from: ["link_url": "https://evil.com/social/x"]) == nil)
        #expect(RemoteNotificationRoute.deepLink(from: [
            "entity_type": "tournament", "related_id": "not-a-uuid",
        ]) == nil)
    }

    @Test func shopLinksOpenNativeBuyerSurfaces() {
        #expect(parse("https://www.thepicklehub.net/shop") == .shopHome)
        #expect(parse("https://www.thepicklehub.net/vi/shop/search?q=vot%20carbon") == .shopSearch(query: "vot carbon"))
        #expect(parse("thepicklehub://shop/category/vot") == .shopCategory(.paddles))
        #expect(parse("https://www.thepicklehub.net/shop/product/vot-carbon-16mm-control") == .shopProduct(slug: "vot-carbon-16mm-control"))
        #expect(parse("https://www.thepicklehub.net/shop/store/pickle-gear-sai-gon") == .shopStore(slug: "pickle-gear-sai-gon"))
        #expect(parse("https://www.thepicklehub.net/shop/order/TPH-260824-ABC") == .shopOrder(code: "TPH-260824-ABC"))
        #expect(parse("https://www.thepicklehub.net/shop/category/khong-ton-tai") == nil)
        #expect(parse("https://evil.com/shop") == nil)
    }

    @Test func shopStatusPushOpensBuyerOrder() {
        #expect(RemoteNotificationRoute.deepLink(from: [
            "type": "shop_order_status",
            "order_code": "TPH-260824-ABC",
            "url": "/shop/order/TPH-260824-ABC",
        ]) == .shopOrder(code: "TPH-260824-ABC"))
    }
}
