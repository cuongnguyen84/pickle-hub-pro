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
    score_a, score_b, winner_side, counts_for_standings, display_order
    """

    // MARK: Create (port of useFlexTournament createMutation)

    private struct CreateParams: Encodable { let _name: String; let _is_public: Bool }
    private struct CreateResult: Decodable { let success: Bool; let error: String?; let tournament: FlexTournament? }
    private struct PlayerInsert: Encodable { let tournament_id: String; let name: String; let display_order: Int }
    private struct GroupInsert: Encodable { let tournament_id: String; let name: String; let display_order: Int }
    private struct MatchInsert: Encodable { let tournament_id: String; let name: String; let match_type: String; let display_order: Int }

    enum CreateError: LocalizedError {
        case limitReached, message(String)
        var errorDescription: String? {
            switch self {
            case .limitReached: return "Bạn đã đạt giới hạn số giải miễn phí."
            case .message(let m): return m
            }
        }
    }

    /// Create a Flex tournament via the quota-enforced RPC, then insert players +
    /// the preset scaffolding (1 group, 1 singles + 1 doubles match) exactly as web
    /// `createMutation` does. Roster/group editing still happens on web.
    func createFlex(name: String, playerNames: [String], isPublic: Bool) async throws -> FlexTournament {
        let safeName = String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(100))
        let result: CreateResult = try await client
            .rpc("create_flex_tournament_with_quota", params: CreateParams(_name: safeName, _is_public: isPublic))
            .execute().value
        guard result.success, let tournament = result.tournament else {
            if result.error == "LIMIT_REACHED" { throw CreateError.limitReached }
            throw CreateError.message(result.error ?? "Không tạo được giải")
        }
        let tid = tournament.id.uuidString.lowercased()

        let names = playerNames.prefix(200)
            .map { String($0.trimmingCharacters(in: .whitespacesAndNewlines).prefix(100)) }
            .filter { !$0.isEmpty }
        if !names.isEmpty {
            let rows = names.enumerated().map { PlayerInsert(tournament_id: tid, name: $0.element, display_order: $0.offset) }
            try await client.from("flex_players").insert(rows).execute()
        }
        try await client.from("flex_groups")
            .insert(GroupInsert(tournament_id: tid, name: "Group A", display_order: 0)).execute()
        try await client.from("flex_matches").insert([
            MatchInsert(tournament_id: tid, name: "Singles Match 1", match_type: "singles", display_order: 0),
            MatchInsert(tournament_id: tid, name: "Doubles Match 1", match_type: "doubles", display_order: 1),
        ]).execute()
        return tournament
    }

    // MARK: Score (port of updateMatchScore + recomputeGroupStats)

    private struct ScoreUpdate: Encodable {
        let score_a: Int; let score_b: Int; let winner_side: String?
        func encode(to e: Encoder) throws {
            var c = e.container(keyedBy: K.self)
            try c.encode(score_a, forKey: .score_a)
            try c.encode(score_b, forKey: .score_b)
            try c.encode(winner_side, forKey: .winner_side)   // explicit null on a tie
        }
        enum K: String, CodingKey { case score_a, score_b, winner_side }
    }

    /// Update a match score (winner_side derived) then recompute the group's
    /// persisted stats so the web view stays consistent. `data` is the freshly
    /// loaded snapshot used for the recompute (caller reloads after).
    func score(match: FlexMatch, scoreA: Int, scoreB: Int, data: FlexData) async throws {
        let winner: String? = scoreA > scoreB ? "a" : (scoreB > scoreA ? "b" : nil)
        try await client.from("flex_matches")
            .update(ScoreUpdate(score_a: scoreA, score_b: scoreB, winner_side: winner))
            .eq("id", value: match.id).execute()

        guard let groupID = match.groupID, let group = data.groups.first(where: { $0.id == groupID }) else { return }
        // Build an updated snapshot reflecting this score so the recompute is correct.
        let updated = Self.applying(scoreA: scoreA, scoreB: scoreB, winner: winner, to: match, in: data)
        try await recomputeGroupStats(group: group, data: updated)
    }

    /// Returns a copy of `data` with the one match's score replaced.
    private static func applying(scoreA: Int, scoreB: Int, winner: String?, to match: FlexMatch, in data: FlexData) -> FlexData {
        let newMatches = data.matches.map { m -> FlexMatch in
            guard m.id == match.id else { return m }
            return FlexMatch(id: m.id, groupID: m.groupID, name: m.name, matchType: m.matchType,
                             slotA1PlayerID: m.slotA1PlayerID, slotA2PlayerID: m.slotA2PlayerID,
                             slotB1PlayerID: m.slotB1PlayerID, slotB2PlayerID: m.slotB2PlayerID,
                             slotATeamID: m.slotATeamID, slotBTeamID: m.slotBTeamID,
                             scoreA: scoreA, scoreB: scoreB, winnerSide: winner,
                             countsForStandings: m.countsForStandings, displayOrder: m.displayOrder)
        }
        return FlexData(tournament: data.tournament, players: data.players, teams: data.teams,
                        teamMembers: data.teamMembers, groups: data.groups, groupItems: data.groupItems,
                        matches: newMatches)
    }

    private struct PlayerStatInsert: Encodable { let group_id: String; let player_id: String; let wins: Int; let losses: Int; let point_diff: Int }
    private struct PairStatInsert: Encodable { let group_id: String; let player1_id: String; let player2_id: String; let wins: Int; let losses: Int; let point_diff: Int }

    /// Port of recomputeGroupStats: clear + re-insert player/pair stats for the
    /// group from its matches (web singles/doubles standings read these tables).
    private func recomputeGroupStats(group: FlexGroup, data: FlexData) async throws {
        let gid = group.id.uuidString.lowercased()
        let singles = data.singlesStandings(group)
        let pairs = data.pairStandings(group)

        async let delP = client.from("flex_player_stats").delete().eq("group_id", value: group.id).execute()
        async let delPair = client.from("flex_pair_stats").delete().eq("group_id", value: group.id).execute()
        _ = try await (delP, delPair)

        let playerRows = singles.filter { $0.wins != 0 || $0.losses != 0 || $0.pointDiff != 0 }
            .map { PlayerStatInsert(group_id: gid, player_id: $0.id, wins: $0.wins, losses: $0.losses, point_diff: $0.pointDiff) }
        if !playerRows.isEmpty {
            try await client.from("flex_player_stats").insert(playerRows).execute()
        }
        let pairRows = pairs.compactMap { p -> PairStatInsert? in
            let parts = p.id.split(separator: "|")
            guard parts.count == 2 else { return nil }
            return PairStatInsert(group_id: gid, player1_id: String(parts[0]), player2_id: String(parts[1]),
                                  wins: p.wins, losses: p.losses, point_diff: p.pointDiff)
        }
        if !pairRows.isEmpty {
            try await client.from("flex_pair_stats").insert(pairRows).execute()
        }
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
