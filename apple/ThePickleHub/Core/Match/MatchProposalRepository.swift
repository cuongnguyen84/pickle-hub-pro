import Foundation
import Supabase

/// Creates community match proposals and searches opponents. Mirrors the web
/// `/match/new` flow but takes the PARTNER path (club_id = null), which needs
/// no DUPR connection — only an authenticated caller.
struct MatchProposalRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    /// The signed-in user's profile id (== auth user id == team A player 1).
    func currentUserID() async throws -> String {
        try await client.auth.session.user.id.uuidString.lowercased()
    }

    // MARK: Opponent search

    private struct SearchBody: Encodable {
        let query: String
        let limit: Int
        let exclude_user_ids: [String]
    }

    func searchOpponents(query: String, excludeIDs: [String]) async throws -> [OpponentHit] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else { return [] }
        let response: OpponentSearchResponse = try await client.functions.invoke(
            "dupr-user-search",
            options: FunctionInvokeOptions(
                body: SearchBody(query: trimmed, limit: 12, exclude_user_ids: excludeIDs)
            )
        )
        return response.hits
    }

    // MARK: Create

    private struct CreateBody: Encodable {
        let action = "create"
        let format: String
        let match_date: String
        let club_id: Int?
        let match_type = "SIDEOUT"
        let team_a_player_ids: [String]
        let team_b_player_ids: [String]
        let team_a_invites: [String]
        let team_b_invites: [String]
        let team_a_scores: [Int]
        let team_b_scores: [Int]
    }

    /// Creates a PARTNER match proposal. The caller is auto-verified server-side;
    /// the opponent confirms via the returned invite link (ghosts) or an in-app
    /// notification (real users). Returns the proposal id + any invite links.
    func create(
        format: MatchFormat,
        teamA: [PickedPlayer],
        teamB: [PickedPlayer],
        scoresA: [Int],
        scoresB: [Int]
    ) async throws -> CreateMatchResult {
        let body = CreateBody(
            format: format.rawValue,
            match_date: Self.todayString(),
            club_id: nil,
            team_a_player_ids: teamA.compactMap(\.userID),
            team_b_player_ids: teamB.compactMap(\.userID),
            team_a_invites: teamA.compactMap(\.inviteName),
            team_b_invites: teamB.compactMap(\.inviteName),
            team_a_scores: scoresA,
            team_b_scores: scoresB
        )
        return try await client.functions.invoke(
            "match-proposal",
            options: FunctionInvokeOptions(body: body)
        )
    }

    /// `match_date` in the server's expected `YYYY-MM-DD` form, local calendar.
    private static func todayString() -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }
}
