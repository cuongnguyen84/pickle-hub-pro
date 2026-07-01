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

    // MARK: Confirm / history (mirror Match.tsx useProposals + verify/dispute)

    /// Proposals the caller is involved in (RLS-scoped). `pendingOnly` filters to
    /// `pending_verify` for the confirm tab; otherwise returns all (history).
    func myProposals(pendingOnly: Bool) async throws -> [MatchProposalRow] {
        let base = client.from("match_proposals").select("*")
        let filtered = pendingOnly ? base.eq("status", value: "pending_verify") : base
        return try await filtered.order("created_at", ascending: false).limit(50).execute().value
    }

    private struct ActionBody: Encodable { let action: String; let proposal_id: String; let reason: String? }
    private struct ActionResult: Decodable { let status: String? }

    func verify(proposalID: String) async throws {
        let _: ActionResult = try await client.functions.invoke(
            "match-proposal",
            options: FunctionInvokeOptions(body: ActionBody(action: "verify", proposal_id: proposalID, reason: nil)))
    }

    func dispute(proposalID: String, reason: String?) async throws {
        let trimmed = reason?.trimmingCharacters(in: .whitespacesAndNewlines)
        let _: ActionResult = try await client.functions.invoke(
            "match-proposal",
            options: FunctionInvokeOptions(body: ActionBody(action: "dispute", proposal_id: proposalID,
                                                            reason: (trimmed?.isEmpty ?? true) ? nil : trimmed)))
    }

    /// Resolve display names for player user ids via `public_profiles`.
    func displayNames(ids: [String]) async -> [String: String] {
        let unique = Set(ids.filter { !$0.isEmpty }.map { $0.lowercased() })
        guard !unique.isEmpty else { return [:] }
        struct Row: Decodable { let id: String; let displayName: String?
            enum CodingKeys: String, CodingKey { case id; case displayName = "display_name" } }
        guard let rows: [Row] = try? await client.from("public_profiles")
            .select("id, display_name").in("id", values: Array(unique)).execute().value else { return [:] }
        var map: [String: String] = [:]
        for r in rows { if let n = r.displayName, !n.isEmpty { map[r.id.lowercased()] = n } }
        return map
    }

    /// `match_date` in the server's expected `YYYY-MM-DD` form, local calendar.
    private static func todayString() -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }
}
