import Foundation
import Supabase

/// Loads + scores a Team Match (MLP) tournament natively. Read surfaces port of
/// web TeamMatchView.tsx; scoring/lineup port of TeamMatchScoringSheet.tsx +
/// LineupSelectionSheet.tsx + useTeamMatchMatches.ts.
struct TeamMatchRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    func currentUserID() async -> UUID? { try? await client.auth.session.user.id }

    /// DUPR (doubles preferred, singles fallback) per linked account, for roster
    /// members with a user_id. profiles readable by authenticated users.
    func duprByUser(_ userIDs: [UUID]) async throws -> [UUID: Double] {
        guard !userIDs.isEmpty else { return [:] }
        struct Row: Decodable {
            let id: UUID; let singles: Double?; let doubles: Double?
            enum CodingKeys: String, CodingKey { case id; case singles = "dupr_singles"; case doubles = "dupr_doubles" }
        }
        let rows: [Row] = try await client.from("profiles")
            .select("id, dupr_singles, dupr_doubles")
            .in("id", values: userIDs.map { $0.uuidString.lowercased() }).execute().value
        var map: [UUID: Double] = [:]
        for r in rows { if let v = r.doubles ?? r.singles { map[r.id] = v } }
        return map
    }

    // MARK: Load

    private static let matchColumns =
        "id, team_a_id, team_b_id, games_won_a, games_won_b, total_points_a, total_points_b, winner_team_id, status, round_number, is_playoff, is_third_place, is_repechage, playoff_round, group_id, display_order, next_match_id, next_match_slot, lineup_a_submitted, lineup_b_submitted, bracket_position"
    private static let gameColumns =
        "id, match_id, game_type, scoring_type, display_name, score_a, score_b, score_version, winner_team_id, lineup_team_a, lineup_team_b, is_dreambreaker, order_index, status"

    func load(shareID: String) async throws -> TMDetail {
        let tournament: TMTournament = try await client
            .from("team_match_tournaments")
            .select("id, share_id, name, status, format, team_count, team_roster_size, has_dreambreaker, has_third_place_match, playoff_team_count, has_repechage, require_registration, created_by, total_score_mode, points_per_game, require_dupr, dupr_max_male, dupr_max_female, rules_summary, entry_fee_vnd, entry_fee_team_vnd, bank_code, bank_account_number, bank_account_name, event_date, location, discount_tiers, chat_group_url")
            .eq("share_id", value: shareID)
            .single()
            .execute().value

        async let teams: [TMTeam] = client
            .from("team_match_teams")
            .select("id, team_name, seed, group_id, status, payment_status, created_at")
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

    func shareID(forMatchID matchID: UUID) async throws -> String {
        struct MatchRow: Decodable {
            let tournamentID: UUID
            enum CodingKeys: String, CodingKey { case tournamentID = "tournament_id" }
        }
        struct TournamentRow: Decodable {
            let shareID: String
            enum CodingKeys: String, CodingKey { case shareID = "share_id" }
        }
        let match: MatchRow = try await client.from("team_match_matches")
            .select("tournament_id")
            .eq("id", value: matchID)
            .single()
            .execute().value
        let tournament: TournamentRow = try await client.from("team_match_tournaments")
            .select("share_id")
            .eq("id", value: match.tournamentID)
            .single()
            .execute().value
        return tournament.shareID
    }

    // MARK: Permissions

    /// Who can score / edit lineups. Mirrors useTeamMatchRefereeManagement
    /// (creator || referee) plus captain (own team) from the roster.
    func scoreAuth(detail: TMDetail) async -> TMScoreAuth {
        guard let uid = await currentUserID() else {
            return TMScoreAuth(canScore: false, isOwner: false, isCreator: false, captainTeamID: nil)
        }
        let isAdmin = await TournamentService.shared.isCurrentUserAdmin()
        let isCreator = detail.tournament.createdBy == uid || isAdmin
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
        let hasRepechage: Bool     // rr_playoff only — nhánh Tái sinh hạng 3,4
        let requireRegistration: Bool
        let hasDreambreaker: Bool  // effective: even games && toggle
        let requireMinGames: Bool
        let hasThirdPlaceMatch: Bool
        let useDupr: Bool
        let duprMaxMale: Double
        let duprMaxFemale: Double
        let totalScoreMode: Bool
        let pointsPerGame: Int
        // Thể lệ + lệ phí + tài khoản nhận (VietQR). Rỗng/0 = miễn phí, bỏ qua.
        let rulesSummary: String
        let entryFeeVnd: Int
        let entryFeeTeamVnd: Int
        let bankCode: String
        let bankAccountNumber: String
        let bankAccountName: String
        // Ngày tổ chức (yyyy-MM-dd) + địa điểm + bậc giảm giá slot. Rỗng = bỏ qua.
        let eventDate: String?
        let location: String
        let discountTiers: [TMDiscountTier]
        let templates: [TMTemplateInput]
    }

    struct TMTemplateInput { let gameType: String; let scoringType: String; let displayName: String; let orderIndex: Int }

    enum CreateError: Error, LocalizedError {
        case limitReached, authRequired, failed(String)
        var errorDescription: String? {
            switch self {
            case .limitReached: return String(localized: "Đã đạt giới hạn: mỗi tài khoản tối đa 3 giải. Liên hệ tapickleballvn@gmail.com để mở rộng.")
            case .authRequired: return String(localized: "Bạn cần đăng nhập để tạo giải.")
            case .failed(let m): return m
            }
        }
    }

    private struct AtomicCreateConfig: Encodable {
        let name: String
        let share_id: String
        let team_roster_size: Int
        let team_count: Int
        let format: String
        let playoff_team_count: Int?
        let require_registration: Bool
        let has_dreambreaker: Bool
        let require_min_games_per_player: Bool
        let has_third_place_match: Bool
        let has_repechage: Bool
        let bracket_pairing_type: String
        let require_dupr: Bool
        let dupr_max_male: Double?
        let dupr_max_female: Double?
        let total_score_mode: Bool
        let points_per_game: Int?
        let rules_summary: String?
        let entry_fee_vnd: Int
        let entry_fee_team_vnd: Int
        let bank_code: String?
        let bank_account_number: String?
        let bank_account_name: String?
        let event_date: String?
        let location: String?
        let discount_tiers: [TMDiscountTier]
    }

    private struct AtomicCreateTemplate: Encodable {
        let order_index: Int
        let game_type: String
        let display_name: String?
        let scoring_type: String
    }

    private struct AtomicCreateParams: Encodable {
        let p_config: AtomicCreateConfig
        let p_templates: [AtomicCreateTemplate]
    }

    /// Quota, metadata and templates commit in one database transaction.
    /// Returns the new share_id (caller pushes the native detail view).
    func createTournament(_ o: CreateOptions) async throws -> String {
        let shareID = Self.randomShareID()
        struct Result: Decodable {
            let success: Bool
            let error: String?
            let tournament: Tournament?
            struct Tournament: Decodable { let shareID: String
                enum CodingKeys: String, CodingKey { case shareID = "share_id" } }
        }
        let rules = o.rulesSummary.trimmingCharacters(in: .whitespacesAndNewlines)
        let location = o.location.trimmingCharacters(in: .whitespacesAndNewlines)
        let params = AtomicCreateParams(
            p_config: AtomicCreateConfig(
                name: o.name, share_id: shareID, team_roster_size: o.rosterSize,
                team_count: o.teamCount, format: o.format,
                playoff_team_count: o.format == "rr_playoff" ? o.playoffTeamCount : nil,
                require_registration: o.requireRegistration,
                has_dreambreaker: o.hasDreambreaker,
                require_min_games_per_player: o.requireMinGames,
                has_third_place_match: o.format == "single_elimination" ? o.hasThirdPlaceMatch : false,
                has_repechage: o.format == "rr_playoff" && o.hasRepechage,
                bracket_pairing_type: "random",
                require_dupr: o.useDupr,
                dupr_max_male: o.useDupr ? o.duprMaxMale : nil,
                dupr_max_female: o.useDupr ? o.duprMaxFemale : nil,
                total_score_mode: o.totalScoreMode,
                points_per_game: o.totalScoreMode ? o.pointsPerGame : nil,
                rules_summary: rules.isEmpty ? nil : rules,
                entry_fee_vnd: o.entryFeeVnd,
                entry_fee_team_vnd: o.entryFeeTeamVnd,
                bank_code: o.bankCode.nonEmpty,
                bank_account_number: o.bankAccountNumber.nonEmpty,
                bank_account_name: o.bankAccountName.nonEmpty,
                event_date: o.eventDate,
                location: location.isEmpty ? nil : location,
                discount_tiers: o.discountTiers),
            p_templates: o.templates.map {
                AtomicCreateTemplate(order_index: $0.orderIndex, game_type: $0.gameType,
                                     display_name: $0.displayName.nonEmpty, scoring_type: $0.scoringType)
            })

        let result: Result = try await client
            .rpc("create_team_match_atomic", params: params).execute().value

        guard result.success, let t = result.tournament else {
            switch result.error {
            case "LIMIT_REACHED": throw CreateError.limitReached
            case "AUTH_REQUIRED": throw CreateError.authRequired
            default: throw CreateError.failed(result.error ?? String(localized: "Không tạo được giải"))
            }
        }

        return t.shareID
    }

    // MARK: Payment (team fee claim / confirm)

    private struct TeamIDParam: Encodable { let p_team_id: String }
    private struct ConfirmParam: Encodable { let p_team_id: String; let p_confirmed: Bool }

    /// Captain marks own team as transferred → status "claimed" (đỏ, chờ BTC).
    func claimTeamPayment(teamID: UUID) async throws {
        try await client.rpc("claim_team_payment",
                             params: TeamIDParam(p_team_id: teamID.uuidString.lowercased())).execute()
    }

    /// Organizer confirms/un-confirms receipt → "confirmed" (xanh) / back to "claimed".
    func confirmTeamPayment(teamID: UUID, confirmed: Bool = true) async throws {
        try await client.rpc("confirm_team_payment",
                             params: ConfirmParam(p_team_id: teamID.uuidString.lowercased(),
                                                  p_confirmed: confirmed)).execute()
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

    struct DetailsUpdate {
        let name: String
        let eventDate: String?
        let location: String?
        let chatGroupURL: String?
        let rulesSummary: String?
        let entryFeeVnd: Int?
        let entryFeeTeamVnd: Int?
        let bankCode: String?
        let bankAccountNumber: String?
        let bankAccountName: String?
        let requireDupr: Bool
        let duprMaxMale: Double?
        let duprMaxFemale: Double?
    }

    /// Soft metadata editable after creation. Every optional is encoded
    /// explicitly, including null, so clearing a native field also clears web.
    func updateDetails(tournamentID: UUID, details: DetailsUpdate) async throws {
        struct Patch: Encodable {
            let source: DetailsUpdate
            enum CodingKeys: String, CodingKey {
                case name
                case eventDate = "event_date"
                case location
                case chatGroupURL = "chat_group_url"
                case rulesSummary = "rules_summary"
                case entryFeeVnd = "entry_fee_vnd"
                case entryFeeTeamVnd = "entry_fee_team_vnd"
                case bankCode = "bank_code"
                case bankAccountNumber = "bank_account_number"
                case bankAccountName = "bank_account_name"
                case requireDupr = "require_dupr"
                case duprMaxMale = "dupr_max_male"
                case duprMaxFemale = "dupr_max_female"
            }
            func encode(to encoder: Encoder) throws {
                var c = encoder.container(keyedBy: CodingKeys.self)
                try c.encode(source.name, forKey: .name)
                try c.encode(source.requireDupr, forKey: .requireDupr)
                try Self.encode(source.eventDate, to: &c, key: .eventDate)
                try Self.encode(source.location, to: &c, key: .location)
                try Self.encode(source.chatGroupURL, to: &c, key: .chatGroupURL)
                try Self.encode(source.rulesSummary, to: &c, key: .rulesSummary)
                try Self.encode(source.entryFeeVnd, to: &c, key: .entryFeeVnd)
                try Self.encode(source.entryFeeTeamVnd, to: &c, key: .entryFeeTeamVnd)
                try Self.encode(source.bankCode, to: &c, key: .bankCode)
                try Self.encode(source.bankAccountNumber, to: &c, key: .bankAccountNumber)
                try Self.encode(source.bankAccountName, to: &c, key: .bankAccountName)
                try Self.encode(source.duprMaxMale, to: &c, key: .duprMaxMale)
                try Self.encode(source.duprMaxFemale, to: &c, key: .duprMaxFemale)
            }
            private static func encode<T: Encodable>(
                _ value: T?,
                to container: inout KeyedEncodingContainer<CodingKeys>,
                key: CodingKeys
            ) throws {
                if let value {
                    try container.encode(value, forKey: key)
                } else {
                    try container.encodeNil(forKey: key)
                }
            }
        }
        try await client.from("team_match_tournaments")
            .update(Patch(source: details))
            .eq("id", value: tournamentID)
            .execute()
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

    /// The captain's most recent team (any tournament) + roster, for one-tap
    /// "reuse previous team" prefill. Light stand-in for web master teams.
    func previousCaptainTeam() async -> (name: String, players: [(name: String, gender: String, isCaptain: Bool)])? {
        guard let uid = await currentUserID() else { return nil }
        struct T: Decodable {
            let id: UUID; let teamName: String
            enum CodingKeys: String, CodingKey { case id; case teamName = "team_name" }
        }
        let teams: [T]? = try? await client.from("team_match_teams")
            .select("id, team_name, created_at").eq("captain_user_id", value: uid)
            .order("created_at", ascending: false).limit(1).execute().value
        guard let t = teams?.first else { return nil }
        struct R: Decodable {
            let playerName: String; let gender: String?; let isCaptain: Bool?
            enum CodingKeys: String, CodingKey { case playerName = "player_name"; case gender; case isCaptain = "is_captain" }
        }
        let roster: [R]? = try? await client.from("team_match_roster")
            .select("player_name, gender, is_captain").eq("team_id", value: t.id).execute().value
        let players = (roster ?? []).map { (name: $0.playerName, gender: $0.gender ?? "male", isCaptain: $0.isCaptain ?? false) }
        guard !players.isEmpty else { return nil }
        return (name: t.teamName, players: players)
    }

    /// The signed-in user's own team in this tournament (captain), if any.
    func userTeam(tournamentID: UUID) async -> TMTeam? {
        guard let uid = await currentUserID() else { return nil }
        let rows: [TMTeam]? = try? await client
            .from("team_match_teams").select("id, team_name, seed, group_id, status, payment_status")
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
            if resp.success == true { return .ok(resp.message ?? String(localized: "Đã mời đội")) }
            return .failed(resp.error ?? String(localized: "Không mời được đội"))
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

    /// Roster of a single team (captain roster management).
    func teamRoster(teamID: UUID) async throws -> [TMRosterPlayer] {
        try await client.from("team_match_roster")
            .select("id, team_id, player_name, gender, is_captain, user_id, status")
            .eq("team_id", value: teamID)
            .order("is_captain", ascending: false).order("created_at", ascending: true)
            .execute().value
    }

    enum JoinError: LocalizedError {
        case notAuthed, alreadyMember
        var errorDescription: String? {
            switch self {
            case .notAuthed: return String(localized: "Cần đăng nhập để tham gia đội.")
            case .alreadyMember: return String(localized: "Bạn đã ở trong một đội của giải này.")
            }
        }
    }

    /// Player self-joins a team as a pending, non-captain member (RLS: user may
    /// insert its own pending row). One team per player per tournament.
    func joinTeam(teamID: UUID, tournamentID: UUID, playerName: String, gender: String) async throws {
        guard let uid = await currentUserID() else { throw JoinError.notAuthed }
        if await userMembership(tournamentID: tournamentID) != nil { throw JoinError.alreadyMember }
        struct JoinInsert: Encodable {
            let team_id: String; let user_id: String; let player_name: String
            let gender: String; let is_captain = false; let status = "pending"
        }
        try await client.from("team_match_roster").insert(
            JoinInsert(team_id: teamID.uuidString.lowercased(), user_id: uid.uuidString.lowercased(),
                       player_name: playerName, gender: gender)).execute()
    }

    /// Captain/creator approves or rejects a pending roster member.
    func updateRosterStatus(id: UUID, status: String) async throws {
        struct U: Encodable { let status: String }
        try await client.from("team_match_roster").update(U(status: status)).eq("id", value: id).execute()
    }

    /// My roster membership (any team) in this tournament, if any.
    func userMembership(tournamentID: UUID) async -> TMMembership? {
        guard let uid = await currentUserID() else { return nil }
        struct TeamRef: Decodable { let team_name: String }
        struct Row: Decodable {
            let id: UUID; let teamID: UUID; let status: String?; let isCaptain: Bool?; let team: TeamRef?
            enum CodingKeys: String, CodingKey {
                case id; case teamID = "team_id"; case status; case isCaptain = "is_captain"
                case team = "team_match_teams"
            }
        }
        let rows: [Row]? = try? await client.from("team_match_roster")
            .select("id, team_id, status, is_captain, team_match_teams!inner(team_name, tournament_id)")
            .eq("user_id", value: uid)
            .eq("team_match_teams.tournament_id", value: tournamentID)
            .limit(1).execute().value
        guard let r = rows?.first else { return nil }
        return TMMembership(id: r.id, teamID: r.teamID, teamName: r.team?.team_name ?? "",
                            status: r.status ?? "pending", isCaptain: r.isCaptain ?? false)
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
            case .tooFewTeams: return String(localized: "Cần ít nhất 2 đội (đã duyệt) để tạo lịch.")
            case .notPowerOfTwo: return String(localized: "Số đội phải là lũy thừa của 2 (4, 8, 16, 32…) cho loại trực tiếp.")
            case .noTemplates: return String(localized: "Giải chưa có game template.")
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

    private struct ResetLifecycleParams: Encodable {
        let p_tournament_id: String
        let p_scope: String
    }

    func deleteMatches(tournamentID: UUID) async throws {
        let result: AtomicTournamentMutationResult = try await client
            .rpc("reset_team_match_lifecycle_atomic", params: ResetLifecycleParams(
                p_tournament_id: tournamentID.uuidString.lowercased(), p_scope: "schedule"))
            .execute().value
        try result.requireSuccess()
    }

    /// rr_playoff: xóa toàn bộ vòng bảng (trận + bảng) + đưa giải về 'registration' để chia lại sạch.
    func resetGroupStage(tournamentID: UUID) async throws {
        let result: AtomicTournamentMutationResult = try await client
            .rpc("reset_team_match_lifecycle_atomic", params: ResetLifecycleParams(
                p_tournament_id: tournamentID.uuidString.lowercased(), p_scope: "group_stage"))
            .execute().value
        try result.requireSuccess()
    }

    /// Round-robin (circle method) — port of generateMatchesMutation.
    private struct RoundRobinParams: Encodable {
        let p_tournament_id: String
        let p_groups: [[String]]
        let p_randomize_game_order: Bool
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

    func generateRoundRobin(tournamentID: UUID, hasDreambreaker _: Bool) async throws {
        let result: AtomicTournamentMutationResult = try await client
            .rpc("generate_team_match_round_robin_atomic", params: RoundRobinParams(
                p_tournament_id: tournamentID.uuidString.lowercased(), p_groups: [],
                p_randomize_game_order: false))
            .execute().value
        try result.requireSuccess()
    }

    /// rr_playoff — chia bảng theo `distribution` (random/manual do UI quyết): tạo team_match_groups,
    /// gán group_id cho đội, set status 'ongoing' + group_count, sinh RR THEO TỪNG BẢNG + games.
    /// Port web useTeamMatchGroups.createGroups, hỗ trợ mọi số bảng.
    func setupGroups(tournamentID: UUID, distribution: [[UUID]], hasDreambreaker _: Bool, randomizeGameOrder: Bool = false) async throws {
        guard distribution.count >= 2, distribution.allSatisfy({ $0.count >= 2 }) else {
            throw GenerateError.tooFewTeams
        }
        let result: AtomicTournamentMutationResult = try await client
            .rpc("generate_team_match_round_robin_atomic", params: RoundRobinParams(
                p_tournament_id: tournamentID.uuidString.lowercased(),
                p_groups: distribution.map { $0.map { $0.uuidString.lowercased() } },
                p_randomize_game_order: randomizeGameOrder))
            .execute().value
        try result.requireSuccess()
    }

    struct BracketBranchPlan {
        let isRepechage: Bool
        let firstRound: [(a: String, b: String)]
    }

    private struct BracketPairInput: Encodable {
        let team_a_id: String
        let team_b_id: String
    }

    private struct BracketBranchInput: Encodable {
        let is_repechage: Bool
        let first_round: [BracketPairInput]
    }

    private struct BracketParams: Encodable {
        let p_tournament_id: String
        let p_branches: [BracketBranchInput]
    }

    func generateBrackets(tournamentID: UUID, branches: [BracketBranchPlan]) async throws {
        guard !branches.isEmpty else { throw GenerateError.tooFewTeams }
        let encoded = try branches.map { branch -> BracketBranchInput in
            let n = branch.firstRound.count * 2
            guard n >= 2, n & (n - 1) == 0 else { throw GenerateError.notPowerOfTwo }
            return BracketBranchInput(
                is_repechage: branch.isRepechage,
                first_round: branch.firstRound.map {
                    BracketPairInput(team_a_id: $0.a, team_b_id: $0.b)
                })
        }
        let result: AtomicTournamentMutationResult = try await client
            .rpc("generate_team_match_brackets_atomic", params: BracketParams(
                p_tournament_id: tournamentID.uuidString.lowercased(), p_branches: encoded))
            .execute().value
        try result.requireSuccess()
    }

    /// Single elimination keeps the native random draw; the server creates and
    /// links the full tree, third-place match and games transactionally.
    func generateSingleElimination(tournamentID: UUID, hasThirdPlace _: Bool, hasDreambreaker _: Bool) async throws {
        let teamIDs = try await approvedTeamIDs(tournamentID: tournamentID)
        let n = teamIDs.count
        guard n >= 2 else { throw GenerateError.tooFewTeams }
        guard n & (n - 1) == 0 else { throw GenerateError.notPowerOfTwo }
        let shuffled = teamIDs.shuffled()
        let firstRound = stride(from: 0, to: shuffled.count, by: 2).map {
            (a: shuffled[$0], b: shuffled[$0 + 1])
        }
        try await generateBrackets(tournamentID: tournamentID, branches: [
            BracketBranchPlan(isRepechage: false, firstRound: firstRound)
        ])
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
    func generatePlayoffFromSeeds(tournamentID: UUID, seededTeamIDs: [String], hasDreambreaker _: Bool,
                                  isRepechage: Bool = false) async throws {
        let n = seededTeamIDs.count
        guard n >= 2, n & (n - 1) == 0 else { throw GenerateError.notPowerOfTwo }
        let order = DEBracket.seedPositions(n)   // order[slot] = seedIndex (0-based); #1 & #2 hai nửa đối diện
        let firstRound = (0..<(n / 2)).map { i in (a: seededTeamIDs[order[2 * i]], b: seededTeamIDs[order[2 * i + 1]]) }
        try await generateBrackets(tournamentID: tournamentID, branches: [
            BracketBranchPlan(isRepechage: isRepechage, firstRound: firstRound)
        ])
    }

    /// Playoff seed theo BẢNG (nhất gặp nhì bảng khác, cùng bảng khác nhánh).
    /// `isRepechage` = true → cùng logic nhưng dựng nhánh Tái sinh (hạng 3,4).
    func generatePlayoffFromGroupPairs(tournamentID: UUID, firstRound: [(a: String, b: String)], hasDreambreaker _: Bool,
                                       isRepechage: Bool = false) async throws {
        try await generateBrackets(tournamentID: tournamentID, branches: [
            BracketBranchPlan(isRepechage: isRepechage, firstRound: firstRound)
        ])
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

    private struct AtomicTeamGameScore: Encodable {
        let game_id: String
        let score_a: Int
        let score_b: Int
        let expected_version: Int64
    }

    private struct AtomicTeamScoreParams: Encodable {
        let p_match_id: String
        let p_scores: [AtomicTeamGameScore]
    }

    /// The server owns the game write, match totals, optimistic version and
    /// playoff/third-place propagation as one transaction.
    func score(matchID: UUID, game: TMGame, scoreA: Int, scoreB: Int,
               expectedVersion: Int64) async throws {
        let result: AtomicTournamentMutationResult = try await client
            .rpc("score_team_match_games_atomic", params: AtomicTeamScoreParams(
                p_match_id: matchID.uuidString.lowercased(),
                p_scores: [AtomicTeamGameScore(
                    game_id: game.id.uuidString.lowercased(),
                    score_a: scoreA,
                    score_b: scoreB,
                    expected_version: expectedVersion
                )]
            ))
            .execute().value
        try result.requireSuccess()
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

    /// Pure match-result computation — QA-07 twin of web
    /// `src/lib/teamMatchResult.ts` (pinned by TeamMatchResultTests).
    ///
    /// - totalPoints = SUM of game scores (total-score mode plays each game
    ///   to points_per_game; a 4-game match is NOT a fixed 28).
    /// - Default mode: winner = games-won majority (ceil(games/2)).
    /// - Total-score mode (Cuong's rule 2026-07-16): winner = higher
    ///   cumulative total, only once every game is decided (a tied/unplayed
    ///   0-0 game keeps the match in progress, otherwise game 1 would end
    ///   the match early). Equal totals → no winner (dreambreaker/organizer).
    struct ComputedMatchResult: Equatable {
        let gamesWonA: Int
        let gamesWonB: Int
        let totalPointsA: Int
        let totalPointsB: Int
        let winnerID: UUID?
    }

    static func computeMatchResult(scores: [(a: Int, b: Int)],
                                   teamAID: UUID?, teamBID: UUID?,
                                   totalScoreMode: Bool = false) -> ComputedMatchResult {
        var gamesWonA = 0, gamesWonB = 0, totalPointsA = 0, totalPointsB = 0
        var undecidedGames = 0
        for s in scores {
            totalPointsA += s.a; totalPointsB += s.b
            if s.a > s.b { gamesWonA += 1 }
            else if s.b > s.a { gamesWonB += 1 }
            else { undecidedGames += 1 }
        }
        var winnerID: UUID? = nil
        if !scores.isEmpty {
            if totalScoreMode {
                if undecidedGames == 0 {
                    if totalPointsA > totalPointsB, let a = teamAID { winnerID = a }
                    else if totalPointsB > totalPointsA, let b = teamBID { winnerID = b }
                }
            } else {
                let requiredToWin = Int(ceil(Double(scores.count) / 2.0))
                if gamesWonA >= requiredToWin, let a = teamAID { winnerID = a }
                else if gamesWonB >= requiredToWin, let b = teamBID { winnerID = b }
            }
        }
        return ComputedMatchResult(gamesWonA: gamesWonA, gamesWonB: gamesWonB,
                                   totalPointsA: totalPointsA, totalPointsB: totalPointsB,
                                   winnerID: winnerID)
    }

    private struct DynamicKey: CodingKey {
        var stringValue: String; var intValue: Int? { nil }
        init?(stringValue: String) { self.stringValue = stringValue }
        init?(intValue: Int) { nil }
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
