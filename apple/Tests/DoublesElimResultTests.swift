import Foundation
import Testing
@testable import ThePickleHub

// ARCH-04 pre-work: characterization of the doubles-elimination result rule.
// Mirror of web src/lib/__tests__/doublesElimResult.test.ts — keep the
// shared-rule cases case-for-case identical (the web suite's sparse/padding
// quirk cases are web-only). Rule changes happen in computeMatchResult and
// its web twin, never in a view.

struct DoublesElimResultTests {
    private let teamA = UUID()
    private let teamB = UUID()

    private func g(_ game: Int, _ a: Int, _ b: Int) -> DEGame {
        DEGame(game: game, scoreA: a, scoreB: b, winner: a > b ? "a" : "b")
    }

    @Test func bo3TwoGameWinsCompleteTheMatch() {
        let r = DoublesElimRepository.computeMatchResult(
            games: [g(1, 11, 7), g(2, 11, 9)], bestOf: 3, teamAID: teamA, teamBID: teamB)
        #expect(r.gamesWonA == 2)
        #expect(r.gamesWonB == 0)
        #expect(r.complete)
        #expect(r.winnerID == teamA)
        #expect(r.loserID == teamB)
    }

    @Test func bo3OneOneIsIncomplete() {
        let r = DoublesElimRepository.computeMatchResult(
            games: [g(1, 11, 7), g(2, 9, 11)], bestOf: 3, teamAID: teamA, teamBID: teamB)
        #expect(!r.complete)
        #expect(r.winnerID == nil)
        #expect(r.loserID == nil)
    }

    @Test func bo1SingleDecidedGameCompletesTheMatch() {
        let r = DoublesElimRepository.computeMatchResult(
            games: [g(1, 7, 11)], bestOf: 1, teamAID: teamA, teamBID: teamB)
        #expect(r.complete)
        #expect(r.winnerID == teamB)
        #expect(r.loserID == teamA)
    }

    @Test func bo5CompletesAtThreeWinsWithGamesLeftUnplayed() {
        let r = DoublesElimRepository.computeMatchResult(
            games: [g(1, 11, 3), g(2, 11, 5), g(3, 11, 9)], bestOf: 5, teamAID: teamA, teamBID: teamB)
        #expect(r.complete)
        #expect(r.winnerID == teamA)
    }

    @Test func bo5TwoTwoIsIncomplete() {
        let r = DoublesElimRepository.computeMatchResult(
            games: [g(1, 11, 3), g(2, 3, 11), g(3, 11, 5), g(4, 5, 11)],
            bestOf: 5, teamAID: teamA, teamBID: teamB)
        #expect(!r.complete)
        #expect(r.winnerID == nil)
    }

    @Test func missingTeamIDYieldsNilWinnerEvenWhenComplete() {
        let r = DoublesElimRepository.computeMatchResult(
            games: [g(1, 11, 2)], bestOf: 1, teamAID: nil, teamBID: teamB)
        #expect(r.complete)
        #expect(r.winnerID == nil)
        #expect(r.loserID == teamB)
    }

    @Test func noGamesYieldsZerosAndIncomplete() {
        let r = DoublesElimRepository.computeMatchResult(
            games: [], bestOf: 3, teamAID: teamA, teamBID: teamB)
        #expect(r == DoublesElimRepository.DEMatchResult(
            gamesWonA: 0, gamesWonB: 0, complete: false, winnerID: nil, loserID: nil))
    }

    @Test func advanceTargetPairsConsecutiveMatchesIntoNextRound() {
        #expect(DoublesElimRepository.advanceTarget(matchNumber: 1) == (0, true))
        #expect(DoublesElimRepository.advanceTarget(matchNumber: 2) == (0, false))
        #expect(DoublesElimRepository.advanceTarget(matchNumber: 3) == (1, true))
        #expect(DoublesElimRepository.advanceTarget(matchNumber: 4) == (1, false))
        #expect(DoublesElimRepository.advanceTarget(matchNumber: 5) == (2, true))
    }
}
