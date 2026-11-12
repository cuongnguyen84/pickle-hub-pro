import Foundation
import Supabase

/// Trợ lý AI chung — gọi edge function `site-assistant` (dùng chung với web).
/// `pageTypes` + `siteLinks` là bản sao của supabase/functions/site-assistant/shared.ts:
/// sửa một bên thì sửa cả bên kia.
enum SiteAssistant {
    static let pageTypes: Set<String> = [
        "home", "tournament", "tools", "live_video", "blog_news", "venues",
        "players", "shop", "community", "account", "general",
    ]

    static let siteLinks: Set<String> = [
        "/", "/feed", "/tournaments", "/tools", "/tools/quick-tables", "/tools/quick-tables/chat",
        "/tools/team-match", "/tools/doubles-elimination", "/tools/flex-tournament", "/su-kien", "/social",
        "/live", "/videos", "/blog", "/news", "/san", "/san/them", "/rankings", "/rankings/ppa-tour", "/dupr",
        "/tim-ban-choi", "/clubs", "/forum", "/shop", "/account", "/account/my-tournaments", "/notifications",
        "/search", "/match/new", "/about", "/contact", "/login",
    ]

    static let webBase = "https://www.thepicklehub.net"

    /// Giống safeLink() của web: chỉ đường dẫn nội bộ trong allowlist, bỏ /vi và / cuối.
    static func safeLink(_ href: String) -> String? {
        guard href.count <= 80, href.hasPrefix("/"), !href.hasPrefix("//"),
              href.rangeOfCharacter(from: CharacterSet(charactersIn: "?#\\ \t\n")) == nil else { return nil }
        var p = href == "/vi" ? "/" : href.hasPrefix("/vi/") ? String(href.dropFirst(3)) : href
        while p.count > 1 && p.hasSuffix("/") { p.removeLast() }
        return siteLinks.contains(p) ? p : nil
    }

    /// Loại trang theo tab đang mở.
    static func page(for tab: AppTabView.Tab) -> String {
        switch tab {
        case .home, .feed: return "home"
        case .live: return "live_video"
        case .shop: return "shop"
        case .social: return "community"
        case .tools: return "tools"
        case .more: return "general"
        }
    }

    enum Destination: Equatable {
        case tab(AppTabView.Tab)
        case home(HomeRoute)
        case web(URL)
    }

    /// Link (đã qua safeLink) → màn hình native nếu có, không thì trang web cùng ngôn ngữ.
    static func destination(for path: String, shopEnabled: Bool, lang: String) -> Destination? {
        guard let p = safeLink(path) else { return nil }
        switch p {
        case "/": return .tab(.home)
        case "/feed": return .tab(.feed)
        case "/live", "/videos": return .tab(.live)
        case "/tournaments": return .home(.tournaments)
        case "/rankings": return .home(.rankings)
        case "/notifications": return .home(.notifications)
        case "/search": return .home(.search)
        case "/account": return .home(.profile)
        case "/shop" where shopEnabled: return .tab(.shop)
        case "/social", "/su-kien": return .tab(shopEnabled ? .more : .social)
        case _ where p == "/tools" || p.hasPrefix("/tools/"): return .tab(shopEnabled ? .more : .tools)
        default:
            let localized = lang == "vi" ? (p == "/" ? "/vi" : "/vi\(p)") : p
            return URL(string: webBase + localized).map(Destination.web)
        }
    }

    struct Link: Decodable, Equatable, Sendable {
        let href: String
        let label: String
    }

    struct Reply: Decodable, Sendable {
        let reply: String
        let links: [Link]
        let outcome: String?

        private enum CodingKeys: String, CodingKey { case reply, links, outcome }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            reply = try c.decode(String.self, forKey: .reply)
            outcome = try c.decodeIfPresent(String.self, forKey: .outcome)
            // Lọc lại phía app: chỉ link trong allowlist, nhãn không rỗng, tối đa 3.
            let raw = (try? c.decodeIfPresent([Link].self, forKey: .links)) ?? []
            links = Array(raw.compactMap { l -> Link? in
                guard let href = SiteAssistant.safeLink(l.href) else { return nil }
                let label = l.label.trimmingCharacters(in: .whitespacesAndNewlines)
                return label.isEmpty ? nil : Link(href: href, label: String(label.prefix(40)))
            }.prefix(3))
        }
    }

    struct Turn: Encodable, Sendable {
        let role: String   // "user" | "bot"
        let text: String
    }

    private struct Payload: Encodable {
        let thread_id: String
        let lang: String
        let page: String
        let route: String
        let messages: [Turn]
    }

    private struct Body: Encodable { let assistant: Payload }

    /// Ngôn ngữ đang hiển thị của app (vi mặc định).
    static var appLang: String {
        Bundle.main.preferredLocalizations.first?.hasPrefix("en") == true ? "en" : "vi"
    }

    /// Lịch sử gửi lên: 6 lượt cuối, mỗi lượt ≤ 500 ký tự (server cũng cắt).
    static func clip(_ turns: [Turn]) -> [Turn] {
        turns.suffix(6).map { Turn(role: $0.role, text: String($0.text.prefix(500))) }
    }

    /// JWT người dùng (nếu đã đăng nhập) do SupabaseClient tự gắn.
    static func send(threadId: String, page: String, tab: String, turns: [Turn]) async throws -> Reply {
        let body = Body(assistant: Payload(
            thread_id: threadId, lang: appLang, page: pageTypes.contains(page) ? page : "general",
            route: "ios:\(tab)", messages: clip(turns)))
        return try await SupabaseManager.shared.client.functions.invoke(
            "site-assistant", options: FunctionInvokeOptions(body: body))
    }
}
