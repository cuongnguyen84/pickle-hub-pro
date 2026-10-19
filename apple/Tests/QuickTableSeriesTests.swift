import Testing
import Foundation
@testable import ThePickleHub

/// Mirror của src/lib/__tests__/quick-table-series.test.ts (web).
struct QuickTableSeriesTests {
    private func mkPlayer(_ name: String, group: UUID, won: Int) -> QTPlayer {
        QTPlayer(id: UUID(), groupID: group, name: name, player1Name: nil, player2Name: nil,
                 team: nil, seed: nil,
                 matchesPlayed: 3, matchesWon: won, pointsFor: 0, pointsAgainst: 0,
                 pointDiff: 0, isQualified: nil, isWildcard: nil, playoffSeed: nil)
    }

    @Test func capOnlyForCleanBrackets() {
        #expect(QTSeries.cap(groupCount: 8, smallestGroup: 4) == 2)
        #expect(QTSeries.cap(groupCount: 4, smallestGroup: 6) == 3)
        #expect(QTSeries.cap(groupCount: 6, smallestGroup: 4) == 1)
        #expect(QTSeries.cap(groupCount: 4, smallestGroup: 3) == 1)
    }

    @Test func seriesBTakesRanksThreeAndFour() {
        let a = QTGroup(id: UUID(), name: "A", displayOrder: 0)
        let players = [mkPlayer("a1", group: a.id, won: 3), mkPlayer("a4", group: a.id, won: 0),
                       mkPlayer("a3", group: a.id, won: 1), mkPlayer("a2", group: a.id, won: 2)]
        let b = QTSeries.qualified(groups: [a], players: players, division: 1)
        #expect(b.map { $0.player.name } == ["a3", "a4"])
        #expect(b.map { $0.seed } == [1, 2])
    }
}
