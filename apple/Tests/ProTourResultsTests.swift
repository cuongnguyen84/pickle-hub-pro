import Foundation
import Testing
@testable import ThePickleHub

struct ProTourResultsTests {
    private func row(
        id: String = UUID().uuidString,
        event: String? = "Pro Men's Doubles",
        round: String? = "F",
        a: [Int]? = [11, 11],
        b: [Int]? = [7, 9],
        winner: String? = "a",
        playedAt: String? = "2026-09-13T10:00:00Z",
        notes: String? = nil,
        participants: [ProResultParticipant]? = nil
    ) -> ProResultRow {
        ProResultRow(
            id: id,
            slug: "m-\(id)",
            tournamentName: "PPA Asia 1000 Leapmotor Kuala Lumpur Cup 2026",
            tournamentEvent: event,
            roundName: round,
            teamAScore: a,
            teamBScore: b,
            winningTeam: winner,
            playedAt: playedAt,
            courtNumber: nil,
            notes: notes,
            matchParticipants: participants ?? standardParticipants
        )
    }

    private var standardParticipants: [ProResultParticipant] {
        [
            participant("a", 1, "Alex Smith", "alex"),
            participant("a", 2, "Ben Jones"),
            participant("b", 1, "Trương Vĩnh Hiển"),
            participant("b", 2, "Đỗ Minh Quân"),
        ]
    }

    private func participant(_ team: String, _ position: Int, _ name: String, _ username: String? = nil) -> ProResultParticipant {
        ProResultParticipant(
            team: team,
            position: position,
            profile: .init(displayName: name, username: username)
        )
    }

    @Test func classifiesFiveProEventsAndOther() {
        #expect(ProResultsLogic.classifyEvent("Pro Men's Singles") == .mensSingles)
        #expect(ProResultsLogic.classifyEvent("Pro Women's Singles") == .womensSingles)
        #expect(ProResultsLogic.classifyEvent("Pro Men's Doubles") == .mensDoubles)
        #expect(ProResultsLogic.classifyEvent("Pro Women's Doubles") == .womensDoubles)
        #expect(ProResultsLogic.classifyEvent("Pro Mixed Doubles") == .mixedDoubles)
        #expect(ProResultsLogic.classifyEvent("Champions Bracket") == .other)
    }

    @Test func groupsOrdersRoundsAndExtractsChampion() {
        let output = ProResultsLogic.group([
            row(id: "sf1", round: "SF", winner: "b"),
            row(id: "f1", round: "F", winner: "a"),
            row(id: "ws-f", event: "Pro Women's Singles", winner: "b"),
        ])
        #expect(output.total == 3)
        #expect(output.events.map(\.key) == [.womensSingles, .mensDoubles])
        #expect(output.events[1].rounds.map(\.code) == ["F", "SF"])
        #expect(ProResultsLogic.playersLine(output.events[1].champion ?? []) == "Alex Smith / Ben Jones")
    }

    @Test func flagsVietnameseNamesAndCountsMatches() {
        let output = ProResultsLogic.group([row(id: "vn")])
        let match = output.events[0].rounds[0].matches[0]
        #expect(match.hasVietnamesePlayer)
        #expect(match.teamB.allSatisfy { $0.isVietnamese })
        #expect(!match.teamA.contains { $0.isVietnamese })
        #expect(output.vietnamCount == 1)
    }

    @Test func removesOnlyTrailingTemplateZeroGame() {
        let match = ProResultsLogic.group([
            row(id: "g", a: [11, 11, 0], b: [7, 9, 0])
        ]).events[0].rounds[0].matches[0]
        #expect(match.scoreLine == "11-7, 11-9")
    }

    @Test func preservesSingleRealLoveGame() {
        let match = ProResultsLogic.group([
            row(id: "love", a: [0], b: [11])
        ]).events[0].rounds[0].matches[0]
        #expect(match.scoreLine == "0-11")
    }

    @Test func keepsOnlyProDrawsWhenAnyExist() {
        let output = ProResultsLogic.group([
            row(id: "pro"), row(id: "am", event: "Men's Doubles 4.0")
        ])
        #expect(output.total == 1)
        #expect(output.events.first?.name == "Pro Men's Doubles")
    }

    @Test func keepsAllDrawsWhenNoProLabelExists() {
        let output = ProResultsLogic.group([
            row(id: "a", event: "Men's Doubles"),
            row(id: "b", event: "Women's Doubles"),
        ])
        #expect(output.total == 2)
    }

    @Test func skipsEmptyByeButKeepsOneSidedBye() {
        let oneSide = [participant("a", 1, "Alex Smith")]
        let output = ProResultsLogic.group([
            row(id: "empty", participants: []),
            row(id: "one-side", participants: oneSide),
        ])
        #expect(output.total == 1)
        #expect(output.events[0].rounds[0].matches[0].id == "one-side")
    }

    @Test func emptySearchReturnsSameValue() {
        let grouped = ProResultsLogic.group([row(id: "a")])
        #expect(ProResultsLogic.filter(grouped, query: "  ") == grouped)
    }

    @Test func searchFoldsVietnameseAndRecounts() {
        let grouped = ProResultsLogic.group([
            row(id: "md"),
            row(
                id: "ws",
                event: "Pro Women's Singles",
                participants: [participant("a", 1, "Anna Leigh Waters"), participant("b", 1, "Sophia Nhi Huỳnh")]
            ),
        ])
        let truong = ProResultsLogic.filter(grouped, query: "truong")
        #expect(truong.total == 1)
        #expect(truong.vietnamCount == 1)
        #expect(ProResultsLogic.filter(grouped, query: "HUYNH").total == 1)
    }

    @Test func searchCanReturnEmptyTree() {
        let output = ProResultsLogic.filter(
            ProResultsLogic.group([row(id: "a")]),
            query: "nguyen-khong-ton-tai"
        )
        #expect(output.total == 0)
        #expect(output.events.isEmpty)
    }

    @Test func liveNoteRequiresNoWinnerAndSortsFirst() {
        let output = ProResultsLogic.group([
            row(id: "done", round: "SF", winner: "a", playedAt: "2026-09-09T01:00:00Z"),
            row(id: "on", round: "SF", winner: nil, playedAt: "2026-09-09T09:00:00Z", notes: "{\"live\":true}"),
            row(id: "won", round: "SF", winner: "a", notes: "{\"live\":true}"),
        ])
        let matches = output.events[0].rounds[0].matches
        #expect(matches.first?.id == "on")
        #expect(matches.first?.isLive == true)
        #expect(matches.first(where: { $0.id == "won" })?.isLive == false)
    }

    @Test func collectsLiveAcrossEventsWithLocalizedLabels() {
        let output = ProResultsLogic.group([
            row(id: "on1", winner: nil, notes: "{\"live\":true}"),
            row(id: "on2", event: "Pro Women's Singles", round: "SF", winner: nil, notes: "{\"live\":true}"),
            row(id: "done"),
        ])
        let labels = Set(ProResultsLogic.liveMatches(output, language: "vi").map(\.eventLabel))
        #expect(labels == Set(["Đôi nam", "Đơn nữ"]))
    }

    @Test func qualifierDrawGetsUniqueHeading() {
        let output = ProResultsLogic.group([
            row(id: "main"),
            row(id: "q", event: "Pro Men's Doubles Qualifier", round: "W", winner: nil),
        ])
        #expect(output.events.map(\.labelVI).sorted() == ["Đôi nam", "Đôi nam — Vòng loại"])
    }

    @Test func eventWindowUsesUTCPlusEightAndVisibilityMargins() {
        let event = fixtureEvent(start: "2026-09-09", end: "2026-09-13")
        let formatter = ISO8601DateFormatter()
        #expect(event.phase(at: formatter.date(from: "2026-09-08T16:00:00Z")!) == .live)
        #expect(event.shouldAppearOnLive(at: formatter.date(from: "2026-09-02T16:00:00Z")!))
        #expect(event.shouldAppearOnLive(at: formatter.date(from: "2026-09-27T15:59:59Z")!))
        #expect(!event.shouldAppearOnLive(at: formatter.date(from: "2026-09-27T16:00:00Z")!))
    }

    private func fixtureEvent(start: String, end: String) -> ProTourEvent {
        ProTourEvent(
            slug: "test", namePattern: "%Test%", nameEN: "Test", nameVI: "Thử nghiệm",
            tier: "PPA 1000", tour: "PPA Asia", sponsor: nil, city: "Kuala Lumpur",
            country: "Malaysia", countryCode: "MY", venue: nil, startDate: start,
            endDate: end, officialURL: "https://example.com", bracketsURL: "https://example.com",
            prizeMoney: nil, logoURL: nil, brandBackground: nil
        )
    }
}
