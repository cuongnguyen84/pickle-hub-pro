import Foundation
import Supabase

/// Loads a Flex tournament + all related entities and writes match scores.
/// Scoring recomputes the persisted `flex_player_stats` / `flex_pair_stats`
/// tables (web reads those for singles/doubles standings) so native scoring
/// stays consistent with the web view. Creator management mirrors the web Flex
/// workspace; SwiftUI uses menus/pickers in place of pointer-only drag/drop.
struct FlexRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    func currentUserID() async -> UUID? { try? await client.auth.session.user.id }

    // MARK: Load

    func load(shareID: String) async throws -> FlexData {
        let tournament: FlexTournament = try await client
            .from("flex_tournaments")
            .select("id, name, share_id, is_public, status, creator_user_id, created_at")
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

    /// Public Flex discovery from the production list. Own tournaments are
    /// omitted because the Tools hub already shows them under "Giải gần đây".
    func publicTournaments(limit: Int = 50) async -> [FlexTournament] {
        let current = await currentUserID()
        do {
            let rows: [FlexTournament] = try await client
                .from("flex_tournaments")
                .select("id, name, share_id, is_public, status, creator_user_id, created_at")
                .eq("is_public", value: true)
                .order("created_at", ascending: false)
                .limit(limit)
                .execute().value
            return rows.filter { $0.creatorUserID != current }
        } catch {
            return []
        }
    }

    private static let matchSelect = """
    id, group_id, parent_match_id, name, match_type, slot_a1_player_id, slot_a2_player_id, \
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

    // MARK: Native workspace management

    enum EntityKind: String {
        case player, team, group, match

        var table: String {
            switch self {
            case .player: return "flex_players"
            case .team: return "flex_teams"
            case .group: return "flex_groups"
            case .match: return "flex_matches"
            }
        }
    }

    enum MatchSlot {
        case a1, a2, b1, b2, aTeam, bTeam
    }

    enum WorkspaceError: LocalizedError {
        case message(String)

        var errorDescription: String? {
            switch self {
            case .message(let message): return Self.localize(message)
            }
        }

        private static func localize(_ code: String) -> String {
            switch code {
            case "AUTH_REQUIRED": return "Bạn cần đăng nhập."
            case "NOT_AUTHORIZED": return "Bạn không có quyền chỉnh sửa giải này."
            case "INVALID_NAME": return "Tên không được để trống."
            case "PLAYER_LIMIT": return "Giải đã đạt tối đa 200 VĐV."
            case "TEAM_LIMIT": return "Giải đã đạt tối đa 20 đội."
            case "GROUP_LIMIT": return "Giải đã đạt tối đa 20 bảng."
            case "MATCH_LIMIT": return "Giải đã đạt tối đa 100 trận."
            case "GROUP_MISMATCH": return "Bảng không thuộc giải này."
            case "PARENT_MISMATCH": return "Trận cha không thuộc giải này."
            case "CONFIG_CONFLICT": return "Cấu hình vừa thay đổi trên thiết bị khác. Hãy tải lại."
            default: return code
            }
        }
    }

    private struct WorkspaceResult: Decodable {
        let success: Bool
        let error: String?
        let detail: String?
    }

    private struct CreateEntityParams: Encodable {
        let tournamentID: UUID
        let kind: EntityKind
        let name: String
        let displayOrder: Int
        let matchType: String?
        let groupID: UUID?
        let parentMatchID: UUID?

        enum CodingKeys: String, CodingKey {
            case tournamentID = "p_tournament_id"
            case kind = "p_entity_type"
            case name = "p_name"
            case displayOrder = "p_display_order"
            case matchType = "p_match_type"
            case groupID = "p_group_id"
            case parentMatchID = "p_parent_match_id"
        }

        func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            try c.encode(tournamentID, forKey: .tournamentID)
            try c.encode(kind.rawValue, forKey: .kind)
            try c.encode(name, forKey: .name)
            try c.encode(displayOrder, forKey: .displayOrder)
            if let matchType { try c.encode(matchType, forKey: .matchType) }
            else { try c.encodeNil(forKey: .matchType) }
            if let groupID { try c.encode(groupID, forKey: .groupID) }
            else { try c.encodeNil(forKey: .groupID) }
            if let parentMatchID { try c.encode(parentMatchID, forKey: .parentMatchID) }
            else { try c.encodeNil(forKey: .parentMatchID) }
        }
    }

    func createEntity(
        tournamentID: UUID,
        kind: EntityKind,
        name: String,
        displayOrder: Int,
        matchType: String? = nil,
        groupID: UUID? = nil,
        parentMatchID: UUID? = nil
    ) async throws {
        let safeName = String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(100))
        let result: WorkspaceResult = try await client.rpc(
            "create_flex_entity_atomic",
            params: CreateEntityParams(
                tournamentID: tournamentID,
                kind: kind,
                name: safeName,
                displayOrder: displayOrder,
                matchType: matchType,
                groupID: groupID,
                parentMatchID: parentMatchID
            )
        ).execute().value
        try requireSuccess(result)
    }

    private struct TeamMemberInsert: Encodable {
        let team_id: UUID
        let player_id: UUID
    }

    func addPlayer(_ playerID: UUID, toTeam teamID: UUID) async throws {
        try await client.from("flex_team_members")
            .insert(TeamMemberInsert(team_id: teamID, player_id: playerID))
            .execute()
    }

    func removeTeamMember(_ memberID: UUID) async throws {
        try await client.from("flex_team_members").delete().eq("id", value: memberID).execute()
    }

    private struct GroupItemInsert: Encodable {
        let group_id: UUID
        let item_type: String
        let player_id: UUID?
        let team_id: UUID?
        let display_order: Int
    }

    func addPlayer(_ playerID: UUID, toGroup groupID: UUID, displayOrder: Int) async throws {
        try await client.from("flex_group_items").insert(GroupItemInsert(
            group_id: groupID,
            item_type: "player",
            player_id: playerID,
            team_id: nil,
            display_order: displayOrder
        )).execute()
    }

    func addTeam(_ teamID: UUID, toGroup groupID: UUID, displayOrder: Int) async throws {
        try await client.from("flex_group_items").insert(GroupItemInsert(
            group_id: groupID,
            item_type: "team",
            player_id: nil,
            team_id: teamID,
            display_order: displayOrder
        )).execute()
    }

    func removeGroupItem(_ itemID: UUID) async throws {
        try await client.from("flex_group_items").delete().eq("id", value: itemID).execute()
    }

    private struct NameUpdate: Encodable { let name: String }

    func rename(kind: EntityKind, id: UUID, name: String) async throws {
        let safeName = String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(100))
        guard !safeName.isEmpty else { throw WorkspaceError.message("INVALID_NAME") }
        try await client.from(kind.table).update(NameUpdate(name: safeName)).eq("id", value: id).execute()
    }

    func deleteEntity(kind: EntityKind, id: UUID) async throws {
        try await client.from(kind.table).delete().eq("id", value: id).execute()
    }

    private struct PlayerSlotUpdate: Encodable { let slot_a1_player_id: UUID? }
    private struct PlayerSlotA2Update: Encodable { let slot_a2_player_id: UUID? }
    private struct PlayerSlotB1Update: Encodable { let slot_b1_player_id: UUID? }
    private struct PlayerSlotB2Update: Encodable { let slot_b2_player_id: UUID? }
    private struct TeamSlotAUpdate: Encodable { let slot_a_team_id: UUID? }
    private struct TeamSlotBUpdate: Encodable { let slot_b_team_id: UUID? }

    func setMatchSlot(matchID: UUID, slot: MatchSlot, itemID: UUID?) async throws {
        let query = client.from("flex_matches")
        switch slot {
        case .a1:
            try await query.update(PlayerSlotUpdate(slot_a1_player_id: itemID)).eq("id", value: matchID).execute()
        case .a2:
            try await query.update(PlayerSlotA2Update(slot_a2_player_id: itemID)).eq("id", value: matchID).execute()
        case .b1:
            try await query.update(PlayerSlotB1Update(slot_b1_player_id: itemID)).eq("id", value: matchID).execute()
        case .b2:
            try await query.update(PlayerSlotB2Update(slot_b2_player_id: itemID)).eq("id", value: matchID).execute()
        case .aTeam:
            try await query.update(TeamSlotAUpdate(slot_a_team_id: itemID)).eq("id", value: matchID).execute()
        case .bTeam:
            try await query.update(TeamSlotBUpdate(slot_b_team_id: itemID)).eq("id", value: matchID).execute()
        }
    }

    private struct ParticipantModeUpdate: Encodable {
        let teamMode: Bool
        let firstTeamID: UUID?
        enum CodingKeys: String, CodingKey {
            case slotA1 = "slot_a1_player_id"
            case slotA2 = "slot_a2_player_id"
            case slotB1 = "slot_b1_player_id"
            case slotB2 = "slot_b2_player_id"
            case teamA = "slot_a_team_id"
            case teamB = "slot_b_team_id"
        }
        func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            if teamMode {
                try c.encodeNil(forKey: .slotA1)
                try c.encodeNil(forKey: .slotA2)
                try c.encodeNil(forKey: .slotB1)
                try c.encodeNil(forKey: .slotB2)
                try c.encodeIfPresent(firstTeamID, forKey: .teamA)
                if firstTeamID == nil { try c.encodeNil(forKey: .teamA) }
                try c.encodeNil(forKey: .teamB)
            } else {
                try c.encodeNil(forKey: .teamA)
                try c.encodeNil(forKey: .teamB)
            }
        }
    }

    /// Switches a top-level match between individual-player slots and team
    /// slots. One PATCH avoids partial mode changes when the user taps quickly.
    func setParticipantMode(matchID: UUID, teamMode: Bool, firstTeamID: UUID?) async throws {
        try await client.from("flex_matches")
            .update(ParticipantModeUpdate(teamMode: teamMode, firstTeamID: firstTeamID))
            .eq("id", value: matchID)
            .execute()
    }

    private struct MatchStandingsParams: Encodable {
        let matchID: UUID
        let counts: Bool
        let groupID: UUID?

        enum CodingKeys: String, CodingKey {
            case matchID = "p_match_id"
            case counts = "p_counts_for_standings"
            case groupID = "p_group_id"
        }

        func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            try c.encode(matchID, forKey: .matchID)
            try c.encode(counts, forKey: .counts)
            if let groupID { try c.encode(groupID, forKey: .groupID) }
            else { try c.encodeNil(forKey: .groupID) }
        }
    }

    func configureMatch(matchID: UUID, countsForStandings: Bool, groupID: UUID?) async throws {
        let result: WorkspaceResult = try await client.rpc(
            "update_flex_match_standings_atomic",
            params: MatchStandingsParams(matchID: matchID, counts: countsForStandings, groupID: groupID)
        ).execute().value
        try requireSuccess(result)
    }

    private struct GroupStandingsParams: Encodable {
        let p_group_id: UUID
        let p_include_doubles: Bool
    }

    func setIncludeDoubles(groupID: UUID, include: Bool) async throws {
        let result: WorkspaceResult = try await client.rpc(
            "update_flex_group_standings_atomic",
            params: GroupStandingsParams(p_group_id: groupID, p_include_doubles: include)
        ).execute().value
        try requireSuccess(result)
    }

    private struct RoundRobinMatchInsert: Encodable {
        let tournament_id: UUID
        let group_id: UUID
        let name: String
        let match_type: String
        let display_order: Int
        let slot_a1_player_id: UUID?
        let slot_b1_player_id: UUID?
        let slot_a_team_id: UUID?
        let slot_b_team_id: UUID?
    }

    func generateRoundRobin(tournamentID: UUID, group: FlexGroup, data: FlexData) async throws {
        let items = data.items(in: group)
        guard items.count >= 2 else {
            throw WorkspaceError.message("Cần ít nhất 2 VĐV hoặc đội trong bảng.")
        }
        let firstType = items[0].itemType
        guard items.allSatisfy({ $0.itemType == firstType }) else {
            throw WorkspaceError.message("Một bảng chỉ được chứa VĐV hoặc đội, không trộn hai loại.")
        }
        var rows: [RoundRobinMatchInsert] = []
        for i in items.indices {
            for j in items.indices where j > i {
                let a = items[i]
                let b = items[j]
                let aName = data.playerName(a.playerID) ?? data.teamName(a.teamID) ?? "?"
                let bName = data.playerName(b.playerID) ?? data.teamName(b.teamID) ?? "?"
                rows.append(RoundRobinMatchInsert(
                    tournament_id: tournamentID,
                    group_id: group.id,
                    name: "\(aName) vs \(bName)",
                    match_type: firstType == "team" ? "doubles" : "singles",
                    display_order: rows.count,
                    slot_a1_player_id: firstType == "player" ? a.playerID : nil,
                    slot_b1_player_id: firstType == "player" ? b.playerID : nil,
                    slot_a_team_id: firstType == "team" ? a.teamID : nil,
                    slot_b_team_id: firstType == "team" ? b.teamID : nil
                ))
            }
        }
        try await client.from("flex_matches").insert(rows).execute()
    }

    func syncParentScore(parentID: UUID) async throws {
        struct Child: Decodable { let winnerSide: String?
            enum CodingKeys: String, CodingKey { case winnerSide = "winner_side" } }
        let children: [Child] = try await client.from("flex_matches")
            .select("winner_side").eq("parent_match_id", value: parentID).execute().value
        let parent: FlexMatch = try await client.from("flex_matches")
            .select(Self.matchSelect).eq("id", value: parentID).single().execute().value
        try await score(
            match: parent,
            scoreA: children.filter { $0.winnerSide == "a" }.count,
            scoreB: children.filter { $0.winnerSide == "b" }.count
        )
    }

    private func requireSuccess(_ result: WorkspaceResult) throws {
        guard result.success else {
            throw WorkspaceError.message(result.detail ?? result.error ?? "Không thể cập nhật giải.")
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
