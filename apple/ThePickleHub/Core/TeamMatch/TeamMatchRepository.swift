import Foundation
import Supabase

/// Loads a Team Match (MLP) tournament for the native read view. Scoring
/// (lineup + sub-games + dreambreaker) stays on web for now.
struct TeamMatchRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    func currentUserID() async -> UUID? { try? await client.auth.session.user.id }

    func load(shareID: String) async throws -> TMDetail {
        let tournament: TMTournament = try await client
            .from("team_match_tournaments")
            .select("id, share_id, name, status, format, team_count, team_roster_size, has_dreambreaker, created_by")
            .eq("share_id", value: shareID)
            .single()
            .execute().value

        async let teams: [TMTeam] = client
            .from("team_match_teams")
            .select("id, team_name, seed, group_id, status")
            .eq("tournament_id", value: tournament.id)
            .order("seed", ascending: true)
            .execute().value
        async let matches: [TMMatch] = client
            .from("team_match_matches")
            .select("id, team_a_id, team_b_id, games_won_a, games_won_b, total_points_a, total_points_b, winner_team_id, status, round_number, is_playoff, is_third_place, playoff_round, group_id, display_order")
            .eq("tournament_id", value: tournament.id)
            .order("display_order", ascending: true)
            .execute().value

        let teamList = try await teams
        let matchList = try await matches

        // Roster + games are keyed by team/match — fetch by the parent ids we have.
        let teamIDs = teamList.map { $0.id.uuidString.lowercased() }
        let matchIDs = matchList.map { $0.id.uuidString.lowercased() }

        async let roster: [TMRosterPlayer] = teamIDs.isEmpty ? [] : client
            .from("team_match_roster")
            .select("id, team_id, player_name")
            .in("team_id", values: teamIDs)
            .execute().value
        async let games: [TMGame] = matchIDs.isEmpty ? [] : client
            .from("team_match_games")
            .select("id, match_id, game_type, display_name, score_a, score_b, winner_team_id, lineup_team_a, lineup_team_b, is_dreambreaker, order_index, status")
            .in("match_id", values: matchIDs)
            .execute().value

        return TMDetail(tournament: tournament, teams: teamList, roster: try await roster,
                        matches: matchList, games: try await games)
    }
}
