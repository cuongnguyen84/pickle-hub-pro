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
