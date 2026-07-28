import Foundation

/// A multi-event tournament that groups several Quick Tables under one public link.
struct ParentTournament: Decodable, Identifiable, Equatable, Hashable {
    let id: UUID
    let creatorUserID: UUID
    let name: String
    let description: String?
    let bannerURL: String?
    let eventDate: String?
    let location: String?
    let shareID: String
    let isFeatured: Bool
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, name, description, location
        case creatorUserID = "creator_user_id"
        case bannerURL = "banner_url"
        case eventDate = "event_date"
        case shareID = "share_id"
        case isFeatured = "is_featured"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// Lightweight Quick Table row shown inside a parent tournament.
struct ParentTournamentEvent: Decodable, Identifiable, Equatable, Hashable {
    let id: UUID
    let shareID: String
    let name: String?
    let status: String?
    let format: String?
    let isDoubles: Bool?
    let playerCount: Int?
    let createdAt: String?
    let parentTournamentID: UUID?

    var displayName: String { name?.nonEmpty ?? String(localized: "Nội dung thi đấu") }
    var statusLabel: String {
        switch status {
        case "setup": String(localized: "Đang chuẩn bị")
        case "registration": String(localized: "Đang đăng ký")
        case "group_stage": "Vòng bảng"
        case "playoff": "Playoff"
        case "completed": String(localized: "Đã kết thúc")
        default: status ?? "—"
        }
    }
    var formatLabel: String {
        if isDoubles == true { return format == "large_playoff" ? String(localized: "Đôi · playoff") : String(localized: "Đôi · vòng bảng") }
        return format == "large_playoff" ? String(localized: "Đơn · playoff") : String(localized: "Đơn · vòng bảng")
    }

    enum CodingKeys: String, CodingKey {
        case id, name, status, format
        case shareID = "share_id"
        case isDoubles = "is_doubles"
        case playerCount = "player_count"
        case createdAt = "created_at"
        case parentTournamentID = "parent_tournament_id"
    }
}

struct ParentTournamentDetail: Equatable {
    let tournament: ParentTournament
    let events: [ParentTournamentEvent]
}
