import Foundation
import Supabase
import SwiftUI

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
        /// Model thấy người dùng cần người thật → mở form gửi admin.
        let contact: Bool

        private enum CodingKeys: String, CodingKey { case reply, links, outcome, contact }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            reply = try c.decode(String.self, forKey: .reply)
            outcome = try c.decodeIfPresent(String.self, forKey: .outcome)
            contact = (try? c.decodeIfPresent(Bool.self, forKey: .contact)) ?? false
            // Lọc lại phía app: chỉ link trong allowlist, nhãn không rỗng, tối đa 3.
            let raw = (try? c.decodeIfPresent([Link].self, forKey: .links)) ?? []
            links = Array(raw.compactMap { l -> Link? in
                guard let href = SiteAssistant.safeLink(l.href) else { return nil }
                let label = l.label.trimmingCharacters(in: .whitespacesAndNewlines)
                return label.isEmpty ? nil : Link(href: href, label: String(label.prefix(40)))
            }.prefix(3))
        }
    }

    struct Turn: Encodable, Equatable, Sendable {
        let role: String   // "user" | "bot"
        let text: String
    }

    private struct Payload: Encodable {
        let thread_id: String
        let lang: String
        let page: String
        let route: String
        let label: String?
        let facts: String
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
    static func send(threadId: String, page: String, tab: String, context: ScreenContext?, loggedIn: Bool, turns: [Turn]) async throws -> Reply {
        let body = Body(assistant: Payload(
            thread_id: threadId, lang: appLang, page: pageTypes.contains(page) ? page : "general",
            route: "ios:\(tab)", label: context?.label, facts: facts(context, tab: tab, loggedIn: loggedIn), messages: clip(turns)))
        return try await SupabaseManager.shared.client.functions.invoke(
            "site-assistant", options: FunctionInvokeOptions(body: body))
    }

    // MARK: - Ngữ cảnh màn hình (giống serializeFacts() của web)

    /// Trần ngữ cảnh — bằng MAX_CTX_CHARS của supabase/functions/site-assistant/shared.ts.
    static let maxContextChars = 3500

    /// Một dữ kiện đang hiển thị trên màn hình. Giá trị nil/rỗng bị bỏ.
    struct Fact: Equatable, Sendable {
        let key: String
        let value: String?
        init(_ key: String, _ value: String?) { self.key = key; self.value = value }
        init(_ key: String, _ value: Int?) { self.init(key, value.map(String.init)) }
        init(_ key: String, _ value: Double?) { self.init(key, value.map { String(format: "%.3f", $0) }) }
        init(_ key: String, _ value: Bool?) { self.init(key, value.map { $0 ? "true" : "false" }) }
    }

    /// Ngữ cảnh do màn hình chi tiết khai báo (đã có model trong bộ nhớ — không gọi mạng thêm).
    struct ScreenContext: Equatable, Sendable {
        let label: String
        let facts: [Fact]
    }

    /// Làm sạch: bỏ ký tự điều khiển, < >, gộp khoảng trắng; cắt `max` ký tự.
    static func clean(_ s: String, max: Int) -> String {
        let scalars = s.unicodeScalars.map { CharacterSet.controlCharacters.contains($0) || $0 == "<" || $0 == ">" ? " " : Character($0) }
        let collapsed = String(scalars).split(whereSeparator: \.isWhitespace).joined(separator: " ")
        return String(collapsed.prefix(max))
    }

    /// "key: value" từng dòng theo thứ tự khai báo; mỗi giá trị ≤ 300, tổng ≤ max (cắt ở ranh giới dòng).
    static func serialize(_ facts: [Fact], max: Int = maxContextChars) -> String {
        var out: [String] = []
        var len = 0
        for f in facts {
            guard let raw = f.value else { continue }
            let value = clean(raw, max: 300)
            guard !value.isEmpty else { continue }
            let line = "\(clean(f.key, max: 40).replacingOccurrences(of: " ", with: "_")): \(value)"
            if len + line.count + 1 > max { break }
            out.append(line)
            len += line.count + 1
        }
        return out.joined(separator: "\n")
    }

    /// Dữ kiện gửi server: màn hình khai báo trước, dữ kiện chung (tab, đăng nhập) sau.
    static func facts(_ context: ScreenContext?, tab: String, loggedIn: Bool) -> String {
        serialize((context?.facts ?? []) + [Fact("app", "ios"), Fact("tab", tab), Fact("logged_in", loggedIn ? "yes" : "no")])
    }

    // MARK: - Liên hệ admin (site-assistant { support })

    struct SupportForm: Equatable, Sendable {
        var message = ""
        var name = ""
        var phone = ""
        var email = ""
        var zalo = ""
    }

    enum SupportError: String, Equatable { case messageRequired, contactRequired, invalidEmail, invalidPhone }

    /// Kiểm nhẹ phía app (server kiểm lại). Khách phải để lại ít nhất một cách liên hệ.
    static func validate(_ f: SupportForm, loggedIn: Bool) -> SupportError? {
        let t = { (s: String) in s.trimmingCharacters(in: .whitespacesAndNewlines) }
        if t(f.message).count < 2 { return .messageRequired }
        if !loggedIn && t(f.phone).isEmpty && t(f.email).isEmpty && t(f.zalo).isEmpty { return .contactRequired }
        if !t(f.email).isEmpty && t(f.email).range(of: #"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$"#, options: .regularExpression) == nil { return .invalidEmail }
        let digits = f.phone.filter { !" ().-".contains($0) }
        if !t(f.phone).isEmpty && digits.range(of: #"^\+?\d{8,15}$"#, options: .regularExpression) == nil { return .invalidPhone }
        return nil
    }

    /// Nội dung gợi sẵn: tối đa 3 câu người dùng vừa gõ.
    static func prefill(_ turns: [Turn]) -> String {
        String(turns.filter { $0.role == "user" }.suffix(3).map(\.text).joined(separator: "\n").prefix(1000))
    }

    struct SupportPayload: Encodable, Equatable {
        let message: String
        let name: String
        let phone: String
        let email: String
        let zalo: String
        let page_type: String
        let route: String
        let page_label: String
        let lang: String
        let transcript: [Turn]
    }

    /// Payload gửi đi — không bao giờ có user_id (server lấy từ JWT).
    static func supportPayload(_ f: SupportForm, page: String, tab: String, label: String, turns: [Turn]) -> SupportPayload {
        let t = { (s: String, n: Int) in String(s.trimmingCharacters(in: .whitespacesAndNewlines).prefix(n)) }
        return SupportPayload(
            message: t(f.message, 1000), name: t(f.name, 80), phone: t(f.phone, 40), email: t(f.email, 120), zalo: t(f.zalo, 60),
            page_type: pageTypes.contains(page) ? page : "general", route: "ios:\(tab)", page_label: t(label, 200), lang: appLang,
            transcript: turns.suffix(6).map { Turn(role: $0.role, text: String($0.text.prefix(300))) })
    }

    struct SupportResult: Decodable, Sendable {
        let ok: Bool
        let reply: String?
    }

    private struct SupportBody: Encodable { let support: SupportPayload }

    static func sendSupport(_ payload: SupportPayload) async throws -> SupportResult {
        try await SupabaseManager.shared.client.functions.invoke(
            "site-assistant", options: FunctionInvokeOptions(body: SupportBody(support: payload)))
    }
}

/// Ngữ cảnh từng màn hình chi tiết — chỉ dữ liệu đang hiển thị, không email/SĐT
/// người khác. Giờ/giá sân không đưa vào vì app chưa có cờ "đã xác nhận" (PRICE-01).
extension SiteAssistant {
    static func context(tournament t: Tournament) -> ScreenContext {
        ScreenContext(label: t.name, facts: [
            Fact("tournament", t.name), Fact("status", t.status), Fact("start", t.startDate), Fact("end", t.endDate),
            Fact("organizer", t.organization?.name),
        ])
    }

    static func context(venue v: VenueDetail) -> ScreenContext {
        ScreenContext(label: v.displayName, facts: [
            Fact("venue", v.displayName), Fact("address", v.address), Fact("district", v.district), Fact("city", v.city),
            Fact("courts", v.numCourts), Fact("indoor", v.isIndoor.map { $0 ? "indoor" : "outdoor" }), Fact("surface", v.surfaceType),
            Fact("verified_listing", v.isVerified), Fact("amenities", v.amenities.map { $0.prefix(12).joined(separator: ", ") }),
            Fact("hours", "not confirmed"), Fact("price", "not confirmed"),
        ])
    }

    static func context(profile p: Profile, stats: PlayerStats?) -> ScreenContext {
        let name = p.displayName ?? p.username ?? ""
        return ScreenContext(label: name, facts: [
            Fact("player", name), Fact("city", p.city), Fact("dupr_doubles", p.duprDoubles), Fact("dupr_singles", p.duprSingles),
            Fact("matches", stats?.totalMatches), Fact("wins", stats?.wins), Fact("losses", stats?.losses), Fact("last5", stats?.last5Form),
        ])
    }

    static func context(product p: ShopProduct) -> ScreenContext {
        let vnd = { (n: Int) in "\(n.formatted(.number.locale(Locale(identifier: "vi_VN"))))đ" }
        return ScreenContext(label: p.title, facts: [
            Fact("product", p.title), Fact("category", p.category.rawValue), Fact("condition", p.condition.rawValue),
            Fact("price", p.hasPriceRange ? "\(vnd(p.minimumPriceVND))–\(vnd(p.maximumPriceVND))" : vnd(p.minimumPriceVND)),
            Fact("seller", p.seller.name), Fact("seller_city", p.seller.city), Fact("available", p.isAvailable),
        ])
    }

    static func context(live: [LivestreamSummary], upcoming: [LivestreamSummary], replays: Int) -> ScreenContext {
        ScreenContext(label: "Live", facts: [
            Fact("live_now", live.count), Fact("live_titles", live.prefix(8).compactMap(\.title).joined(separator: " | ")),
            Fact("upcoming_titles", upcoming.prefix(5).compactMap(\.title).joined(separator: " | ")), Fact("replays", replays),
        ])
    }
}

/// Màn hình chi tiết khai báo ngữ cảnh cho nút trợ lý (giống useAssistantContext() của web).
/// Rời màn hình thì xoá — chỉ khi chưa bị màn khác ghi đè.
@MainActor
@Observable
final class AssistantContextStore {
    static let shared = AssistantContextStore()
    private(set) var current: SiteAssistant.ScreenContext?

    func set(_ context: SiteAssistant.ScreenContext?) { current = context }
    func clear(_ context: SiteAssistant.ScreenContext) { if current == context { current = nil } }
}

private struct AssistantContextModifier: ViewModifier {
    let context: SiteAssistant.ScreenContext?
    @State private var registered: SiteAssistant.ScreenContext?

    func body(content: Content) -> some View {
        content
            .onAppear { register(context) }
            .onChange(of: context) { _, new in register(new) }
            .onDisappear { if let registered { AssistantContextStore.shared.clear(registered) } }
    }

    private func register(_ new: SiteAssistant.ScreenContext?) {
        if let registered { AssistantContextStore.shared.clear(registered) }
        registered = new
        if let new { AssistantContextStore.shared.set(new) }
    }
}

extension View {
    /// nil khi model chưa tải xong.
    func assistantContext(_ context: SiteAssistant.ScreenContext?) -> some View {
        modifier(AssistantContextModifier(context: context))
    }
}
