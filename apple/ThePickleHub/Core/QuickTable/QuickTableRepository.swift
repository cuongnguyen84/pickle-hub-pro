import Foundation
import Supabase

/// Loads a quick table (groups/players/matches) and writes match scores.
/// Scoring + group-stat recompute + playoff advancement mirror the web
/// `useQuickTableMutations` exactly so native and web stay consistent.
struct QuickTableRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    func currentUserID() async -> UUID? {
        try? await client.auth.session.user.id
    }

    // MARK: Load

    func load(shareID: String) async throws -> QuickTableDetail {
        let table: QTTable = try await client
            .from("quick_tables")
            .select("id, share_id, name, status, format, is_doubles, creator_user_id, top_per_group")
            .eq("share_id", value: shareID)
            .single()
            .execute()
            .value

        async let groups: [QTGroup] = client
            .from("quick_table_groups")
            .select("id, name, display_order")
            .eq("table_id", value: table.id)
            .order("display_order", ascending: true)
            .execute().value
        async let players: [QTPlayer] = client
            .from("quick_table_players")
            .select("id, group_id, name, team, seed, matches_played, matches_won, points_for, points_against, point_diff, is_qualified, is_wildcard, playoff_seed")
            .eq("table_id", value: table.id)
            .execute().value
        async let matches: [QTMatch] = client
            .from("quick_table_matches")
            .select("id, group_id, is_playoff, playoff_round, playoff_match_number, player1_id, player2_id, score1, score2, winner_id, status, court_name, display_order")
            .eq("table_id", value: table.id)
            .execute().value

        return QuickTableDetail(table: table, groups: try await groups,
                                players: try await players, matches: try await matches)
    }

    // MARK: Create (faithful port of the web 3-step wizard + setup)

    /// All wizard inputs. Mirrors `create_quick_table_with_quota` params +
    /// the post-create PATCH (default_sets / rating_source / DUPR range).
    struct CreateOptions {
        var name: String
        var playerCount: Int
        var format: String            // round_robin | large_playoff
        var groupCount: Int?          // round_robin only
        var requiresRegistration: Bool
        var isDoubles: Bool
        var defaultSets: Int          // 1 | 3 | 5
        var requiresSkillLevel: Bool
        var ratingSource: String      // self | dupr | either
        var minDupr: Double?
        var maxDupr: Double?
        var autoApprove: Bool
        var registrationMessage: String?
    }

    private struct CreateParams: Encodable {
        let _name: String
        let _player_count: Int
        let _format: String
        let _group_count: Int?
        let _requires_registration: Bool
        let _requires_skill_level: Bool
        let _auto_approve_registrations: Bool
        let _registration_message: String?
        let _is_doubles: Bool
    }
    private struct CreateResult: Decodable {
        let success: Bool
        let error: String?
        let table: QTTable?
    }
    private struct PostCreatePatch: Encodable {
        let default_sets: Int?
        let rating_source: String?
        let min_skill_level: Double?
        let max_skill_level: Double?
    }
    private struct PlayerInsert: Encodable { let table_id: String; let name: String; let team: String?; let seed: Int?; let display_order: Int }
    private struct CourtSettingsUpdate: Encodable { let courts: [String]; let start_time: String? }
    private struct GroupInsert: Encodable { let table_id: String; let name: String; let display_order: Int }
    private struct InsertedRow: Decodable { let id: UUID; let displayOrder: Int
        enum CodingKeys: String, CodingKey { case id; case displayOrder = "display_order" } }
    private struct GroupIDUpdate: Encodable { let group_id: String }
    private struct MatchInsert: Encodable {
        let table_id: String; let group_id: String; let is_playoff = false
        let player1_id: String; let player2_id: String
        let display_order: Int; let rr_round_number: Int; let rr_match_index: Int
    }

    /// Step 1–3 of the wizard: creates the `quick_tables` row via the quota RPC
    /// (status stays `setup`). Roster is entered separately (web parity).
    /// Returns the created table (need id + share_id + requires_registration).
    func createTable(_ o: CreateOptions) async throws -> QTTable {
        let result: CreateResult = try await client
            .rpc("create_quick_table_with_quota", params: CreateParams(
                _name: String(o.name.prefix(100)),
                _player_count: max(2, min(200, o.playerCount)),
                _format: o.format,
                _group_count: o.format == "round_robin" ? o.groupCount : nil,
                _requires_registration: o.requiresRegistration,
                _requires_skill_level: o.requiresRegistration ? (o.requiresSkillLevel || o.ratingSource != "self") : false,
                _auto_approve_registrations: o.requiresRegistration ? o.autoApprove : false,
                _registration_message: o.requiresRegistration ? o.registrationMessage?.nonEmpty : nil,
                _is_doubles: o.requiresRegistration ? o.isDoubles : true
            ))
            .execute().value
        guard result.success, let table = result.table else {
            throw NSError(domain: "quicktable", code: 1, userInfo: [NSLocalizedDescriptionKey: errorMessage(result.error)])
        }
        // Post-create PATCH for fields the RPC doesn't know (web Sprint B1.3).
        let wantsDupr = o.requiresRegistration && o.requiresSkillLevel && o.ratingSource != "self"
        if o.defaultSets > 1 || wantsDupr {
            try await client.from("quick_tables").update(PostCreatePatch(
                default_sets: o.defaultSets > 1 ? o.defaultSets : nil,
                rating_source: wantsDupr ? o.ratingSource : nil,
                min_skill_level: wantsDupr ? o.minDupr : nil,
                max_skill_level: wantsDupr ? o.maxDupr : nil
            )).eq("id", value: table.id).execute()
        }
        return table
    }

    struct RosterEntry { let name: String; let team: String?; let seed: Int? }

    /// The setup step (auto, non-registration): add roster (name/team/seed) →
    /// save court+time settings → create groups → snake-draft distribute →
    /// circle-method matches → status=group_stage. Mirrors web handleAutoSubmit.
    func setupRoster(tableID: UUID, players: [RosterEntry], groupCount: Int,
                     courts: [String], startTime: String?) async throws {
        let tid = tableID.uuidString.lowercased()
        let roster = players
            .map { RosterEntry(name: $0.name.trimmingCharacters(in: .whitespacesAndNewlines), team: $0.team?.nonEmpty, seed: $0.seed) }
            .filter { !$0.name.isEmpty }
        let groups = max(1, groupCount)

        let inserted: [InsertedRow] = try await client
            .from("quick_table_players")
            .insert(roster.enumerated().map { PlayerInsert(table_id: tid, name: $1.name, team: $1.team, seed: $1.seed, display_order: $0) })
            .select("id, display_order")
            .execute().value
        let ordered = inserted.sorted { $0.displayOrder < $1.displayOrder }
        // Pair inserted ids back to their roster entry (same display_order order).
        let records = ordered.map { row -> (id: UUID, team: String?, seed: Int?) in
            let r = roster[row.displayOrder]
            return (id: row.id, team: r.team, seed: r.seed)
        }

        if !courts.isEmpty || startTime?.nonEmpty != nil {
            try await client.from("quick_tables")
                .update(CourtSettingsUpdate(courts: courts, start_time: startTime?.nonEmpty))
                .eq("id", value: tableID).execute()
        }

        let groupRows: [InsertedRow] = try await client
            .from("quick_table_groups")
            .insert((0..<groups).map { GroupInsert(table_id: tid, name: groupLetter($0), display_order: $0) })
            .select("id, display_order")
            .execute().value
        let orderedGroups = groupRows.sorted { $0.displayOrder < $1.displayOrder }

        let buckets = Self.distribute(records, groupCount: orderedGroups.count)
        for (g, ids) in buckets.enumerated() {
            for id in ids {
                try await client.from("quick_table_players")
                    .update(GroupIDUpdate(group_id: orderedGroups[g].id.uuidString.lowercased()))
                    .eq("id", value: id).execute()
            }
        }

        for (gIdx, group) in orderedGroups.enumerated() {
            let pairs = Self.circleMethod(buckets[gIdx])
            guard !pairs.isEmpty else { continue }
            let inserts = pairs.enumerated().map { i, pair in
                MatchInsert(table_id: tid, group_id: group.id.uuidString.lowercased(),
                            player1_id: pair.p1.uuidString.lowercased(), player2_id: pair.p2.uuidString.lowercased(),
                            display_order: i, rr_round_number: pair.round, rr_match_index: pair.index)
            }
            try await client.from("quick_table_matches").insert(inserts).execute()
        }

        try await client.from("quick_tables").update(TableStatusUpdate(status: "group_stage")).eq("id", value: tableID).execute()
    }

    /// Snake-draft distribution (seed-aware + team-spread). Port of web
    /// distributePlayersToGroups: seeded players snake across groups avoiding
    /// teammates; unseeded fill by most-room, also team-spread.
    static func distribute(_ players: [(id: UUID, team: String?, seed: Int?)], groupCount k: Int) -> [[UUID]] {
        guard k > 0 else { return [] }
        let total = players.count
        let base = total / k
        let rem = total % k
        let targetSizes = (0..<k).map { base + ($0 < rem ? 1 : 0) }

        var groups: [[(id: UUID, team: String?, seed: Int?)]] = Array(repeating: [], count: k)
        func teamCount(_ g: Int, _ team: String?) -> Int {
            guard let team else { return 0 }
            return groups[g].filter { $0.team == team }.count
        }
        func isFull(_ g: Int) -> Bool { groups[g].count >= targetSizes[g] }
        func bestGroup(team: String?, preferred: [Int]?) -> Int {
            let available = (0..<k).filter { !isFull($0) }
            if available.isEmpty { return 0 }
            let pref = preferred?.filter { !isFull($0) } ?? available
            let cands = pref.isEmpty ? available : pref
            guard let team else { return cands[0] }
            let noMate = cands.filter { teamCount($0, team) == 0 }
            if !noMate.isEmpty { return noMate[0] }
            return cands.sorted { teamCount($0, team) < teamCount($1, team) }[0]
        }

        let seeded = players.filter { ($0.seed ?? 0) > 0 }.sorted { ($0.seed ?? 0) < ($1.seed ?? 0) }
        let unseeded = players.filter { ($0.seed ?? 0) <= 0 }

        var dir = 1, idx = 0
        for p in seeded {
            var pref: [Int] = []
            if dir == 1 {
                pref.append(contentsOf: idx..<k)
                if idx - 1 >= 0 { pref.append(contentsOf: stride(from: idx - 1, through: 0, by: -1)) }
            } else {
                pref.append(contentsOf: stride(from: idx, through: 0, by: -1))
                if idx + 1 < k { pref.append(contentsOf: (idx + 1)..<k) }
            }
            groups[bestGroup(team: p.team, preferred: pref)].append(p)
            idx += dir
            if idx >= k { idx = k - 1; dir = -1 } else if idx < 0 { idx = 0; dir = 1 }
        }

        var freq: [String: Int] = [:]
        for p in unseeded { if let t = p.team { freq[t, default: 0] += 1 } }
        let sortedUnseeded = unseeded.sorted { (freq[$0.team ?? ""] ?? 0) > (freq[$1.team ?? ""] ?? 0) }
        for p in sortedUnseeded {
            let byRoom = (0..<k).filter { !isFull($0) }
                .sorted { (targetSizes[$0] - groups[$0].count) > (targetSizes[$1] - groups[$1].count) }
            groups[bestGroup(team: p.team, preferred: byRoom.isEmpty ? nil : byRoom)].append(p)
        }

        return groups.map { $0.map(\.id) }
    }

    private func errorMessage(_ code: String?) -> String {
        switch code {
        case "LIMIT_REACHED": return "Bạn đã đạt giới hạn số giải. Hãy xóa bớt giải cũ."
        case "AUTH_REQUIRED": return "Cần đăng nhập để tạo giải."
        default: return code ?? "Không tạo được giải."
        }
    }

    private func groupLetter(_ i: Int) -> String {
        String(UnicodeScalar(65 + UInt8(i % 26)))
    }

    /// Circle-method (Berger) round-robin pairings. Port of web round-robin.ts.
    struct RRPair { let p1: UUID; let p2: UUID; let round: Int; let index: Int }
    static func circleMethod(_ playerIDs: [UUID]) -> [RRPair] {
        guard playerIDs.count >= 2 else { return [] }
        var players = playerIDs.map { Optional($0) }
        if players.count % 2 == 1 { players.append(nil) } // BYE
        let n = players.count
        let rounds = n - 1
        let perRound = n / 2
        var rotating = Array(players[1...])
        var pairs: [RRPair] = []
        for round in 0..<rounds {
            let order = [players[0]] + rotating
            var indexInRound = 0
            for i in 0..<perRound {
                let a = order[i]
                let b = order[n - 1 - i]
                if let a, let b {
                    pairs.append(RRPair(p1: a, p2: b, round: round + 1, index: indexInRound))
                    indexInRound += 1
                }
            }
            rotating.insert(rotating.removeLast(), at: 0)
        }
        return pairs
    }

    // MARK: Score

    private struct MatchScoreUpdate: Encodable {
        let score1: Int
        let score2: Int
        let winner_id: String
        let status = "completed"
    }

    /// Saves a match score, then recomputes group stats (group stage) or
    /// advances the winner (playoff). Caller reloads afterward.
    func score(tableID: UUID, match: QTMatch, score1: Int, score2: Int) async throws {
        guard score1 != score2 else { return } // no ties in pickleball
        let winnerID = (score1 > score2 ? match.player1ID : match.player2ID)
        guard let winnerID else { return }

        try await client
            .from("quick_table_matches")
            .update(MatchScoreUpdate(score1: score1, score2: score2, winner_id: winnerID.uuidString))
            .eq("id", value: match.id)
            .execute()

        if match.isPlayoff, let round = match.playoffRound {
            try await advancePlayoff(tableID: tableID, matchID: match.id, round: round, winnerID: winnerID)
        } else if let groupID = match.groupID {
            try await recomputeGroupStats(groupID: groupID)
        }
    }

    private struct PlayerStatsUpdate: Encodable {
        let matches_played: Int
        let matches_won: Int
        let points_for: Int
        let points_against: Int
    }

    /// Recompute every player's aggregate in a group from its completed matches.
    /// `point_diff` is a generated column — not written.
    private func recomputeGroupStats(groupID: UUID) async throws {
        let matches: [QTMatch] = try await client
            .from("quick_table_matches")
            .select("id, group_id, is_playoff, playoff_round, playoff_match_number, player1_id, player2_id, score1, score2, winner_id, status, court_name, display_order")
            .eq("group_id", value: groupID)
            .eq("status", value: "completed")
            .execute().value
        let players: [QTPlayer] = try await client
            .from("quick_table_players")
            .select("id, group_id, name, team, seed, matches_played, matches_won, points_for, points_against, point_diff, is_qualified, playoff_seed")
            .eq("group_id", value: groupID)
            .execute().value

        struct Stat { var played = 0; var won = 0; var pf = 0; var pa = 0 }
        var stats: [UUID: Stat] = [:]
        for p in players { stats[p.id] = Stat() }

        for m in matches {
            guard let p1 = m.player1ID, let p2 = m.player2ID,
                  let s1 = m.score1, let s2 = m.score2 else { continue }
            if stats[p1] != nil {
                stats[p1]!.played += 1; stats[p1]!.pf += s1; stats[p1]!.pa += s2
                if s1 > s2 { stats[p1]!.won += 1 }
            }
            if stats[p2] != nil {
                stats[p2]!.played += 1; stats[p2]!.pf += s2; stats[p2]!.pa += s1
                if s2 > s1 { stats[p2]!.won += 1 }
            }
        }

        for (playerID, s) in stats {
            try await client
                .from("quick_table_players")
                .update(PlayerStatsUpdate(matches_played: s.played, matches_won: s.won,
                                          points_for: s.pf, points_against: s.pa))
                .eq("id", value: playerID)
                .execute()
        }
    }

    private struct Slot1Update: Encodable { let player1_id: String }
    private struct Slot2Update: Encodable { let player2_id: String }
    private struct TableStatusUpdate: Encodable { let status: String }

    /// Push the winner into the next playoff round (pos/2 → next match,
    /// pos%2 → slot). When the current round is the final, mark table completed.
    private func advancePlayoff(tableID: UUID, matchID: UUID, round: Int, winnerID: UUID) async throws {
        struct RoundMatch: Decodable { let id: UUID; let playoffMatchNumber: Int?
            enum CodingKeys: String, CodingKey { case id; case playoffMatchNumber = "playoff_match_number" } }

        let current: [RoundMatch] = try await client
            .from("quick_table_matches")
            .select("id, playoff_match_number")
            .eq("table_id", value: tableID).eq("is_playoff", value: true).eq("playoff_round", value: round)
            .order("playoff_match_number", ascending: true)
            .execute().value
        guard let position = current.firstIndex(where: { $0.id == matchID }) else { return }

        let next: [RoundMatch] = try await client
            .from("quick_table_matches")
            .select("id, playoff_match_number")
            .eq("table_id", value: tableID).eq("is_playoff", value: true).eq("playoff_round", value: round + 1)
            .order("playoff_match_number", ascending: true)
            .execute().value

        let nextIndex = position / 2
        if next.count > nextIndex {
            let nextID = next[nextIndex].id
            if position % 2 == 0 {
                try await client.from("quick_table_matches").update(Slot1Update(player1_id: winnerID.uuidString)).eq("id", value: nextID).execute()
            } else {
                try await client.from("quick_table_matches").update(Slot2Update(player2_id: winnerID.uuidString)).eq("id", value: nextID).execute()
            }
        } else if current.count == 1 {
            // Final just finished.
            try await client.from("quick_tables").update(TableStatusUpdate(status: "completed")).eq("id", value: tableID).execute()
        }
    }
}
