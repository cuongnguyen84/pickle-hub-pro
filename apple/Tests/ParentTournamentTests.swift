import Foundation
import Testing
@testable import ThePickleHub

struct ParentTournamentTests {
    @Test func decodesProductionSnakeCaseShape() throws {
        let id = "10000000-0000-4000-8000-000000000001"
        let owner = "20000000-0000-4000-8000-000000000002"
        let json = """
        {
          "id": "\(id)",
          "creator_user_id": "\(owner)",
          "name": "Giải hè",
          "description": "Ba nội dung",
          "banner_url": "banners/summer.jpg",
          "event_date": "2026-08-01",
          "location": "TP.HCM",
          "share_id": "summer26",
          "is_featured": true,
          "created_at": "2026-07-23T00:00:00Z",
          "updated_at": "2026-07-23T01:00:00Z"
        }
        """

        let value = try JSONDecoder().decode(ParentTournament.self, from: Data(json.utf8))
        #expect(value.id.uuidString.lowercased() == id)
        #expect(value.creatorUserID.uuidString.lowercased() == owner)
        #expect(value.shareID == "summer26")
        #expect(value.isFeatured)
        #expect(value.bannerURL == "banners/summer.jpg")
    }

    @Test func eventLabelsReflectFormatAndStatus() throws {
        let json = """
        {
          "id": "30000000-0000-4000-8000-000000000003",
          "share_id": "women-double",
          "name": "Đôi nữ",
          "status": "playoff",
          "format": "large_playoff",
          "is_doubles": true,
          "player_count": 24,
          "created_at": null,
          "parent_tournament_id": "10000000-0000-4000-8000-000000000001"
        }
        """

        let value = try JSONDecoder().decode(ParentTournamentEvent.self, from: Data(json.utf8))
        #expect(value.statusLabel == "Playoff")
        // Assert qua String(localized:) cùng key — chạy được ở mọi -testLanguage.
        #expect(value.formatLabel == String(localized: "Đôi · playoff"))
        #expect(value.displayName == "Đôi nữ")
    }
}
