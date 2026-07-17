import Foundation
import Testing
@testable import ThePickleHub

// ARCH-04 pre-work: characterization of the QuickTable result rules.
// Mirror of web src/lib/__tests__/quickTableResult.test.ts — keep the
// shared-rule cases case-for-case identical. Web-only quirks (tie saved as
// completed with null winner, findIndex -1 advancement) stay web-only:
// Swift score() refuses ties and guards the not-found position.

struct QuickTableResultTests {
    private let p1 = UUID()
    private let p2 = UUID()

    @Test func advanceTargetPairsConsecutivePositionsIntoNextRound() {
        #expect(QuickTableRepository.advanceTarget(position: 0) == (0, true))
        #expect(QuickTableRepository.advanceTarget(position: 1) == (0, false))
        #expect(QuickTableRepository.advanceTarget(position: 2) == (1, true))
        #expect(QuickTableRepository.advanceTarget(position: 3) == (1, false))
        #expect(QuickTableRepository.advanceTarget(position: 4) == (2, true))
    }

    @Test func accumulatesPlayedWonPointsPerPlayer() {
        let stats = QuickTableRepository.accumulateGroupStats(
            matches: [(p1, p2, 11, 7), (p1, p2, 5, 11)],
            playerIDs: [p1, p2])
        #expect(stats[p1] == QuickTableRepository.GroupStat(played: 2, won: 1, pf: 16, pa: 18))
        #expect(stats[p2] == QuickTableRepository.GroupStat(played: 2, won: 1, pf: 18, pa: 16))
    }

    @Test func skipsMatchesWithMissingPlayerOrScore() {
        let stats = QuickTableRepository.accumulateGroupStats(
            matches: [(nil, p2, 11, 7), (p1, p2, 11, nil), (p1, p2, 0, 0)],
            playerIDs: [p1, p2])
        // Only the 0-0 match survives the guard (0 is a valid score, not nil).
        #expect(stats[p1] == QuickTableRepository.GroupStat(played: 1, won: 0, pf: 0, pa: 0))
        #expect(stats[p2] == QuickTableRepository.GroupStat(played: 1, won: 0, pf: 0, pa: 0))
    }

    @Test func tiedMatchCountsAsPlayedForBothWonByNeither() {
        let stats = QuickTableRepository.accumulateGroupStats(
            matches: [(p1, p2, 9, 9)], playerIDs: [p1, p2])
        #expect(stats[p1] == QuickTableRepository.GroupStat(played: 1, won: 0, pf: 9, pa: 9))
        #expect(stats[p2] == QuickTableRepository.GroupStat(played: 1, won: 0, pf: 9, pa: 9))
    }

    @Test func ignoresMatchesInvolvingPlayersOutsideTheGroupList() {
        let ghost = UUID()
        let stats = QuickTableRepository.accumulateGroupStats(
            matches: [(ghost, p2, 11, 7)], playerIDs: [p1, p2])
        #expect(stats[p1] == QuickTableRepository.GroupStat(played: 0, won: 0, pf: 0, pa: 0))
        #expect(stats[p2] == QuickTableRepository.GroupStat(played: 1, won: 0, pf: 7, pa: 11))
        #expect(stats[ghost] == nil)
    }

    @Test func playersWithNoMatchesKeepZeroedStats() {
        let stats = QuickTableRepository.accumulateGroupStats(matches: [], playerIDs: [p1])
        #expect(stats[p1] == QuickTableRepository.GroupStat(played: 0, won: 0, pf: 0, pa: 0))
    }
}
