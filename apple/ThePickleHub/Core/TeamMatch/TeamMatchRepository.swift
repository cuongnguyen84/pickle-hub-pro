import Foundation
import Supabase

/// Loads + scores a Team Match (MLP) tournament natively. Read surfaces port of
/// web TeamMatchView.tsx; scoring/lineup port of TeamMatchScoringSheet.tsx +
/// LineupSelectionSheet.tsx + useTeamMatchMatches.ts.
struct TeamMatchRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    func currentUserID() async -> UUID? { try? await client.auth.session.user.id }

    // MARK: Load

    private static let matchColumns =
        "id, team_a_id, team_b_id, games_won_a, games_won_b, total_points_a, total_points_b, winner_team_id, status, round_number, is_playoff, is_third_place, playoff_round, group_id, display_order, next_match_id, next_match_slot, lineup_a_submitted, lineup_b_submitted, bracket_position"
    private static let gameColumns =
        "id, match_id, game_type, scoring_type, display_name, score_a, score_b, winner_team_id, lineup_team_a, lineup_team_b, is_dreambreaker, order_index, status"

    func load(shareID: String) async throws -> TMDetail {
        let tournament: TMTournament = try await client
            .from("team_match_tournaments")
            .select("id, share_id, name, status, format, team_count, team_roster_size, has_dreambreaker, has_third_place_match, playoff_team_count, require_registration, created_by, total_score_mode, points_per_game")
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
            .select(Self.matchColumns)
            .eq("tournament_id", value: tournament.id)
            .order("display_order", ascending: true)
            .execute().value
        async let groups: [TMGroup] = client
            .from("team_match_groups")
            .select("id, name, display_order")
            .eq("tournament_id", value: tournament.id)
            .order("display_order", ascending: true)
            .execute().value

        let teamList = try await teams
        let matchList = try await matches

        let teamIDs = teamList.map { $0.id.uuidString.lowercased() }
        let matchIDs = matchList.map { $0.id.uuidString.lowercased() }

        async let roster: [TMRosterPlayer] = teamIDs.isEmpty ? [] : client
            .from("team_match_roster")
            .select("id, team_id, player_name, gender, is_captain, user_id, status")
            .in("team_id", values: teamIDs)
            .execute().value
        async let games: [TMGame] = matchIDs.isEmpty ? [] : client
            .from("team_match_games")
            .select(Self.gameColumns)
            .in("match_id", values: matchIDs)
            .execute().value

        return TMDetail(tournament: tournament, teams: teamList, roster: try await roster,
                        matches: matchList, games: try await games, groups: try await groups)
    }

    // MARK: Permissions

    /// Who can score / edit lineups. Mirrors useTeamMatchRefereeManagement
    /// (creator || referee) plus captain (own team) from the roster.
    func scoreAuth(detail: TMDetail) async -> TMScoreAuth {
        guard let uid = await currentUserID() else {
            return TMScoreAuth(canScore: false, isOwner: false, isCreator: false, captainTeamID: nil)
        }
        let isCreator = detail.tournament.createdBy == uid
        var isReferee = false
        if !isCreator {
            struct RefRow: Decodable { let id: UUID }
            let rows: [RefRow]? = try? await client
                .from("team_match_referees")
                .select("id")
                .eq("tournament_id", value: detail.tournament.id)
                .eq("user_id", value: uid)
                .limit(1)
                .execute().value
            isReferee = (rows?.isEmpty == false)
        }
        let isOwner = isCreator || isReferee
        let captainTeamID = detail.roster.first { $0.isCaptain == true && $0.userID == uid }?.teamID
        return TMScoreAuth(canScore: isOwner || captainTeamID != nil, isOwner: isOwner,
                           isCreator: isCreator, captainTeamID: captainTeamID)
    }

    // MARK: Create (port of TeamMatchSetup wizard + useTeamMatch.createTournament)

    struct CreateOptions {
        let name: String
        let rosterSize: Int        // 4 | 6 | 8
        let teamCount: Int
        let format: String         // round_robin | single_elimination | rr_playoff
        let playoffTeamCount: Int? // rr_playoff only
        let requireRegistration: Bool
        let hasDreambreaker: Bool  // effective: even games && toggle
        let requireMinGames: Bool
        let hasThirdPlaceMatch: Bool
        let useDupr: Bool
        let duprMaxMale: Double
        let duprMaxFemale: Double
        let totalScoreMode: Bool
        let pointsPerGame: Int
        let templates: [TMTemplateInput]
    }

    struct TMTemplateInput { let gameType: String; let scoringType: String; let displayName: String; let orderIndex: Int }

    enum CreateError: Error, LocalizedError {
        case limitReached, authRequired, failed(String)
        var errorDescription: String? {
            switch self {
            case .limitReached: return "Đã đạt giới hạn: mỗi tài khoản tối đa 3 giải. Liên hệ tapickleballvn@gmail.com để mở rộng."
            case .authRequired: return "Bạn cần đăng nhập để tạo giải."
            case .failed(let m): return m
            }
        }
    }

    private struct CreateParams: Encodable {
        let name: String, shareID: String, rosterSize: Int, teamCount: Int, format: String
        let playoffTeamCount: Int?, requireRegistration: Bool, hasDreambreaker: Bool
        let requireMinGames: Bool, hasThirdPlace: Bool
        func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: K.self)
            try c.encode(name, forKey: ._name)
            try c.encode(shareID, forKey: ._share_id)
            try c.encode(rosterSize, forKey: ._team_roster_size)
            try c.encode(teamCount, forKey: ._team_count)
            try c.encode(format, forKey: ._format)
            try c.encode(playoffTeamCount, forKey: ._playoff_team_count) // null when nil
            try c.encode(requireRegistration, forKey: ._require_registration)
            try c.encode(hasDreambreaker, forKey: ._has_dreambreaker)
            try c.encode(requireMinGames, forKey: ._require_min_games_per_player)
            try c.encode(hasThirdPlace, forKey: ._has_third_place_match)
            try c.encode("random", forKey: ._bracket_pairing_type)
        }
        enum K: String, CodingKey {
            case _name, _share_id, _team_roster_size, _team_count, _format, _playoff_team_count
            case _require_registration, _has_dreambreaker, _require_min_games_per_player
            case _has_third_place_match, _bracket_pairing_type
        }
    }

    /// Create the tournament via the quota RPC, then insert game templates.
    /// Returns the new share_id (caller pushes the native detail view).
    func createTournament(_ o: CreateOptions) async throws -> String {
        let shareID = Self.randomShareID()
        struct Result: Decodable {
            let success: Bool
            let error: String?
            let tournament: Tournament?
            struct Tournament: Decodable { let id: UUID; let shareID: String
                enum CodingKeys: String, CodingKey { case id; case shareID = "share_id" } }
        }
        let params = CreateParams(
            name: o.name, shareID: shareID, rosterSize: o.rosterSize, teamCount: o.teamCount,
            format: o.format, playoffTeamCount: o.format == "rr_playoff" ? o.playoffTeamCount : nil,
            requireRegistration: o.requireRegistration, hasDreambreaker: o.hasDreambreaker,
            requireMinGames: o.requireMinGames,
            hasThirdPlace: o.format == "single_elimination" ? o.hasThirdPlaceMatch : false)

        let result: Result = try await client
            .rpc("create_team_match_with_quota", params: params).execute().value

        guard result.success, let t = result.tournament else {
            switch result.error {
            case "LIMIT_REACHED": throw CreateError.limitReached
            case "AUTH_REQUIRED": throw CreateError.authRequired
            default: throw CreateError.failed(result.error ?? "Không tạo được giải")
            }
        }

        if !o.templates.isEmpty {
            struct TemplateInsert: Encodable {
                let tournament_id: String; let order_index: Int
                let game_type: String; let display_name: String?; let scoring_type: String
            }
            let rows = o.templates.map {
                TemplateInsert(tournament_id: t.id.uuidString.lowercased(), order_index: $0.orderIndex,
                               game_type: $0.gameType, display_name: $0.displayName, scoring_type: $0.scoringType)
            }
            try await client.from("team_match_game_templates").insert(rows).execute()
        }

        // DUPR: RPC không biết các cột này → UPDATE sau (creator có quyền sửa giải của mình).
        if o.useDupr {
            struct DuprUpdate: Encodable {
                let require_dupr = true
                let dupr_max_male: Double
                let dupr_max_female: Double
            }
            try await client.from("team_match_tournaments")
                .update(DuprUpdate(dupr_max_male: o.duprMaxMale, dupr_max_female: o.duprMaxFemale))
                .eq("id", value: t.id).execute()
        }

        // Chế độ tính theo tổng điểm — cũng UPDATE sau create (RPC không biết cột này).
        if o.totalScoreMode {
            struct TotalScoreUpdate: Encodable {
                let total_score_mode = true
                let points_per_game: Int
            }
            try await client.from("team_match_tournaments")
                .update(TotalScoreUpdate(points_per_game: o.pointsPerGame))
                .eq("id", value: t.id).execute()
        }
        return t.shareID
    }

    private static func randomShareID() -> String {
        let chars = Array("abcdefghijklmnopqrstuvwxyz0123456789")
        return String((0..<8).map { _ in chars.randomElement()! })
    }

    // MARK: Lifecycle (creator only — RLS enforces)

    private struct StatusUpdate: Encodable { let status: String }
    func updateStatus(tournamentID: UUID, status: String) async throws {
        try await client.from("team_match_tournaments")
            .update(StatusUpdate(status: status)).eq("id", value: tournamentID).execute()
    }

    private struct NameUpdate: Encodable { let name: String }
    func rename(tournamentID: UUID, name: String) async throws {
        try await client.from("team_match_tournaments")
            .update(NameUpdate(name: name)).eq("id", value: tournamentID).execute()
    }

    func deleteTournament(tournamentID: UUID) async throws {
        try await client.from("team_match_tournaments")
            .delete().eq("id", value: tournamentID).execute()
    }

    // MARK: Referees (port of referee-helpers + useTeamMatchRefereeManagement)

    func fetchReferees(tournamentID: UUID) async -> [TMReferee] {
        struct Row: Decodable { let id: UUID; let userID: UUID
            enum CodingKeys: String, CodingKey { case id; case userID = "user_id" } }
        guard let rows: [Row] = try? await client
            .from("team_match_referees").select("id, user_id")
            .eq("tournament_id", value: tournamentID).execute().value, !rows.isEmpty else { return [] }
        let names = await displayNames(ids: Set(rows.map { $0.userID.uuidString.lowercased() }))
        return rows.map { TMReferee(id: $0.id, userID: $0.userID,
                                    displayName: names[$0.userID.uuidString.lowercased()]) }
    }

    enum AddRefereeOutcome: Equatable { case ok(String?), notFound, alreadyExists, error }

    /// lookup_user_by_email RPC → existence check → insert. Mirrors referee-helpers.
    func addReferee(tournamentID: UUID, email: String) async -> AddRefereeOutcome {
        struct LookupRow: Decodable { let id: UUID; let displayName: String?
            enum CodingKeys: String, CodingKey { case id; case displayName = "display_name" } }
        let trimmed = email.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return .error }
        do {
            let rows: [LookupRow] = try await client
                .rpc("lookup_user_by_email", params: ["lookup_email": trimmed])
                .execute().value
            guard let profile = rows.first else { return .notFound }
            struct R: Decodable { let id: UUID }
            let existing: [R] = try await client
                .from("team_match_referees").select("id")
                .eq("tournament_id", value: tournamentID).eq("user_id", value: profile.id)
                .limit(1).execute().value
            if !existing.isEmpty { return .alreadyExists }
            struct Ins: Encodable { let tournament_id: String; let user_id: String }
            try await client.from("team_match_referees")
                .insert(Ins(tournament_id: tournamentID.uuidString.lowercased(),
                            user_id: profile.id.uuidString.lowercased())).execute()
            return .ok(profile.displayName)
        } catch { return .error }
    }

    func removeReferee(refereeID: UUID) async throws {
        try await client.from("team_match_referees").delete().eq("id", value: refereeID).execute()
    }

    // MARK: Teams + roster (organizer path — port of useTeamMatchTeams, simplified)

    private struct TeamInsert: Encodable {
        let tournament_id: String; let team_name: String; let seed: Int; let status: String
        let captain_user_id: String?
        func encode(to e: Encoder) throws {
            var c = e.container(keyedBy: K.self)
            try c.encode(tournament_id, forKey: .tournament_id)
            try c.encode(team_name, forKey: .team_name)
            try c.encode(seed, forKey: .seed)
            try c.encode(status, forKey: .status)
            if let captain_user_id { try c.encode(captain_user_id, forKey: .captain_user_id) }
        }
        enum K: String, CodingKey { case tournament_id, team_name, seed, status, captain_user_id }
    }
    /// Add a team. Organizer path → captain_user_id nil + status 'approved'.
    /// Captain self-register → captain_user_id = self + status 'pending'.
    func addTeam(tournamentID: UUID, name: String, seed: Int,
                 captainUserID: UUID? = nil, status: String = "approved") async throws -> UUID {
        struct R: Decodable { let id: UUID }
        let row: R = try await client
            .from("team_match_teams")
            .insert(TeamInsert(tournament_id: tournamentID.uuidString.lowercased(),
                               team_name: name, seed: seed, status: status,
                               captain_user_id: captainUserID?.uuidString.lowercased()))
            .select("id").single().execute().value
        return row.id
    }

    /// The signed-in user's own team in this tournament (captain), if any.
    func userTeam(tournamentID: UUID) async -> TMTeam? {
        guard let uid = await currentUserID() else { return nil }
        let rows: [TMTeam]? = try? await client
            .from("team_match_teams").select("id, team_name, seed, group_id, status")
            .eq("tournament_id", value: tournamentID).eq("captain_user_id", value: uid).limit(1)
            .execute().value
        return rows?.first
    }

    enum InviteResult: Equatable { case ok(String), failed(String) }
    /// Organizer invites a captain by email — edge fn invite-team-to-tournament
    /// (auto-creates + approves the team). Port of InviteTeamDialog.
    func inviteTeamByEmail(tournamentID: UUID, tournamentName: String, email: String) async -> InviteResult {
        struct Body: Encodable { let captainEmail: String; let tournamentId: String; let tournamentName: String }
        struct Resp: Decodable { let success: Bool?; let message: String?; let error: String? }
        do {
            let resp: Resp = try await client.functions.invoke(
                "invite-team-to-tournament",
                options: FunctionInvokeOptions(body: Body(
                    captainEmail: email.trimmingCharacters(in: .whitespacesAndNewlines),
                    tournamentId: tournamentID.uuidString.lowercased(), tournamentName: tournamentName)))
            if resp.success == true { return .ok(resp.message ?? "Đã mời đội") }
            return .failed(resp.error ?? "Không mời được đội")
        } catch { return .failed(error.localizedDescription) }
    }

    private struct RosterInsert: Encodable {
        let team_id: String; let player_name: String; let gender: String
        let is_captain: Bool; let status: String
    }
    func addRosterMember(teamID: UUID, name: String, gender: String, isCaptain: Bool) async throws {
        try await client.from("team_match_roster").insert(
            RosterInsert(team_id: teamID.uuidString.lowercased(), player_name: name,
                         gender: gender, is_captain: isCaptain, status: "approved")).execute()
    }
    func removeRosterMember(id: UUID) async throws {
        try await client.from("team_match_roster").delete().eq("id", value: id).execute()
    }
    func deleteTeam(id: UUID) async throws {
        try await client.from("team_match_teams").delete().eq("id", value: id).execute()
    }
    func updateTeamStatus(teamID: UUID, status: String) async throws {
        struct U: Encodable { let status: String }
        try await client.from("team_match_teams").update(U(status: status)).eq("id", value: teamID).execute()
    }

    /// Fresh teams + roster for the manage sheet (re-read after each mutation).
    func loadTeamsRoster(tournamentID: UUID) async throws -> (teams: [TMTeam], roster: [TMRosterPlayer]) {
        let teams: [TMTeam] = try await client
            .from("team_match_teams").select("id, team_name, seed, group_id, status")
            .eq("tournament_id", value: tournamentID).order("seed", ascending: true).execute().value
        let ids = teams.map { $0.id.uuidString.lowercased() }
        let roster: [TMRosterPlayer] = ids.isEmpty ? [] : try await client
            .from("team_match_roster").select("id, team_id, player_name, gender, is_captain, user_id, status")
            .in("team_id", values: ids).execute().value
        return (teams, roster)
    }

    // MARK: Match generation (port of useTeamMatchMatches generate*)

    enum GenerateError: Error, LocalizedError {
        case tooFewTeams, notPowerOfTwo, noTemplates
        var errorDescription: String? {
            switch self {
            case .tooFewTeams: return "Cần ít nhất 2 đội (đã duyệt) để tạo lịch."
            case .notPowerOfTwo: return "Số đội phải là lũy thừa của 2 (4, 8, 16, 32…) cho loại trực tiếp."
            case .noTemplates: return "Giải chưa có game template."
            }
        }
    }

    private struct ApprovedTeamRow: Decodable {
        let id: UUID; let seed: Int?; let createdAt: String?
        enum CodingKeys: String, CodingKey { case id, seed; case createdAt = "created_at" }
    }
    private func approvedTeamIDs(tournamentID: UUID) async throws -> [String] {
        let teams: [ApprovedTeamRow] = try await client
            .from("team_match_teams").select("id, seed, created_at")
            .eq("tournament_id", value: tournamentID).eq("status", value: "approved")
            .order("seed", ascending: true).order("created_at", ascending: true)
            .execute().value
        return teams.map { $0.id.uuidString.lowercased() }
    }

    private struct InsertedID: Decodable { let id: UUID }

    /// Build + insert sub-games for the given match ids from templates (+ dreambreaker
    /// when even count & enabled). Shared by all generators.
    private func insertGames(forMatchIDs ids: [UUID], templates: [TemplateRow], hasDreambreaker: Bool) async throws {
        guard !templates.isEmpty, !ids.isEmpty else { return }
        let addDB = hasDreambreaker && templates.count % 2 == 0
        var games: [GameInsert] = []
        for mid in ids {
            for (i, t) in templates.enumerated() {
                games.append(GameInsert(match_id: mid.uuidString.lowercased(), order_index: i,
                                        game_type: t.gameType, scoring_type: t.scoringType,
                                        display_name: t.displayName, is_dreambreaker: false,
                                        score_a: 0, score_b: 0, status: "pending"))
            }
            if addDB {
                games.append(GameInsert(match_id: mid.uuidString.lowercased(), order_index: templates.count,
                                        game_type: "MS", scoring_type: "rally21",
                                        display_name: "Dreambreaker", is_dreambreaker: true,
                                        score_a: 0, score_b: 0, status: "pending"))
            }
        }
        try await client.from("team_match_games").insert(games).execute()
    }

    func deleteMatches(tournamentID: UUID) async throws {
        try await client.from("team_match_matches").delete().eq("tournament_id", value: tournamentID).execute()
    }

    /// rr_playoff: xoá toàn bộ vòng bảng (trận + bảng) + đưa giải về 'registration' để chia lại sạch.
    func resetGroupStage(tournamentID: UUID) async throws {
        try await client.from("team_match_matches").delete().eq("tournament_id", value: tournamentID).execute()
        try await client.from("team_match_groups").delete().eq("tournament_id", value: tournamentID).execute()
        struct StatusUpdate: Encodable { let status: String }
        try await client.from("team_match_tournaments")
            .update(StatusUpdate(status: "registration")).eq("id", value: tournamentID).execute()
    }

    /// Round-robin (circle method) — port of generateMatchesMutation.
    private struct RRMatchInsert: Encodable {
        let tournament_id: String; let team_a_id: String; let team_b_id: String
        let round_number: Int; let is_playoff: Bool; let status: String; let display_order: Int
        let games_won_a: Int; let games_won_b: Int; let total_points_a: Int; let total_points_b: Int
        var group_id: String? = nil   // nil = RR phẳng; set khi chia bảng
    }

    /// Cặp đấu vòng tròn (circle method) cho 1 tập đội. BYE bỏ qua. Dùng chung RR phẳng + theo bảng.
    static func circlePairs(_ ids: [String]) -> [(a: String, b: String, round: Int)] {
        var sched = ids
        guard sched.count >= 2 else { return [] }
        if sched.count % 2 != 0 { sched.append("BYE") }
        let numRounds = sched.count - 1, half = sched.count / 2
        var out: [(a: String, b: String, round: Int)] = []
        for round in 0..<numRounds {
            for i in 0..<half {
                let a = sched[i], b = sched[sched.count - 1 - i]
                if a != "BYE" && b != "BYE" { out.append((a, b, round + 1)) }
            }
            let last = sched.removeLast(); sched.insert(last, at: 1)
        }
        return out
    }

    func generateRoundRobin(tournamentID: UUID, hasDreambreaker: Bool) async throws {
        let ids = try await approvedTeamIDs(tournamentID: tournamentID)
        guard ids.count >= 2 else { throw GenerateError.tooFewTeams }
        let tID = tournamentID.uuidString.lowercased()
        let rows = Self.circlePairs(ids).enumerated().map { i, p in
            RRMatchInsert(tournament_id: tID, team_a_id: p.a, team_b_id: p.b,
                          round_number: p.round, is_playoff: false, status: "pending",
                          display_order: i, games_won_a: 0, games_won_b: 0,
                          total_points_a: 0, total_points_b: 0)
        }
        let inserted: [InsertedID] = try await client
            .from("team_match_matches").insert(rows).select("id").execute().value
        let templates = try await gameTemplates(tournamentID: tournamentID)
        try await insertGames(forMatchIDs: inserted.map { $0.id }, templates: templates, hasDreambreaker: hasDreambreaker)
    }

    /// rr_playoff — chia bảng theo `distribution` (random/manual do UI quyết): tạo team_match_groups,
    /// gán group_id cho đội, set status 'ongoing' + group_count, sinh RR THEO TỪNG BẢNG + games.
    /// Port web useTeamMatchGroups.createGroups, hỗ trợ mọi số bảng.
    func setupGroups(tournamentID: UUID, distribution: [[UUID]], hasDreambreaker: Bool) async throws {
        let tID = tournamentID.uuidString.lowercased()
        guard distribution.count >= 2, distribution.allSatisfy({ $0.count >= 2 }) else {
            throw GenerateError.tooFewTeams
        }
        // Clean slate (idempotent): xoá bảng + trận vòng bảng cũ để chia lại không bị tạo trùng.
        // games cascade theo match; group_id của đội cascade về null khi xoá group.
        try await client.from("team_match_matches").delete()
            .eq("tournament_id", value: tournamentID).eq("is_playoff", value: false).execute()
        try await client.from("team_match_groups").delete()
            .eq("tournament_id", value: tournamentID).execute()
        let names = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
        struct GroupInsert: Encodable { let tournament_id: String; let name: String; let display_order: Int }
        let groupRows: [InsertedID] = try await client.from("team_match_groups")
            .insert(distribution.indices.map { i in
                GroupInsert(tournament_id: tID, name: "Bảng \(names[i])", display_order: i) })
            .select("id").execute().value

        struct GroupAssign: Encodable { let group_id: String }
        for (i, teamIDs) in distribution.enumerated() {
            let gid = groupRows[i].id.uuidString.lowercased()
            for tid in teamIDs {
                try await client.from("team_match_teams")
                    .update(GroupAssign(group_id: gid)).eq("id", value: tid.uuidString.lowercased()).execute()
            }
        }

        struct TUpdate: Encodable { let group_count: Int; let status: String }
        try await client.from("team_match_tournaments")
            .update(TUpdate(group_count: distribution.count, status: "ongoing"))
            .eq("id", value: tournamentID).execute()

        var rows: [RRMatchInsert] = []
        for (i, teamIDs) in distribution.enumerated() {
            let gid = groupRows[i].id.uuidString.lowercased()
            for p in Self.circlePairs(teamIDs.map { $0.uuidString.lowercased() }) {
                rows.append(RRMatchInsert(tournament_id: tID, team_a_id: p.a, team_b_id: p.b,
                    round_number: p.round, is_playoff: false, status: "pending", display_order: rows.count,
                    games_won_a: 0, games_won_b: 0, total_points_a: 0, total_points_b: 0, group_id: gid))
            }
        }
        let inserted: [InsertedID] = try await client
            .from("team_match_matches").insert(rows).select("id").execute().value
        let templates = try await gameTemplates(tournamentID: tournamentID)
        try await insertGames(forMatchIDs: inserted.map { $0.id }, templates: templates, hasDreambreaker: hasDreambreaker)
    }

    /// Single elimination bracket (random pairing) — port of generateSingleEliminationMutation.
    private struct POMatchInsert: Encodable {
        let tournament_id: String
        let team_a_id: String?
        let team_b_id: String?
        let playoff_round: Int
        let bracket_position: Int
        let display_order: Int
        let is_third_place: Bool
        func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: K.self)
            try c.encode(tournament_id, forKey: .tournament_id)
            try c.encode(team_a_id, forKey: .team_a_id)   // null when nil
            try c.encode(team_b_id, forKey: .team_b_id)
            try c.encode(playoff_round, forKey: .playoff_round)
            try c.encode(bracket_position, forKey: .bracket_position)
            try c.encode(display_order, forKey: .display_order)
            try c.encode(is_third_place, forKey: .is_third_place)
            try c.encode(true, forKey: .is_playoff)
            try c.encode("pending", forKey: .status)
            try c.encode(0, forKey: .games_won_a); try c.encode(0, forKey: .games_won_b)
            try c.encode(0, forKey: .total_points_a); try c.encode(0, forKey: .total_points_b)
        }
        enum K: String, CodingKey {
            case tournament_id, team_a_id, team_b_id, playoff_round, bracket_position
            case display_order, is_third_place, is_playoff, status
            case games_won_a, games_won_b, total_points_a, total_points_b
        }
    }
    private struct POInsertedRow: Decodable {
        let id: UUID; let playoffRound: Int?; let bracketPosition: Int?
        enum CodingKeys: String, CodingKey {
            case id; case playoffRound = "playoff_round"; case bracketPosition = "bracket_position"
        }
    }
    private struct NextLinkUpdate: Encodable { let next_match_id: String; let next_match_slot: Int }

    func generateSingleElimination(tournamentID: UUID, hasThirdPlace: Bool, hasDreambreaker: Bool) async throws {
        let teamIDs = try await approvedTeamIDs(tournamentID: tournamentID)
        let n = teamIDs.count
        guard n >= 2 else { throw GenerateError.tooFewTeams }
        guard n & (n - 1) == 0 else { throw GenerateError.notPowerOfTwo }
        let totalRounds = Int(log2(Double(n)))
        let tID = tournamentID.uuidString.lowercased()

        var rows: [POMatchInsert] = []
        let shuffled = teamIDs.shuffled()
        var idx = 0
        var i = 0
        while i < shuffled.count {
            rows.append(POMatchInsert(tournament_id: tID, team_a_id: shuffled[i], team_b_id: shuffled[i + 1],
                                      playoff_round: totalRounds, bracket_position: idx, display_order: idx, is_third_place: false))
            idx += 1; i += 2
        }
        for round in stride(from: totalRounds - 1, through: 1, by: -1) {
            let matchesInRound = Int(pow(2.0, Double(round - 1)))
            for j in 0..<matchesInRound {
                rows.append(POMatchInsert(tournament_id: tID, team_a_id: nil, team_b_id: nil,
                                          playoff_round: round, bracket_position: j,
                                          display_order: 100 + (totalRounds - round) * 10 + j, is_third_place: false))
            }
        }
        let inserted: [POInsertedRow] = try await client
            .from("team_match_matches").insert(rows).select("id, playoff_round, bracket_position").execute().value

        // Link each match to its next-round match.
        var byRound: [Int: [POInsertedRow]] = [:]
        for m in inserted { byRound[m.playoffRound ?? 1, default: []].append(m) }
        for round in stride(from: totalRounds, through: 2, by: -1) {
            let cur = (byRound[round] ?? []).sorted { ($0.bracketPosition ?? 0) < ($1.bracketPosition ?? 0) }
            let nxt = (byRound[round - 1] ?? []).sorted { ($0.bracketPosition ?? 0) < ($1.bracketPosition ?? 0) }
            for (k, m) in cur.enumerated() {
                let nextIdx = k / 2
                guard nxt.indices.contains(nextIdx) else { continue }
                try await client.from("team_match_matches")
                    .update(NextLinkUpdate(next_match_id: nxt[nextIdx].id.uuidString.lowercased(), next_match_slot: (k % 2) + 1))
                    .eq("id", value: m.id).execute()
            }
        }

        if hasThirdPlace && n >= 4 {
            try await client.from("team_match_matches").insert(
                POMatchInsert(tournament_id: tID, team_a_id: nil, team_b_id: nil,
                              playoff_round: 0, bracket_position: 0, display_order: 999, is_third_place: true)).execute()
        }

        // Games for first-round matches (those with both teams).
        let templates = try await gameTemplates(tournamentID: tournamentID)
        let firstRoundIDs = inserted.filter { $0.playoffRound == totalRounds }.map { $0.id }
        try await insertGames(forMatchIDs: firstRoundIDs, templates: templates, hasDreambreaker: hasDreambreaker)
    }

    /// rr_playoff: seed the playoff bracket from final standings (standard
    /// seeding 1vN, 2vN-1…). `seededTeamIDs` is rank order (rank 1 first),
    /// length must be a power of two. Port of generatePlayoffMatchesMutation.
    /// Ghép cặp playoff THEO BẢNG (số bảng chẵn): nhất bảng X gặp nhì bảng Y (cặp kề), nhì X gặp nhất Y
    /// ở nửa đối diện → 2 đội cùng bảng nằm hai nửa, chỉ gặp lại ở chung kết.
    /// `winners`/`runnersUp` index theo thứ tự bảng (A,B,C…). Trả first-round: nửa trên trước, nửa dưới sau.
    static func groupPairings(winners: [String], runnersUp: [String]) -> [(a: String, b: String)]? {
        let g = winners.count
        guard g >= 2, g % 2 == 0, runnersUp.count == g else { return nil }
        var top: [(a: String, b: String)] = [], bottom: [(a: String, b: String)] = []
        var p = 0
        while p < g {
            top.append((winners[p], runnersUp[p + 1]))      // X1 vs Y2 → nửa trên
            bottom.append((winners[p + 1], runnersUp[p]))   // Y1 vs X2 → nửa dưới
            p += 2
        }
        return top + bottom
    }

    /// Playoff seed theo BXH tổng + seed-position chuẩn (fallback khi không seed theo bảng).
    func generatePlayoffFromSeeds(tournamentID: UUID, seededTeamIDs: [String], hasDreambreaker: Bool) async throws {
        let n = seededTeamIDs.count
        guard n >= 2, n & (n - 1) == 0 else { throw GenerateError.notPowerOfTwo }
        let order = DEBracket.seedPositions(n)   // order[slot] = seedIndex (0-based); #1 & #2 hai nửa đối diện
        let firstRound = (0..<(n / 2)).map { i in (a: seededTeamIDs[order[2 * i]], b: seededTeamIDs[order[2 * i + 1]]) }
        try await buildPlayoffBracket(tournamentID: tournamentID, firstRound: firstRound, hasDreambreaker: hasDreambreaker)
    }

    /// Playoff seed theo BẢNG (nhất gặp nhì bảng khác, cùng bảng khác nhánh).
    func generatePlayoffFromGroupPairs(tournamentID: UUID, firstRound: [(a: String, b: String)], hasDreambreaker: Bool) async throws {
        try await buildPlayoffBracket(tournamentID: tournamentID, firstRound: firstRound, hasDreambreaker: hasDreambreaker)
    }

    /// Dựng bracket từ first-round pairs cho trước (chung cho cả 2 cách seed). Match i & i+1 (i chẵn)
    /// dồn về 1 match vòng sau (k/2) — first-round phải đã xếp đúng nhánh.
    private func buildPlayoffBracket(tournamentID: UUID, firstRound: [(a: String, b: String)], hasDreambreaker: Bool) async throws {
        let n = firstRound.count * 2
        guard n >= 2, n & (n - 1) == 0 else { throw GenerateError.notPowerOfTwo }
        let totalRounds = Int(log2(Double(n)))
        let tID = tournamentID.uuidString.lowercased()

        var rows: [POMatchInsert] = []
        for (i, pr) in firstRound.enumerated() {
            rows.append(POMatchInsert(tournament_id: tID, team_a_id: pr.a, team_b_id: pr.b,
                                      playoff_round: totalRounds, bracket_position: i, display_order: i, is_third_place: false))
        }
        for round in stride(from: totalRounds - 1, through: 1, by: -1) {
            let matchesInRound = Int(pow(2.0, Double(round - 1)))
            for j in 0..<matchesInRound {
                rows.append(POMatchInsert(tournament_id: tID, team_a_id: nil, team_b_id: nil,
                                          playoff_round: round, bracket_position: j,
                                          display_order: 100 + (totalRounds - round) * 10 + j, is_third_place: false))
            }
        }
        let inserted: [POInsertedRow] = try await client
            .from("team_match_matches").insert(rows).select("id, playoff_round, bracket_position").execute().value

        var byRound: [Int: [POInsertedRow]] = [:]
        for m in inserted { byRound[m.playoffRound ?? 1, default: []].append(m) }
        for round in stride(from: totalRounds, through: 2, by: -1) {
            let cur = (byRound[round] ?? []).sorted { ($0.bracketPosition ?? 0) < ($1.bracketPosition ?? 0) }
            let nxt = (byRound[round - 1] ?? []).sorted { ($0.bracketPosition ?? 0) < ($1.bracketPosition ?? 0) }
            for (k, m) in cur.enumerated() {
                let nextIdx = k / 2
                guard nxt.indices.contains(nextIdx) else { continue }
                try await client.from("team_match_matches")
                    .update(NextLinkUpdate(next_match_id: nxt[nextIdx].id.uuidString.lowercased(), next_match_slot: (k % 2) + 1))
                    .eq("id", value: m.id).execute()
            }
        }

        let templates = try await gameTemplates(tournamentID: tournamentID)
        let firstRoundIDs = inserted.filter { $0.playoffRound == totalRounds }.map { $0.id }
        try await insertGames(forMatchIDs: firstRoundIDs, templates: templates, hasDreambreaker: hasDreambreaker)
    }

    /// Batch-resolve display names from public_profiles (lower-cased id keys).
    private func displayNames(ids: Set<String>) async -> [String: String] {
        guard !ids.isEmpty else { return [:] }
        struct ProfileRow: Decodable {
            let id: String
            let displayName: String?
            enum CodingKeys: String, CodingKey { case id; case displayName = "display_name" }
        }
        guard let rows: [ProfileRow] = try? await client
            .from("public_profiles").select("id, display_name")
            .in("id", values: Array(ids)).execute().value else { return [:] }
        var map: [String: String] = [:]
        for r in rows { if let n = r.displayName?.nonEmpty { map[r.id.lowercased()] = n } }
        return map
    }

    // MARK: Scoring (port of TeamMatchScoringSheet + useTeamMatchMatches)

    private struct GameScoreUpdate: Encodable {
        let score_a: Int
        let score_b: Int
        let status: String
    }

    /// Persist one sub-game's score. status = completed when decided, else in_progress.
    /// winner_team_id on the game row is intentionally NOT written (web parity).
    func saveGameScore(gameID: UUID, scoreA: Int, scoreB: Int) async throws {
        let status = scoreA != scoreB ? "completed" : "in_progress"
        try await client
            .from("team_match_games")
            .update(GameScoreUpdate(score_a: scoreA, score_b: scoreB, status: status))
            .eq("id", value: gameID)
            .execute()
    }

    /// Đẩy điểm ván hiện tại (chưa completed) để người xem thấy realtime —
    /// mirror QuickTableRepository.updateLiveScore. Best-effort.
    func updateGameLiveScore(gameID: UUID, scoreA: Int, scoreB: Int) async throws {
        struct U: Encodable { let score_a: Int; let score_b: Int }
        try await client.from("team_match_games")
            .update(U(score_a: scoreA, score_b: scoreB)).eq("id", value: gameID).execute()
    }

    /// Claim ván làm LIVE (live_referee_id = user hiện tại) để hiện badge —
    /// mirror QuickTableRepository.claimLive.
    func claimGameLive(gameID: UUID) async throws {
        guard let uid = await currentUserID() else { return }
        struct U: Encodable { let live_referee_id: String }
        try await client.from("team_match_games")
            .update(U(live_referee_id: uid.uuidString.lowercased())).eq("id", value: gameID).execute()
    }

    /// Match-level aggregate write — sends explicit null for winner so a downgraded
    /// match clears its winner (web parity).
    private struct MatchResultUpdate: Encodable {
        let games_won_a: Int
        let games_won_b: Int
        let total_points_a: Int
        let total_points_b: Int
        let winner_team_id: String?
        let status: String
        func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            try c.encode(games_won_a, forKey: .games_won_a)
            try c.encode(games_won_b, forKey: .games_won_b)
            try c.encode(total_points_a, forKey: .total_points_a)
            try c.encode(total_points_b, forKey: .total_points_b)
            try c.encode(winner_team_id, forKey: .winner_team_id) // null when nil
            try c.encode(status, forKey: .status)
        }
        enum CodingKeys: String, CodingKey {
            case games_won_a, games_won_b, total_points_a, total_points_b, winner_team_id, status
        }
    }

    /// Recompute match totals from all its games and persist; advances the
    /// playoff bracket exactly like web updateMatchResult.
    /// `scores` is the full ordered list of (a,b) for the match's games.
    func saveMatchResult(match: TMMatch, scores: [(a: Int, b: Int)],
                         tournamentID: UUID, hasDreambreaker: Bool) async throws {
        var gamesWonA = 0, gamesWonB = 0, totalPointsA = 0, totalPointsB = 0
        for s in scores {
            totalPointsA += s.a; totalPointsB += s.b
            if s.a > s.b { gamesWonA += 1 } else if s.b > s.a { gamesWonB += 1 }
        }
        let requiredToWin = Int(ceil(Double(scores.count) / 2.0))
        var winnerID: UUID? = nil
        if gamesWonA >= requiredToWin, let a = match.teamAID { winnerID = a }
        else if gamesWonB >= requiredToWin, let b = match.teamBID { winnerID = b }

        try await client
            .from("team_match_matches")
            .update(MatchResultUpdate(
                games_won_a: gamesWonA, games_won_b: gamesWonB,
                total_points_a: totalPointsA, total_points_b: totalPointsB,
                winner_team_id: winnerID?.uuidString.lowercased(),
                status: winnerID != nil ? "completed" : "in_progress"))
            .eq("id", value: match.id)
            .execute()

        // Playoff advancement.
        guard match.isPlayoff, let winner = winnerID, let nextID = match.nextMatchID else { return }

        let slotField = match.nextMatchSlot == 1 ? "team_a_id" : "team_b_id"
        try await setTeamSlot(matchID: nextID, field: slotField, teamID: winner)

        // Semifinal (playoff_round == 2) loser drops to the third-place match.
        if match.playoffRound == 2 {
            let loser = (match.teamAID == winner) ? match.teamBID : match.teamAID
            if let loser {
                if let tp = try? await thirdPlaceMatch(tournamentID: tournamentID) {
                    let field = tp.teamAID != nil ? "team_b_id" : "team_a_id"
                    try await setTeamSlot(matchID: tp.id, field: field, teamID: loser)
                    try await ensureGamesIfReady(matchID: tp.id, tournamentID: tournamentID, hasDreambreaker: hasDreambreaker)
                }
            }
        }

        try await ensureGamesIfReady(matchID: nextID, tournamentID: tournamentID, hasDreambreaker: hasDreambreaker)
    }

    private struct TeamSlotUpdate: Encodable { let field: String; let teamID: String
        func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: DynamicKey.self)
            try c.encode(teamID, forKey: DynamicKey(stringValue: field)!)
        }
    }
    private struct DynamicKey: CodingKey {
        var stringValue: String; var intValue: Int? { nil }
        init?(stringValue: String) { self.stringValue = stringValue }
        init?(intValue: Int) { nil }
    }

    private func setTeamSlot(matchID: UUID, field: String, teamID: UUID) async throws {
        try await client
            .from("team_match_matches")
            .update(TeamSlotUpdate(field: field, teamID: teamID.uuidString.lowercased()))
            .eq("id", value: matchID)
            .execute()
    }

    private struct SlotRow: Decodable {
        let id: UUID
        let teamAID: UUID?
        let teamBID: UUID?
        enum CodingKeys: String, CodingKey { case id; case teamAID = "team_a_id"; case teamBID = "team_b_id" }
    }

    private func thirdPlaceMatch(tournamentID: UUID) async throws -> SlotRow? {
        let rows: [SlotRow] = try await client
            .from("team_match_matches")
            .select("id, team_a_id, team_b_id")
            .eq("tournament_id", value: tournamentID)
            .eq("is_third_place", value: true)
            .limit(1)
            .execute().value
        return rows.first
    }

    /// Insert games for a match (from templates + optional dreambreaker) once both
    /// teams are assigned and no games exist yet. Mirrors useTeamMatchMatches.
    private func ensureGamesIfReady(matchID: UUID, tournamentID: UUID, hasDreambreaker: Bool) async throws {
        let rows: [SlotRow] = try await client
            .from("team_match_matches")
            .select("id, team_a_id, team_b_id")
            .eq("id", value: matchID)
            .limit(1)
            .execute().value
        guard let m = rows.first, m.teamAID != nil, m.teamBID != nil else { return }

        struct ExistingGame: Decodable { let id: UUID }
        let existing: [ExistingGame] = try await client
            .from("team_match_games")
            .select("id")
            .eq("match_id", value: matchID)
            .limit(1)
            .execute().value
        guard existing.isEmpty else { return }

        let templates = try await gameTemplates(tournamentID: tournamentID)
        guard !templates.isEmpty else { return }

        var inserts: [GameInsert] = templates.enumerated().map { idx, t in
            GameInsert(match_id: matchID.uuidString.lowercased(), order_index: idx,
                       game_type: t.gameType, scoring_type: t.scoringType,
                       display_name: t.displayName, is_dreambreaker: false,
                       score_a: 0, score_b: 0, status: "pending")
        }
        if hasDreambreaker && templates.count % 2 == 0 {
            inserts.append(GameInsert(match_id: matchID.uuidString.lowercased(), order_index: templates.count,
                                      game_type: "MS", scoring_type: "rally21",
                                      display_name: "Dreambreaker", is_dreambreaker: true,
                                      score_a: 0, score_b: 0, status: "pending"))
        }
        try await client.from("team_match_games").insert(inserts).execute()
    }

    private struct GameInsert: Encodable {
        let match_id: String
        let order_index: Int
        let game_type: String
        let scoring_type: String
        let display_name: String?
        let is_dreambreaker: Bool
        let score_a: Int
        let score_b: Int
        let status: String
    }

    private struct TemplateRow: Decodable {
        let gameType: String
        let scoringType: String
        let displayName: String?
        let orderIndex: Int
        enum CodingKeys: String, CodingKey {
            case gameType = "game_type"
            case scoringType = "scoring_type"
            case displayName = "display_name"
            case orderIndex = "order_index"
        }
    }

    private func gameTemplates(tournamentID: UUID) async throws -> [TemplateRow] {
        try await client
            .from("team_match_game_templates")
            .select("game_type, scoring_type, display_name, order_index")
            .eq("tournament_id", value: tournamentID)
            .order("order_index", ascending: true)
            .execute().value
    }

    // MARK: Lineup (port of LineupSelectionSheet)

    private struct LineupUpdate: Encodable {
        let field: String          // lineup_team_a | lineup_team_b
        let ids: [String]
        func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: DynamicKey.self)
            try c.encode(ids, forKey: DynamicKey(stringValue: field)!)
        }
    }
    private struct LineupSubmittedUpdate: Encodable {
        let field: String          // lineup_a_submitted | lineup_b_submitted
        func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: DynamicKey.self)
            try c.encode(true, forKey: DynamicKey(stringValue: field)!)
        }
    }

    /// Save one team's lineups for every game of a match, then flag submitted.
    /// `lineups` maps game id → ordered roster ids (web sets all games at once).
    func saveLineup(matchID: UUID, isTeamA: Bool, lineups: [UUID: [UUID]]) async throws {
        let field = isTeamA ? "lineup_team_a" : "lineup_team_b"
        for (gameID, ids) in lineups {
            try await client
                .from("team_match_games")
                .update(LineupUpdate(field: field, ids: ids.map { $0.uuidString.lowercased() }))
                .eq("id", value: gameID)
                .execute()
        }
        let submittedField = isTeamA ? "lineup_a_submitted" : "lineup_b_submitted"
        try await client
            .from("team_match_matches")
            .update(LineupSubmittedUpdate(field: submittedField))
            .eq("id", value: matchID)
            .execute()
    }
}

/// Resolved scoring authority for the current user on a Team Match tournament.
struct TMScoreAuth: Equatable {
    let canScore: Bool       // organizer/referee/captain may enter scores
    let isOwner: Bool        // creator or referee — may edit any team's lineup anytime
    let isCreator: Bool      // creator only — may manage the tournament (settings/delete/start)
    let captainTeamID: UUID? // team the user captains (own-team lineup only)
}

/// A referee row enriched with display name (team_match_referees + public_profiles).
struct TMReferee: Identifiable, Equatable {
    let id: UUID
    let userID: UUID
    let displayName: String?
}
