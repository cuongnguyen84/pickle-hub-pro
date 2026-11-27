import Foundation
import Testing
@testable import ThePickleHub

// Profile redesign port (PR-N4, twin of web #1134/#1135/#1137-#1139):
// the generated-cover palette, the verified-seal geometry, and the
// pill tab visibility/default rules. All pure - data paths run on the
// same tables and RPCs the web uses.

struct ProfileRedesignTests {

    // MARK: - CoverPalette

    @Test func coverPaletteIsDeterministic() {
        #expect(CoverPalette.hash("thecuong-685w") == CoverPalette.hash("thecuong-685w"))
        let first = CoverPalette.pair(for: "thecuong-685w")
        let second = CoverPalette.pair(for: "thecuong-685w")
        #expect(first.from == second.from)
        #expect(first.to == second.to)
    }

    @Test func coverPaletteMatchesTheWebHash() {
        // JS: h = (h * 31 + code) >>> 0 over UTF-16 units, index h % 6.
        // "a": h = 97 -> 97 % 6 = 1 -> palette (0x10243E, 0x2F7FD0).
        #expect(CoverPalette.hash("a") == 97)
        #expect(CoverPalette.hash("ab") == 97 * 31 + 98)
        let pair = CoverPalette.palettes[Int(CoverPalette.hash("a") % 6)]
        #expect(pair.from == 0x10243E)
        #expect(pair.to == 0x2F7FD0)
    }

    @Test func coverPaletteWrapsLikeJSUnsigned() {
        // A long seed overflows UInt32 exactly like JS `>>> 0` wraps.
        let seed = String(repeating: "pickleball-", count: 40)
        var expected: UInt64 = 0
        for unit in seed.utf16 {
            expected = (expected * 31 + UInt64(unit)) & 0xFFFF_FFFF
        }
        #expect(CoverPalette.hash(seed) == UInt32(expected))
    }

    // MARK: - VerifiedSealShape geometry (constants from the web SVG)

    @Test func sealEndpointsMatchTheSVGPath() {
        // The web path starts at (3.85, 8.62) - the endpoint at 202.5
        // degrees - and its next vertex is (8.63, 3.85) at 247.5.
        let start = VerifiedSealShape.endpoint(atDegrees: 202.5)
        #expect(abs(start.x - 3.85) < 0.05)
        #expect(abs(start.y - 8.62) < 0.05)
        let next = VerifiedSealShape.endpoint(atDegrees: 247.5)
        #expect(abs(next.x - 8.63) < 0.05)
        #expect(abs(next.y - 3.85) < 0.05)
    }

    @Test func sealScallopCentersSitOnTheArcCircles() {
        // Every endpoint must lie on its scallop's circle (radius 4),
        // or the rendered ring would not close smoothly.
        for index in 0..<8 {
            let mid = 225.0 + 45.0 * Double(index)
            let scallop = VerifiedSealShape.scallopCenter(atDegrees: mid)
            for endpoint in [VerifiedSealShape.endpoint(atDegrees: mid - 22.5),
                             VerifiedSealShape.endpoint(atDegrees: mid + 22.5)] {
                let distance = hypot(endpoint.x - scallop.x, endpoint.y - scallop.y)
                #expect(abs(distance - 4) < 0.05)
            }
        }
    }

    // MARK: - ProfileTabLogic

    @Test func tabsHidePostsForStrangersWithoutPosts() {
        let tabs = ProfileTabLogic.visibleTabs(isOwn: false, postsTotal: 0, hasAthlete: false)
        #expect(tabs == [.matches, .tournaments])
    }

    @Test func tabsShowPostsForOwnerAndAuthors() {
        #expect(ProfileTabLogic.visibleTabs(isOwn: true, postsTotal: 0, hasAthlete: false).first == .posts)
        #expect(ProfileTabLogic.visibleTabs(isOwn: false, postsTotal: 3, hasAthlete: false).first == .posts)
        #expect(ProfileTabLogic.visibleTabs(isOwn: false, postsTotal: nil, hasAthlete: false).first == .posts)
    }

    @Test func tabsGateAchievementsOnAthleteData() {
        #expect(!ProfileTabLogic.visibleTabs(isOwn: false, postsTotal: 0, hasAthlete: false).contains(.achievements))
        #expect(ProfileTabLogic.visibleTabs(isOwn: false, postsTotal: 0, hasAthlete: true).contains(.achievements))
    }

    @Test func defaultTabFollowsTheWebRule() {
        // Athlete -> Matches; otherwise Posts when visible; else Matches.
        #expect(ProfileTabLogic.defaultTab(isOwn: false, postsTotal: 5, hasAthlete: true) == .matches)
        #expect(ProfileTabLogic.defaultTab(isOwn: false, postsTotal: 5, hasAthlete: false) == .posts)
        #expect(ProfileTabLogic.defaultTab(isOwn: false, postsTotal: 0, hasAthlete: false) == .matches)
        #expect(ProfileTabLogic.defaultTab(isOwn: true, postsTotal: 0, hasAthlete: false) == .posts)
    }

    // MARK: - Match history row decoding (shape verified live 2026-11-25)

    @Test func matchHistoryRowDecodes() throws {
        let json = """
        {
          "match_id": "5c16d3e1-d7c0-44bd-8a2a-171bc2d2bc47",
          "slug": "clb-thanh-dong-pickleball-ffbfdb73",
          "played_at": "2026-06-02T06:51:00+00:00",
          "format": "singles",
          "match_type": "rec",
          "venue_name": null,
          "team_a_score": [15],
          "team_b_score": [13],
          "winning_team": "a",
          "player_team": "b",
          "player_won": false,
          "participants": [
            {"team": "a", "is_ghost": false, "username": "tapickleball", "player_id": "5d3284cb-fe10-46b1-bc9a-16b3b3fd228d", "avatar_url": null, "display_name": "TA Pickleball"},
            {"team": "b", "is_ghost": false, "username": "thecuong-685w", "player_id": "5040f0f2-f564-401c-9737-4b030b6371d7", "avatar_url": null, "display_name": "Admin"}
          ]
        }
        """
        let row = try JSONDecoder().decode(PlayerMatchHistoryRow.self, from: Data(json.utf8))
        #expect(row.playerWon == false)
        #expect(row.playerTeam == "b")
        #expect(row.teamAScore == [15])
        #expect(row.participants.count == 2)
    }
}
