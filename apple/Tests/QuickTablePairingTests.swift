import Foundation
import Testing
@testable import ThePickleHub

struct QuickTablePairingTests {
    @Test func decodesIncomingRequestWithJoinedPlayer() throws {
        let json = """
        {
          "id": "10000000-0000-4000-8000-000000000001",
          "table_id": "20000000-0000-4000-8000-000000000002",
          "from_team_id": "30000000-0000-4000-8000-000000000003",
          "to_team_id": "40000000-0000-4000-8000-000000000004",
          "from_user_id": "50000000-0000-4000-8000-000000000005",
          "to_user_id": "60000000-0000-4000-8000-000000000006",
          "status": "pending",
          "created_at": "2026-07-23T00:00:00Z",
          "responded_at": null,
          "from_team": {
            "player1_display_name": "An",
            "player1_team": "CLB Quận 1"
          }
        }
        """

        let request = try JSONDecoder().decode(QTPairRequest.self, from: Data(json.utf8))
        #expect(request.status == "pending")
        #expect(request.fromTeam?.player1DisplayName == "An")
        #expect(request.fromTeam?.player1Team == "CLB Quận 1")
        #expect(request.toTeam == nil)
    }

    @Test func decodesOutgoingRequestWithJoinedTarget() throws {
        let json = """
        {
          "id": "70000000-0000-4000-8000-000000000007",
          "table_id": "20000000-0000-4000-8000-000000000002",
          "from_team_id": "30000000-0000-4000-8000-000000000003",
          "to_team_id": "40000000-0000-4000-8000-000000000004",
          "from_user_id": "50000000-0000-4000-8000-000000000005",
          "to_user_id": "60000000-0000-4000-8000-000000000006",
          "status": "pending",
          "created_at": "2026-07-23T00:00:00Z",
          "responded_at": null,
          "to_team": {
            "player1_display_name": "Bình",
            "player1_team": null
          }
        }
        """

        let request = try JSONDecoder().decode(QTPairRequest.self, from: Data(json.utf8))
        #expect(request.toTeam?.player1DisplayName == "Bình")
        #expect(request.toTeam?.player1Team == nil)
        #expect(request.fromTeam == nil)
    }
}
