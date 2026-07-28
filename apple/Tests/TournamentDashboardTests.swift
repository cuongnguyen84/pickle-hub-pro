import Foundation
import Testing
@testable import ThePickleHub

struct TournamentDashboardTests {
    private let tournament = ActiveDashboardTournament(
        id: UUID(),
        shareID: "summer26",
        name: "Summer 2026",
        type: .quickTable
    )

    private func match(
        _ order: Int,
        court: Int,
        status: String,
        scoreA: Int? = nil,
        scoreB: Int? = nil
    ) -> TournamentDashboardMatch {
        TournamentDashboardMatch(
            id: UUID(),
            teamA: "A\(order)",
            teamB: "B\(order)",
            scoreA: scoreA,
            scoreB: scoreB,
            status: status,
            startTime: nil,
            displayOrder: order,
            courtNumber: court
        )
    }

    @Test func liveStateIncludesExplicitAndInProgressPendingScores() {
        #expect(match(0, court: 1, status: "live").isLive)
        #expect(match(0, court: 1, status: "playing").isLive)
        #expect(match(0, court: 1, status: "pending", scoreA: 3, scoreB: 2).isLive)
        #expect(!match(0, court: 1, status: "pending", scoreA: 0, scoreB: 0).isLive)
    }

    @Test func courtsPickFirstLiveAndFirstDifferentPendingMatch() {
        let live = match(3, court: 1, status: "live", scoreA: 5, scoreB: 4)
        let earlierPending = match(1, court: 1, status: "pending")
        let laterPending = match(4, court: 1, status: "pending")
        let snapshot = TournamentDashboardSnapshot(
            tournament: tournament,
            matches: [live, laterPending, earlierPending],
            courtCount: 2
        )

        #expect(snapshot.courts.count == 2)
        #expect(snapshot.courts[0].liveMatch?.id == live.id)
        #expect(snapshot.courts[0].nextMatch?.id == earlierPending.id)
        #expect(snapshot.courts[1].liveMatch == nil)
        #expect(snapshot.courts[1].nextMatch == nil)
    }

    @Test func highestAssignedCourtExpandsConfiguredCourtCount() {
        let courtFour = match(0, court: 4, status: "pending")
        let snapshot = TournamentDashboardSnapshot(
            tournament: tournament,
            matches: [courtFour],
            courtCount: 2
        )

        #expect(snapshot.courts.map(\.courtNumber) == [1, 2, 3, 4])
        #expect(snapshot.courts[3].nextMatch?.id == courtFour.id)
    }

    @Test func teamMatchUsesFlatLiveAndNextQueues() {
        let teamTournament = ActiveDashboardTournament(
            id: UUID(),
            shareID: "tm",
            name: "MLP",
            type: .teamMatch
        )
        let live = match(0, court: 0, status: "in_progress")
        let pending = (1...7).map { match($0, court: 0, status: "pending") }
        let snapshot = TournamentDashboardSnapshot(
            tournament: teamTournament,
            matches: [live] + pending,
            courtCount: 0
        )

        #expect(snapshot.courts.isEmpty)
        #expect(snapshot.liveTeamMatches.map(\.id) == [live.id])
        #expect(snapshot.nextTeamMatches.count == 5)
    }
}
