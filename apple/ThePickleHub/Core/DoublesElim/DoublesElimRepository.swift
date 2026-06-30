import Foundation
import Supabase

/// Loads a Doubles Elimination tournament and writes match scores with full
/// winner/loser advancement. Scoring, R3 assignment, and playoff generation are
/// faithful ports of web `DoublesEliminationBracket.tsx` + `useDoublesElimination.ts`
/// so native and web stay consistent.
struct DoublesElimRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    private static let matchSelect = """
    id, tournament_id, round_number, round_type, bracket_type, match_number, \
    team_a_id, team_b_id, score_a, score_b, winner_id, best_of, games, \
    games_won_a, games_won_b, source_a, source_b, is_bye, display_order, status, \
    court_number, start_time
    """
    private static let teamSelect = """
    id, team_name, player1_name, player2_name, seed, total_points_for, \
    total_points_against, point_diff, status, eliminated_at_round, \
    player1_user_id, player2_user_id, dupr_avg_rating, dupr_seed_source
    """

    func currentUserID() async -> UUID? { try? await client.auth.session.user.id }

    /// Đẩy điểm ván hiện tại (chưa completed) cho người xem — mirror
    /// QuickTableRepository.updateLiveScore. Best-effort.
    func updateLiveScore(matchID: UUID, scoreA: Int, scoreB: Int) async throws {
        struct U: Encodable { let score_a: Int; let score_b: Int }
        try await client.from("doubles_elimination_matches")
            .update(U(score_a: scoreA, score_b: scoreB)).eq("id", value: matchID).execute()
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

    // MARK: Score

    private struct ScoreBO1Update: Encodable { let score_a: Int; let score_b: Int; let winner_id: String?; let status: String }
    private struct GamesUpdate: Encodable { let games: [DEGame]; let games_won_a: Int; let games_won_b: Int; let winner_id: String?; let status: String }
    private struct TeamAUpdate: Encodable { let team_a_id: String }
    private struct TeamBUpdate: Encodable { let team_b_id: String }
    private struct EliminateUpdate: Encodable { let status: String; let eliminated_at_round: Int }
    private struct TournamentStatusUpdate: Encodable { let status: String }

    /// Save a match result. `gameScores` is one (a,b) pair for BO1, or up to
    /// best_of pairs for BO3/BO5 (only games with a winner are kept). Mirrors
    /// web handleSaveScore / handleSaveGameScore + propagation.
    func score(match: DEMatch, gameScores: [(Int, Int)]) async throws {
        let winnerID: UUID?
        let loserID: UUID?
        let complete: Bool

        if match.bestOf <= 1 {
            guard let (a, b) = gameScores.first, a != b else { return }
            complete = true
            winnerID = a > b ? match.teamAID : match.teamBID
            loserID = a > b ? match.teamBID : match.teamAID
            try await client.from("doubles_elimination_matches")
                .update(ScoreBO1Update(score_a: a, score_b: b,
                                       winner_id: winnerID?.uuidString, status: "completed"))
                .eq("id", value: match.id).execute()
        } else {
            // Build games from entered pairs (each must have a winner).
            let valid = gameScores.filter { $0.0 != $0.1 }
            let games = valid.enumerated().map { i, s in
                DEGame(game: i + 1, scoreA: s.0, scoreB: s.1, winner: s.0 > s.1 ? "a" : "b")
            }
            let winsA = games.filter { $0.winner == "a" }.count
            let winsB = games.filter { $0.winner == "b" }.count
            let needed = (match.bestOf + 1) / 2   // ceil(best_of / 2)
            complete = winsA >= needed || winsB >= needed
            winnerID = complete ? (winsA > winsB ? match.teamAID : match.teamBID) : nil
            loserID = complete ? (winsA > winsB ? match.teamBID : match.teamAID) : nil
            try await client.from("doubles_elimination_matches")
                .update(GamesUpdate(games: games, games_won_a: winsA, games_won_b: winsB,
                                    winner_id: winnerID?.uuidString,
                                    status: complete ? "completed" : "live"))
                .eq("id", value: match.id).execute()
        }

        guard complete else { return }

        // ── Advancement (port of BracketMatchCard handleSaveScore) ──
        if let loserID, match.roundType == "winner_r1" {
            try await propagateLoserToR2(matchIndex: match.matchNumber - 1, loserID: loserID, tournamentID: match.tournamentID)
        }
        if let winnerID, match.roundNumber >= 3 {
            try await propagateWinnerToNextRound(match: match, winnerID: winnerID)
        }
        if let loserID, match.roundType == "semifinal" {
            try await propagateLoserToThirdPlace(match: match, loserID: loserID)
        }
        if let loserID, match.roundType != "winner_r1" {
            try await client.from("doubles_elimination_teams")
                .update(EliminateUpdate(status: "eliminated", eliminated_at_round: match.roundNumber))
                .eq("id", value: loserID).execute()
        }
        if match.roundType == "final" {
            try await client.from("doubles_elimination_tournaments")
                .update(TournamentStatusUpdate(status: "completed"))
                .eq("id", value: match.tournamentID).execute()
        }
    }

    private func propagateLoserToR2(matchIndex: Int, loserID: UUID, tournamentID: UUID) async throws {
        let r2: [DEMatch] = try await client.from("doubles_elimination_matches")
            .select(Self.matchSelect)
            .eq("tournament_id", value: tournamentID).eq("round_number", value: 2)
            .execute().value
        guard let target = r2.first(where: {
            $0.bracketType == "loser" && ($0.sourceA?.matchIndex == matchIndex || $0.sourceB?.matchIndex == matchIndex)
        }) else { return }
        if target.sourceA?.matchIndex == matchIndex {
            try await client.from("doubles_elimination_matches").update(TeamAUpdate(team_a_id: loserID.uuidString)).eq("id", value: target.id).execute()
        } else {
            try await client.from("doubles_elimination_matches").update(TeamBUpdate(team_b_id: loserID.uuidString)).eq("id", value: target.id).execute()
        }
    }

    private func propagateWinnerToNextRound(match: DEMatch, winnerID: UUID) async throws {
        if match.roundNumber == 3 {
            // R3 winners fill the empty slots in R4 (high-diff teams already seeded there).
            let r4: [DEMatch] = try await client.from("doubles_elimination_matches")
                .select(Self.matchSelect)
                .eq("tournament_id", value: match.tournamentID).eq("round_number", value: 4)
                .order("match_number", ascending: true).execute().value
            for m in r4 {
                if m.teamAID == nil {
                    try await client.from("doubles_elimination_matches").update(TeamAUpdate(team_a_id: winnerID.uuidString)).eq("id", value: m.id).execute()
                    return
                }
                if m.teamBID == nil {
                    try await client.from("doubles_elimination_matches").update(TeamBUpdate(team_b_id: winnerID.uuidString)).eq("id", value: m.id).execute()
                    return
                }
            }
        } else if match.roundNumber >= 4 {
            let next: [DEMatch] = try await client.from("doubles_elimination_matches")
                .select(Self.matchSelect)
                .eq("tournament_id", value: match.tournamentID).eq("round_number", value: match.roundNumber + 1)
                .neq("round_type", value: "third_place")
                .order("match_number", ascending: true).execute().value
            let idx = match.matchNumber - 1
            let nextIdx = idx / 2
            guard next.count > nextIdx else { return }
            let target = next[nextIdx]
            if idx % 2 == 0 {
                try await client.from("doubles_elimination_matches").update(TeamAUpdate(team_a_id: winnerID.uuidString)).eq("id", value: target.id).execute()
            } else {
                try await client.from("doubles_elimination_matches").update(TeamBUpdate(team_b_id: winnerID.uuidString)).eq("id", value: target.id).execute()
            }
        }
    }

    private func propagateLoserToThirdPlace(match: DEMatch, loserID: UUID) async throws {
        let third: [DEMatch] = try await client.from("doubles_elimination_matches")
            .select(Self.matchSelect)
            .eq("tournament_id", value: match.tournamentID).eq("round_type", value: "third_place")
            .execute().value
        guard let tp = third.first else { return }
        if match.matchNumber == 1 {
            if tp.teamAID == nil { try await client.from("doubles_elimination_matches").update(TeamAUpdate(team_a_id: loserID.uuidString)).eq("id", value: tp.id).execute() }
        } else {
            if tp.teamBID == nil { try await client.from("doubles_elimination_matches").update(TeamBUpdate(team_b_id: loserID.uuidString)).eq("id", value: tp.id).execute() }
        }
    }

    // MARK: R3 assignment (port of calculateR3Assignments)

    private struct DESettings: Decodable {
        let courtCount: Int
        let early: String
        let semi: String?
        let finals: String
        let thirdPlace: Bool
        enum CodingKeys: String, CodingKey {
            case courtCount = "court_count"
            case early = "early_rounds_format"
            case semi = "semifinals_format"
            case finals = "finals_format"
            case thirdPlace = "has_third_place_match"
        }
    }
    private struct R3AssignUpdate: Encodable { let team_a_id: String; let team_b_id: String; let court_number: Int; let start_time: String }

    /// If R1+R2 are complete and R3 has no teams, assign R3 teams by point diff
    /// (ties shuffled). Returns true if assignment ran. Mirrors checkAndAssignR3.
    @discardableResult
    func checkAndAssignR3(tournamentID: UUID) async throws -> Bool {
        let matches: [DEMatch] = try await client.from("doubles_elimination_matches")
            .select(Self.matchSelect).eq("tournament_id", value: tournamentID).execute().value
        let teams: [DETeam] = try await client.from("doubles_elimination_teams")
            .select(Self.teamSelect).eq("tournament_id", value: tournamentID).execute().value

        let r3 = matches.filter { $0.roundNumber == 3 }
        if r3.contains(where: { $0.teamAID != nil || $0.teamBID != nil }) { return false }
        let r1 = matches.filter { $0.roundNumber == 1 }
        let r2 = matches.filter { $0.roundNumber == 2 }
        guard !r1.isEmpty, !r2.isEmpty,
              r1.allSatisfy({ $0.isCompleted }), r2.allSatisfy({ $0.isCompleted }) else { return false }

        struct Diff { let teamID: UUID; var pointDiff: Int }
        var diffs: [Diff] = []
        func record(_ m: DEMatch) {
            guard let w = m.winnerID, teams.contains(where: { $0.id == w }) else { return }
            let isA = m.teamAID == w
            let pf = isA ? m.scoreA : m.scoreB
            let pa = isA ? m.scoreB : m.scoreA
            diffs.append(Diff(teamID: w, pointDiff: pf - pa))
        }
        r1.forEach(record)
        r2.forEach(record)

        // BYE teams that never played R1 (and aren't eliminated) join at diff 0.
        var r1Teams = Set<UUID>()
        for m in r1 { if let a = m.teamAID { r1Teams.insert(a) }; if let b = m.teamBID { r1Teams.insert(b) } }
        for t in teams where !r1Teams.contains(t.id) && t.status != "eliminated" {
            diffs.append(Diff(teamID: t.id, pointDiff: 0))
        }

        diffs.sort { $0.pointDiff > $1.pointDiff }

        let teamsForR3 = r3.count * 2
        let teamsForR4 = diffs.count - teamsForR3
        if teamsForR3 > 0 && diffs.count >= teamsForR3, teamsForR4 - 1 >= 0, teamsForR4 - 1 < diffs.count {
            let cutoff = diffs[teamsForR4 - 1].pointDiff
            let atCutoff = diffs.filter { $0.pointDiff == cutoff }
            if atCutoff.count > 1 {
                let above = diffs.filter { $0.pointDiff > cutoff }
                let below = diffs.filter { $0.pointDiff < cutoff }
                let shuffled = atCutoff.shuffled()
                let r4SlotsLeft = max(0, teamsForR4 - above.count)
                let r4FromTied = Array(shuffled.prefix(r4SlotsLeft))
                let r3FromTied = Array(shuffled.dropFirst(r4SlotsLeft))
                diffs = above + r4FromTied + r3FromTied + below
            }
        }

        let r3TeamIDs = Array(diffs.dropFirst(max(0, teamsForR4)).map { $0.teamID }).shuffled()

        // Court/time: now + 15 min, 20-min slots.
        let settings: DESettings = try await client.from("doubles_elimination_tournaments")
            .select("court_count, early_rounds_format, semifinals_format, finals_format, has_third_place_match")
            .eq("id", value: tournamentID).single().execute().value
        let (startHour, startMinute) = Self.nowPlus(minutes: 15)
        let courtCount = max(1, settings.courtCount)
        let courts = Array(1...courtCount)
        var slots: [Int: Int] = [:]; courts.forEach { slots[$0] = 0 }

        let r3Ordered = r3.sorted { $0.matchNumber < $1.matchNumber }
        for (i, m) in r3Ordered.enumerated() {
            let aIdx = i * 2, bIdx = i * 2 + 1
            guard aIdx < r3TeamIDs.count, bIdx < r3TeamIDs.count else { continue }
            let (court, time) = DEBracket.assignCourtAndTime(&slots, courts: courts, startHour: startHour, startMinute: startMinute, duration: 20)
            try await client.from("doubles_elimination_matches")
                .update(R3AssignUpdate(team_a_id: r3TeamIDs[aIdx].uuidString, team_b_id: r3TeamIDs[bIdx].uuidString, court_number: court, start_time: time))
                .eq("id", value: m.id).execute()
        }
        return true
    }

    // MARK: Playoff generation (port of generatePlayoffBracket)

    private struct DEMatchInsert: Encodable {
        let tournament_id: String
        let round_number: Int
        let round_type: String
        let bracket_type: String
        let match_number: Int
        let team_a_id: String?
        let team_b_id: String?
        let score_a = 0
        let score_b = 0
        let winner_id: String? = nil
        let best_of: Int
        let games: [DEGame] = []
        let games_won_a = 0
        let games_won_b = 0
        let source_a: DEJSON?
        let source_b: DEJSON?
        let dest_winner: DEJSON?
        let dest_loser: DEJSON?
        let is_bye = false
        let display_order: Int
        let status = "pending"
        var court_number: Int?
        var start_time: String?
    }

    /// If R3 is complete and no playoff exists, generate the single-elimination
    /// playoff bracket with proper seeding. Returns true if generated.
    @discardableResult
    func checkAndGeneratePlayoff(tournamentID: UUID) async throws -> Bool {
        let matches: [DEMatch] = try await client.from("doubles_elimination_matches")
            .select(Self.matchSelect).eq("tournament_id", value: tournamentID).execute().value
        if matches.contains(where: { $0.roundNumber >= 4 }) { return false }
        let r3 = matches.filter { $0.roundNumber == 3 }
        guard !r3.isEmpty, r3.allSatisfy({ $0.isCompleted }) else { return false }

        let teams: [DETeam] = try await client.from("doubles_elimination_teams")
            .select(Self.teamSelect).eq("tournament_id", value: tournamentID).execute().value
        let settings: DESettings = try await client.from("doubles_elimination_tournaments")
            .select("court_count, early_rounds_format, semifinals_format, finals_format, has_third_place_match")
            .eq("id", value: tournamentID).single().execute().value

        // Collect playoff teams: R3 winners + R1/R2 winners not in R3 + BYE teams.
        var playoffIDs: [UUID] = []
        for m in r3 { if let w = m.winnerID { playoffIDs.append(w) } }
        var r3TeamIDs = Set<UUID>()
        for m in r3 { if let a = m.teamAID { r3TeamIDs.insert(a) }; if let b = m.teamBID { r3TeamIDs.insert(b) } }
        let r1 = matches.filter { $0.roundNumber == 1 }
        let r2 = matches.filter { $0.roundNumber == 2 }
        for m in r1 { if let w = m.winnerID, !r3TeamIDs.contains(w) { playoffIDs.append(w) } }
        for m in r2 { if let w = m.winnerID, !r3TeamIDs.contains(w) { playoffIDs.append(w) } }
        var r1Teams = Set<UUID>()
        for m in r1 { if let a = m.teamAID { r1Teams.insert(a) }; if let b = m.teamBID { r1Teams.insert(b) } }
        for t in teams where !r1Teams.contains(t.id) && t.status != "eliminated" && !playoffIDs.contains(t.id) {
            playoffIDs.append(t.id)
        }

        var seen = Set<UUID>()
        let unique = playoffIDs.filter { seen.insert($0).inserted }
        guard unique.count >= 2 else { return false }

        let r4Size = Int(pow(2.0, floor(log2(Double(unique.count)))))
        let playoffTeams = unique.compactMap { id in teams.first { $0.id == id } }
        let seeded = playoffTeams.filter { $0.seed != nil }.sorted { ($0.seed ?? 0) < ($1.seed ?? 0) }
        let unseeded = playoffTeams.filter { $0.seed == nil }.shuffled()

        var positions: [DETeam?] = Array(repeating: nil, count: r4Size)
        let seedPos = DEBracket.seedPositions(r4Size)
        for i in 0..<min(seeded.count, seedPos.count) {
            let p = seedPos[i]
            if p < r4Size { positions[p] = seeded[i] }
        }
        var u = 0
        for i in 0..<positions.count where positions[i] == nil && u < unseeded.count {
            positions[i] = unseeded[u]; u += 1
        }

        let early = settings.early
        let semi = settings.semi ?? "bo3"
        let finals = settings.finals
        var inserts: [DEMatchInsert] = []
        var displayOrder = matches.count
        let (startHour, startMinute) = Self.nowPlus(minutes: 15)
        let courtCount = max(1, settings.courtCount)
        let courts = Array(1...courtCount)
        var slots: [Int: Int] = [:]; courts.forEach { slots[$0] = 0 }

        var round = 4
        var teamsInRound = r4Size
        while teamsInRound > 1 {
            let matchesInRound = teamsInRound / 2
            let roundType: String = teamsInRound == 8 ? "quarterfinal" : teamsInRound == 4 ? "semifinal" : teamsInRound == 2 ? "final" : "elimination"
            for i in 0..<matchesInRound {
                let (court, time) = DEBracket.assignCourtAndTime(&slots, courts: courts, startHour: startHour, startMinute: startMinute, duration: 20)
                let teamA = round == 4 ? positions[i * 2] : nil
                let teamB = round == 4 ? positions[i * 2 + 1] : nil
                inserts.append(DEMatchInsert(
                    tournament_id: tournamentID.uuidString, round_number: round, round_type: roundType,
                    bracket_type: "single", match_number: i + 1,
                    team_a_id: teamA?.id.uuidString, team_b_id: teamB?.id.uuidString,
                    best_of: DEBracket.getBestOf(roundType: roundType, early: early, semifinals: semi, finals: finals),
                    source_a: round == 4 ? DEJSON(type: "bracket_position", position: i * 2) : DEJSON(type: "winner_of", round: round - 1, matchIndex: i * 2),
                    source_b: round == 4 ? DEJSON(type: "bracket_position", position: i * 2 + 1) : DEJSON(type: "winner_of", round: round - 1, matchIndex: i * 2 + 1),
                    dest_winner: teamsInRound == 2 ? DEJSON(type: "CHAMPION") : nil,
                    dest_loser: DEJSON(type: "ELIMINATED"),
                    display_order: displayOrder,
                    court_number: round == 4 ? court : nil, start_time: round == 4 ? time : nil))
                displayOrder += 1
            }
            teamsInRound = matchesInRound
            round += 1
            courts.forEach { slots[$0] = 0 }
        }

        if settings.thirdPlace {
            let finalRound = round - 1
            inserts.append(DEMatchInsert(
                tournament_id: tournamentID.uuidString, round_number: finalRound, round_type: "third_place",
                bracket_type: "single", match_number: 1, team_a_id: nil, team_b_id: nil,
                best_of: DEBracket.getBestOf(roundType: "third_place", early: early, semifinals: semi, finals: finals),
                source_a: DEJSON(type: "loser_of", matchIndex: 0, roundType: "semifinal"),
                source_b: DEJSON(type: "loser_of", matchIndex: 1, roundType: "semifinal"),
                dest_winner: nil, dest_loser: nil, display_order: displayOrder, court_number: nil, start_time: nil))
            displayOrder += 1
        }

        try await client.from("doubles_elimination_matches").insert(inserts).execute()
        return true
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
        case limitReached, authRequired, failed(String)
        var errorDescription: String? {
            switch self {
            case .limitReached: return "Đã đạt giới hạn: mỗi tài khoản tối đa 3 giải."
            case .authRequired: return "Bạn cần đăng nhập để tạo giải."
            case .failed(let m): return m
            }
        }
    }

    private struct DECreateParams: Encodable {
        let _name: String, _share_id: String, _team_count: Int, _has_third_place_match: Bool
        let _early_rounds_format: String, _semifinals_format: String, _finals_format: String
        let _court_count: Int
        let _start_time: String?
        func encode(to e: Encoder) throws {
            var c = e.container(keyedBy: K.self)
            try c.encode(_name, forKey: ._name); try c.encode(_share_id, forKey: ._share_id)
            try c.encode(_team_count, forKey: ._team_count)
            try c.encode(_has_third_place_match, forKey: ._has_third_place_match)
            try c.encode(_early_rounds_format, forKey: ._early_rounds_format)
            try c.encode(_semifinals_format, forKey: ._semifinals_format)
            try c.encode(_finals_format, forKey: ._finals_format)
            try c.encode(_court_count, forKey: ._court_count)
            try c.encode(_start_time, forKey: ._start_time)   // null ok
        }
        enum K: String, CodingKey {
            case _name, _share_id, _team_count, _has_third_place_match
            case _early_rounds_format, _semifinals_format, _finals_format, _court_count, _start_time
        }
    }
    private struct DERatingPatch: Encodable {
        let rating_source: String; let min_dupr_rating: Double?; let max_dupr_rating: Double?; let status: String
    }
    private struct DETeamInsertRow: Encodable {
        let tournament_id: String; let team_name: String; let player1_name: String
        let player2_name: String?; let seed: Int?; let status: String
    }

    /// Manual flow → create + insert teams + generate R1/R2/R3 bracket + status
    /// 'ongoing'. DUPR flow → create + patch registration_open (teams register).
    func createDoublesElim(_ o: DECreateOptions, teams: [DETeamInput]) async throws -> String {
        let shareID = Self.randomShareID()
        let isDupr = o.ratingSource == "dupr"
        let teamCount = isDupr ? o.teamCount : max(teams.count, 2)

        struct Result: Decodable {
            let success: Bool; let error: String?
            let tournament: T?
            struct T: Decodable { let id: UUID }
        }
        let result: Result = try await client.rpc("create_doubles_elimination_with_quota", params: DECreateParams(
            _name: o.name, _share_id: shareID, _team_count: teamCount, _has_third_place_match: o.hasThirdPlace,
            _early_rounds_format: o.earlyFormat, _semifinals_format: o.semiFormat, _finals_format: o.finalsFormat,
            _court_count: max(1, o.courts.count), _start_time: o.startTime)).execute().value
        guard result.success, let t = result.tournament else {
            switch result.error {
            case "LIMIT_REACHED": throw DECreateError.limitReached
            case "AUTH_REQUIRED": throw DECreateError.authRequired
            default: throw DECreateError.failed(result.error ?? "Không tạo được giải")
            }
        }

        if isDupr {
            try await client.from("doubles_elimination_tournaments").update(DERatingPatch(
                rating_source: "dupr", min_dupr_rating: o.minDupr, max_dupr_rating: o.maxDupr,
                status: "registration_open")).eq("id", value: t.id).execute()
            return shareID
        }

        // self / either → patch rating_source, insert teams, generate bracket.
        try await client.from("doubles_elimination_tournaments").update(DERatingPatch(
            rating_source: o.ratingSource, min_dupr_rating: o.minDupr, max_dupr_rating: o.maxDupr,
            status: "setup")).eq("id", value: t.id).execute()

        let rows = teams.map { team -> DETeamInsertRow in
            let p1 = team.p1.trimmingCharacters(in: .whitespaces)
            let p2 = team.p2.trimmingCharacters(in: .whitespaces)
            let derived = team.teamName.trimmingCharacters(in: .whitespaces).nonEmpty
                ?? (!p1.isEmpty && !p2.isEmpty ? "\(p1) / \(p2)" : (p1.nonEmpty ?? p2.nonEmpty ?? "Đội"))
            return DETeamInsertRow(tournament_id: t.id.uuidString.lowercased(), team_name: derived,
                                   player1_name: p1.nonEmpty ?? derived, player2_name: p2.nonEmpty,
                                   seed: team.seed, status: "active")
        }
        let inserted: [DETeam] = try await client.from("doubles_elimination_teams")
            .insert(rows).select(Self.teamSelect).execute().value
        try await generateInitialBracket(tournamentID: t.id, teams: inserted, opts: o)
        try await client.from("doubles_elimination_tournaments")
            .update(TournamentStatusUpdate(status: "ongoing")).eq("id", value: t.id).execute()
        return shareID
    }

    /// Build R1 (winner pairings) + R2 (loser skeleton) + R3 (merge skeleton) with
    /// source pointers + court/time for R1/R2. Faithful port of generateBracket.
    private func generateInitialBracket(tournamentID: UUID, teams: [DETeam], opts o: DECreateOptions) async throws {
        // Manual seeding: seed asc (nil last), tie by name.
        let shuffled = teams.sorted {
            let sa = $0.seed ?? Int.max, sb = $1.seed ?? Int.max
            if sa != sb { return sa < sb }
            return $0.teamName.localizedCompare($1.teamName) == .orderedAscending
        }
        let n = shuffled.count
        let tID = tournamentID.uuidString.lowercased()
        let early = o.earlyFormat
        func bo(_ rt: String) -> Int { DEBracket.getBestOf(roundType: rt, early: early, semifinals: o.semiFormat, finals: o.finalsFormat) }

        var inserts: [DEMatchInsert] = []
        var order = 0

        // R1 — winner bracket.
        let r1Count = n / 2
        for i in 0..<r1Count {
            let a = shuffled[i * 2], b = shuffled[i * 2 + 1]
            inserts.append(DEMatchInsert(
                tournament_id: tID, round_number: 1, round_type: "winner_r1", bracket_type: "winner",
                match_number: i + 1, team_a_id: a.id.uuidString.lowercased(), team_b_id: b.id.uuidString.lowercased(),
                best_of: bo("winner_r1"),
                source_a: DEJSON(type: "team", position: nil, round: nil, matchIndex: nil, roundType: nil, teamID: a.id.uuidString.lowercased()),
                source_b: DEJSON(type: "team", position: nil, round: nil, matchIndex: nil, roundType: nil, teamID: b.id.uuidString.lowercased()),
                dest_winner: nil, dest_loser: nil, display_order: order, court_number: nil, start_time: nil))
            order += 1
        }

        // R2 — loser bracket skeleton (random loser pairing).
        let r2Count = r1Count / 2
        let loserOrder = Array(0..<r1Count).shuffled()
        for i in 0..<r2Count {
            inserts.append(DEMatchInsert(
                tournament_id: tID, round_number: 2, round_type: "loser_r2", bracket_type: "loser",
                match_number: i + 1, team_a_id: nil, team_b_id: nil, best_of: bo("loser_r2"),
                source_a: DEJSON(type: "loser_of", matchIndex: loserOrder[i * 2]),
                source_b: DEJSON(type: "loser_of", matchIndex: loserOrder[i * 2 + 1]),
                dest_winner: nil, dest_loser: DEJSON(type: "ELIMINATED"),
                display_order: order, court_number: nil, start_time: nil))
            order += 1
        }

        // R3 — merge skeleton.
        let byeFromR2 = r1Count % 2 == 1
        let byeTeamFromR1 = n % 2 == 1
        let winnersFromR1 = r1Count + (byeTeamFromR1 ? 1 : 0)
        let winnersFromR2 = r2Count + (byeFromR2 ? 1 : 0)
        let t3 = winnersFromR1 + winnersFromR2
        if t3 >= 2 {
            let r4 = Int(pow(2.0, floor(log2(Double(t3)))))
            let byesToR4 = 2 * r4 - t3
            let teamsPlayingR3 = t3 - byesToR4
            let r3Count = max(0, teamsPlayingR3 / 2)
            for i in 0..<r3Count {
                inserts.append(DEMatchInsert(
                    tournament_id: tID, round_number: 3, round_type: "merge_r3", bracket_type: "merged",
                    match_number: i + 1, team_a_id: nil, team_b_id: nil, best_of: bo("merge_r3"),
                    source_a: DEJSON(type: "winner_of", round: 1, matchIndex: i),
                    source_b: DEJSON(type: "winner_of", round: 2, matchIndex: i),
                    dest_winner: nil, dest_loser: DEJSON(type: "ELIMINATED"),
                    display_order: order, court_number: nil, start_time: nil))
                order += 1
            }
        }

        // Court + time for R1/R2 only.
        if !o.courts.isEmpty, let st = o.startTime,
           let h = Int(st.prefix(2)), let m = Int(st.suffix(2)) {
            var slots: [Int: Int] = [:]; o.courts.forEach { slots[$0] = 0 }
            for idx in inserts.indices where inserts[idx].round_number == 1 || inserts[idx].round_number == 2 {
                let (court, time) = DEBracket.assignCourtAndTime(&slots, courts: o.courts, startHour: h, startMinute: m, duration: 20)
                inserts[idx].court_number = court
                inserts[idx].start_time = time
            }
        }

        try await client.from("doubles_elimination_matches").insert(inserts).execute()
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

    /// Close registration (RPC seeds teams by DUPR + flips status 'ongoing') then
    /// build R1/R2/R3 from the freshly written seeds — mirrors web closeRegistration
    /// followed by generateBracket(..., 'manual'). Returns team count on success.
    @discardableResult
    func closeRegistrationAndGenerate(tournamentID: UUID) async throws -> Int {
        let r: RegRPCResult = try await client.rpc("close_doubles_elimination_registration",
            params: ["p_tournament_id": tournamentID.uuidString.lowercased()]).execute().value
        guard r.success else { throw DECreateError.failed(Self.localizeRegError(r.error)) }

        let t: DETournament = try await client.from("doubles_elimination_tournaments")
            .select("*").eq("id", value: tournamentID).single().execute().value
        let teams: [DETeam] = try await client.from("doubles_elimination_teams")
            .select(Self.teamSelect).eq("tournament_id", value: tournamentID)
            .order("seed", ascending: true).execute().value
        let courts = Array(1...max(1, t.courtCount))
        let opts = DECreateOptions(
            name: t.name, teamCount: t.teamCount, courts: courts, startTime: t.startTime,
            ratingSource: t.ratingSource ?? "dupr", minDupr: t.minDuprRating, maxDupr: t.maxDuprRating,
            earlyFormat: t.earlyRoundsFormat, semiFormat: t.semifinalsFormat ?? "bo3",
            finalsFormat: t.finalsFormat, hasThirdPlace: t.hasThirdPlaceMatch)
        try await generateInitialBracket(tournamentID: tournamentID, teams: teams, opts: opts)
        return r.count ?? teams.count
    }

    /// Localized copy of the RPC error codes (port of localizeError, VN only).
    static func localizeRegError(_ code: String?) -> String {
        switch code {
        case "AUTH_REQUIRED": return "Cần đăng nhập"
        case "INVALID_PARTNER": return "Đồng đội không hợp lệ"
        case "TOURNAMENT_NOT_FOUND": return "Không tìm thấy giải"
        case "REGISTRATION_CLOSED": return "Đăng ký đã đóng"
        case "NOT_DUPR_TOURNAMENT": return "Giải này không dùng DUPR"
        case "TOURNAMENT_FULL": return "Giải đã đủ đội"
        case "ALREADY_REGISTERED": return "Bạn hoặc đồng đội đã đăng ký rồi"
        case "MISSING_DUPR": return "Thiếu DUPR ở ít nhất 1 VĐV"
        case "OUT_OF_RANGE": return "DUPR trung bình ngoài khoảng cho phép"
        case "NOT_OWNER": return "Không có quyền"
        case "NOT_REGISTRATION_OPEN": return "Giải không ở trạng thái mở đăng ký"
        case "NOT_FULL": return "Chưa đủ đội"
        case "INVALID_PLAYERS": return "Thiếu VĐV"
        case "SAME_PLAYER": return "Hai VĐV trùng nhau"
        case "TEAM_NOT_FOUND": return "Không tìm thấy đội"
        case .some(let c): return c
        case .none: return "Lỗi không xác định"
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

    private static func nowPlus(minutes: Int) -> (hour: Int, minute: Int) {
        let date = Date().addingTimeInterval(Double(minutes) * 60)
        let c = Calendar.current.dateComponents([.hour, .minute], from: date)
        return (c.hour ?? 9, c.minute ?? 0)
    }
}

private extension DEJSON {
    init(type: String, position: Int? = nil, round: Int? = nil, matchIndex: Int? = nil, roundType: String? = nil) {
        self.init(type: type, position: position, round: round, matchIndex: matchIndex, roundType: roundType, teamID: nil)
    }
}
