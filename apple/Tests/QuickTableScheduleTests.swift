import Testing
import Foundation
@testable import ThePickleHub

/// Verifies the court/time scheduler ported from web `round-robin.ts scheduleMatches`.
struct QuickTableScheduleTests {
    private typealias SM = QuickTableRepository.SchedulableMatch

    /// 4 players (1 group) → 6 round-robin matches on 2 courts from 08:00.
    private func roundRobin4() -> (players: [UUID], matches: [SM]) {
        let p = (0..<4).map { _ in UUID() }
        var ms: [SM] = []
        for i in 0..<4 { for j in (i + 1)..<4 {
            ms.append(SM(matchID: UUID(), player1: p[i], player2: p[j], groupIndex: 0))
        } }
        return (p, ms)
    }

    @Test func schedulesEveryMatchOntoProvidedCourts() {
        let (_, matches) = roundRobin4()
        let out = QuickTableRepository.scheduleMatches(matches, courts: [1, 2], numGroups: 1, startTime: "08:00")
        #expect(out.count == matches.count)
        #expect(out.allSatisfy { [1, 2].contains($0.court) })
        // display_order is a 0..<n permutation (play order).
        #expect(Set(out.map(\.displayOrder)) == Set(0..<matches.count))
    }

    @Test func noPlayerDoubleBookedInASlot() {
        let (players, matches) = roundRobin4()
        let out = QuickTableRepository.scheduleMatches(matches, courts: [1, 2], numGroups: 1, startTime: "08:00")
        let timeByMatch = Dictionary(uniqueKeysWithValues: out.map { ($0.matchID, $0.startAt) })
        // Each player's matches must all be at distinct start times (no overlap).
        for pl in players {
            let times = matches.filter { $0.player1 == pl || $0.player2 == pl }.compactMap { timeByMatch[$0.matchID] ?? nil }
            #expect(Set(times).count == times.count)
        }
    }

    @Test func firstSlotIsStartTime() {
        let (_, matches) = roundRobin4()
        let out = QuickTableRepository.scheduleMatches(matches, courts: [1, 2], numGroups: 1, startTime: "08:00")
        #expect(out.contains { $0.startAt == "08:00" })
    }

    @Test func emptyCourtsOrMatchesYieldNothing() {
        let (_, matches) = roundRobin4()
        #expect(QuickTableRepository.scheduleMatches(matches, courts: [], numGroups: 1, startTime: "08:00").isEmpty)
        #expect(QuickTableRepository.scheduleMatches([], courts: [1], numGroups: 1, startTime: nil).isEmpty)
    }

    @Test func nilStartTimeLeavesTimesNil() {
        let (_, matches) = roundRobin4()
        let out = QuickTableRepository.scheduleMatches(matches, courts: [1, 2], numGroups: 1, startTime: nil)
        #expect(out.allSatisfy { $0.startAt == nil })
        #expect(out.count == matches.count)
    }
}
