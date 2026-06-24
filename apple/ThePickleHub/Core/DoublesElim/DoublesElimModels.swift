import Foundation

// Native models for the Doubles Elimination format (Bracket Lab). Faithful port
// of web `src/hooks/useDoublesElimination.ts` types + `doubles-bracket-utils.ts`.
// Backend tables: doubles_elimination_{tournaments,teams,matches}.

// MARK: Tournament

struct DETournament: Decodable, Equatable {
    let id: UUID
    let name: String
    let shareID: String
    let creatorUserID: UUID?
    let teamCount: Int
    let hasThirdPlaceMatch: Bool
    let earlyRoundsFormat: String   // bo1 | bo3 | bo5
    let semifinalsFormat: String?
    let finalsFormat: String
    let status: String              // setup | registration_open | ongoing | completed
    let courtCount: Int
    let startTime: String?
    let ratingSource: String?
    let minDuprRating: Double?
    let maxDuprRating: Double?
    let createdAt: String?

    var displayName: String { name.nonEmpty ?? "Giải đấu" }

    var statusLabel: String {
        switch status {
        case "setup": return "Đang cài đặt"
        case "registration_open": return "Đang mở đăng ký"
        case "ongoing": return "Đang diễn ra"
        case "completed": return "Đã hoàn thành"
        default: return status
        }
    }

    enum CodingKeys: String, CodingKey {
        case id, name, status
        case shareID = "share_id"
        case creatorUserID = "creator_user_id"
        case teamCount = "team_count"
        case hasThirdPlaceMatch = "has_third_place_match"
        case earlyRoundsFormat = "early_rounds_format"
        case semifinalsFormat = "semifinals_format"
        case finalsFormat = "finals_format"
        case courtCount = "court_count"
        case startTime = "start_time"
        case ratingSource = "rating_source"
        case minDuprRating = "min_dupr_rating"
        case maxDuprRating = "max_dupr_rating"
        case createdAt = "created_at"
    }
}

// MARK: Team

struct DETeam: Decodable, Identifiable, Equatable {
    let id: UUID
    let teamName: String
    let player1Name: String?
    let player2Name: String?
    let seed: Int?
    let totalPointsFor: Int
    let totalPointsAgainst: Int
    let pointDiff: Int
    let status: String
    let eliminatedAtRound: Int?
    // Open-registration (Sprint E.3/E.4) — populated only for DUPR-flow teams.
    let player1UserID: UUID?
    let player2UserID: UUID?
    let duprAvgRating: Double?
    let duprSeedSource: String?   // exact | approx | none

    var isEliminated: Bool { status == "eliminated" }

    /// The current user owns this registration if they sit in either slot.
    func belongsTo(_ userID: UUID?) -> Bool {
        guard let userID else { return false }
        return player1UserID == userID || player2UserID == userID
    }

    /// "name (seed)" like web formatTeamName.
    var displayLabel: String {
        if let seed { return "\(teamName) (\(seed))" }
        return teamName
    }

    var playersLine: String {
        let p1 = player1Name ?? ""
        if let p2 = player2Name?.nonEmpty { return "\(p1) / \(p2)" }
        return p1
    }

    enum CodingKeys: String, CodingKey {
        case id, seed, status
        case teamName = "team_name"
        case player1Name = "player1_name"
        case player2Name = "player2_name"
        case totalPointsFor = "total_points_for"
        case totalPointsAgainst = "total_points_against"
        case pointDiff = "point_diff"
        case eliminatedAtRound = "eliminated_at_round"
        case player1UserID = "player1_user_id"
        case player2UserID = "player2_user_id"
        case duprAvgRating = "dupr_avg_rating"
        case duprSeedSource = "dupr_seed_source"
    }
}

// MARK: Referee (doubles_elimination_referees + public_profiles display name)

struct DEReferee: Identifiable, Equatable {
    let id: UUID
    let userID: UUID
    let displayName: String?
}

// MARK: Game (one game inside a BO3/BO5 match)

struct DEGame: Codable, Equatable {
    let game: Int
    let scoreA: Int
    let scoreB: Int
    let winner: String   // "a" | "b"

    enum CodingKeys: String, CodingKey {
        case game, winner
        case scoreA = "score_a"
        case scoreB = "score_b"
    }
}

// MARK: JSONB source/dest pointer (read + write)

/// Flexible JSONB shape used by source_a/source_b/dest_*. Only non-nil keys are
/// encoded so inserts match the web payloads exactly.
struct DEJSON: Codable, Equatable {
    var type: String?
    var position: Int?
    var round: Int?
    var matchIndex: Int?
    var roundType: String?
    var teamID: String?

    enum CodingKeys: String, CodingKey {
        case type, position, round
        case matchIndex = "match_index"
        case roundType = "round_type"
        case teamID = "team_id"
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(type, forKey: .type)
        try c.encodeIfPresent(position, forKey: .position)
        try c.encodeIfPresent(round, forKey: .round)
        try c.encodeIfPresent(matchIndex, forKey: .matchIndex)
        try c.encodeIfPresent(roundType, forKey: .roundType)
        try c.encodeIfPresent(teamID, forKey: .teamID)
    }
}

// MARK: Match

struct DEMatch: Decodable, Identifiable, Equatable {
    let id: UUID
    let tournamentID: UUID
    let roundNumber: Int
    let roundType: String   // winner_r1 | loser_r2 | merge_r3 | elimination | quarterfinal | semifinal | third_place | final
    let bracketType: String // winner | loser | merged | single
    let matchNumber: Int
    let teamAID: UUID?
    let teamBID: UUID?
    let scoreA: Int
    let scoreB: Int
    let winnerID: UUID?
    let bestOf: Int
    let games: [DEGame]
    let gamesWonA: Int
    let gamesWonB: Int
    let sourceA: DEJSON?
    let sourceB: DEJSON?
    let isBye: Bool
    let displayOrder: Int
    let status: String      // pending | live | completed
    let courtNumber: Int?
    let startTime: String?

    var isCompleted: Bool { status == "completed" }
    var isLive: Bool { status == "live" }
    var isBestOf: Bool { bestOf > 1 }
    var hasBothTeams: Bool { teamAID != nil && teamBID != nil }

    // games can come back as null/missing → default to [].
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        tournamentID = try c.decode(UUID.self, forKey: .tournamentID)
        roundNumber = try c.decode(Int.self, forKey: .roundNumber)
        roundType = try c.decode(String.self, forKey: .roundType)
        bracketType = try c.decode(String.self, forKey: .bracketType)
        matchNumber = try c.decode(Int.self, forKey: .matchNumber)
        teamAID = try c.decodeIfPresent(UUID.self, forKey: .teamAID)
        teamBID = try c.decodeIfPresent(UUID.self, forKey: .teamBID)
        scoreA = (try? c.decode(Int.self, forKey: .scoreA)) ?? 0
        scoreB = (try? c.decode(Int.self, forKey: .scoreB)) ?? 0
        winnerID = try c.decodeIfPresent(UUID.self, forKey: .winnerID)
        bestOf = (try? c.decode(Int.self, forKey: .bestOf)) ?? 1
        games = (try? c.decodeIfPresent([DEGame].self, forKey: .games)) ?? []
        gamesWonA = (try? c.decode(Int.self, forKey: .gamesWonA)) ?? 0
        gamesWonB = (try? c.decode(Int.self, forKey: .gamesWonB)) ?? 0
        sourceA = try? c.decodeIfPresent(DEJSON.self, forKey: .sourceA)
        sourceB = try? c.decodeIfPresent(DEJSON.self, forKey: .sourceB)
        isBye = (try? c.decode(Bool.self, forKey: .isBye)) ?? false
        displayOrder = (try? c.decode(Int.self, forKey: .displayOrder)) ?? 0
        status = try c.decode(String.self, forKey: .status)
        courtNumber = try c.decodeIfPresent(Int.self, forKey: .courtNumber)
        startTime = try c.decodeIfPresent(String.self, forKey: .startTime)
    }

    enum CodingKeys: String, CodingKey {
        case id, games, status
        case tournamentID = "tournament_id"
        case roundNumber = "round_number"
        case roundType = "round_type"
        case bracketType = "bracket_type"
        case matchNumber = "match_number"
        case teamAID = "team_a_id"
        case teamBID = "team_b_id"
        case scoreA = "score_a"
        case scoreB = "score_b"
        case winnerID = "winner_id"
        case bestOf = "best_of"
        case gamesWonA = "games_won_a"
        case gamesWonB = "games_won_b"
        case sourceA = "source_a"
        case sourceB = "source_b"
        case isBye = "is_bye"
        case displayOrder = "display_order"
        case courtNumber = "court_number"
        case startTime = "start_time"
    }
}

// MARK: Composed snapshot

struct DEDetail: Equatable {
    let tournament: DETournament
    let teams: [DETeam]
    let matches: [DEMatch]

    func team(_ id: UUID?) -> DETeam? {
        guard let id else { return nil }
        return teams.first { $0.id == id }
    }

    func teamLabel(_ id: UUID?) -> String { team(id)?.displayLabel ?? "TBD" }

    // Preliminary groupings (web bracket sections).
    var r1Matches: [DEMatch] {
        matches.filter { $0.roundNumber == 1 && $0.bracketType == "winner" }
            .sorted { $0.matchNumber < $1.matchNumber }
    }
    var r2Matches: [DEMatch] {
        matches.filter { $0.roundNumber == 2 && $0.bracketType == "loser" }
            .sorted { $0.matchNumber < $1.matchNumber }
    }
    var r3Matches: [DEMatch] {
        matches.filter { $0.roundNumber == 3 }.sorted { $0.matchNumber < $1.matchNumber }
    }

    /// Playoff rounds (>= 4) grouped by round number, excluding third-place.
    var playoffRounds: [(round: Int, type: String, matches: [DEMatch])] {
        let playoff = matches.filter { $0.roundNumber >= 4 && $0.roundType != "third_place" }
        let grouped = Dictionary(grouping: playoff) { $0.roundNumber }
        return grouped.keys.sorted().map { round in
            let ms = (grouped[round] ?? []).sorted { $0.matchNumber < $1.matchNumber }
            return (round, ms.first?.roundType ?? "elimination", ms)
        }
    }

    var thirdPlaceMatch: DEMatch? { matches.first { $0.roundType == "third_place" } }
    var finalMatch: DEMatch? { matches.first { $0.roundType == "final" } }
    var champion: DETeam? { team(finalMatch?.winnerID) }

    var hasPlayoff: Bool { matches.contains { $0.roundNumber >= 4 } }

    // Open-registration helpers (status == registration_open).
    var isRegistrationOpen: Bool { tournament.status == "registration_open" }
    var isFull: Bool { teams.count >= tournament.teamCount }
    func myTeam(_ userID: UUID?) -> DETeam? { teams.first { $0.belongsTo(userID) } }

    /// Court queue board source — playable matches (both teams, not done) ordered
    /// by display_order. Court assignment lives on R1/R2 + playoff R4 matches.
    var upcomingCourtMatches: [DEMatch] {
        matches.filter { $0.status != "completed" && $0.hasBothTeams }
            .sorted { $0.displayOrder < $1.displayOrder }
    }
    var hasUpcomingCourtMatches: Bool { !upcomingCourtMatches.isEmpty }

    var r1Completed: Bool { !r1Matches.isEmpty && r1Matches.allSatisfy { $0.isCompleted } }
    var r2Completed: Bool { !r2Matches.isEmpty && r2Matches.allSatisfy { $0.isCompleted } }
    var r3NeedsAssignment: Bool { !r3Matches.isEmpty && r3Matches.contains { $0.teamAID == nil || $0.teamBID == nil } }
    var r3Completed: Bool { !r3Matches.isEmpty && r3Matches.allSatisfy { $0.isCompleted } }

    /// Teams sorted by point diff (web "teams" tab uses seed order; standings use diff).
    var teamsBySeed: [DETeam] {
        teams.sorted { ($0.seed ?? Int.max) < ($1.seed ?? Int.max) }
    }
}

// MARK: Bracket utilities (port of doubles-bracket-utils.ts)

enum DEBracket {
    static func getBestOf(roundType: String, early: String, semifinals: String, finals: String) -> Int {
        func n(_ f: String) -> Int { f == "bo5" ? 5 : f == "bo3" ? 3 : 1 }
        if roundType == "final" || roundType == "third_place" { return n(finals) }
        if roundType == "semifinal" { return n(semifinals) }
        return n(early)
    }

    static func seedPositions(_ size: Int) -> [Int] {
        switch size {
        case 2: return [0, 1]
        case 4: return [0, 3, 2, 1]
        case 8: return [0, 7, 4, 3, 2, 5, 6, 1]
        case 16: return [0, 15, 8, 7, 4, 11, 12, 3, 2, 13, 10, 5, 6, 9, 14, 1]
        case 32: return [0, 31, 16, 15, 8, 23, 24, 7, 4, 27, 20, 11, 12, 19, 28, 3,
                         2, 29, 18, 13, 10, 21, 26, 5, 6, 25, 22, 9, 14, 17, 30, 1]
        default:
            guard size > 2 else { return [0, 1] }
            let half = seedPositions(size / 2)
            var out: [Int] = []
            for h in half {
                out.append(h * 2)
                out.append(size - 1 - h * 2)
            }
            return out
        }
    }

    /// Mutates `courtNextSlot`, returns (court, "HH:mm"). Port of assignCourtAndTime.
    static func assignCourtAndTime(_ courtNextSlot: inout [Int: Int], courts: [Int],
                                   startHour: Int, startMinute: Int, duration: Int) -> (court: Int, time: String) {
        let minSlot = courtNextSlot.values.min() ?? 0
        let court = courts.first { courtNextSlot[$0] == minSlot } ?? courts.first ?? 1
        let slot = courtNextSlot[court] ?? 0
        let total = startHour * 60 + startMinute + slot * duration
        let hour = (total / 60) % 24
        let minute = total % 60
        courtNextSlot[court] = slot + 1
        return (court, String(format: "%02d:%02d", hour, minute))
    }
}
