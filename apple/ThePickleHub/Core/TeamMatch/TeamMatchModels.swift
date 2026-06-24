import Foundation

// Native models for the Team Match (MLP) format. Read surfaces port of web
// TeamMatchView.tsx + useTeamMatch.ts. Tables: team_match_{tournaments,teams,
// matches,games,roster}. Scoring (lineup + sub-games) stays on web for now.

struct TMTournament: Decodable, Equatable {
    let id: UUID
    let shareID: String
    let name: String
    let status: String        // setup | registration | ongoing | completed
    let format: String        // round_robin | single_elimination | rr_playoff
    let teamCount: Int?
    let teamRosterSize: Int?
    let hasDreambreaker: Bool?
    let hasThirdPlaceMatch: Bool?
    let playoffTeamCount: Int?
    let requireRegistration: Bool?
    let createdBy: UUID?

    var displayName: String { name.nonEmpty ?? "Giải đồng đội" }

    var statusLabel: String {
        switch status {
        case "setup": return "Đang cài đặt"
        case "registration": return "Đang đăng ký"
        case "ongoing": return "Đang diễn ra"
        case "completed": return "Đã hoàn thành"
        default: return status
        }
    }

    var formatLabel: String {
        switch format {
        case "round_robin": return "Vòng tròn"
        case "single_elimination": return "Loại trực tiếp"
        case "rr_playoff": return "Vòng tròn + Playoff"
        default: return format
        }
    }

    enum CodingKeys: String, CodingKey {
        case id, name, status, format
        case shareID = "share_id"
        case teamCount = "team_count"
        case teamRosterSize = "team_roster_size"
        case hasDreambreaker = "has_dreambreaker"
        case hasThirdPlaceMatch = "has_third_place_match"
        case playoffTeamCount = "playoff_team_count"
        case requireRegistration = "require_registration"
        case createdBy = "created_by"
    }
}

struct TMTeam: Decodable, Identifiable, Equatable {
    let id: UUID
    let teamName: String
    let seed: Int?
    let groupID: UUID?
    let status: String?

    enum CodingKeys: String, CodingKey {
        case id, seed, status
        case teamName = "team_name"
        case groupID = "group_id"
    }
}

struct TMRosterPlayer: Decodable, Identifiable, Equatable {
    let id: UUID
    let teamID: UUID
    let playerName: String
    let gender: String?       // "male" | "female" (enum player_gender, never null on web)
    let isCaptain: Bool?
    let userID: UUID?
    let status: String?

    var isMale: Bool { gender == "male" }
    var isFemale: Bool { gender == "female" }
    var genderLabel: String { isFemale ? "Nữ" : isMale ? "Nam" : "—" }

    enum CodingKeys: String, CodingKey {
        case id, gender, status
        case teamID = "team_id"
        case playerName = "player_name"
        case isCaptain = "is_captain"
        case userID = "user_id"
    }
}

struct TMMatch: Decodable, Identifiable, Equatable {
    let id: UUID
    let teamAID: UUID?
    let teamBID: UUID?
    let gamesWonA: Int
    let gamesWonB: Int
    let totalPointsA: Int?
    let totalPointsB: Int?
    let winnerTeamID: UUID?
    let status: String?
    let roundNumber: Int?
    let isPlayoff: Bool
    let isThirdPlace: Bool
    let playoffRound: Int?
    let groupID: UUID?
    let displayOrder: Int?
    let nextMatchID: UUID?
    let nextMatchSlot: Int?     // 1 = team_a, 2 = team_b
    let lineupASubmitted: Bool
    let lineupBSubmitted: Bool
    let bracketPosition: Int?

    var isCompleted: Bool { status == "completed" }
    var hasBothTeams: Bool { teamAID != nil && teamBID != nil }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        teamAID = try c.decodeIfPresent(UUID.self, forKey: .teamAID)
        teamBID = try c.decodeIfPresent(UUID.self, forKey: .teamBID)
        gamesWonA = (try? c.decode(Int.self, forKey: .gamesWonA)) ?? 0
        gamesWonB = (try? c.decode(Int.self, forKey: .gamesWonB)) ?? 0
        totalPointsA = try c.decodeIfPresent(Int.self, forKey: .totalPointsA)
        totalPointsB = try c.decodeIfPresent(Int.self, forKey: .totalPointsB)
        winnerTeamID = try c.decodeIfPresent(UUID.self, forKey: .winnerTeamID)
        status = try c.decodeIfPresent(String.self, forKey: .status)
        roundNumber = try c.decodeIfPresent(Int.self, forKey: .roundNumber)
        isPlayoff = (try? c.decode(Bool.self, forKey: .isPlayoff)) ?? false
        isThirdPlace = (try? c.decode(Bool.self, forKey: .isThirdPlace)) ?? false
        playoffRound = try c.decodeIfPresent(Int.self, forKey: .playoffRound)
        groupID = try c.decodeIfPresent(UUID.self, forKey: .groupID)
        displayOrder = try c.decodeIfPresent(Int.self, forKey: .displayOrder)
        nextMatchID = try c.decodeIfPresent(UUID.self, forKey: .nextMatchID)
        nextMatchSlot = try c.decodeIfPresent(Int.self, forKey: .nextMatchSlot)
        lineupASubmitted = (try? c.decode(Bool.self, forKey: .lineupASubmitted)) ?? false
        lineupBSubmitted = (try? c.decode(Bool.self, forKey: .lineupBSubmitted)) ?? false
        bracketPosition = try c.decodeIfPresent(Int.self, forKey: .bracketPosition)
    }

    enum CodingKeys: String, CodingKey {
        case id, status
        case teamAID = "team_a_id"
        case teamBID = "team_b_id"
        case gamesWonA = "games_won_a"
        case gamesWonB = "games_won_b"
        case totalPointsA = "total_points_a"
        case totalPointsB = "total_points_b"
        case winnerTeamID = "winner_team_id"
        case roundNumber = "round_number"
        case isPlayoff = "is_playoff"
        case isThirdPlace = "is_third_place"
        case playoffRound = "playoff_round"
        case groupID = "group_id"
        case displayOrder = "display_order"
        case nextMatchID = "next_match_id"
        case nextMatchSlot = "next_match_slot"
        case lineupASubmitted = "lineup_a_submitted"
        case lineupBSubmitted = "lineup_b_submitted"
        case bracketPosition = "bracket_position"
    }
}

struct TMGame: Decodable, Identifiable, Equatable {
    let id: UUID
    let matchID: UUID
    let gameType: String       // WD | MD | MX | WS | MS
    let scoringType: String?   // rally21 | sideout11
    let displayName: String?
    let scoreA: Int?
    let scoreB: Int?
    let winnerTeamID: UUID?
    let lineupTeamA: [UUID]?
    let lineupTeamB: [UUID]?
    let isDreambreaker: Bool?
    let orderIndex: Int
    let status: String?

    /// Win target for the stepper hint (rally → 21, side-out → 11).
    var winTarget: Int { scoringType == "sideout11" ? 11 : 21 }

    /// VN label for a game type (matches web MLP slot naming).
    var typeLabel: String {
        if isDreambreaker == true { return "Dreambreaker" }
        switch gameType {
        case "WD": return "Đôi nữ"
        case "MD": return "Đôi nam"
        case "MX": return "Đôi nam nữ"
        case "WS": return "Đơn nữ"
        case "MS": return "Đơn nam"
        default: return displayName ?? gameType
        }
    }

    var isCompleted: Bool { status == "completed" }

    enum CodingKeys: String, CodingKey {
        case id, status
        case matchID = "match_id"
        case gameType = "game_type"
        case scoringType = "scoring_type"
        case displayName = "display_name"
        case scoreA = "score_a"
        case scoreB = "score_b"
        case winnerTeamID = "winner_team_id"
        case lineupTeamA = "lineup_team_a"
        case lineupTeamB = "lineup_team_b"
        case isDreambreaker = "is_dreambreaker"
        case orderIndex = "order_index"
    }
}

struct TMDetail: Equatable {
    let tournament: TMTournament
    let teams: [TMTeam]
    let roster: [TMRosterPlayer]
    let matches: [TMMatch]
    let games: [TMGame]

    func teamName(_ id: UUID?) -> String {
        guard let id, let t = teams.first(where: { $0.id == id }) else { return "TBD" }
        return t.teamName
    }

    func rosterName(_ id: UUID) -> String {
        roster.first(where: { $0.id == id })?.playerName ?? "—"
    }

    func games(for matchID: UUID) -> [TMGame] {
        games.filter { $0.matchID == matchID }.sorted { $0.orderIndex < $1.orderIndex }
    }

    func roster(for teamID: UUID) -> [TMRosterPlayer] {
        roster.filter { $0.teamID == teamID }
    }

    func match(_ id: UUID) -> TMMatch? { matches.first { $0.id == id } }

    var teamsBySeed: [TMTeam] {
        teams.sorted { ($0.seed ?? Int.max) < ($1.seed ?? Int.max) }
    }

    var rrMatches: [TMMatch] { matches.filter { !$0.isPlayoff } }
    var playoffMatches: [TMMatch] { matches.filter { $0.isPlayoff } }
    var hasPlayoff: Bool { !playoffMatches.isEmpty }

    /// Round-robin matches grouped into "Lượt N" sections (list view).
    var rrSections: [(title: String, matches: [TMMatch])] {
        let grouped = Dictionary(grouping: rrMatches) { $0.roundNumber ?? 0 }
        return grouped.keys.sorted().map { r in
            ("Lượt \(r)", (grouped[r] ?? []).sorted { ($0.displayOrder ?? 0) < ($1.displayOrder ?? 0) })
        }
    }

    /// Playoff (non-third-place) rounds ordered first-round → final for the bracket.
    /// playoff_round is highest at the first round (e.g. 3 for 8 teams) → final = 1,
    /// so sort DESCENDING to lay it out left→right.
    var mlpPlayoffRounds: [(round: Int, matches: [TMMatch])] {
        let po = playoffMatches.filter { !$0.isThirdPlace }
        let grouped = Dictionary(grouping: po) { $0.playoffRound ?? 0 }
        return grouped.keys.sorted(by: >).map { r in
            (r, (grouped[r] ?? []).sorted { ($0.displayOrder ?? 0) < ($1.displayOrder ?? 0) })
        }
    }

    var thirdPlaceMatch: TMMatch? { matches.first { $0.isThirdPlace } }

    /// Final (last round, single match) winner once decided.
    var champion: UUID? {
        guard let final = mlpPlayoffRounds.last, final.matches.count == 1,
              let m = final.matches.first, m.isCompleted else { return nil }
        return m.winnerTeamID
    }
    /// All round-robin matches scored — ready to seed the playoff (rr_playoff).
    var groupStageComplete: Bool { !rrMatches.isEmpty && rrMatches.allSatisfy { $0.isCompleted } }

    /// True when the format produces a round-robin standings table.
    var hasStandings: Bool {
        tournament.format == "round_robin" || tournament.format == "rr_playoff"
    }

    /// Round-robin standings. Mirrors web `useTeamMatchStandings`: only completed,
    /// non-playoff matches; sort by wins → game diff → points diff.
    var standings: [TMStanding] {
        var map: [UUID: TMStanding] = [:]
        for t in teams { map[t.id] = TMStanding(team: t) }
        for m in matches where m.isCompleted && !m.isPlayoff {
            guard let a = m.teamAID, let b = m.teamBID,
                  var sa = map[a], var sb = map[b] else { continue }
            sa.played += 1; sb.played += 1
            sa.gamesWon += m.gamesWonA; sa.gamesLost += m.gamesWonB
            sb.gamesWon += m.gamesWonB; sb.gamesLost += m.gamesWonA
            sa.pointsFor += m.totalPointsA ?? 0; sa.pointsAgainst += m.totalPointsB ?? 0
            sb.pointsFor += m.totalPointsB ?? 0; sb.pointsAgainst += m.totalPointsA ?? 0
            if m.winnerTeamID == a { sa.won += 1; sb.lost += 1 }
            else if m.winnerTeamID == b { sb.won += 1; sa.lost += 1 }
            map[a] = sa; map[b] = sb
        }
        return map.values.sorted {
            if $0.won != $1.won { return $0.won > $1.won }
            if $0.gameDiff != $1.gameDiff { return $0.gameDiff > $1.gameDiff }
            return $0.pointsDiff > $1.pointsDiff
        }
    }

    /// Match sections: round-robin rounds first, then playoff rounds.
    var sections: [(title: String, matches: [TMMatch])] {
        let sorted = matches.sorted {
            if $0.isPlayoff != $1.isPlayoff { return !$0.isPlayoff && $1.isPlayoff }
            let lr = ($0.isPlayoff ? $0.playoffRound : $0.roundNumber) ?? 0
            let rr = ($1.isPlayoff ? $1.playoffRound : $1.roundNumber) ?? 0
            if lr != rr { return lr < rr }
            return ($0.displayOrder ?? 0) < ($1.displayOrder ?? 0)
        }
        var result: [(String, [TMMatch])] = []
        // Round-robin grouped by round_number.
        let rr = sorted.filter { !$0.isPlayoff }
        let rrRounds = Dictionary(grouping: rr) { $0.roundNumber ?? 0 }
        for r in rrRounds.keys.sorted() {
            result.append(("Lượt \(r)", rrRounds[r]!.sorted { ($0.displayOrder ?? 0) < ($1.displayOrder ?? 0) }))
        }
        // Playoff grouped by playoff_round, labelled by match count.
        let po = sorted.filter { $0.isPlayoff }
        let poRounds = Dictionary(grouping: po) { $0.playoffRound ?? 0 }
        for r in poRounds.keys.sorted() {
            let ms = poRounds[r]!.sorted { ($0.displayOrder ?? 0) < ($1.displayOrder ?? 0) }
            let nonThird = ms.filter { !$0.isThirdPlace }
            result.append((playoffLabel(nonThird.count), ms))
        }
        return result
    }

    private func playoffLabel(_ count: Int) -> String {
        switch count {
        case 1: return "Chung kết"
        case 2: return "Bán kết"
        case 3...4: return "Tứ kết"
        default: return "Playoff"
        }
    }
}

/// One row of the round-robin standings table.
struct TMStanding: Identifiable, Equatable {
    let team: TMTeam
    var played = 0
    var won = 0
    var lost = 0
    var gamesWon = 0
    var gamesLost = 0
    var pointsFor = 0
    var pointsAgainst = 0

    var id: UUID { team.id }
    var gameDiff: Int { gamesWon - gamesLost }
    var pointsDiff: Int { pointsFor - pointsAgainst }
}

/// Gender + count requirement for a lineup slot. Mirrors web GAME_TYPE_REQUIREMENTS.
struct TMLineupRequirement: Equatable {
    let male: Int
    let female: Int
    var total: Int { male + female }
}

enum TMLineupRules {
    static let dreambreakerCount = 4   // DREAMBREAKER_PLAYER_COUNT (any gender)

    static func requirement(gameType: String, isDreambreaker: Bool) -> TMLineupRequirement {
        if isDreambreaker { return TMLineupRequirement(male: 0, female: 0) } // any genders, 4 total
        switch gameType {
        case "WD": return .init(male: 0, female: 2)
        case "MD": return .init(male: 2, female: 0)
        case "MX": return .init(male: 1, female: 1)
        case "WS": return .init(male: 0, female: 1)
        case "MS": return .init(male: 1, female: 0)
        default:   return .init(male: 0, female: 0)
        }
    }

    static func totalPlayers(gameType: String, isDreambreaker: Bool) -> Int {
        isDreambreaker ? dreambreakerCount : requirement(gameType: gameType, isDreambreaker: false).total
    }
}
