import Foundation
import Testing
@testable import ThePickleHub

/// Trợ lý AI chung: allowlist link, map tab → loại trang, link → màn hình, decode phản hồi.
struct SiteAssistantTests {

    @Test func safeLinkAcceptsAllowlistOnly() {
        #expect(SiteAssistant.safeLink("/san") == "/san")
        #expect(SiteAssistant.safeLink("/vi/san/") == "/san")
        #expect(SiteAssistant.safeLink("/vi") == "/")
        for bad in ["https://evil.com", "//evil.com", "javascript:alert(1)", "/san?x=1", "/san#a", "/admin", "san", "/san/abc", ""] {
            #expect(SiteAssistant.safeLink(bad) == nil, "\(bad)")
        }
        for link in SiteAssistant.siteLinks { #expect(SiteAssistant.safeLink(link) == link) }
    }

    @Test func tabMapsToKnownPageType() {
        let tabs: [AppTabView.Tab] = [.home, .live, .social, .shop, .feed, .tools, .more]
        for tab in tabs { #expect(SiteAssistant.pageTypes.contains(SiteAssistant.page(for: tab))) }
        #expect(SiteAssistant.page(for: .live) == "live_video")
        #expect(SiteAssistant.page(for: .shop) == "shop")
    }

    @Test func deepLinkMapsToKnownPageType() {
        let links: [DeepLink] = [
            .venue(slug: "s"), .blogPost(slug: "b", isVietnamese: true), .newsArticle(slug: "n", language: "en"),
            .livestream(id: UUID()), .proTourEvent(slug: "p"), .socialEvent(slug: "e"), .registration(token: "t"),
            .shopHome, .shopProduct(slug: "x"), .shopOrder(code: "o"), .toolsHub, .quickTable(shareID: "q"),
            .joinInvite(code: "c"), .tournamentDashboard(type: "quick-table", id: "1"),
        ]
        for link in links { #expect(SiteAssistant.pageTypes.contains(SiteAssistant.page(for: link)), "\(link)") }
        #expect(SiteAssistant.page(for: .venue(slug: "s")) == "venues")
        #expect(SiteAssistant.page(for: .newsArticle(slug: "n", language: "vi")) == "blog_news")
        #expect(SiteAssistant.page(for: .blogPost(slug: "b", isVietnamese: false)) == "blog_news")
        #expect(SiteAssistant.page(for: .shopProduct(slug: "x")) == "shop")
        #expect(SiteAssistant.page(for: .proTourEvent(slug: "p")) == "live_video")
        #expect(SiteAssistant.page(for: .socialEvent(slug: "e")) == "community")
        #expect(SiteAssistant.page(for: .teamMatch(shareID: "t")) == "tools")
    }

    /// Tab "Thêm" (More) có key riêng — key "Thêm" vẫn là "Add" cho các nút thêm.
    /// VI lấy từ defaultValue trong code (bundle chỉ có en.lproj).
    @Test func tabLabelsAreLocalized() throws {
        let en = try #require(Bundle.main.path(forResource: "en", ofType: "lproj").flatMap(Bundle.init(path:)))
        let expected = ["Trang chủ": "Home", "Trực tiếp": "Live", "tab.shop": "Shop", "Bảng tin": "Feed",
                        "Social": "Social", "Công cụ": "Tools", "tab.more": "More", "Thêm": "Add"]
        for (key, value) in expected { #expect(en.localizedString(forKey: key, value: nil, table: nil) == value, "\(key)") }
    }

    @Test func linksOpenNativeScreensWhenTheyExist() {
        #expect(SiteAssistant.destination(for: "/rankings", shopEnabled: true, lang: "vi") == .home(.rankings))
        #expect(SiteAssistant.destination(for: "/vi/tournaments", shopEnabled: true, lang: "vi") == .home(.tournaments))
        #expect(SiteAssistant.destination(for: "/live", shopEnabled: true, lang: "vi") == .tab(.live))
        #expect(SiteAssistant.destination(for: "/tools/quick-tables/chat", shopEnabled: true, lang: "vi") == .tab(.more))
        #expect(SiteAssistant.destination(for: "/tools", shopEnabled: false, lang: "vi") == .tab(.tools))
        #expect(SiteAssistant.destination(for: "/shop", shopEnabled: true, lang: "en") == .tab(.shop))
    }

    @Test func otherLinksOpenTheLocalizedWebPage() {
        #expect(SiteAssistant.destination(for: "/san", shopEnabled: true, lang: "vi") == .web(URL(string: "https://www.thepicklehub.net/vi/san")!))
        #expect(SiteAssistant.destination(for: "/blog", shopEnabled: true, lang: "en") == .web(URL(string: "https://www.thepicklehub.net/blog")!))
        #expect(SiteAssistant.destination(for: "/shop", shopEnabled: false, lang: "en") == .web(URL(string: "https://www.thepicklehub.net/shop")!))
        #expect(SiteAssistant.destination(for: "https://evil.com", shopEnabled: true, lang: "vi") == nil)
    }

    @Test func decodesReplyAndDropsUnsafeLinks() throws {
        let json = """
        {"reply":"Vào mục Tìm sân nhé.","outcome":"answered","lang":"vi","links":[
          {"href":"/san","label":"Tìm sân"},{"href":"https://evil.com","label":"x"},{"href":"/rankings","label":"  "},
          {"href":"/blog","label":"Blog"},{"href":"/shop","label":"Chợ"},{"href":"/live","label":"Live"}]}
        """
        let r = try JSONDecoder().decode(SiteAssistant.Reply.self, from: Data(json.utf8))
        #expect(r.reply == "Vào mục Tìm sân nhé.")
        #expect(r.outcome == "answered")
        #expect(r.links.map(\.href) == ["/san", "/blog", "/shop"])
    }

    @Test func decodesFallbackWithoutLinks() throws {
        let r = try JSONDecoder().decode(SiteAssistant.Reply.self, from: Data(#"{"reply":"Thử lại sau nhé."}"#.utf8))
        #expect(r.links.isEmpty)
        #expect(r.outcome == nil)
    }

    @Test func historyIsClipped() {
        let turns = (0..<10).map { SiteAssistant.Turn(role: $0 % 2 == 0 ? "user" : "bot", text: String(repeating: "a", count: 900)) }
        let clipped = SiteAssistant.clip(turns)
        #expect(clipped.count == 6)
        #expect(clipped.allSatisfy { $0.text.count == 500 })
    }

    // MARK: - Ngữ cảnh màn hình

    @Test func factsSerializeInOrderSkipEmptyAndSanitize() {
        let out = SiteAssistant.serialize([
            .init("name", "Sân <b>A</b>\n\tB"), .init("courts", 4), .init("price", nil as String?), .init("note", ""), .init("indoor", true),
        ])
        #expect(out == "name: Sân b A /b B\ncourts: 4\nindoor: true")
    }

    @Test func factsAreCappedAtALineBoundary() {
        let facts = (0..<50).map { SiteAssistant.Fact("k\($0)", String(repeating: "v", count: 500)) }
        let out = SiteAssistant.serialize(facts)
        #expect(out.count <= SiteAssistant.maxContextChars)
        #expect(out.split(separator: "\n").allSatisfy { $0.count <= "k49: ".count + 300 })
        #expect(SiteAssistant.serialize([.init("a", "x"), .init("b", String(repeating: "y", count: 50))], max: 20) == "a: x")
    }

    @Test func screenContextComesFirstThenGenericFacts() {
        let ctx = SiteAssistant.ScreenContext(label: "Sân A", facts: [.init("venue", "Sân A")])
        #expect(SiteAssistant.facts(ctx, tab: "home", loggedIn: false) == "venue: Sân A\napp: ios\ntab: home\nlogged_in: no")
        #expect(SiteAssistant.facts(nil, tab: "live", loggedIn: true).hasSuffix("logged_in: yes"))
    }

    @Test func venueContextNeverPrintsUnverifiedHoursOrPrice() {
        let v = VenueDetail(id: UUID(), slug: "san-a", name: "San A", nameVi: "Sân A", address: "1 Lê Lợi", district: "Q1", city: "HCM",
                            country: "VN", latitude: nil, longitude: nil, numCourts: 6, surfaceType: "acrylic", isIndoor: true,
                            phone: "0900000000", website: nil, hoursJSON: ["mon": "05:00-22:00"], amenities: ["parking"],
                            coverImageURL: nil, isVerified: true)
        let s = SiteAssistant.serialize(SiteAssistant.context(venue: v).facts)
        #expect(s.contains("venue: Sân A"))
        #expect(s.contains("courts: 6"))
        #expect(s.contains("indoor: indoor"))
        #expect(s.contains("hours: not confirmed"))
        #expect(!s.contains("05:00"))
        #expect(!s.contains("0900000000"))
    }

    @Test func decodesContactFlag() throws {
        let r = try JSONDecoder().decode(SiteAssistant.Reply.self, from: Data(#"{"reply":"Mình mở form nhé.","contact":true}"#.utf8))
        #expect(r.contact)
        #expect(try JSONDecoder().decode(SiteAssistant.Reply.self, from: Data(#"{"reply":"x"}"#.utf8)).contact == false)
    }

    // MARK: - Liên hệ admin

    @Test func supportValidation() {
        var f = SiteAssistant.SupportForm(message: "Cần giúp")
        #expect(SiteAssistant.validate(f, loggedIn: true) == nil)
        #expect(SiteAssistant.validate(f, loggedIn: false) == .contactRequired)
        f.phone = "0912 345 678"
        #expect(SiteAssistant.validate(f, loggedIn: false) == nil)
        f.phone = "09 12"
        #expect(SiteAssistant.validate(f, loggedIn: true) == .invalidPhone)
        f.phone = ""
        f.email = "x@"
        #expect(SiteAssistant.validate(f, loggedIn: true) == .invalidEmail)
        #expect(SiteAssistant.validate(SiteAssistant.SupportForm(message: " "), loggedIn: true) == .messageRequired)
    }

    @Test func supportPayloadIsClippedAndHasNoUserId() throws {
        let turns = (0..<9).map { SiteAssistant.Turn(role: $0 % 2 == 0 ? "user" : "bot", text: String(repeating: "t", count: 500)) }
        let p = SiteAssistant.supportPayload(
            SiteAssistant.SupportForm(message: String(repeating: "m", count: 2000), name: " Lan ", phone: "0912345678"),
            page: "hacker", tab: "shop", label: "Vợt A", turns: turns)
        #expect(p.message.count == 1000)
        #expect(p.name == "Lan")
        #expect(p.page_type == "general")
        #expect(p.route == "ios:shop")
        #expect(p.transcript.count == 6)
        #expect(p.transcript.allSatisfy { $0.text.count == 300 })
        let json = String(decoding: try JSONEncoder().encode(p), as: UTF8.self)
        #expect(!json.contains("user_id"))
    }

    @Test func prefillUsesRecentUserTurnsOnly() {
        let turns = [SiteAssistant.Turn(role: "user", text: "a"), .init(role: "bot", text: "b"), .init(role: "user", text: "c")]
        #expect(SiteAssistant.prefill(turns) == "a\nc")
    }
}
