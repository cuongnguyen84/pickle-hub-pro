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
    let requiresRegistration: Bool?

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
        case requiresRegistration = "requires_registration"
    }
}

/// A `quick_table_registrations` row (self-signup awaiting BTC approval).
struct QTRegistration: Decodable, Identifiable, Equatable {
    let id: UUID
    let userID: UUID
    let displayName: String
    let team: String?
    let ratingSystem: String?     // DUPR | other | none
    let skillLevel: Double?
    let profileLink: String?
    let status: String            // pending | approved | rejected
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, team, status
        case userID = "user_id"
        case displayName = "display_name"
        case ratingSystem = "rating_system"
        case skillLevel = "skill_level"
        case profileLink = "profile_link"
        case createdAt = "created_at"
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
    let name: String                 // nhãn gộp hiển thị ("An & Bình" cho đôi)
    let player1Name: String?         // tên VĐV 1 (đôi/đơn) — cho màn trọng tài
    let player2Name: String?         // tên VĐV 2 (chỉ đôi)
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
        case player1Name = "player1_name"
        case player2Name = "player2_name"
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

/// One first-round playoff pairing produced by `QTPlayoff.bracket`.
struct QTBracketMatch: Equatable {
    let player1: UUID?
    let player2: UUID?
    let position: String   // upper | lower
    let matchNumber: Int
}

/// Pure playoff logic — 1:1 port of useQuickTable getQualifiedPlayers /
/// getWildcardCount / generatePlayoffBracket. No DB.
enum QTPlayoff {
    /// Wildcards needed to pad to the bracket size (web getWildcardCount).
    static func wildcardCount(groupCount: Int) -> Int {
        switch groupCount { case 3: return 2; case 6: return 4; default: return 0 }
    }

    /// Top-`topPerGroup` per group (playoff_seed 1..N) + the 3rd-placers.
    static func qualify(groups: [QTGroup], players: [QTPlayer], topPerGroup: Int = 2)
        -> (qualified: [(player: QTPlayer, seed: Int)], thirdPlace: [QTPlayer]) {
        var qualified: [(QTPlayer, Int)] = []
        var thirdPlace: [QTPlayer] = []
        for g in groups {
            let gp = players.filter { $0.groupID == g.id }.sorted {
                if $0.matchesWon != $1.matchesWon { return $0.matchesWon > $1.matchesWon }
                return $0.pointDiff > $1.pointDiff
            }
            for (idx, p) in gp.prefix(topPerGroup).enumerated() { qualified.append((p, idx + 1)) }
            if gp.count > topPerGroup { thirdPlace.append(gp[topPerGroup]) }
        }
        return (qualified, thirdPlace)
    }

    /// Third-placers ranked for the wildcard picker (wins → diff → points for).
    static func rankThirdPlace(_ players: [QTPlayer]) -> [QTPlayer] {
        players.sorted {
            if $0.matchesWon != $1.matchesWon { return $0.matchesWon > $1.matchesWon }
            if $0.pointDiff != $1.pointDiff { return $0.pointDiff > $1.pointDiff }
            return $0.pointsFor > $1.pointsFor
        }
    }

    /// First-round pairings per group count (exact web tables).
    static func bracket(groupCount: Int, qualified: [(player: QTPlayer, seed: Int)],
                        wildcards: [QTPlayer], groups: [QTGroup]) -> [QTBracketMatch] {
        var wc = wildcards
        var wcIndex = 0
        func player(_ gname: String, _ seed: Int) -> UUID? {
            guard let g = groups.first(where: { $0.name == gname }) else { return nil }
            return qualified.first(where: { $0.player.groupID == g.id && $0.seed == seed })?.player.id
        }
        func nextWildcard(_ exclude: UUID?) -> UUID? {
            guard wcIndex < wc.count else { return nil }
            if let pref = wc.indices.first(where: { $0 >= wcIndex && wc[$0].groupID != exclude }) {
                wc.swapAt(wcIndex, pref)
            }
            let p = wc[wcIndex]; wcIndex += 1; return p.id
        }
        func m(_ p1: UUID?, _ p2: UUID?, _ pos: String, _ n: Int) -> QTBracketMatch {
            QTBracketMatch(player1: p1, player2: p2, position: pos, matchNumber: n)
        }
        let groupE = groups.first { $0.name == "E" }?.id
        let groupF = groups.first { $0.name == "F" }?.id
        switch groupCount {
        case 2:
            return [m(player("A", 1), player("B", 2), "upper", 1),
                    m(player("B", 1), player("A", 2), "lower", 2)]
        case 3:
            return [m(player("A", 1), player("B", 2), "upper", 1),
                    m(player("C", 1), nextWildcard(nil), "upper", 2),
                    m(player("B", 1), player("A", 2), "lower", 3),
                    m(player("C", 2), nextWildcard(nil), "lower", 4)]
        case 4:
            return [m(player("A", 1), player("B", 2), "upper", 1),
                    m(player("C", 1), player("D", 2), "upper", 2),
                    m(player("B", 1), player("A", 2), "lower", 3),
                    m(player("D", 1), player("C", 2), "lower", 4)]
        case 6:
            return [m(player("A", 1), player("B", 2), "upper", 1),
                    m(player("C", 1), player("D", 2), "upper", 2),
                    m(player("E", 1), nextWildcard(groupE), "upper", 3),
                    m(player("F", 1), nextWildcard(groupF), "upper", 4),
                    m(player("B", 1), player("A", 2), "lower", 5),
                    m(player("D", 1), player("C", 2), "lower", 6),
                    m(player("E", 2), nextWildcard(groupE), "lower", 7),
                    m(player("F", 2), nextWildcard(groupF), "lower", 8)]
        case 8:
            return [m(player("A", 1), player("B", 2), "upper", 1),
                    m(player("C", 1), player("D", 2), "upper", 2),
                    m(player("E", 1), player("F", 2), "upper", 3),
                    m(player("G", 1), player("H", 2), "upper", 4),
                    m(player("B", 1), player("A", 2), "lower", 5),
                    m(player("D", 1), player("C", 2), "lower", 6),
                    m(player("F", 1), player("E", 2), "lower", 7),
                    m(player("H", 1), player("G", 2), "lower", 8)]
        default:
            return []
        }
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

    /// 2 tên VĐV của 1 competitor đôi (cho màn trọng tài hiện người giao/đỡ). nil
    /// nếu không phải đôi hoặc thiếu tên — caller fallback theo competitor.
    func pairNames(for playerID: UUID?) -> [String]? {
        guard table.isDoubles == true, let playerID,
              let p = players.first(where: { $0.id == playerID }),
              let n1 = p.player1Name?.nonEmpty, let n2 = p.player2Name?.nonEmpty else { return nil }
        return [n1, n2]
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

/// Trọng tài của 1 bảng (quick_table_referees + tên từ public_profiles).
struct QTReferee: Identifiable, Equatable {
    let id: UUID
    let userID: UUID
    let displayName: String?
}
