import Foundation
import Supabase

/// Loads a Flex tournament + all related entities and writes match scores.
/// Scoring recomputes the persisted `flex_player_stats` / `flex_pair_stats`
/// tables (web reads those for singles/doubles standings) so native scoring
/// stays consistent with the web view. Create/manage stays on web.
struct FlexRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    func currentUserID() async -> UUID? { try? await client.auth.session.user.id }

    // MARK: Load

    func load(shareID: String) async throws -> FlexData {
        let tournament: FlexTournament = try await client
            .from("flex_tournaments")
            .select("id, name, share_id, is_public, status, creator_user_id")
            .eq("share_id", value: shareID).single().execute().value
        let tID = tournament.id

        async let players: [FlexPlayer] = client.from("flex_players")
            .select("id, name, display_order").eq("tournament_id", value: tID)
            .order("display_order", ascending: true).execute().value
        async let teams: [FlexTeam] = client.from("flex_teams")
            .select("id, name, display_order").eq("tournament_id", value: tID)
            .order("display_order", ascending: true).execute().value
        async let groups: [FlexGroup] = client.from("flex_groups")
            .select("id, name, display_order, include_doubles_in_singles").eq("tournament_id", value: tID)
            .order("display_order", ascending: true).execute().value
        async let matches: [FlexMatch] = client.from("flex_matches")
            .select(Self.matchSelect).eq("tournament_id", value: tID)
            .order("display_order", ascending: true).execute().value

        let teamList = try await teams
        let groupList = try await groups
        let teamIDs = teamList.map { $0.id.uuidString.lowercased() }
        let groupIDs = groupList.map { $0.id.uuidString.lowercased() }

        let teamMembers: [FlexTeamMember] = teamIDs.isEmpty ? [] : ((try? await client
            .from("flex_team_members").select("id, team_id, player_id")
            .in("team_id", values: teamIDs).execute().value) ?? [])
        let groupItems: [FlexGroupItem] = groupIDs.isEmpty ? [] : ((try? await client
            .from("flex_group_items").select("id, group_id, item_type, player_id, team_id, display_order")
            .in("group_id", values: groupIDs).order("display_order", ascending: true).execute().value) ?? [])

        return FlexData(tournament: tournament, players: try await players, teams: teamList,
                        teamMembers: teamMembers, groups: groupList, groupItems: groupItems,
                        matches: try await matches)
    }

    private static let matchSelect = """
    id, group_id, name, match_type, slot_a1_player_id, slot_a2_player_id, \
    slot_b1_player_id, slot_b2_player_id, slot_a_team_id, slot_b_team_id, \
    score_a, score_b, winner_side, counts_for_standings, display_order, score_version
    """

    // MARK: Create (port of useFlexTournament createMutation)

    private struct CreateParams: Encodable {
        let p_name: String
        let p_is_public: Bool
        let p_player_names: [String]
    }
    private struct CreateResult: Decodable { let success: Bool; let error: String?; let tournament: FlexTournament? }

    enum CreateError: LocalizedError {
        case limitReached, message(String)
        var errorDescription: String? {
            switch self {
            case .limitReached: return "Bạn đã đạt giới hạn số giải miễn phí."
            case .message(let m): return m
            }
        }
    }

    /// The RPC owns quota, players, and preset scaffolding in one transaction.
    /// Roster/group editing still happens on web.
    func createFlex(name: String, playerNames: [String], isPublic: Bool) async throws -> FlexTournament {
        let safeName = String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(100))
        let names = playerNames.prefix(200)
            .map { String($0.trimmingCharacters(in: .whitespacesAndNewlines).prefix(100)) }
            .filter { !$0.isEmpty }
        let result: CreateResult = try await client
            .rpc("create_flex_tournament_atomic", params: CreateParams(
                p_name: safeName,
                p_is_public: isPublic,
                p_player_names: names
            ))
            .execute().value
        guard result.success, let tournament = result.tournament else {
            if result.error == "LIMIT_REACHED" { throw CreateError.limitReached }
            throw CreateError.message(result.error ?? "Không tạo được giải")
        }
        return tournament
    }

    // MARK: Score

    private struct ScoreParams: Encodable {
        let p_match_id: String
        let p_score_a: Int
        let p_score_b: Int
        let p_expected_version: Int64
    }

    /// One RPC owns the score update and the player/pair standings rebuild.
    /// `scoreVersion` rejects a stale referee without overwriting newer data.
    func score(match: FlexMatch, scoreA: Int, scoreB: Int) async throws {
        let result: AtomicTournamentMutationResult = try await client
            .rpc("score_flex_match_atomic", params: ScoreParams(
                p_match_id: match.id.uuidString.lowercased(),
                p_score_a: scoreA,
                p_score_b: scoreB,
                p_expected_version: match.scoreVersion
            ))
            .execute().value
        try result.requireSuccess()
    }

    // MARK: Referees (table flex_tournament_referees)

    func fetchReferees(tournamentID: UUID) async -> [FlexReferee] {
        struct Row: Decodable { let id: UUID; let userID: UUID
            enum CodingKeys: String, CodingKey { case id; case userID = "user_id" } }
        guard let rows: [Row] = try? await client
            .from("flex_tournament_referees").select("id, user_id")
            .eq("tournament_id", value: tournamentID).execute().value, !rows.isEmpty else { return [] }
        let names = await displayNames(ids: Set(rows.map { $0.userID.uuidString.lowercased() }))
        return rows.map { FlexReferee(id: $0.id, userID: $0.userID,
                                      displayName: names[$0.userID.uuidString.lowercased()]) }
    }

    func isReferee(tournamentID: UUID, userID: UUID) async -> Bool {
        struct R: Decodable { let id: UUID }
        let rows: [R]? = try? await client
            .from("flex_tournament_referees").select("id")
            .eq("tournament_id", value: tournamentID).eq("user_id", value: userID)
            .limit(1).execute().value
        return !(rows?.isEmpty ?? true)
    }

    enum AddRefereeOutcome: Equatable { case ok(String?), notFound, alreadyExists, error }

    func addReferee(tournamentID: UUID, email: String) async -> AddRefereeOutcome {
        struct LookupRow: Decodable { let id: UUID; let displayName: String?
            enum CodingKeys: String, CodingKey { case id; case displayName = "display_name" } }
        let trimmed = email.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return .error }
        do {
            let rows: [LookupRow] = try await client
                .rpc("lookup_user_by_email", params: ["lookup_email": trimmed]).execute().value
            guard let profile = rows.first else { return .notFound }
            struct R: Decodable { let id: UUID }
            let existing: [R] = try await client
                .from("flex_tournament_referees").select("id")
                .eq("tournament_id", value: tournamentID).eq("user_id", value: profile.id)
                .limit(1).execute().value
            if !existing.isEmpty { return .alreadyExists }
            struct Ins: Encodable { let tournament_id: String; let user_id: String }
            try await client.from("flex_tournament_referees")
                .insert(Ins(tournament_id: tournamentID.uuidString.lowercased(),
                            user_id: profile.id.uuidString.lowercased())).execute()
            return .ok(profile.displayName)
        } catch { return .error }
    }

    func removeReferee(refereeID: UUID) async throws {
        try await client.from("flex_tournament_referees").delete().eq("id", value: refereeID).execute()
    }

    // MARK: Lifecycle (creator only)

    private struct VisibilityUpdate: Encodable { let is_public: Bool }
    func setVisibility(tournamentID: UUID, isPublic: Bool) async throws {
        try await client.from("flex_tournaments")
            .update(VisibilityUpdate(is_public: isPublic)).eq("id", value: tournamentID).execute()
    }

    func delete(tournamentID: UUID) async throws {
        try await client.from("flex_tournaments").delete().eq("id", value: tournamentID).execute()
    }

    private func displayNames(ids: Set<String>) async -> [String: String] {
        guard !ids.isEmpty else { return [:] }
        struct ProfileRow: Decodable { let id: String; let displayName: String?
            enum CodingKeys: String, CodingKey { case id; case displayName = "display_name" } }
        guard let rows: [ProfileRow] = try? await client
            .from("public_profiles").select("id, display_name")
            .in("id", values: Array(ids)).execute().value else { return [:] }
        var map: [String: String] = [:]
        for r in rows { if let n = r.displayName?.nonEmpty { map[r.id.lowercased()] = n } }
        return map
    }
}
