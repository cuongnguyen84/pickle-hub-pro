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
}
