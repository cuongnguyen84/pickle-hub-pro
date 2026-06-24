import Foundation

// Native models for the Flex (custom-format) tool. Faithful port of web
// `src/hooks/useFlexTournament.ts` types + `useFlexStats.ts` computation.
// Backend tables: flex_{tournaments,players,teams,team_members,groups,
// group_items,matches}. Stats are computed CLIENT-SIDE from matches (web also
// computes team stats live; native computes ALL standings live so they never go
// stale). Create/manage (drag-drop workspace) stays on web.

// MARK: Rows

struct FlexTournament: Decodable, Equatable {
    let id: UUID
    let name: String
    let shareID: String
    let isPublic: Bool
    let status: String
    let creatorUserID: UUID?

    var displayName: String { name.nonEmpty ?? "Giải linh hoạt" }

    enum CodingKeys: String, CodingKey {
        case id, name, status
        case shareID = "share_id"
        case isPublic = "is_public"
        case creatorUserID = "creator_user_id"
    }
}

struct FlexPlayer: Decodable, Identifiable, Equatable {
    let id: UUID
    let name: String
    let displayOrder: Int
    enum CodingKeys: String, CodingKey { case id, name; case displayOrder = "display_order" }
}

struct FlexTeam: Decodable, Identifiable, Equatable {
    let id: UUID
    let name: String
    let displayOrder: Int
    enum CodingKeys: String, CodingKey { case id, name; case displayOrder = "display_order" }
}

struct FlexTeamMember: Decodable, Identifiable, Equatable {
    let id: UUID
    let teamID: UUID
    let playerID: UUID
    enum CodingKeys: String, CodingKey { case id; case teamID = "team_id"; case playerID = "player_id" }
}

struct FlexGroup: Decodable, Identifiable, Equatable {
    let id: UUID
    let name: String
    let displayOrder: Int
    let includeDoublesInSingles: Bool
    enum CodingKeys: String, CodingKey {
        case id, name
        case displayOrder = "display_order"
        case includeDoublesInSingles = "include_doubles_in_singles"
    }
}

struct FlexGroupItem: Decodable, Identifiable, Equatable {
    let id: UUID
    let groupID: UUID
    let itemType: String   // player | team
    let playerID: UUID?
    let teamID: UUID?
    let displayOrder: Int
    enum CodingKeys: String, CodingKey {
        case id
        case groupID = "group_id"
        case itemType = "item_type"
        case playerID = "player_id"
        case teamID = "team_id"
        case displayOrder = "display_order"
    }
}

struct FlexMatch: Decodable, Identifiable, Equatable {
    let id: UUID
    let groupID: UUID?
    let name: String
    let matchType: String   // singles | doubles
    let slotA1PlayerID: UUID?
    let slotA2PlayerID: UUID?
    let slotB1PlayerID: UUID?
    let slotB2PlayerID: UUID?
    let slotATeamID: UUID?
    let slotBTeamID: UUID?
    let scoreA: Int
    let scoreB: Int
    let winnerSide: String?  // a | b | nil
    let countsForStandings: Bool
    let displayOrder: Int

    var isDoubles: Bool { matchType == "doubles" }
    var isTeamMatch: Bool { slotATeamID != nil || slotBTeamID != nil }
    var isCompleted: Bool { winnerSide != nil }
    var hasScore: Bool { scoreA != 0 || scoreB != 0 || winnerSide != nil }

    enum CodingKeys: String, CodingKey {
        case id, name
        case groupID = "group_id"
        case matchType = "match_type"
        case slotA1PlayerID = "slot_a1_player_id"
        case slotA2PlayerID = "slot_a2_player_id"
        case slotB1PlayerID = "slot_b1_player_id"
        case slotB2PlayerID = "slot_b2_player_id"
        case slotATeamID = "slot_a_team_id"
        case slotBTeamID = "slot_b_team_id"
        case scoreA = "score_a"
        case scoreB = "score_b"
        case winnerSide = "winner_side"
        case countsForStandings = "counts_for_standings"
        case displayOrder = "display_order"
    }
}

// MARK: Stats (port of useFlexStats)

struct FlexStatLine: Equatable { var wins = 0; var losses = 0; var pointDiff = 0 }

/// A row in a standings table (player, pair, or team).
struct FlexStanding: Identifiable, Equatable {
    let id: String
    let name: String
    let wins: Int
    let losses: Int
    let pointDiff: Int
}

// MARK: Composed snapshot

struct FlexData: Equatable {
    let tournament: FlexTournament
    let players: [FlexPlayer]
    let teams: [FlexTeam]
    let teamMembers: [FlexTeamMember]
    let groups: [FlexGroup]
    let groupItems: [FlexGroupItem]
    let matches: [FlexMatch]

    // Lookups
    func playerName(_ id: UUID?) -> String? { id.flatMap { pid in players.first { $0.id == pid }?.name } }
    func teamName(_ id: UUID?) -> String? { id.flatMap { tid in teams.first { $0.id == tid }?.name } }

    var ungroupedMatches: [FlexMatch] {
        matches.filter { $0.groupID == nil }.sorted { $0.displayOrder < $1.displayOrder }
    }
    func matches(in group: FlexGroup) -> [FlexMatch] {
        matches.filter { $0.groupID == group.id }.sorted { $0.displayOrder < $1.displayOrder }
    }
    func items(in group: FlexGroup) -> [FlexGroupItem] {
        groupItems.filter { $0.groupID == group.id }.sorted { $0.displayOrder < $1.displayOrder }
    }

    /// Both sides' display names for a match ("?" when a slot is empty).
    func sideNames(_ m: FlexMatch) -> (a: String, b: String) {
        if m.isTeamMatch {
            return (teamName(m.slotATeamID) ?? "?", teamName(m.slotBTeamID) ?? "?")
        }
        func side(_ s1: UUID?, _ s2: UUID?) -> String {
            let n1 = playerName(s1)
            let n2 = playerName(s2)
            if let n1, let n2 { return "\(n1) / \(n2)" }
            return n1 ?? n2 ?? "?"
        }
        return (side(m.slotA1PlayerID, m.slotA2PlayerID), side(m.slotB1PlayerID, m.slotB2PlayerID))
    }

    // ── Group standings (computed live from matches) ──

    func groupType(_ group: FlexGroup) -> String? {
        items(in: group).first?.itemType
    }

    /// Player ids relevant to a group: direct player items, or union of team
    /// members for team groups.
    func groupPlayerIDs(_ group: FlexGroup) -> Set<UUID> {
        let gi = items(in: group)
        if gi.first?.itemType == "team" {
            let teamIDs = Set(gi.compactMap { $0.teamID })
            return Set(teamMembers.filter { teamIDs.contains($0.teamID) }.map { $0.playerID })
        }
        return Set(gi.compactMap { $0.playerID })
    }

    func groupTeamIDs(_ group: FlexGroup) -> Set<UUID> {
        Set(items(in: group).compactMap { $0.teamID })
    }

    /// Singles standings — port of computePlayerStats + getGroupStandings.
    func singlesStandings(_ group: FlexGroup) -> [FlexStanding] {
        let playerIDs = groupPlayerIDs(group)
        let include = group.includeDoublesInSingles
        var stats: [UUID: FlexStatLine] = [:]
        for m in matches(in: group) {
            guard m.countsForStandings, let side = m.winnerSide else { continue }
            if m.isDoubles && !include { continue }
            let diff = abs(m.scoreA - m.scoreB)
            let sideA = [m.slotA1PlayerID, m.slotA2PlayerID].compactMap { $0 }
            let sideB = [m.slotB1PlayerID, m.slotB2PlayerID].compactMap { $0 }
            let winners = side == "a" ? sideA : sideB
            let losers = side == "a" ? sideB : sideA
            for p in winners where playerIDs.contains(p) {
                stats[p, default: FlexStatLine()].wins += 1
                stats[p]!.pointDiff += diff
            }
            for p in losers where playerIDs.contains(p) {
                stats[p, default: FlexStatLine()].losses += 1
                stats[p]!.pointDiff -= diff
            }
        }
        return playerIDs.map { pid in
            let s = stats[pid] ?? FlexStatLine()
            return FlexStanding(id: pid.uuidString, name: playerName(pid) ?? "—",
                                wins: s.wins, losses: s.losses, pointDiff: s.pointDiff)
        }.sorted(by: Self.rankSort)
    }

    /// Doubles pair standings — port of computePairStats.
    func pairStandings(_ group: FlexGroup) -> [FlexStanding] {
        let playerIDs = groupPlayerIDs(group)
        var stats: [String: (line: FlexStatLine, p1: UUID, p2: UUID)] = [:]
        func record(_ players: [UUID], won: Bool, diff: Int) {
            guard players.count == 2, players.contains(where: { playerIDs.contains($0) }) else { return }
            let sorted = players.sorted { $0.uuidString < $1.uuidString }
            let key = "\(sorted[0].uuidString)|\(sorted[1].uuidString)"
            var entry = stats[key] ?? (FlexStatLine(), sorted[0], sorted[1])
            if won { entry.line.wins += 1; entry.line.pointDiff += diff }
            else { entry.line.losses += 1; entry.line.pointDiff -= diff }
            stats[key] = entry
        }
        for m in matches(in: group) {
            guard m.isDoubles, m.countsForStandings, let side = m.winnerSide else { continue }
            let diff = abs(m.scoreA - m.scoreB)
            let sideA = [m.slotA1PlayerID, m.slotA2PlayerID].compactMap { $0 }
            let sideB = [m.slotB1PlayerID, m.slotB2PlayerID].compactMap { $0 }
            record(sideA, won: side == "a", diff: diff)
            record(sideB, won: side == "b", diff: diff)
        }
        return stats.map { key, v in
            FlexStanding(id: key,
                         name: "\(playerName(v.p1) ?? "—") / \(playerName(v.p2) ?? "—")",
                         wins: v.line.wins, losses: v.line.losses, pointDiff: v.line.pointDiff)
        }.sorted(by: Self.rankSort)
    }

    /// Team standings — port of computeTeamStats.
    func teamStandings(_ group: FlexGroup) -> [FlexStanding] {
        let teamIDs = groupTeamIDs(group)
        var stats: [UUID: FlexStatLine] = [:]
        for m in matches(in: group) {
            guard m.isTeamMatch, m.countsForStandings, let side = m.winnerSide else { continue }
            let diff = abs(m.scoreA - m.scoreB)
            if let a = m.slotATeamID, teamIDs.contains(a) {
                if side == "a" { stats[a, default: FlexStatLine()].wins += 1; stats[a]!.pointDiff += diff }
                else { stats[a, default: FlexStatLine()].losses += 1; stats[a]!.pointDiff -= diff }
            }
            if let b = m.slotBTeamID, teamIDs.contains(b) {
                if side == "b" { stats[b, default: FlexStatLine()].wins += 1; stats[b]!.pointDiff += diff }
                else { stats[b, default: FlexStatLine()].losses += 1; stats[b]!.pointDiff -= diff }
            }
        }
        return teamIDs.map { tid in
            let s = stats[tid] ?? FlexStatLine()
            return FlexStanding(id: tid.uuidString, name: teamName(tid) ?? "—",
                                wins: s.wins, losses: s.losses, pointDiff: s.pointDiff)
        }.sorted(by: Self.rankSort)
    }

    /// Wins desc, then point diff desc (web getGroupStandings sort).
    static func rankSort(_ a: FlexStanding, _ b: FlexStanding) -> Bool {
        if a.wins != b.wins { return a.wins > b.wins }
        return a.pointDiff > b.pointDiff
    }
}

// MARK: Referee

struct FlexReferee: Identifiable, Equatable {
    let id: UUID
    let userID: UUID
    let displayName: String?
}
