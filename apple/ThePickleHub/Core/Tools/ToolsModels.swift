import Foundation

/// A recent public Quick Table (round-robin → playoff) bracket.
struct QuickTableSummary: Decodable, Identifiable, Equatable {
    let id: UUID
    let shareID: String
    let name: String?
    let isDoubles: Bool?
    let playerCount: Int?
    let status: String?

    var displayName: String { name?.nonEmpty ?? "Giải đấu" }

    var statusLabel: String {
        switch status {
        case "setup": return "Đang mở"
        case "registration": return "Mở đăng ký"
        case "group_stage": return "Vòng bảng"
        case "playoff": return "Playoff"
        case "completed": return "Đã xong"
        default: return status ?? "—"
        }
    }

    var isOngoing: Bool { status == "group_stage" || status == "playoff" }

    var subtitle: String {
        let mode = (isDoubles ?? false) ? "Đôi" : "Đơn"
        if let count = playerCount { return "\(mode) · \(count) người" }
        return mode
    }

    enum CodingKeys: String, CodingKey {
        case id, name, status
        case shareID = "share_id"
        case isDoubles = "is_doubles"
        case playerCount = "player_count"
    }
}
