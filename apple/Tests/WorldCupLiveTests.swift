import Foundation
import Testing
@testable import ThePickleHub

@Suite("World Cup live contract")
struct WorldCupLiveTests {
    @Test("Pro rows decode games and expose the current scoreboard")
    func proDecoding() throws {
        let data = Data(#"{"match_id":"m1","category_id":"pro_singles_mens","division_name":"Pro","round_name":"Quarterfinal","round_num":4,"match_index":10,"entry_a_name":"Lý Hoàng Nam","entry_a_seed":1,"entry_b_name":"Player B","entry_b_seed":8,"current_a":8,"current_b":5,"games_json":[{"a":11,"b":7}],"serving_side":"A","leader_side":"A","status":"in_progress","is_vietnam":true,"venue_name":"Tiên Sơn","court_label":"Court 1","scheduled_at":null,"last_seen_at":"2026-08-31T12:00:00Z"}"#.utf8)
        let match = try decoder().decode(WorldCupProMatch.self, from: data)

        #expect(match.categoryID == .mensSingles)
        #expect(match.isLive)
        #expect(match.visibleScore.a == "8")
        #expect(match.visibleScore.b == "5")
        #expect(match.gameLine == "11–7")
        #expect(match.sideAIsVietnamese)
        #expect(!match.sideBIsVietnamese)
    }

    @Test("Vietnamese-name emphasis matches the web heuristic")
    func vietnameseNameHeuristic() {
        #expect(WorldCupProMatch.isVietnameseName("Dương Thiên Quang"))
        #expect(WorldCupProMatch.isVietnameseName("Nguyen Viet Hoang"))
        #expect(!WorldCupProMatch.isVietnameseName("William Sobek"))
        #expect(!WorldCupProMatch.isVietnameseName("García Malbrán"))
    }

    @Test("A finished game remains visible when the current score is absent")
    func finishedScoreFallback() throws {
        let data = Data(#"{"match_id":"m2","category_id":"pro_mixed","division_name":null,"round_name":"Final","round_num":6,"match_index":20,"entry_a_name":"A / B","entry_a_seed":null,"entry_b_name":"C / D","entry_b_seed":null,"current_a":null,"current_b":null,"games_json":[{"a":11,"b":9},{"a":7,"b":11},{"a":11,"b":6}],"serving_side":null,"leader_side":"A","status":"completed","is_vietnam":false,"venue_name":null,"court_label":null,"scheduled_at":null,"last_seen_at":"2026-08-31T12:00:00Z"}"#.utf8)
        let match = try decoder().decode(WorldCupProMatch.self, from: data)

        #expect(match.visibleScore.a == "11")
        #expect(match.visibleScore.b == "6")
        #expect(match.gameLine == "11–9  ·  7–11  ·  11–6")
    }

    @Test("Vietnam's national-team group is promoted ahead of the draw")
    func vietnamGroupFirst() {
        let vietnam = WorldCupOpenTeam(slug: "viet_nam", groupLetter: "A", seed: 1, nameVI: "Việt Nam", nameEN: "Vietnam", countryCode: "VN")
        let canada = WorldCupOpenTeam(slug: "canada", groupLetter: "A", seed: 2, nameVI: "Canada", nameEN: "Canada", countryCode: "CA")
        let japan = WorldCupOpenTeam(slug: "japan", groupLetter: "B", seed: 1, nameVI: "Nhật Bản", nameEN: "Japan", countryCode: "JP")

        let feed = WorldCupLiveFeed.build(proMatches: [], teams: [japan, canada, vietnam], openMatches: [])

        #expect(feed.groups.map(\.letter) == ["A", "B"])
        #expect(feed.groups.first?.containsVietnam == true)
        #expect(feed.groups.first?.teams.map(\.slug) == ["viet_nam", "canada"])
    }

    @Test("Every Pro match appears in its event with live first")
    func eventFiltering() throws {
        let live = try match(id: "live", status: "in_progress", vietnam: false)
        let vietnam = try match(id: "vn", status: "completed", vietnam: true)
        let unrelated = try match(id: "other", status: "completed", vietnam: false)
        let feed = WorldCupLiveFeed(proMatches: [live, vietnam, unrelated], groups: [])

        #expect(feed.liveCount == 1)
        #expect(feed.matches(for: .mensSingles).map(\.matchID) == ["live", "other", "vn"])
    }

    @Test("Athlete search ignores Vietnamese accents and letter case")
    func athleteSearch() throws {
        let vietnamese = try match(id: "quang", status: "completed", vietnam: true, entryA: "Dương Thiên Quang")
        let international = try match(id: "sobek", status: "completed", vietnam: false, entryA: "William Sobek")
        let feed = WorldCupLiveFeed(proMatches: [international, vietnamese], groups: [])

        #expect(feed.matches(for: .mensSingles, athleteQuery: "duong thien").map(\.matchID) == ["quang"])
        #expect(feed.matches(for: .mensSingles, athleteQuery: "SOBEK").map(\.matchID) == ["sobek"])
        #expect(feed.matches(for: .mensSingles, athleteQuery: "  ").count == 2)
    }

    @Test("Today's results use Vietnam time and exclude older results")
    func todayResults() throws {
        let today = try match(id: "today", status: "completed", vietnam: false, seenAt: "2026-08-31T12:00:00Z")
        let yesterday = try match(id: "yesterday", status: "completed", vietnam: false, seenAt: "2026-08-30T12:00:00Z")
        let live = try match(id: "live", status: "in_progress", vietnam: false, seenAt: "2026-08-31T13:00:00Z")
        let feed = WorldCupLiveFeed(proMatches: [today, yesterday, live], groups: [])
        let now = try #require(ISO8601DateFormatter().date(from: "2026-08-31T14:00:00Z"))

        #expect(feed.resultsToday(now: now).map(\.matchID) == ["today"])
    }

    private func match(
        id: String,
        status: String,
        vietnam: Bool,
        seenAt: String = "2026-08-31T12:00:00Z",
        entryA: String = "A"
    ) throws -> WorldCupProMatch {
        let json = """
        {"match_id":"\(id)","category_id":"pro_singles_mens","division_name":null,"round_name":null,"round_num":null,"match_index":null,"entry_a_name":"\(entryA)","entry_a_seed":null,"entry_b_name":"B","entry_b_seed":null,"current_a":0,"current_b":0,"games_json":[],"serving_side":null,"leader_side":null,"status":"\(status)","is_vietnam":\(vietnam),"venue_name":null,"court_label":null,"scheduled_at":null,"last_seen_at":"\(seenAt)"}
        """
        return try decoder().decode(WorldCupProMatch.self, from: Data(json.utf8))
    }

    private func decoder() -> JSONDecoder {
        let value = JSONDecoder()
        value.dateDecodingStrategy = .iso8601
        return value
    }
}
