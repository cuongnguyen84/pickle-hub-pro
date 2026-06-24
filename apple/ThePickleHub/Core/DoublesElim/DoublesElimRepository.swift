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
    total_points_against, point_diff, status, eliminated_at_round
    """

    func currentUserID() async -> UUID? { try? await client.auth.session.user.id }

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
        let court_number: Int?
        let start_time: String?
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
