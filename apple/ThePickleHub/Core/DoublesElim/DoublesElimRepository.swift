import Foundation
import Supabase

/// Loads Doubles Elimination data. Committed scoring and lifecycle advancement
/// are owned by transactional database RPCs shared with the web client.
struct DoublesElimRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    private static let matchSelect = """
    id, tournament_id, round_number, round_type, bracket_type, match_number, \
    team_a_id, team_b_id, score_a, score_b, winner_id, best_of, games, \
    games_won_a, games_won_b, source_a, source_b, is_bye, display_order, status, \
    court_number, start_time, score_version
    """
    private static let teamSelect = """
    id, team_name, player1_name, player2_name, seed, total_points_for, \
    total_points_against, point_diff, status, eliminated_at_round, \
    player1_user_id, player2_user_id, dupr_avg_rating, dupr_seed_source
    """

    func currentUserID() async -> UUID? { try? await client.auth.session.user.id }

    /// Persist an in-progress referee draft without touching committed score
    /// columns. The atomic score RPC is the only writer of score_a/score_b.
    func updateLiveScore(matchID: UUID, scoreA: Int, scoreB: Int) async throws {
        guard let uid = await currentUserID() else { return }
        struct DraftState: Encodable {
            let a: Int, b: Int
            let serving = "a"
            let serverNumber = 1
            let mode = "manual"
            let isSingles = false
            let winTarget = 11
            let winByTwo = true
            enum CodingKeys: String, CodingKey {
                case a, b, serving, serverNumber, mode, isSingles, winTarget, winByTwo, rotation
            }
            func encode(to encoder: Encoder) throws {
                var c = encoder.container(keyedBy: CodingKeys.self)
                try c.encode(a, forKey: .a); try c.encode(b, forKey: .b)
                try c.encode(serving, forKey: .serving); try c.encode(serverNumber, forKey: .serverNumber)
                try c.encode(mode, forKey: .mode); try c.encode(isSingles, forKey: .isSingles)
                try c.encode(winTarget, forKey: .winTarget); try c.encode(winByTwo, forKey: .winByTwo)
                try c.encodeNil(forKey: .rotation)
            }
        }
        struct Used: Encodable { let a = 0; let b = 0 }
        struct Notes: Encodable { let a = ""; let b = "" }
        struct Draft: Encodable {
            let v = 1
            let state: DraftState
            let history: [DraftState] = []
            let usedReg = Used()
            let usedMed = Used()
            let notes = Notes()
            let regularTO = 2
        }
        struct U: Encodable { let referee_live_state: Draft }
        try await client.from("doubles_elimination_matches")
            .update(U(referee_live_state: Draft(state: DraftState(a: scoreA, b: scoreB))))
            .eq("id", value: matchID)
            .eq("live_referee_id", value: uid)
            .execute()
    }

    /// Claim trận làm LIVE (live_referee_id = user hiện tại) → badge.
    func claimLive(matchID: UUID) async throws {
        guard let uid = await currentUserID() else { return }
        struct U: Encodable { let live_referee_id: String }
        try await client.from("doubles_elimination_matches")
            .update(U(live_referee_id: uid.uuidString.lowercased())).eq("id", value: matchID).execute()
    }

    // MARK: Load

    func load(shareID: String) async throws -> DEDetail {
        let tournament: DETournament = try await client
            .from("doubles_elimination_tournaments")
            .select("*")
            .eq("share_id", value: shareID)
            .single()
            .execute().value

        async let teams: [DETeam] = client
            .from("doubles_elimination_teams")
            .select(Self.teamSelect)
            .eq("tournament_id", value: tournament.id)
            .order("seed", ascending: true)
            .execute().value
        async let matches: [DEMatch] = client
            .from("doubles_elimination_matches")
            .select(Self.matchSelect)
            .eq("tournament_id", value: tournament.id)
            .order("display_order", ascending: true)
            .execute().value

        return DEDetail(tournament: tournament, teams: try await teams, matches: try await matches)
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
        let match: MatchRow = try await client.from("doubles_elimination_matches")
            .select("tournament_id")
            .eq("id", value: matchID)
            .single()
            .execute().value
        let tournament: TournamentRow = try await client.from("doubles_elimination_tournaments")
            .select("share_id")
            .eq("id", value: match.tournamentID)
            .single()
            .execute().value
        return tournament.shareID
    }

    // MARK: Score

    /// ARCH-04 pre-work: the doubles-elimination match-result rule, shared by
    /// score() below. Web twin: src/lib/doublesElimResult.ts
    /// (computeDoublesElimResult) — keep the rule identical; mirror tests in
    /// apple/Tests/DoublesElimResultTests.swift.
    struct DEMatchResult: Equatable {
        let gamesWonA: Int
        let gamesWonB: Int
        let complete: Bool
        let winnerID: UUID?
        let loserID: UUID?
    }

    static func computeMatchResult(games: [DEGame], bestOf: Int, teamAID: UUID?, teamBID: UUID?) -> DEMatchResult {
        let winsA = games.filter { $0.winner == "a" }.count
        let winsB = games.filter { $0.winner == "b" }.count
        let needed = (bestOf + 1) / 2   // ceil(best_of / 2)
        let complete = winsA >= needed || winsB >= needed
        return DEMatchResult(
            gamesWonA: winsA, gamesWonB: winsB, complete: complete,
            winnerID: complete ? (winsA > winsB ? teamAID : teamBID) : nil,
            loserID: complete ? (winsA > winsB ? teamBID : teamAID) : nil)
    }

    /// R4+ bracket advancement: winner of match N seats into next-round match
    /// N-1 over 2, slot A for odd N. Web twin: bracketAdvanceTarget.
    static func advanceTarget(matchNumber: Int) -> (nextMatchIndex: Int, slotA: Bool) {
        let idx = matchNumber - 1
        return (idx / 2, idx % 2 == 0)
    }

    private struct AtomicScoreParams: Encodable {
        let p_match_id: String
        let p_score_a: Int
        let p_score_b: Int
        let p_games: [DEGame]
        let p_expected_version: Int64
    }

    /// Save a match result through the transactional RPC. The server validates
    /// BO1/BO3/BO5, owns elimination and advancement, and rejects a correction
    /// when a dependent match has already started.
    func score(match: DEMatch, gameScores: [(Int, Int)]) async throws {
        let scores = gameScores.filter { $0.0 != $0.1 }
        let games = match.bestOf <= 1 ? [] : scores.enumerated().map { index, score in
            DEGame(game: index + 1, scoreA: score.0, scoreB: score.1,
                   winner: score.0 > score.1 ? "a" : "b")
        }
        let first = scores.first ?? (0, 0)
        let result: AtomicTournamentMutationResult = try await client
            .rpc("score_doubles_elimination_match_atomic", params: AtomicScoreParams(
                p_match_id: match.id.uuidString.lowercased(),
                p_score_a: match.bestOf <= 1 ? first.0 : 0,
                p_score_b: match.bestOf <= 1 ? first.1 : 0,
                p_games: games,
                p_expected_version: match.scoreVersion
            ))
            .execute().value
        try result.requireSuccess()
    }

    private struct DELifecycleParams: Encodable { let p_tournament_id: String }
    private struct DELifecycleResult: Decodable {
        let success: Bool
        let error: String?
        let action: String?
    }

    private func advanceLifecycle(tournamentID: UUID) async throws -> DELifecycleResult {
        let result: DELifecycleResult = try await client
            .rpc("advance_doubles_elimination_lifecycle", params: DELifecycleParams(
                p_tournament_id: tournamentID.uuidString.lowercased()
            ))
            .execute().value
        guard result.success else { throw TournamentMutationError(code: result.error) }
        return result
    }

    // MARK: R3 assignment

    /// Idempotent recovery wrapper. Normal scoring invokes the same lifecycle
    /// function from the database trigger before the score transaction commits.
    @discardableResult
    func checkAndAssignR3(tournamentID: UUID) async throws -> Bool {
        try await advanceLifecycle(tournamentID: tournamentID).action == "r3_assigned"
    }
    // MARK: Playoff generation

    /// Idempotent recovery wrapper for server-owned playoff generation.
    @discardableResult
    func checkAndGeneratePlayoff(tournamentID: UUID) async throws -> Bool {
        try await advanceLifecycle(tournamentID: tournamentID).action == "playoff_generated"
    }
    // MARK: Create (port of DoublesEliminationSetup + generateBracket)

    struct DECreateOptions {
        let name: String
        let teamCount: Int
        let courts: [Int]
        let startTime: String?       // "HH:mm" or nil
        let ratingSource: String     // self | either | dupr
        let minDupr: Double?
        let maxDupr: Double?
        let earlyFormat: String      // bo1 | bo3 | bo5
        let semiFormat: String
        let finalsFormat: String
        let hasThirdPlace: Bool
    }
    struct DETeamInput { let teamName: String; let p1: String; let p2: String; let seed: Int? }

    enum DECreateError: Error, LocalizedError {
        case limitReached, authRequired, invalidTeamCount(Int), teamCountMismatch(declared: Int, actual: Int), failed(String)
        var errorDescription: String? {
            switch self {
            case .limitReached: return String(localized: "Đã đạt giới hạn: mỗi tài khoản tối đa 3 giải.")
            case .authRequired: return String(localized: "Bạn cần đăng nhập để tạo giải.")
            case .invalidTeamCount(let count): return String(localized: "Số đội \(count) không hợp lệ; giải mới hỗ trợ 40–128 đội.")
            case .teamCountMismatch(let declared, let actual):
                return String(localized: "Danh sách có \(actual) đội nhưng bước thiết lập khai báo \(declared) đội.")
            case .failed(let m): return m
            }
        }
    }

    static let supportedCreationTeamCounts = 40...128

    static func validateCreationInputs(declaredTeamCount: Int, actualTeamCount: Int?) throws {
        guard supportedCreationTeamCounts.contains(declaredTeamCount) else {
            throw DECreateError.invalidTeamCount(declaredTeamCount)
        }
        if let actualTeamCount, actualTeamCount != declaredTeamCount {
            throw DECreateError.teamCountMismatch(declared: declaredTeamCount, actual: actualTeamCount)
        }
    }

    private struct DEAtomicCreateTeam: Encodable {
        let team_name: String
        let player1_name: String
        let player2_name: String?
        let seed: Int?
        let dupr_seed_source = "none"
    }

    private struct DEAtomicCreateParams: Encodable {
        let p_name: String
        let p_share_id: String
        let p_team_count: Int
        let p_has_third_place_match: Bool
        let p_early_rounds_format: String
        let p_semifinals_format: String
        let p_finals_format: String
        let p_court_count: Int
        let p_start_time: String?
        let p_rating_source: String
        let p_min_dupr_rating: Double?
        let p_max_dupr_rating: Double?
        let p_open_registration: Bool
        let p_teams: [DEAtomicCreateTeam]
        let p_seeding_strategy: String

        enum CodingKeys: String, CodingKey {
            case p_name, p_share_id, p_team_count, p_has_third_place_match
            case p_early_rounds_format, p_semifinals_format, p_finals_format
            case p_court_count, p_start_time, p_rating_source
            case p_min_dupr_rating, p_max_dupr_rating, p_open_registration
            case p_teams, p_seeding_strategy
        }

        func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            try c.encode(p_name, forKey: .p_name)
            try c.encode(p_share_id, forKey: .p_share_id)
            try c.encode(p_team_count, forKey: .p_team_count)
            try c.encode(p_has_third_place_match, forKey: .p_has_third_place_match)
            try c.encode(p_early_rounds_format, forKey: .p_early_rounds_format)
            try c.encode(p_semifinals_format, forKey: .p_semifinals_format)
            try c.encode(p_finals_format, forKey: .p_finals_format)
            try c.encode(p_court_count, forKey: .p_court_count)
            if let p_start_time { try c.encode(p_start_time, forKey: .p_start_time) }
            else { try c.encodeNil(forKey: .p_start_time) }
            try c.encode(p_rating_source, forKey: .p_rating_source)
            if let p_min_dupr_rating { try c.encode(p_min_dupr_rating, forKey: .p_min_dupr_rating) }
            else { try c.encodeNil(forKey: .p_min_dupr_rating) }
            if let p_max_dupr_rating { try c.encode(p_max_dupr_rating, forKey: .p_max_dupr_rating) }
            else { try c.encodeNil(forKey: .p_max_dupr_rating) }
            try c.encode(p_open_registration, forKey: .p_open_registration)
            try c.encode(p_teams, forKey: .p_teams)
            try c.encode(p_seeding_strategy, forKey: .p_seeding_strategy)
        }
    }

    /// One RPC owns quota enforcement, tournament configuration, manual roster
    /// insertion, bracket generation, and the final status transition.
    func createDoublesElim(_ o: DECreateOptions, teams: [DETeamInput]) async throws -> String {
        let shareID = Self.randomShareID()
        let isDupr = o.ratingSource == "dupr"
        try Self.validateCreationInputs(
            declaredTeamCount: o.teamCount,
            actualTeamCount: isDupr ? nil : teams.count
        )
        struct Result: Decodable {
            let success: Bool
            let error: String?
            let detail: String?
        }

        let roster: [DEAtomicCreateTeam] = isDupr ? [] : teams.map { team in
            let p1 = team.p1.trimmingCharacters(in: .whitespaces)
            let p2 = team.p2.trimmingCharacters(in: .whitespaces)
            let derived = team.teamName.trimmingCharacters(in: .whitespaces).nonEmpty
                // canonical — ghi xuống DB, KHÔNG localize (proposal native-bilingual inc.2)
                ?? (!p1.isEmpty && !p2.isEmpty ? "\(p1) / \(p2)" : (p1.nonEmpty ?? p2.nonEmpty ?? "Đội"))
            return DEAtomicCreateTeam(
                team_name: derived,
                player1_name: p1.nonEmpty ?? derived,
                player2_name: p2.nonEmpty,
                seed: team.seed
            )
        }

        let result: Result = try await client.rpc(
            "create_doubles_elimination_atomic",
            params: DEAtomicCreateParams(
                p_name: o.name,
                p_share_id: shareID,
                p_team_count: o.teamCount,
                p_has_third_place_match: o.hasThirdPlace,
                p_early_rounds_format: o.earlyFormat,
                p_semifinals_format: o.semiFormat,
                p_finals_format: o.finalsFormat,
                p_court_count: max(1, o.courts.count),
                p_start_time: o.startTime,
                p_rating_source: o.ratingSource,
                p_min_dupr_rating: o.minDupr,
                p_max_dupr_rating: o.maxDupr,
                p_open_registration: isDupr,
                p_teams: roster,
                p_seeding_strategy: isDupr ? "dupr" : "manual"
            )
        ).execute().value

        guard result.success else {
            switch result.error {
            case "LIMIT_REACHED": throw DECreateError.limitReached
            case "AUTH_REQUIRED": throw DECreateError.authRequired
            default: throw DECreateError.failed(result.detail ?? result.error ?? String(localized: "Không tạo được giải"))
            }
        }
        return shareID
    }

    private static func randomShareID() -> String {
        let chars = Array("abcdefghijklmnopqrstuvwxyz0123456789")
        return String((0..<8).map { _ in chars.randomElement()! })
    }

    // MARK: Open registration (Sprint E.3 — port of useDoublesElimination RPCs)

    /// Decoded shape shared by the register/add-team RPCs.
    private struct RegRPCResult: Decodable {
        let success: Bool
        let error: String?
        let teamID: String?
        let duprAvg: Double?
        let count: Int?
        let capacity: Int?
        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: K.self)
            success = (try? c.decode(Bool.self, forKey: .success)) ?? false
            error = try? c.decodeIfPresent(String.self, forKey: .error)
            teamID = try? c.decodeIfPresent(String.self, forKey: .teamID)
            if let d = try? c.decodeIfPresent(Double.self, forKey: .duprAvg) { duprAvg = d }
            else if let s = try? c.decodeIfPresent(String.self, forKey: .duprAvg) { duprAvg = Double(s) }
            else { duprAvg = nil }
            count = try? c.decodeIfPresent(Int.self, forKey: .count)
            capacity = try? c.decodeIfPresent(Int.self, forKey: .capacity)
        }
        enum K: String, CodingKey {
            case success, error, count, capacity
            case teamID = "team_id"
            case duprAvg = "dupr_avg"
        }
    }

    /// Outcome surfaced to the UI — on failure carries a localized message.
    enum DERegisterOutcome: Equatable {
        case ok(duprAvg: Double?)
        case failed(String)
    }

    private struct RegisterParams: Encodable {
        let p_tournament_id: String
        let p_partner_user_id: String
        let p_team_name: String?
        func encode(to e: Encoder) throws {
            var c = e.container(keyedBy: K.self)
            try c.encode(p_tournament_id, forKey: .p_tournament_id)
            try c.encode(p_partner_user_id, forKey: .p_partner_user_id)
            if let p_team_name { try c.encode(p_team_name, forKey: .p_team_name) }
        }
        enum K: String, CodingKey { case p_tournament_id, p_partner_user_id, p_team_name }
    }

    /// Viewer self-registers with a partner (both must be app users with DUPR).
    func registerTeam(tournamentID: UUID, partnerUserID: UUID, teamName: String?) async -> DERegisterOutcome {
        do {
            let r: RegRPCResult = try await client.rpc("register_team_for_doubles_elimination", params: RegisterParams(
                p_tournament_id: tournamentID.uuidString.lowercased(),
                p_partner_user_id: partnerUserID.uuidString.lowercased(),
                p_team_name: teamName?.nonEmpty)).execute().value
            return r.success ? .ok(duprAvg: r.duprAvg) : .failed(Self.localizeRegError(r.error))
        } catch { return .failed(error.localizedDescription) }
    }

    func cancelTeamRegistration(tournamentID: UUID) async -> DERegisterOutcome {
        do {
            let r: RegRPCResult = try await client.rpc("cancel_doubles_elimination_team_registration",
                params: ["p_tournament_id": tournamentID.uuidString.lowercased()]).execute().value
            return r.success ? .ok(duprAvg: nil) : .failed(Self.localizeRegError(r.error))
        } catch { return .failed(error.localizedDescription) }
    }

    private struct OrganizerAddParams: Encodable {
        let p_tournament_id: String
        let p_player1_user_id: String
        let p_player2_user_id: String
        let p_team_name: String?
        func encode(to e: Encoder) throws {
            var c = e.container(keyedBy: K.self)
            try c.encode(p_tournament_id, forKey: .p_tournament_id)
            try c.encode(p_player1_user_id, forKey: .p_player1_user_id)
            try c.encode(p_player2_user_id, forKey: .p_player2_user_id)
            if let p_team_name { try c.encode(p_team_name, forKey: .p_team_name) }
        }
        enum K: String, CodingKey { case p_tournament_id, p_player1_user_id, p_player2_user_id, p_team_name }
    }

    /// Organizer manually adds a team (two app users with DUPR).
    func organizerAddTeam(tournamentID: UUID, player1: UUID, player2: UUID, teamName: String?) async -> DERegisterOutcome {
        do {
            let r: RegRPCResult = try await client.rpc("organizer_add_team_to_doubles_elimination", params: OrganizerAddParams(
                p_tournament_id: tournamentID.uuidString.lowercased(),
                p_player1_user_id: player1.uuidString.lowercased(),
                p_player2_user_id: player2.uuidString.lowercased(),
                p_team_name: teamName?.nonEmpty)).execute().value
            return r.success ? .ok(duprAvg: r.duprAvg) : .failed(Self.localizeRegError(r.error))
        } catch { return .failed(error.localizedDescription) }
    }

    private struct OrganizerRemoveParams: Encodable { let p_tournament_id: String; let p_team_id: String }
    func organizerRemoveTeam(tournamentID: UUID, teamID: UUID) async -> DERegisterOutcome {
        do {
            let r: RegRPCResult = try await client.rpc("organizer_remove_team_from_doubles_elimination", params: OrganizerRemoveParams(
                p_tournament_id: tournamentID.uuidString.lowercased(),
                p_team_id: teamID.uuidString.lowercased())).execute().value
            return r.success ? .ok(duprAvg: nil) : .failed(Self.localizeRegError(r.error))
        } catch { return .failed(error.localizedDescription) }
    }

    /// The server seeds teams, writes the entire R1/R2/R3 graph, and flips the
    /// status in one transaction. Retrying after a network timeout is safe.
    @discardableResult
    func closeRegistrationAndGenerate(tournamentID: UUID) async throws -> Int {
        let r: RegRPCResult = try await client.rpc("close_doubles_elimination_registration",
            params: ["p_tournament_id": tournamentID.uuidString.lowercased()]).execute().value
        guard r.success else { throw DECreateError.failed(Self.localizeRegError(r.error)) }
        return r.count ?? 0
    }

    /// Localized copy of the RPC error codes (port of localizeError, VN only).
    static func localizeRegError(_ code: String?) -> String {
        switch code {
        case "AUTH_REQUIRED": return String(localized: "Cần đăng nhập")
        case "INVALID_PARTNER": return String(localized: "Đồng đội không hợp lệ")
        case "TOURNAMENT_NOT_FOUND": return String(localized: "Không tìm thấy giải")
        case "REGISTRATION_CLOSED": return String(localized: "Đăng ký đã đóng")
        case "NOT_DUPR_TOURNAMENT": return String(localized: "Giải này không dùng DUPR")
        case "TOURNAMENT_FULL": return String(localized: "Giải đã đủ đội")
        case "ALREADY_REGISTERED": return String(localized: "Bạn hoặc đồng đội đã đăng ký rồi")
        case "MISSING_DUPR": return String(localized: "Thiếu DUPR ở ít nhất 1 VĐV")
        case "OUT_OF_RANGE": return String(localized: "DUPR trung bình ngoài khoảng cho phép")
        case "NOT_OWNER": return String(localized: "Không có quyền")
        case "NOT_REGISTRATION_OPEN": return String(localized: "Giải không ở trạng thái mở đăng ký")
        case "NOT_FULL": return String(localized: "Chưa đủ đội")
        case "TEAM_COUNT_MISMATCH": return String(localized: "Số đội hiện tại không khớp sức chứa của giải")
        case "BRACKET_ALREADY_EXISTS": return String(localized: "Giải đã có nhánh đấu; hãy tải lại")
        case "INVALID_PLAYERS": return String(localized: "Thiếu VĐV")
        case "SAME_PLAYER": return String(localized: "Hai VĐV trùng nhau")
        case "TEAM_NOT_FOUND": return String(localized: "Không tìm thấy đội")
        case .some(let c): return c
        case .none: return String(localized: "Lỗi không xác định")
        }
    }

    // MARK: Referees (port of referee-helpers — table doubles_elimination_referees)

    func fetchReferees(tournamentID: UUID) async -> [DEReferee] {
        struct Row: Decodable { let id: UUID; let userID: UUID
            enum CodingKeys: String, CodingKey { case id; case userID = "user_id" } }
        guard let rows: [Row] = try? await client
            .from("doubles_elimination_referees").select("id, user_id")
            .eq("tournament_id", value: tournamentID).execute().value, !rows.isEmpty else { return [] }
        let names = await displayNames(ids: Set(rows.map { $0.userID.uuidString.lowercased() }))
        return rows.map { DEReferee(id: $0.id, userID: $0.userID,
                                    displayName: names[$0.userID.uuidString.lowercased()]) }
    }

    /// True if the user is a referee of this tournament (scoring auth).
    func isReferee(tournamentID: UUID, userID: UUID) async -> Bool {
        struct R: Decodable { let id: UUID }
        let rows: [R]? = try? await client
            .from("doubles_elimination_referees").select("id")
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
                .from("doubles_elimination_referees").select("id")
                .eq("tournament_id", value: tournamentID).eq("user_id", value: profile.id)
                .limit(1).execute().value
            if !existing.isEmpty { return .alreadyExists }
            struct Ins: Encodable { let tournament_id: String; let user_id: String }
            try await client.from("doubles_elimination_referees")
                .insert(Ins(tournament_id: tournamentID.uuidString.lowercased(),
                            user_id: profile.id.uuidString.lowercased())).execute()
            return .ok(profile.displayName)
        } catch { return .error }
    }

    func removeReferee(refereeID: UUID) async throws {
        try await client.from("doubles_elimination_referees").delete().eq("id", value: refereeID).execute()
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

    // MARK: Lifecycle (creator only — RLS enforces)

    private struct DENameUpdate: Encodable { let name: String }
    func rename(tournamentID: UUID, name: String) async throws {
        try await client.from("doubles_elimination_tournaments")
            .update(DENameUpdate(name: name)).eq("id", value: tournamentID).execute()
    }

    // MARK: Delete

    func delete(tournamentID: UUID) async throws {
        try await client.from("doubles_elimination_tournaments").delete().eq("id", value: tournamentID).execute()
    }

}

private extension DEJSON {
    init(type: String, position: Int? = nil, round: Int? = nil, matchIndex: Int? = nil, roundType: String? = nil) {
        self.init(type: type, position: position, round: round, matchIndex: matchIndex, roundType: roundType, teamID: nil)
    }
}
