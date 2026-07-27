import Foundation
import Testing
@testable import ThePickleHub

// N3 — client-side format filter on the Tournaments Community tab.
// Twin of the web /tournaments format tabs (src/pages/Tournaments.tsx).

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
