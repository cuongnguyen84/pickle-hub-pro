import Foundation
import Testing
@testable import ThePickleHub

/// Test engine xếp cặp Mexicano/Round-Robin + BXH — port từ web
/// `src/lib/matchmaking/index.ts` và `src/lib/social-events/standings.ts`.
struct MatchmakingTests {

    private func players(_ n: Int, levels: [Double?]? = nil) -> [MMPlayer] {
        (0..<n).map { MMPlayer(id: "p\($0)", name: "Player \($0)", level: levels?[$0] ?? nil) }
    }

    // MARK: Mexicano

    @Test func mexicanoRound1ZigzagBySeed() {
        // 8 người level 8..1 → sân 1: (1,4) vs (2,3); sân 2: (5,8) vs (6,7).
        let ps = (0..<8).map { MMPlayer(id: "p\($0)", name: "P\($0)", level: Double(8 - $0)) }
        let s = Matchmaking.generateMexicano(players: ps, rounds: 1, courtCount: 2, seed: 42)
        #expect(s.rounds.count == 1)
        let r1 = s.rounds[0]
        #expect(r1.matches.count == 2)
        let m1 = r1.matches[0]
        let ids1 = Set([m1.teamA.0.id, m1.teamA.1.id, m1.teamB.0.id, m1.teamB.1.id])
        #expect(ids1 == Set(["p0", "p1", "p2", "p3"]))   // top-4 cùng sân 1
        #expect(r1.sittingOut.isEmpty)
    }

    @Test func mexicanoRespectsCourtCap() {
        // 12 người nhưng chỉ 2 sân → 8 chơi, 4 ngồi ngoài mỗi vòng.
        let s = Matchmaking.generateMexicano(players: players(12), rounds: 3, courtCount: 2, seed: 7)
        for r in s.rounds {
            #expect(r.matches.count == 2)
            #expect(r.sittingOut.count == 4)
        }
    }

    @Test func mexicanoBalancedNeedsCoverage() {
        // 3/8 có level (37%) → balanced KHÔNG kích hoạt dù preferBalanced=true.
        let levels: [Double?] = [4.0, 3.5, 3.0, nil, nil, nil, nil, nil]
        let low = Matchmaking.generateMexicano(players: players(8, levels: levels),
                                               rounds: 2, courtCount: 2, seed: 1, preferBalanced: true)
        #expect(!low.balancedPairingApplied)
        // 8/8 có level → kích hoạt + fairness được tính.
        let full = Matchmaking.generateMexicano(
            players: players(8, levels: (0..<8).map { Double(30 + $0) / 10 }),
            rounds: 2, courtCount: 2, seed: 1, preferBalanced: true)
        #expect(full.balancedPairingApplied)
        #expect(full.duprCoverage == 1.0)
        #expect(full.rounds[0].fairness != nil)
    }

    @Test func mexicanoTooFewPlayers() {
        let s = Matchmaking.generateMexicano(players: players(3), rounds: 2, courtCount: 2, seed: 5)
        #expect(s.rounds.isEmpty && s.playerCount == 3)
    }

    // MARK: Round Robin

    @Test func roundRobinPartnerDiversity() {
        // 8 người, 7 vòng, 2 sân — không ai ghép cùng partner quá 2 lần
        // (greedy fewest-first; hoàn hảo là ≤2 với 8 người/7 vòng).
        let s = Matchmaking.generateRoundRobin(players: players(8), rounds: 7, courtCount: 2, seed: 99)
        var partnerCount: [String: Int] = [:]
        for r in s.rounds {
            #expect(r.matches.count == 2)
            for m in r.matches {
                for pair in [(m.teamA.0.id, m.teamA.1.id), (m.teamB.0.id, m.teamB.1.id)] {
                    let key = pair.0 < pair.1 ? "\(pair.0)|\(pair.1)" : "\(pair.1)|\(pair.0)"
                    partnerCount[key, default: 0] += 1
                }
            }
        }
        #expect(partnerCount.values.allSatisfy { $0 <= 2 })
    }

    @Test func roundRobinSittingOutWhenOdd() {
        // 6 người 1 sân → 4 chơi, 2 ngồi ngoài.
        let s = Matchmaking.generateRoundRobin(players: players(6), rounds: 4, courtCount: 1, seed: 3)
        for r in s.rounds {
            #expect(r.matches.count == 1)
            #expect(r.sittingOut.count == 2)
        }
    }

    @Test func scheduleToTextFormat() {
        let ps = (0..<4).map { MMPlayer(id: "p\($0)", name: "N\($0)", level: nil) }
        let s = Matchmaking.generateRoundRobin(players: ps, rounds: 1, courtCount: 1, seed: 1)
        let text = Matchmaking.scheduleToText(s)
        // scheduleToText giữ VI cố định — assert này hợp lệ
        #expect(text.contains("Vòng 1"))
        #expect(text.contains("Sân 1:"))
        #expect(text.contains("vs"))
    }
}

struct SocialStandingsTests {

    private func match(_ a1: String, _ a2: String, _ b1: String, _ b2: String,
                       _ sa: Int?, _ sb: Int?, status: String, win: String?) -> SocialLiveMatch {
        SocialLiveMatch(
            id: UUID(), eventID: UUID(), round: 1, court: 1,
            teamAPlayer1ID: UUID(uuidString: a1), teamAPlayer2ID: UUID(uuidString: a2),
            teamBPlayer1ID: UUID(uuidString: b1), teamBPlayer2ID: UUID(uuidString: b2),
            teamAScore: sa, teamBScore: sb, status: status,
            confirmedByTeamA: nil, confirmedByTeamB: nil, winningTeam: win)
    }

    private let u1 = "00000000-0000-0000-0000-000000000001"
    private let u2 = "00000000-0000-0000-0000-000000000002"
    private let u3 = "00000000-0000-0000-0000-000000000003"
    private let u4 = "00000000-0000-0000-0000-000000000004"

    @Test func computeCountsOnlyCompleted() {
        let ms = [
            match(u1, u2, u3, u4, 11, 7, status: "completed", win: "a"),
            match(u1, u3, u2, u4, 5, 3, status: "in_progress", win: nil), // bỏ qua
        ]
        let rows = SocialStandings.compute(ms)
        #expect(rows.count == 4)
        let r1 = rows.first { $0.playerID == u1 }!
        #expect(r1.wins == 1 && r1.losses == 0 && r1.pointDiff == 4)
        let r3 = rows.first { $0.playerID == u3 }!
        #expect(r3.wins == 0 && r3.losses == 1 && r3.pointDiff == -4)
    }

    @Test func sortWinsThenDiff() {
        let ms = [
            match(u1, u2, u3, u4, 11, 2, status: "completed", win: "a"),
            match(u1, u3, u2, u4, 11, 9, status: "completed", win: "a"),
        ]
        let rows = SocialStandings.compute(ms)
        // u1 thắng 2 trận → đứng đầu.
        #expect(rows[0].playerID == u1)
        #expect(rows[0].wins == 2)
    }

    @Test func seedWithRosterAddsZeroRows() {
        let base = SocialStandings.compute([
            match(u1, u2, u3, u4, 11, 7, status: "completed", win: "a"),
        ])
        let seeded = SocialStandings.seedWithRoster(base, roster: [
            (profileID: u1, level: 4.0),
            (profileID: "00000000-0000-0000-0000-000000000009", level: 5.0),
        ])
        #expect(seeded.contains { $0.playerID == "00000000-0000-0000-0000-000000000009" && $0.matchesPlayed == 0 })
        // Người thắng vẫn trên người 0-0 dù level thấp hơn.
        #expect(seeded[0].playerID == u1)
    }
}
