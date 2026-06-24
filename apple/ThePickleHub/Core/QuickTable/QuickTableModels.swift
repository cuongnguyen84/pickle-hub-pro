import Foundation

/// A `quick_tables` row (the tournament itself).
struct QTTable: Decodable, Equatable {
    let id: UUID
    let shareID: String
    let name: String?
    let status: String?       // setup | group_stage | playoff | completed
    let format: String?       // round_robin | large_playoff
    let isDoubles: Bool?
    let creatorUserID: UUID?
    let topPerGroup: Int?

    var displayName: String { name?.nonEmpty ?? "Giải đấu" }
    var isPlayoffStage: Bool { status == "playoff" || status == "completed" }

    var statusLabel: String {
        switch status {
        case "setup": return "Đang chuẩn bị"
        case "group_stage": return "Vòng bảng"
        case "playoff": return "Playoff"
        case "completed": return "Đã kết thúc"
        default: return status ?? "—"
        }
    }

    enum CodingKeys: String, CodingKey {
        case id, name, status, format
        case shareID = "share_id"
        case isDoubles = "is_doubles"
        case creatorUserID = "creator_user_id"
        case topPerGroup = "top_per_group"
    }
}

struct QTGroup: Decodable, Identifiable, Equatable {
    let id: UUID
    let name: String
    let displayOrder: Int?

    enum CodingKeys: String, CodingKey {
        case id, name
        case displayOrder = "display_order"
    }
}

struct QTPlayer: Decodable, Identifiable, Equatable {
    let id: UUID
    let groupID: UUID?
    let name: String
    let team: String?
    let seed: Int?
    let matchesPlayed: Int
    let matchesWon: Int
    let pointsFor: Int
    let pointsAgainst: Int
    let pointDiff: Int
    let isQualified: Bool?
    let isWildcard: Bool?
    let playoffSeed: Int?

    enum CodingKeys: String, CodingKey {
        case id, name, team, seed
        case groupID = "group_id"
        case matchesPlayed = "matches_played"
        case matchesWon = "matches_won"
        case pointsFor = "points_for"
        case pointsAgainst = "points_against"
        case pointDiff = "point_diff"
        case isQualified = "is_qualified"
        case isWildcard = "is_wildcard"
        case playoffSeed = "playoff_seed"
    }
}

struct QTMatch: Decodable, Identifiable, Equatable {
    let id: UUID
    let groupID: UUID?
    let isPlayoff: Bool
    let playoffRound: Int?
    let playoffMatchNumber: Int?
    let player1ID: UUID?
    let player2ID: UUID?
    let score1: Int?
    let score2: Int?
    let winnerID: UUID?
    let status: String
    let courtName: String?
    let displayOrder: Int?

    var isCompleted: Bool { status == "completed" }
    var hasBothPlayers: Bool { player1ID != nil && player2ID != nil }

    enum CodingKeys: String, CodingKey {
        case id, status, score1, score2
        case groupID = "group_id"
        case isPlayoff = "is_playoff"
        case playoffRound = "playoff_round"
        case playoffMatchNumber = "playoff_match_number"
        case player1ID = "player1_id"
        case player2ID = "player2_id"
        case winnerID = "winner_id"
        case courtName = "court_name"
        case displayOrder = "display_order"
    }
}

/// A group-config suggestion for wizard step 3. Port of web suggestGroupConfigs.
struct GroupSuggestion: Identifiable, Equatable {
    let groupCount: Int
    let playersPerGroup: [Int]
    let isRecommended: Bool
    let reason: String
    let wildcardNeeded: Int
    let totalPlayoffSpots: Int
    var id: Int { groupCount }

    static func suggest(playerCount: Int) -> [GroupSuggestion] {
        let valid = [2, 3, 4, 6, 8]
        var out: [GroupSuggestion] = []
        for k in valid {
            if k > playerCount { continue }
            let base = playerCount / k
            let rem = playerCount % k
            let minSize = base
            let maxSize = rem > 0 ? base + 1 : base
            if minSize < 3 || maxSize > 6 { continue }
            if maxSize - minSize > 1 { continue }
            // Deterministic: the first `rem` groups are the larger ones.
            let ppg = (0..<k).map { $0 < rem ? base + 1 : base }
            let directSpots = k * 2
            var ideal = 4
            if directSpots >= 6 { ideal = 8 }
            if directSpots >= 12 { ideal = 16 }
            if directSpots >= 24 { ideal = 32 }
            let wildcard = max(0, ideal - directSpots)
            var recommended = false
            let reason: String
            if wildcard == 0 { recommended = true; reason = "Không cần wildcard, vào thẳng playoff" }
            else if wildcard <= 4 { reason = "Cần \(wildcard) wildcard" }
            else { reason = "Cần \(wildcard) wildcard (không khuyến nghị)" }
            if (k == 4 || k == 8) && wildcard == 0 { recommended = true }
            out.append(GroupSuggestion(groupCount: k, playersPerGroup: ppg, isRecommended: recommended,
                                       reason: reason, wildcardNeeded: wildcard, totalPlayoffSpots: ideal))
        }
        return out
    }
}

/// Composed snapshot of a quick table for the native detail view.
struct QuickTableDetail: Equatable {
    let table: QTTable
    let groups: [QTGroup]
    let players: [QTPlayer]
    let matches: [QTMatch]

    func name(for playerID: UUID?) -> String {
        guard let playerID, let p = players.first(where: { $0.id == playerID }) else { return "—" }
        return p.name
    }

    /// Players in a group, sorted by wins → point diff → points for (web order).
    func standings(groupID: UUID) -> [QTPlayer] {
        players.filter { $0.groupID == groupID }.sorted {
            if $0.matchesWon != $1.matchesWon { return $0.matchesWon > $1.matchesWon }
            if $0.pointDiff != $1.pointDiff { return $0.pointDiff > $1.pointDiff }
            return $0.pointsFor > $1.pointsFor
        }
    }

    func matches(groupID: UUID) -> [QTMatch] {
        matches.filter { $0.groupID == groupID && !$0.isPlayoff }
            .sorted { ($0.displayOrder ?? 0) < ($1.displayOrder ?? 0) }
    }

    var playoffMatches: [QTMatch] {
        matches.filter { $0.isPlayoff }
            .sorted {
                if ($0.playoffRound ?? 0) != ($1.playoffRound ?? 0) { return ($0.playoffRound ?? 0) < ($1.playoffRound ?? 0) }
                return ($0.playoffMatchNumber ?? 0) < ($1.playoffMatchNumber ?? 0)
            }
    }

    /// Playoff matches grouped by round (ascending), matches ordered within round.
    var playoffByRound: [(round: Int, matches: [QTMatch])] {
        let grouped = Dictionary(grouping: matches.filter { $0.isPlayoff }) { $0.playoffRound ?? 0 }
        return grouped.keys.sorted().map { r in
            (r, (grouped[r] ?? []).sorted { ($0.playoffMatchNumber ?? 0) < ($1.playoffMatchNumber ?? 0) })
        }
    }

    /// The final-round single match winner once it's completed.
    var championID: UUID? {
        guard let last = playoffByRound.last, last.matches.count == 1,
              let f = last.matches.first, f.isCompleted else { return nil }
        return f.winnerID
    }

    var hasPlayoff: Bool { matches.contains { $0.isPlayoff } }

    /// All group-stage matches done (drives the "advance to playoff" CTA).
    var groupStageComplete: Bool {
        let gm = matches.filter { !$0.isPlayoff }
        return !gm.isEmpty && gm.allSatisfy { $0.isCompleted }
    }
}
