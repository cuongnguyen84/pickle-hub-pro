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

    enum CodingKeys: String, CodingKey {
        case id
        case teamID = "team_id"
        case playerName = "player_name"
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

    var isCompleted: Bool { status == "completed" }

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
    }
}

struct TMGame: Decodable, Identifiable, Equatable {
    let id: UUID
    let matchID: UUID
    let gameType: String       // WD | MD | MX | WS | MS
    let displayName: String?
    let scoreA: Int?
    let scoreB: Int?
    let winnerTeamID: UUID?
    let lineupTeamA: [UUID]?
    let lineupTeamB: [UUID]?
    let isDreambreaker: Bool?
    let orderIndex: Int
    let status: String?

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

    var teamsBySeed: [TMTeam] {
        teams.sorted { ($0.seed ?? Int.max) < ($1.seed ?? Int.max) }
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
