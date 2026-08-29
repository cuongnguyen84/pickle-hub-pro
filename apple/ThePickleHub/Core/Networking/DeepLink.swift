import Foundation

// ============================================================================
// DeepLink — parse URL mở app thành đích native.
// Nhận cả universal link (https://www.thepicklehub.net/...) lẫn custom
// scheme (thepicklehub://...). Production AASA claims `/tools/*`, so every
// shareable Bracket Lab detail route must resolve to a native destination.
// ============================================================================

enum DeepLink: Identifiable, Equatable {
    /// `/dang-ky/:magic_token` — người chơi tự quản lý đăng ký sự kiện.
    case registration(token: String)
    /// `/join/:invite_code` — nhận lời mời ghép đôi QuickTable trong app.
    case joinInvite(code: String)
    /// `/social/:slug` — chi tiết sự kiện giao lưu.
    case socialEvent(slug: String)
    /// `/live/:id` — livestream (từ notification "Nhắc tôi" hoặc link).
    case livestream(id: UUID)
    case quickTable(shareID: String)
    case quickTableScore(matchID: UUID)
    case parentTournament(shareID: String)
    case doublesElimination(shareID: String)
    case doublesEliminationScore(matchID: UUID)
    case teamMatch(shareID: String)
    case teamMatchScore(matchID: UUID)
    case flexTournament(shareID: String)
    case toolsHub
    case createQuickTable
    case createDoublesElimination
    case createTeamMatch
    case createFlexTournament
    case dashboardPicker
    case tournamentDashboard(type: String, id: String)
    case shopHome
    case shopSearch(query: String?)
    case shopCategory(ShopCategory)
    case shopProduct(slug: String)
    case shopStore(slug: String)
    case shopOrder(code: String)

    var id: String {
        switch self {
        case .registration(let t): "dang-ky/\(t)"
        case .joinInvite(let c): "join/\(c)"
        case .socialEvent(let s): "social/\(s)"
        case .livestream(let i): "live/\(i.uuidString)"
        case .quickTable(let shareID): "tools/quick-tables/\(shareID)"
        case .quickTableScore(let matchID): "tools/quick-tables/referee/\(matchID.uuidString)"
        case .parentTournament(let shareID): "tools/quick-tables/parent/\(shareID)"
        case .doublesElimination(let shareID): "tools/doubles-elimination/\(shareID)"
        case .doublesEliminationScore(let matchID): "tools/doubles-elimination/match/\(matchID.uuidString)/score"
        case .teamMatch(let shareID): "tools/team-match/\(shareID)"
        case .teamMatchScore(let matchID): "tools/team-match/match/\(matchID.uuidString)/score"
        case .flexTournament(let shareID): "tools/flex-tournament/\(shareID)"
        case .toolsHub: "tools"
        case .createQuickTable: "tools/quick-tables/new"
        case .createDoublesElimination: "tools/doubles-elimination/new"
        case .createTeamMatch: "tools/team-match/new"
        case .createFlexTournament: "tools/flex-tournament/new"
        case .dashboardPicker: "tools/dashboard"
        case .tournamentDashboard(let type, let id): "tools/dashboard/\(type)/\(id)"
        case .shopHome: "shop"
        case .shopSearch(let query): "shop/search?query=\(query ?? "")"
        case .shopCategory(let category): "shop/category/\(category.rawValue)"
        case .shopProduct(let slug): "shop/product/\(slug)"
        case .shopStore(let slug): "shop/store/\(slug)"
        case .shopOrder(let code): "shop/order/\(code)"
        }
    }

    private static let uuidRe = try! NSRegularExpression(
        pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
        options: [.caseInsensitive])

    static func parse(_ url: URL) -> DeepLink? {
        // Đường dẫn: https → path; custom scheme → host là segment đầu
        // (thepicklehub://dang-ky/<token> có host="dang-ky", path="/<token>").
        var segments: [String]
        if url.scheme == "thepicklehub" {
            segments = [url.host].compactMap { $0 } + url.pathComponents.filter { $0 != "/" }
        } else if let host = url.host,
                  host == "www.thepicklehub.net" || host == "thepicklehub.net" {
            segments = url.pathComponents.filter { $0 != "/" }
        } else {
            return nil
        }
        // Bỏ prefix /vi
        if segments.first == "vi" { segments.removeFirst() }

        if segments.first == "shop" { return parseShop(segments, url: url) }

        switch (segments.first, segments.count) {
        case ("dang-ky", 2):
            let token = segments[1].lowercased()
            let range = NSRange(token.startIndex..., in: token)
            guard uuidRe.firstMatch(in: token, range: range) != nil else { return nil }
            return .registration(token: token)
        case ("join", 2):
            return .joinInvite(code: segments[1])
        case ("social", 2):
            return .socialEvent(slug: segments[1])
        case ("live", 2):
            guard let uuid = UUID(uuidString: segments[1]) else { return nil }
            return .livestream(id: uuid)
        default:
            return parseTools(segments)
        }
    }

    private static func parseShop(_ segments: [String], url: URL) -> DeepLink? {
        if segments == ["shop"] { return .shopHome }
        if segments == ["shop", "search"] {
            let query = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?.first(where: { $0.name == "q" })?.value
            return .shopSearch(query: query?.isEmpty == false ? query : nil)
        }
        guard segments.count == 3 else { return nil }
        let slug = segments[2]
        guard !slug.isEmpty else { return nil }
        switch segments[1] {
        case "category": return ShopCategory(rawValue: slug).map(DeepLink.shopCategory)
        case "product": return .shopProduct(slug: slug)
        case "store": return .shopStore(slug: slug)
        case "order": return .shopOrder(code: slug)
        default: return nil
        }
    }

    private static func parseTools(_ segments: [String]) -> DeepLink? {
        guard segments.first == "tools" else { return nil }
        if segments.count == 1 {
            return .toolsHub
        }
        if segments == ["tools", "dashboard"] {
            return .dashboardPicker
        }
        if segments.count == 4,
           segments[1] == "dashboard",
           ["quick-table", "team-match", "doubles-elimination"].contains(segments[2]) {
            return .tournamentDashboard(type: segments[2], id: segments[3])
        }

        let toolRoots = ["quick-tables", "doubles-elimination", "team-match", "flex-tournament"]
        if segments.count == 2, toolRoots.contains(segments[1]) {
            return .toolsHub
        }
        if segments.count == 3, segments[2] == "new" {
            switch segments[1] {
            case "quick-tables": return .createQuickTable
            case "doubles-elimination": return .createDoublesElimination
            case "team-match": return .createTeamMatch
            case "flex-tournament": return .createFlexTournament
            default: break
            }
        }
        if segments.count == 4, segments[1] == "quick-tables", segments[2] == "parent" {
            return .parentTournament(shareID: segments[3])
        }
        if segments.count == 4, segments[1] == "quick-tables",
           segments[2] == "referee", let matchID = UUID(uuidString: segments[3]) {
            return .quickTableScore(matchID: matchID)
        }
        if segments.count == 5, segments[1] == "doubles-elimination",
           segments[2] == "match", segments[4] == "score",
           let matchID = UUID(uuidString: segments[3]) {
            return .doublesEliminationScore(matchID: matchID)
        }
        if segments.count == 5, segments[1] == "team-match",
           segments[2] == "match", segments[4] == "score",
           let matchID = UUID(uuidString: segments[3]) {
            return .teamMatchScore(matchID: matchID)
        }
        if (segments.count == 3 || (segments.count == 4 && segments[3] == "setup")),
           segments[1] == "quick-tables" {
            return .quickTable(shareID: segments[2])
        }
        if segments.count == 3, segments[1] == "doubles-elimination" {
            return .doublesElimination(shareID: segments[2])
        }
        if segments.count == 3, segments[1] == "team-match" {
            return .teamMatch(shareID: segments[2])
        }
        if segments.count == 3, segments[1] == "flex-tournament" {
            return .flexTournament(shareID: segments[2])
        }

        // Production AASA hands every `/tools/*` URL to the app. Keep unknown
        // organizer routes useful instead of presenting a blank sheet.
        return .toolsHub
    }
}
