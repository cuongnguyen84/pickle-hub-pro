import Foundation
import Testing
@testable import ThePickleHub

// ARCH-04 pre-work: characterization of the Flex standings rules.
// Mirror of web src/lib/__tests__/flexStats.test.ts — keep the shared-rule
// cases case-for-case identical. Swift computes standings live in
// FlexData.singlesStandings / pairStandings / teamStandings + rankSort;
// rule changes happen there and in the web twin (src/lib/flexStats.ts),
// never in a view.

struct FlexStandingsTests {
    private let p1 = UUID(), p2 = UUID(), p3 = UUID(), p4 = UUID()
    private let t1 = UUID(), t2 = UUID()
    private let group = FlexGroup(id: UUID(), name: "A", displayOrder: 0, includeDoublesInSingles: true)

    private func match(
        type: String = "singles",
        a1: UUID? = nil, a2: UUID? = nil, b1: UUID? = nil, b2: UUID? = nil,
        ta: UUID? = nil, tb: UUID? = nil,
        sa: Int, sb: Int, counts: Bool = true
    ) -> FlexMatch {
        FlexMatch(id: UUID(), groupID: group.id, name: "", matchType: type,
                  slotA1PlayerID: a1, slotA2PlayerID: a2,
                  slotB1PlayerID: b1, slotB2PlayerID: b2,
                  slotATeamID: ta, slotBTeamID: tb,
                  scoreA: sa, scoreB: sb,
                  winnerSide: sa > sb ? "a" : (sb > sa ? "b" : nil),
                  countsForStandings: counts, displayOrder: 0)
    }

    private func data(
        players: [UUID], teams: [UUID] = [], matches: [FlexMatch],
        group overrideGroup: FlexGroup? = nil
    ) -> (FlexData, FlexGroup) {
        let g = overrideGroup ?? group
        let items: [FlexGroupItem] = teams.isEmpty
            ? players.enumerated().map { i, pid in
                FlexGroupItem(id: UUID(), groupID: g.id, itemType: "player",
                              playerID: pid, teamID: nil, displayOrder: i)
            }
            : teams.enumerated().map { i, tid in
                FlexGroupItem(id: UUID(), groupID: g.id, itemType: "team",
                              playerID: nil, teamID: tid, displayOrder: i)
            }
        let d = FlexData(
            tournament: FlexTournament(id: UUID(), name: "T", shareID: "s",
                                       isPublic: true, status: "active", creatorUserID: nil),
            players: [p1, p2, p3, p4].map { FlexPlayer(id: $0, name: $0.uuidString, displayOrder: 0) },
            teams: [t1, t2].map { FlexTeam(id: $0, name: $0.uuidString, displayOrder: 0) },
            teamMembers: [],
            groups: [g], groupItems: items, matches: matches)
        return (d, g)
    }

    private func line(_ standings: [FlexStanding], _ id: UUID) -> FlexStanding? {
        standings.first { $0.id == id.uuidString }
    }

    @Test func eachMatchIsOneWinOrOneLossWithSignedMargin() {
        let (d, g) = data(players: [p1, p2], matches: [
            match(a1: p1, b1: p2, sa: 11, sb: 7),
            match(a1: p1, b1: p2, sa: 5, sb: 11),
        ])
        let s = d.singlesStandings(g)
        #expect(line(s, p1)?.wins == 1)
        #expect(line(s, p1)?.losses == 1)
        #expect(line(s, p1)?.pointDiff == 4 - 6)
        #expect(line(s, p2)?.pointDiff == 6 - 4)
    }

    @Test func skipsNoWinnerAndNonStandingsMatches() {
        let (d, g) = data(players: [p1, p2], matches: [
            match(a1: p1, b1: p2, sa: 9, sb: 9),                 // tie → nil winner
            match(a1: p1, b1: p2, sa: 11, sb: 3, counts: false), // excluded
        ])
        let s = d.singlesStandings(g)
        #expect(line(s, p1) == FlexStanding(id: p1.uuidString, name: p1.uuidString,
                                            wins: 0, losses: 0, pointDiff: 0))
    }

    @Test func doublesCreditEveryWinnerAndRespectIncludeToggle() {
        let doubles = match(type: "doubles", a1: p1, a2: p3, b1: p2, b2: p4, sa: 11, sb: 6)
        let (d, g) = data(players: [p1, p2, p3, p4], matches: [doubles])
        let included = d.singlesStandings(g)
        #expect(line(included, p1)?.wins == 1)
        #expect(line(included, p3)?.pointDiff == 5)
        #expect(line(included, p2)?.losses == 1)

        let offGroup = FlexGroup(id: group.id, name: "A", displayOrder: 0, includeDoublesInSingles: false)
        let (d2, g2) = data(players: [p1, p2, p3, p4], matches: [doubles], group: offGroup)
        let excluded = d2.singlesStandings(g2)
        #expect(line(excluded, p1)?.wins == 0)
        #expect(line(excluded, p1)?.pointDiff == 0)
    }

    @Test func playersOutsideTheGroupGetNoRowEvenWhenTheyPlayed() {
        let (d, g) = data(players: [p1], matches: [match(a1: p1, b1: p3, sa: 11, sb: 8)])
        let s = d.singlesStandings(g)
        #expect(line(s, p1)?.wins == 1)
        #expect(line(s, p1)?.pointDiff == 3)
        #expect(line(s, p3) == nil)
    }

    @Test func pairKeyIsSortedSoSlotOrderDoesNotSplitADuo() {
        let (d, g) = data(players: [p1, p2, p3, p4], matches: [
            match(type: "doubles", a1: p1, a2: p2, b1: p3, b2: p4, sa: 11, sb: 5),
            match(type: "doubles", a1: p2, a2: p1, b1: p3, b2: p4, sa: 11, sb: 9),
        ])
        let pairs = d.pairStandings(g)
        let sorted = [p1, p2].sorted { $0.uuidString < $1.uuidString }
        let key = "\(sorted[0].uuidString)|\(sorted[1].uuidString)"
        let duo = pairs.first { $0.id == key }
        #expect(duo?.wins == 2)
        #expect(duo?.losses == 0)
        #expect(duo?.pointDiff == 6 + 2)
    }

    @Test func pairCountsWithOneMemberInGroupAndSkipsIncompleteSidesAndSingles() {
        let (d, g) = data(players: [p1], matches: [
            match(type: "doubles", a1: p1, a2: p3, b1: p2, b2: p4, sa: 11, sb: 4),
            match(type: "doubles", a1: p1, b1: p2, b2: p3, sa: 11, sb: 6), // side A incomplete
            match(a1: p1, b1: p2, sa: 11, sb: 7),                          // singles skipped
        ])
        let pairs = d.pairStandings(g)
        // Only the full A-side pair from match 1 (contains p1); B sides have no
        // group member; the incomplete side records nothing.
        #expect(pairs.count == 1)
        #expect(pairs.first?.wins == 1)
        #expect(pairs.first?.pointDiff == 7)
    }

    @Test func teamMatchesAreOneWinOrOneLossWithSignedMargin() {
        let (d, g) = data(players: [], teams: [t1, t2], matches: [
            match(ta: t1, tb: t2, sa: 3, sb: 1),
            match(ta: t1, tb: t2, sa: 0, sb: 2),
        ])
        let s = d.teamStandings(g)
        #expect(line(s, t1)?.wins == 1)
        #expect(line(s, t1)?.losses == 1)
        #expect(line(s, t1)?.pointDiff == 0)
        #expect(line(s, t2)?.pointDiff == 0)
    }

    @Test func teamStandingsSkipTiesAndTeamsOutsideTheGroup() {
        let (d, g) = data(players: [], teams: [t1], matches: [
            match(ta: t1, tb: t2, sa: 2, sb: 2), // tie → nil winner
            match(ta: t1, tb: t2, sa: 3, sb: 0),
        ])
        let s = d.teamStandings(g)
        #expect(line(s, t1)?.wins == 1)
        #expect(line(s, t1)?.pointDiff == 3)
        #expect(line(s, t2) == nil)
    }

    @Test func rankSortIsWinsDescThenPointDiffDesc() {
        let rows = [
            FlexStanding(id: "c", name: "c", wins: 1, losses: 0, pointDiff: 9),
            FlexStanding(id: "a", name: "a", wins: 2, losses: 0, pointDiff: -3),
            FlexStanding(id: "b", name: "b", wins: 1, losses: 0, pointDiff: 12),
        ]
        #expect(rows.sorted(by: FlexData.rankSort).map(\.id) == ["a", "b", "c"])
    }
}
