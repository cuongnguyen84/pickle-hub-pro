import Foundation
import Testing
@testable import ThePickleHub

// QA-07: MLP match result, default + total-score mode.
// Mirror of web src/lib/__tests__/teamMatchResult.test.ts — keep the two
// suites case-for-case identical. Rule changes happen in computeMatchResult
// and its web twin, never in a view.

struct TeamMatchResultTests {
    private let teamA = UUID()
    private let teamB = UUID()

    @Test func totalPointsAreSumOfGameScoresNotFixed28() {
        // 4 games each played to 7 (MLP total-score mode)
        let r = TeamMatchRepository.computeMatchResult(
            scores: [(7, 5), (7, 6), (5, 7), (7, 3)],
            teamAID: teamA, teamBID: teamB)
        #expect(r.totalPointsA == 26)
        #expect(r.totalPointsB == 21)
        #expect(r.totalPointsA + r.totalPointsB != 28)
    }

    @Test func winnerIsDecidedByGamesWonMajority() {
        let r = TeamMatchRepository.computeMatchResult(
            scores: [(7, 5), (7, 6), (5, 7), (7, 3)],
            teamAID: teamA, teamBID: teamB)
        #expect(r.gamesWonA == 3)
        #expect(r.gamesWonB == 1)
        #expect(r.winnerID == teamA)
    }

    @Test func defaultModeGamesMajorityBeatsHigherCumulativeTotal() {
        // B outscores A overall but loses 1-2 on games → A wins by default rule.
        let r = TeamMatchRepository.computeMatchResult(
            scores: [(7, 6), (0, 7), (7, 6)],
            teamAID: teamA, teamBID: teamB)
        #expect(r.totalPointsA == 14)
        #expect(r.totalPointsB == 19)
        #expect(r.winnerID == teamA)
    }

    @Test func totalScoreModeHigherCumulativeTotalWins() {
        // Same scores — with total_score_mode on, B's 19-14 wins the match
        // even though A won more games (Cuong's rule 2026-07-16).
        let r = TeamMatchRepository.computeMatchResult(
            scores: [(7, 6), (0, 7), (7, 6)],
            teamAID: teamA, teamBID: teamB, totalScoreMode: true)
        #expect(r.totalPointsB == 19)
        #expect(r.winnerID == teamB)
    }

    @Test func totalScoreModeNoWinnerWhileAnyGameUndecided() {
        // A leads 7-5 after game 1, games 2-4 unplayed (0-0) — the match
        // must NOT complete early on a points lead.
        let r = TeamMatchRepository.computeMatchResult(
            scores: [(7, 5), (0, 0), (0, 0), (0, 0)],
            teamAID: teamA, teamBID: teamB, totalScoreMode: true)
        #expect(r.winnerID == nil)
    }

    @Test func totalScoreModeEqualTotalsLeaveNoWinner() {
        // 21-21 after all games decided → dreambreaker/organizer resolves.
        let r = TeamMatchRepository.computeMatchResult(
            scores: [(7, 5), (5, 7), (2, 7), (7, 2)],
            teamAID: teamA, teamBID: teamB, totalScoreMode: true)
        #expect(r.totalPointsA == 21)
        #expect(r.totalPointsB == 21)
        #expect(r.winnerID == nil)
    }

    @Test func noWinnerWhileGamesMajorityUnreached() {
        // 1-1 after two of four games (remaining games still 0-0 → ties)
        let r = TeamMatchRepository.computeMatchResult(
            scores: [(7, 5), (4, 7), (0, 0), (0, 0)],
            teamAID: teamA, teamBID: teamB)
        #expect(r.gamesWonA == 1)
        #expect(r.gamesWonB == 1)
        #expect(r.winnerID == nil)
    }

    @Test func tiedGameCountsForNeitherSide() {
        let r = TeamMatchRepository.computeMatchResult(
            scores: [(6, 6), (7, 2)],
            teamAID: teamA, teamBID: teamB)
        #expect(r.gamesWonA == 1)
        #expect(r.gamesWonB == 0)
        // 1 of 2 games meets ceil(2/2)=1 → A already has the majority
        #expect(r.winnerID == teamA)
    }

    @Test func majorityWinnerWithMissingTeamIDYieldsNoWinner() {
        let r = TeamMatchRepository.computeMatchResult(
            scores: [(7, 0)],
            teamAID: nil, teamBID: teamB)
        #expect(r.winnerID == nil)
    }

    @Test func noGamesYieldsZerosAndNoWinner() {
        let r = TeamMatchRepository.computeMatchResult(
            scores: [], teamAID: teamA, teamBID: teamB)
        #expect(r == TeamMatchRepository.ComputedMatchResult(
            gamesWonA: 0, gamesWonB: 0, totalPointsA: 0, totalPointsB: 0, winnerID: nil))
    }
}
