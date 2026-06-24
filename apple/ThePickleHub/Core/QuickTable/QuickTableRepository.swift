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
            .select("id, group_id, name, team, seed, matches_played, matches_won, points_for, points_against, point_diff, is_qualified, playoff_seed")
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

    // MARK: Create (direct-roster round-robin → group stage)

    private struct CreateParams: Encodable {
        let _name: String
        let _player_count: Int
        let _format = "round_robin"
        let _group_count: Int?
        let _requires_registration = false
        let _requires_skill_level = false
        let _auto_approve_registrations = false
        let _registration_message: String? = nil
        let _is_doubles: Bool
    }
    private struct CreateResult: Decodable {
        let success: Bool
        let error: String?
        let table: QTTable?
    }
    private struct PlayerInsert: Encodable { let table_id: String; let name: String; let display_order: Int }
    private struct GroupInsert: Encodable { let table_id: String; let name: String; let display_order: Int }
    private struct InsertedRow: Decodable { let id: UUID; let displayOrder: Int
        enum CodingKeys: String, CodingKey { case id; case displayOrder = "display_order" } }
    private struct GroupIDUpdate: Encodable { let group_id: String }
    private struct MatchInsert: Encodable {
        let table_id: String; let group_id: String; let is_playoff = false
        let player1_id: String; let player2_id: String
        let display_order: Int; let rr_round_number: Int; let rr_match_index: Int
    }

    /// Creates a round-robin quick table from a plain roster: RPC create →
    /// add players → create groups → distribute → generate circle-method
    /// matches → status=group_stage. Returns the new share_id. Mirrors the web
    /// QuickTableSetup "no registration" path.
    func create(name: String, isDoubles: Bool, playerNames: [String], groupCount: Int) async throws -> String {
        let names = playerNames.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        let groups = max(1, groupCount)
        let result: CreateResult = try await client
            .rpc("create_quick_table_with_quota", params: CreateParams(
                _name: String(name.prefix(100)),
                _player_count: max(2, min(200, names.count)),
                _group_count: groups,
                _is_doubles: isDoubles
            ))
            .execute().value
        guard result.success, let table = result.table else {
            throw NSError(domain: "quicktable", code: 1, userInfo: [NSLocalizedDescriptionKey: errorMessage(result.error)])
        }
        let tableID = table.id.uuidString.lowercased()

        // Players
        let players: [InsertedRow] = try await client
            .from("quick_table_players")
            .insert(names.enumerated().map { PlayerInsert(table_id: tableID, name: $1, display_order: $0) })
            .select("id, display_order")
            .execute().value
        let orderedPlayers = players.sorted { $0.displayOrder < $1.displayOrder }

        // Groups (A, B, C…)
        let groupRows: [InsertedRow] = try await client
            .from("quick_table_groups")
            .insert((0..<groups).map { GroupInsert(table_id: tableID, name: groupLetter($0), display_order: $0) })
            .select("id, display_order")
            .execute().value
        let orderedGroups = groupRows.sorted { $0.displayOrder < $1.displayOrder }

        // Distribute round-robin (player i → group i % groupCount) → balanced groups.
        var buckets: [[UUID]] = Array(repeating: [], count: orderedGroups.count)
        for (i, p) in orderedPlayers.enumerated() {
            let g = i % orderedGroups.count
            buckets[g].append(p.id)
            try await client.from("quick_table_players")
                .update(GroupIDUpdate(group_id: orderedGroups[g].id.uuidString.lowercased()))
                .eq("id", value: p.id).execute()
        }

        // Generate circle-method matches per group.
        for (gIdx, group) in orderedGroups.enumerated() {
            let pairs = Self.circleMethod(buckets[gIdx])
            guard !pairs.isEmpty else { continue }
            let inserts = pairs.enumerated().map { i, pair in
                MatchInsert(table_id: tableID, group_id: group.id.uuidString.lowercased(),
                            player1_id: pair.p1.uuidString.lowercased(), player2_id: pair.p2.uuidString.lowercased(),
                            display_order: i, rr_round_number: pair.round, rr_match_index: pair.index)
            }
            try await client.from("quick_table_matches").insert(inserts).execute()
        }

        try await client.from("quick_tables").update(TableStatusUpdate(status: "group_stage")).eq("id", value: table.id).execute()
        return table.shareID
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
