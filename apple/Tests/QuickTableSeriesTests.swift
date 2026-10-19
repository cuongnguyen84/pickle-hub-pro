import Testing
import Foundation
@testable import ThePickleHub

/// Mirror của src/lib/__tests__/quick-table-series.test.ts (web).
struct QuickTableSeriesTests {
    private func mkPlayer(_ name: String, group: UUID, won: Int, played: Int = 3) -> QTPlayer {
        QTPlayer(id: UUID(), groupID: group, name: name, player1Name: nil, player2Name: nil,
                 team: nil, seed: nil,
                 matchesPlayed: played, matchesWon: won, pointsFor: 0, pointsAgainst: 0,
                 pointDiff: 0, isQualified: nil, isWildcard: nil, playoffSeed: nil)
    }

    @Test func planMatchesWeb() {
        // 26 đội · 8 bảng (2 bảng 4, 6 bảng 3): A 16, B 10 trong cây 16 → 6 BYE
        let s26 = [4, 4, 3, 3, 3, 3, 3, 3]
        #expect(QTSeries.plan(sizes: s26, k: 2) == [.init(size: 16, bracket: 16), .init(size: 10, bracket: 16)])
        // 28 đội · 6 bảng: A 16 (4 vé vớt), B 8, C 4
        #expect(QTSeries.plan(sizes: [5, 5, 5, 5, 4, 4], k: 3)?.map(\.size) == [16, 8, 4])
        #expect(QTSeries.cap(sizes: [6, 6, 6, 6]) == 3)
        #expect(QTSeries.cap(sizes: [3, 3, 3]) == 1)
    }

    @Test func everyoneIsPlacedAndByesGoToTopSeeds() {
        let groups = (0..<8).map { QTGroup(id: UUID(), name: String(UnicodeScalar(65 + $0)!), displayOrder: $0) }
        let sizes = [4, 4, 3, 3, 3, 3, 3, 3]
        var players: [QTPlayer] = []
        for (g, n) in zip(groups, sizes) {
            for i in 0..<n { players.append(mkPlayer("\(g.name)\(i)", group: g.id, won: n - 1 - i, played: n - 1)) }
        }
        let series = QTSeries.assign(groups: groups, players: players, sizes: QTSeries.plan(sizes: sizes, k: 2)!.map(\.size))
        #expect(series.map(\.count) == [16, 10])
        let b = QTSeries.bracket(series[1])
        #expect(b.count == 8)
        let byeMatches = b.filter { $0.player1 == nil || $0.player2 == nil }
        #expect(byeMatches.count == 6)
        let topSix = Set(series[1].prefix(6).map(\.id))
        #expect(Set(byeMatches.compactMap { $0.player1 ?? $0.player2 }) == topSix)
    }

    @Test func customSizesElevenGroups() {
        #expect(QTSeries.resolveSizes([16, 0, 0], total: 44) == [16, 14, 14])
        #expect(QTSeries.resolveSizes([16], total: 44) == [16])
        #expect(QTSeries.resolveSizes([43, 0], total: 44) == nil)
        #expect(QTSeries.resolveSizes([8, 8, 8, 8], total: 44) == nil)
        let groups = (0..<11).map { QTGroup(id: UUID(), name: String(UnicodeScalar(65 + $0)!), displayOrder: $0) }
        var players: [QTPlayer] = []
        for g in groups { for i in 0..<4 { players.append(mkPlayer("\(g.name)\(i)", group: g.id, won: 3 - i, played: 3)) } }
        let series = QTSeries.assign(groups: groups, players: players, sizes: [16, 14, 14])
        #expect(series.map(\.count) == [16, 14, 14])
        #expect(series[0].filter { $0.name.hasSuffix("0") }.count == 11) // mọi đội nhất vào nhánh Vàng
        #expect(series.allSatisfy { QTSeries.bracket($0).count == 8 })
    }
}
