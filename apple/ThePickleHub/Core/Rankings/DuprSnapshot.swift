import Foundation

/// DUPR ranking scopes, mirroring the web `DUPR_SCOPES`. Vietnam reads live from
/// the `dupr_leaderboard_vietnam` RPC; every other scope is a static DUPR.com
/// snapshot bundled as `dupr-rankings.json`.
enum DuprScope: String, CaseIterable, Identifiable {
    case vietnam
    case open
    case junior
    case asia
    case northAmerica     = "north-america"
    case southAmerica     = "south-america"
    case australiaOceania = "australia-oceania"
    case europe

    var id: String { rawValue }
    var isVietnam: Bool { self == .vietnam }

    enum Group { case national, global, continent }

    var group: Group {
        switch self {
        case .vietnam: return .national
        case .open, .junior: return .global
        default: return .continent
        }
    }

    var labelVi: String {
        switch self {
        case .vietnam: return "Việt Nam"
        case .open: return "Mở rộng"
        case .junior: return "Trẻ"
        case .asia: return "Châu Á"
        case .northAmerica: return "Bắc Mỹ"
        case .southAmerica: return "Nam Mỹ"
        case .australiaOceania: return "Úc / ĐD"
        case .europe: return "Châu Âu"
        }
    }
}

/// DUPR formats. Vietnam aggregates into singles/doubles (no gender column);
/// the static scopes are gender-split.
enum DuprFormat: String, CaseIterable, Identifiable {
    case mensSingles   = "mens-singles"
    case womensSingles = "womens-singles"
    case mensDoubles   = "mens-doubles"
    case womensDoubles = "womens-doubles"
    case singles
    case doubles

    var id: String { rawValue }

    var labelVi: String {
        switch self {
        case .mensSingles: return "Đơn nam"
        case .womensSingles: return "Đơn nữ"
        case .mensDoubles: return "Đôi nam"
        case .womensDoubles: return "Đôi nữ"
        case .singles: return "Đơn"
        case .doubles: return "Đôi"
        }
    }
}

func availableFormats(for scope: DuprScope) -> [DuprFormat] {
    scope == .vietnam ? [.doubles, .singles] : [.mensSingles, .womensSingles, .mensDoubles, .womensDoubles]
}

func defaultFormat(for scope: DuprScope) -> DuprFormat {
    scope == .vietnam ? .doubles : .mensDoubles
}

/// Static snapshot date shown as attribution for non-Vietnam scopes.
let duprLastUpdated = "2026-06-15"

/// One player in the static snapshot.
struct DuprPlayer: Decodable {
    let rank: Int
    let name: String
    let age: Int?
    let rating: Double?
}

/// Loads + caches the bundled DUPR snapshot (scope → format → players).
enum DuprSnapshot {
    private static let data: [String: [String: [DuprPlayer]]] = {
        guard let url = Bundle.main.url(forResource: "dupr-rankings", withExtension: "json"),
              let raw = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode([String: [String: [DuprPlayer]]].self, from: raw)
        else { return [:] }
        return decoded
    }()

    static func players(scope: DuprScope, format: DuprFormat) -> [DuprPlayer] {
        data[scope.rawValue]?[format.rawValue] ?? []
    }
}

/// Unified display row for both the live Vietnam leaderboard and the static
/// snapshot. `username` is set only for live rows (⇒ tappable profile).
struct RankRow: Identifiable {
    let id: String
    let rank: Int
    let name: String
    let subtitle: String?
    let rating: Double?
    let avatarURL: String?
    let username: String?
    let isStale: Bool

    var rankText: String { String(format: "%02d", rank) }
    var ratingText: String { rating.map { String(format: "%.3f", $0) } ?? "—" }
}
