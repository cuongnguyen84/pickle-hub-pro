import Foundation
import Testing
@testable import ThePickleHub

// N3 — client-side format filter on the Tournaments Community tab.
// Twin of the web /tournaments format tabs (src/pages/Tournaments.tsx).

@MainActor
struct CommunityFilterTests {
    private func t(_ format: BracketFormat, name: String = "T") -> MyTournament {
        MyTournament(id: UUID(), shareID: "s", name: name, isDoubles: true,
                     capacity: 8, registered: 0, state: .ongoing,
                     createdAt: nil, format: format)
    }

    @Test func nilFormatReturnsEverything() {
        let list = [t(.quickTable), t(.teamMatch), t(.flex), t(.doublesElim)]
        #expect(TournamentsViewModel.filter(list, format: nil).count == 4)
    }

    @Test func formatFilterKeepsOnlyThatFormat() {
        let list = [t(.quickTable, name: "a"), t(.teamMatch), t(.quickTable, name: "b"), t(.flex)]
        let out = TournamentsViewModel.filter(list, format: .quickTable)
        #expect(out.map(\.name) == ["a", "b"])
        #expect(out.allSatisfy { $0.format == .quickTable })
    }

    @Test func formatWithNoMatchesIsEmpty() {
        let list = [t(.quickTable), t(.flex)]
        #expect(TournamentsViewModel.filter(list, format: .teamMatch).isEmpty)
    }
}

// N4 — social-proof registration badge (#429). Twin of src/lib/regBadge.ts:
// registration-open only, >= 4 approved, đơn/đôi wording split.

struct RegBadgeTests {
    private func t(state: TournamentState, registered: Int, doubles: Bool = true,
                   format: BracketFormat = .quickTable) -> MyTournament {
        MyTournament(id: UUID(), shareID: "s", name: "T", isDoubles: doubles,
                     capacity: 16, registered: registered, state: state,
                     createdAt: nil, format: format)
    }

    @Test func showsAtThresholdSplitByMode() {
        #expect(t(state: .open, registered: 4, doubles: true).regBadgeText == "4 đội đã đăng ký")
        #expect(t(state: .open, registered: 5, doubles: false).regBadgeText == "5 người đã đăng ký")
    }

    @Test func hidesBelowThreshold() {
        #expect(t(state: .open, registered: 3).regBadgeText == nil)
        #expect(t(state: .open, registered: 0).regBadgeText == nil)
    }

    @Test func hidesWhenNotRegistrationOpen() {
        #expect(t(state: .ongoing, registered: 10).regBadgeText == nil)
        #expect(t(state: .draft, registered: 10).regBadgeText == nil)
        #expect(t(state: .completed, registered: 10).regBadgeText == nil)
    }

    @Test func teamMatchUsesTeamWording() {
        #expect(t(state: .open, registered: 6, format: .teamMatch).regBadgeText == "6 đội đã đăng ký")
    }
}
