import Foundation
import Supabase

enum WorldCupProEvent: String, CaseIterable, Codable, Sendable, Identifiable {
    case mensSingles = "pro_singles_mens"
    case womensSingles = "pro_singles_womens"
    case mensDoubles = "pro_doubles_mens"
    case womensDoubles = "pro_doubles_womens"
    case mixedDoubles = "pro_mixed"

    var id: String { rawValue }
    var title: String {
        switch self {
        case .mensSingles: "Đơn nam"
        case .womensSingles: "Đơn nữ"
        case .mensDoubles: "Đôi nam"
        case .womensDoubles: "Đôi nữ"
        case .mixedDoubles: "Đôi hỗn hợp"
        }
    }
}

enum WorldCupProStatus: String, Codable, Sendable {
    case scheduled
    case inProgress = "in_progress"
    case completed
}

struct WorldCupGameScore: Codable, Equatable, Sendable {
    let a: Int
    let b: Int
}

struct WorldCupProMatch: Codable, Equatable, Identifiable, Sendable {
    let matchID: String
    let categoryID: WorldCupProEvent
    let divisionName: String?
    let roundName: String?
    let roundNumber: Int?
    let matchIndex: Int?
    let entryAName: String?
    let entryASeed: Int?
    let entryBName: String?
    let entryBSeed: Int?
    let currentA: Int?
    let currentB: Int?
    let games: [WorldCupGameScore]
    let servingSide: String?
    let leaderSide: String?
    let status: WorldCupProStatus
    let isVietnam: Bool
    let venueName: String?
    let courtLabel: String?
    let scheduledAt: Date?
    let lastSeenAt: Date

    var id: String { matchID }
    var isLive: Bool { status == .inProgress }
    var sideAName: String { entryAName?.nilIfBlank ?? "—" }
    var sideBName: String { entryBName?.nilIfBlank ?? "—" }
    var sideAIsVietnamese: Bool { Self.isVietnameseName(entryAName) }
    var sideBIsVietnamese: Bool { Self.isVietnameseName(entryBName) }

    var visibleScore: (a: String, b: String) {
        if let currentA, let currentB { return (String(currentA), String(currentB)) }
        if let last = games.last { return (String(last.a), String(last.b)) }
        return ("–", "–")
    }

    var gameLine: String? {
        guard !games.isEmpty else { return nil }
        return games.map { "\($0.a)–\($0.b)" }.joined(separator: "  ·  ")
    }

    /// Mirrors the web parser's best-effort heuristic. The source does not
    /// publish reliable player nationality, so this only affects emphasis.
    static func isVietnameseName(_ name: String?) -> Bool {
        guard let name, !name.isEmpty else { return false }
        if name.contains("đ") || name.contains("Đ") { return true }
        let decomposed = name.decomposedStringWithCanonicalMapping
        if decomposed.unicodeScalars.contains(where: { [0x031B, 0x0323, 0x0309].contains(Int($0.value)) }) {
            return true
        }
        let folded = name.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "vi_VN"))
        let tokens = folded.lowercased().split { !$0.isLetter }.map(String.init)
        return !Set(tokens).isDisjoint(with: vietnameseSurnames)
    }

    private static let vietnameseSurnames: Set<String> = [
        "nguyen", "tran", "le", "pham", "hoang", "huynh", "phan", "vu", "vo", "dang",
        "bui", "do", "ho", "ngo", "duong", "ly", "dao", "dinh", "trinh", "cao", "doan",
        "ha", "luong", "luu", "mai", "truong", "chau", "quach", "ton", "thai", "dam",
        "khuc", "kieu", "lam", "lai", "ma", "nghiem", "ong", "ta", "ung",
    ]

    enum CodingKeys: String, CodingKey {
        case matchID = "match_id"
        case categoryID = "category_id"
        case divisionName = "division_name"
        case roundName = "round_name"
        case roundNumber = "round_num"
        case matchIndex = "match_index"
        case entryAName = "entry_a_name"
        case entryASeed = "entry_a_seed"
        case entryBName = "entry_b_name"
        case entryBSeed = "entry_b_seed"
        case currentA = "current_a"
        case currentB = "current_b"
        case games = "games_json"
        case servingSide = "serving_side"
        case leaderSide = "leader_side"
        case status, isVietnam = "is_vietnam", venueName = "venue_name"
        case courtLabel = "court_label"
        case scheduledAt = "scheduled_at"
        case lastSeenAt = "last_seen_at"
    }
}

struct WorldCupOpenTeam: Codable, Equatable, Identifiable, Sendable {
    let slug: String
    let groupLetter: String
    let seed: Int?
    let nameVI: String
    let nameEN: String
    let countryCode: String?

    var id: String { slug }
    var displayName: String { nameVI.nilIfBlank ?? nameEN }
    var flag: String {
        guard let code = countryCode?.uppercased(), code.count >= 2 else { return "🏳️" }
        let scalars = code.prefix(2).unicodeScalars.compactMap {
            UnicodeScalar(127_397 + Int($0.value))
        }
        return String(String.UnicodeScalarView(scalars))
    }

    enum CodingKeys: String, CodingKey {
        case slug, seed
        case groupLetter = "group_letter"
        case nameVI = "name_vi"
        case nameEN = "name_en"
        case countryCode = "country_code"
    }
}

enum WorldCupOpenStatus: String, Codable, Sendable {
    case scheduled, live, final
}

struct WorldCupOpenMatch: Codable, Equatable, Identifiable, Sendable {
    let matchID: String
    let groupLetter: String
    let round: String?
    let homeSlug: String
    let awaySlug: String
    let homeScore: Int?
    let awayScore: Int?
    let status: WorldCupOpenStatus
    let court: String?
    let startTime: Date?

    var id: String { matchID }

    enum CodingKeys: String, CodingKey {
        case matchID = "match_id"
        case groupLetter = "group_letter"
        case round
        case homeSlug = "home_slug"
        case awaySlug = "away_slug"
        case homeScore = "home_score"
        case awayScore = "away_score"
        case status, court
        case startTime = "start_time"
    }
}

struct WorldCupOpenGroup: Identifiable, Equatable, Sendable {
    let letter: String
    let teams: [WorldCupOpenTeam]
    let matches: [WorldCupOpenMatch]
    var id: String { letter }
    var containsVietnam: Bool { teams.contains { $0.slug == "viet_nam" } }
}

struct WorldCupLiveFeed: Equatable, Sendable {
    let proMatches: [WorldCupProMatch]
    let groups: [WorldCupOpenGroup]

    var liveProMatches: [WorldCupProMatch] { proMatches.filter(\.isLive) }
    var liveCount: Int { liveProMatches.count }
    var hasData: Bool { !proMatches.isEmpty || !groups.isEmpty }

    func matches(for event: WorldCupProEvent) -> [WorldCupProMatch] {
        proMatches.filter { $0.categoryID == event }.sorted(by: Self.matchOrder)
    }

    func matches(for event: WorldCupProEvent, athleteQuery query: String) -> [WorldCupProMatch] {
        let matches = matches(for: event)
        let needle = Self.searchKey(query)
        guard !needle.isEmpty else { return matches }
        return matches.filter {
            Self.searchKey($0.entryAName).contains(needle)
                || Self.searchKey($0.entryBName).contains(needle)
        }
    }

    func resultsToday(now: Date = Date(), calendar: Calendar = .worldCupVietnam) -> [WorldCupProMatch] {
        proMatches.filter {
            $0.status == .completed && calendar.isDate($0.lastSeenAt, inSameDayAs: now)
        }.sorted {
            $0.lastSeenAt > $1.lastSeenAt
        }
    }

    private static func matchOrder(_ lhs: WorldCupProMatch, _ rhs: WorldCupProMatch) -> Bool {
        let rank: [WorldCupProStatus: Int] = [.inProgress: 0, .completed: 1, .scheduled: 2]
        let left = rank[lhs.status] ?? 3
        let right = rank[rhs.status] ?? 3
        if left != right { return left < right }
        if lhs.roundNumber != rhs.roundNumber { return (lhs.roundNumber ?? -1) > (rhs.roundNumber ?? -1) }
        if lhs.matchIndex != rhs.matchIndex { return (lhs.matchIndex ?? -1) > (rhs.matchIndex ?? -1) }
        if lhs.lastSeenAt != rhs.lastSeenAt { return lhs.lastSeenAt > rhs.lastSeenAt }
        return lhs.matchID < rhs.matchID
    }

    private static func searchKey(_ value: String?) -> String {
        (value ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "vi_VN"))
            .lowercased()
    }

    static func build(
        proMatches: [WorldCupProMatch],
        teams: [WorldCupOpenTeam],
        openMatches: [WorldCupOpenMatch]
    ) -> WorldCupLiveFeed {
        let groups = Dictionary(grouping: teams, by: \.groupLetter).map { letter, teams in
            WorldCupOpenGroup(
                letter: letter,
                teams: teams.sorted {
                    ($0.seed ?? .max, $0.nameEN) < ($1.seed ?? .max, $1.nameEN)
                },
                matches: openMatches.filter { $0.groupLetter == letter }
            )
        }.sorted {
            if $0.containsVietnam != $1.containsVietnam { return $0.containsVietnam }
            return $0.letter < $1.letter
        }
        return WorldCupLiveFeed(proMatches: proMatches, groups: groups)
    }
}

protocol WorldCupLiveRepositoryProtocol: Sendable {
    func feed() async throws -> WorldCupLiveFeed
}

struct WorldCupLiveRepository: WorldCupLiveRepositoryProtocol {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    func feed() async throws -> WorldCupLiveFeed {
        async let pro: [WorldCupProMatch] = client.from("wc_pro_matches")
            .select("match_id,category_id,division_name,round_name,round_num,match_index,entry_a_name,entry_a_seed,entry_b_name,entry_b_seed,current_a,current_b,games_json,serving_side,leader_side,status,is_vietnam,venue_name,court_label,scheduled_at,last_seen_at")
            .order("last_seen_at", ascending: false)
            .execute().value
        async let teams: [WorldCupOpenTeam] = client.from("wc_open_teams")
            .select("slug,group_letter,seed,name_vi,name_en,country_code")
            .order("group_letter", ascending: true)
            .order("seed", ascending: true)
            .execute().value
        async let matches: [WorldCupOpenMatch] = client.from("wc_open_matches")
            .select("match_id,group_letter,round,home_slug,away_slug,home_score,away_score,status,court,start_time")
            .order("start_time", ascending: true)
            .execute().value

        return try await .build(proMatches: pro, teams: teams, openMatches: matches)
    }
}

extension Calendar {
    static var worldCupVietnam: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Ho_Chi_Minh") ?? .current
        return calendar
    }
}

private extension String {
    var nilIfBlank: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}
