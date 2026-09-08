import Testing
import Foundation
@testable import ThePickleHub

/// Mirror của src/lib/__tests__/quick-table-seeding-v2.test.ts (web).
struct QuickTableSeedingV2Tests {

    private func mkGroup(_ name: String) -> QTGroup { QTGroup(id: UUID(), name: name, displayOrder: 0) }
    private func mkPlayer(_ name: String, group: UUID, won: Int, pd: Int, pf: Int) -> QTPlayer {
        QTPlayer(id: UUID(), groupID: group, name: name, player1Name: nil, player2Name: nil,
                 team: nil, seed: nil,
                 matchesPlayed: 2, matchesWon: won, pointsFor: pf, pointsAgainst: pf - pd,
                 pointDiff: pd, isQualified: nil, isWildcard: nil, playoffSeed: nil)
    }

    // MARK: computeSeedingPlan — công thức nextPow2(G*A) - G*A

    @Test func planA2() {
        let p3 = QTSeedingV2.computeSeedingPlan(groupCount: 3, advancePerGroup: 2)
        #expect(p3.bracketSize == 8 && p3.wildcardCount == 2 && p3.feasible)
        let p6 = QTSeedingV2.computeSeedingPlan(groupCount: 6, advancePerGroup: 2)
        #expect(p6.bracketSize == 16 && p6.wildcardCount == 4 && p6.feasible)
        let p7 = QTSeedingV2.computeSeedingPlan(groupCount: 7, advancePerGroup: 2)
        #expect(p7.bracketSize == 16 && p7.wildcardCount == 2 && p7.feasible)
        let p5 = QTSeedingV2.computeSeedingPlan(groupCount: 5, advancePerGroup: 2)
        #expect(p5.bracketSize == 16 && p5.wildcardCount == 6 && !p5.feasible)
    }

    @Test func planA1() {
        let p3 = QTSeedingV2.computeSeedingPlan(groupCount: 3, advancePerGroup: 1)
        #expect(p3.bracketSize == 4 && p3.wildcardCount == 1 && p3.feasible)
        let p6 = QTSeedingV2.computeSeedingPlan(groupCount: 6, advancePerGroup: 1)
        #expect(p6.bracketSize == 8 && p6.wildcardCount == 2 && p6.feasible)
        let p5 = QTSeedingV2.computeSeedingPlan(groupCount: 5, advancePerGroup: 1)
        #expect(p5.bracketSize == 8 && p5.wildcardCount == 3 && p5.feasible)
    }

    // MARK: A=1, 3 bảng — nhất bảng + 1 nhì xuất sắc nhất (B2), không BYE

    @Test func seedingA1ThreeGroups() throws {
        let gA = mkGroup("A"), gB = mkGroup("B"), gC = mkGroup("C")
        let players = [
            mkPlayer("A1", group: gA.id, won: 2, pd: 10, pf: 33),
            mkPlayer("A2", group: gA.id, won: 1, pd: 2, pf: 25),
            mkPlayer("A3", group: gA.id, won: 0, pd: -12, pf: 15),
            mkPlayer("B1", group: gB.id, won: 2, pd: 8, pf: 31),
            mkPlayer("B2", group: gB.id, won: 1, pd: 5, pf: 27),
            mkPlayer("B3", group: gB.id, won: 0, pd: -13, pf: 14),
            mkPlayer("C1", group: gC.id, won: 2, pd: 6, pf: 30),
            mkPlayer("C2", group: gC.id, won: 1, pd: 1, pf: 24),
            mkPlayer("C3", group: gC.id, won: 0, pd: -9, pf: 16),
        ]
        let r = try QTSeedingV2.generateSeeding(groups: [gA, gB, gC], players: players, matches: [], advancePerGroup: 1)
        #expect(r.plan.bracketSize == 4)
        #expect(r.seeded.count == 4)
        #expect(r.seeded.filter { $0.tier == .winner }.map { $0.name }.sorted() == ["A1", "B1", "C1"])
        let wildcards = r.seeded.filter { $0.tier == .wildcard }
        #expect(wildcards.count == 1)
        #expect(wildcards.first?.name == "B2")
        #expect(!r.seeded.contains { $0.tier == .bye })
    }

    // MARK: A=2, 5 bảng — pad BYE

    @Test func seedingA2FiveGroupsBye() throws {
        var groups: [QTGroup] = []
        var players: [QTPlayer] = []
        for (ord, nm) in ["A", "B", "C", "D", "E"].enumerated() {
            let g = mkGroup(nm); groups.append(g)
            for pos in 0..<3 {
                players.append(mkPlayer("\(nm)\(pos + 1)", group: g.id,
                                        won: 2 - pos, pd: 10 - pos * 3 - ord, pf: 30 - pos * 4))
            }
        }
        let r = try QTSeedingV2.generateSeeding(groups: groups, players: players, matches: [], advancePerGroup: 2)
        #expect(r.plan.bracketSize == 16)
        #expect(!r.plan.feasible)
        #expect(r.seeded.count == 16)
        #expect(r.seeded.filter { $0.tier == .winner }.count == 5)
        #expect(r.seeded.filter { $0.tier == .runnerUp }.count == 5)
        #expect(r.seeded.filter { $0.tier == .wildcard }.count == 5)
        #expect(r.seeded.filter { $0.tier == .bye }.count == 1)
    }

    // MARK: pairings — seed #1 và #2 ở hai nửa đối diện

    // MARK: BYE walkover — winner tự đẩy lên vòng sau

    @Test func byeWalkoverAutoAdvances() {
        let a = UUID(), b = UUID(), real = UUID()
        // Vòng đầu 2 match: m1 = a vs b (thật), m2 = real vs BYE (nil) → walkover.
        let tree = QTSeedingV2.resolveBracketTree(firstRound: [
            (p1: a, p2: b, matchNumber: 1),
            (p1: real, p2: nil, matchNumber: 2),
        ])
        let m2 = tree.first { $0.roundIndex == 0 && $0.position == 1 }!
        #expect(m2.done)
        #expect(m2.winner == real)                 // match BYE completed, winner = người thật
        let final = tree.first { $0.roundIndex == 1 }!
        #expect(final.roundCount == 1)
        #expect(final.p2 == real)                  // position 1 → slot2 của final
        #expect(final.p1 == nil)                   // slot1 chờ winner m1
        #expect(!final.done)                       // final vẫn pending
    }

    @Test func noByeLeavesTreeUnresolved() {
        // Không BYE → không match nào done (old path giữ nguyên hành vi).
        let ids = (0..<4).map { _ in UUID() }
        let tree = QTSeedingV2.resolveBracketTree(firstRound: [
            (p1: ids[0], p2: ids[1], matchNumber: 1),
            (p1: ids[2], p2: ids[3], matchNumber: 2),
        ])
        #expect(tree.filter { $0.roundIndex == 0 }.allSatisfy { !$0.done })
        #expect(tree.first { $0.roundIndex == 1 }?.p1 == nil)  // final rỗng, chờ điểm
    }

    @Test func pairingsStandardSeed() {
        let seeded = (1...8).map { i in
            QTSeedingV2.Seeded(playerID: UUID(), name: "s\(i)", seed: i, sourceGroupID: UUID(),
                               wins: 0, pointDiff: 0, pointsFor: 0, tier: .winner)
        }
        let prs = QTSeedingV2.pairings(seeded)
        #expect(prs.count == 4)
        let m1 = prs.first { $0.p1.name == "s1" || $0.p2.name == "s1" }!
        #expect([m1.p1.name, m1.p2.name].sorted() == ["s1", "s8"])
        let m2 = prs.first { $0.p1.name == "s2" || $0.p2.name == "s2" }!
        #expect([m2.p1.name, m2.p2.name].sorted() == ["s2", "s7"])
    }

    @Test func resolveBracketConflictsKeepsWinnersVsRunnersUp() {
        // Giải 4 bảng thật (share 5c86f3d9551a): seed 1&8 cùng bảng A, seed 3&6 cùng bảng C.
        // Resolver cũ đẩy nhất bảng B (seed 4) sang gặp nhất bảng A (seed 1) ở vòng 1.
        let gA = UUID(), gB = UUID(), gC = UUID(), gD = UUID()
        let groupOf = [1: gA, 2: gD, 3: gC, 4: gB, 5: gD, 6: gC, 7: gB, 8: gA]
        let seeded = (1...8).map { i in
            QTSeedingV2.Seeded(playerID: UUID(), name: "s\(i)", seed: i, sourceGroupID: groupOf[i],
                               wins: 0, pointDiff: 0, pointsFor: 0, tier: i <= 4 ? .winner : .runnerUp)
        }
        let resolved = QTSeedingV2.resolveBracketConflicts(QTSeedingV2.pairings(seeded))
        #expect(resolved.count == 4)
        for m in resolved {
            #expect(m.p1.seed <= 4 && m.p2.seed >= 5)          // nhất bảng luôn gặp nhì bảng
            #expect(m.p1.sourceGroupID != m.p2.sourceGroupID)  // không cùng bảng
        }
        #expect(resolved.first { $0.p1.seed == 1 }?.p2.seed == 7)  // seed 8 cùng bảng → floater yếu nhất khác bảng
        #expect(resolved.first { $0.p1.seed == 3 }?.p2.seed == 5)
    }

    @Test func swapSlotsExchangesTwoSlotsAcrossMatches() {
        let ids = (0..<4).map { _ in UUID() }
        let bracket = [
            QTBracketMatch(player1: ids[0], player2: ids[1], position: "upper", matchNumber: 1),
            QTBracketMatch(player1: ids[2], player2: ids[3], position: "lower", matchNumber: 2),
        ]
        let out = QTSeedingV2.swapSlots(bracket, (0, 2), (1, 1))
        #expect(out[0].player2 == ids[2])
        #expect(out[1].player1 == ids[1])
        #expect(out[0].player1 == ids[0] && out[1].player2 == ids[3])   // slot khác giữ nguyên
        #expect(QTSeedingV2.swapSlots(bracket, (0, 1), (0, 1)) == bracket) // cùng ô → no-op
        #expect(QTSeedingV2.swapSlots(bracket, (0, 1), (5, 1)) == bracket) // index sai → no-op
    }
}
