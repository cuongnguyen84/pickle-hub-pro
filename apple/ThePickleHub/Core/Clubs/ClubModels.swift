import Foundation

// Native models for clubs (web `/clubs`, `/clb/:slug`). Faithful port of the
// `club_listing` view + `clubs`/`club_members`/`club_matches` shapes.

struct ClubListItem: Decodable, Identifiable, Equatable {
    let id: UUID
    let slug: String
    let name: String
    let description: String?
    let logoURL: String?
    let locationText: String?
    let createdBy: UUID?
    let upcomingEvents: Int?
    let creatorDisplayName: String?
    let creatorUsername: String?

    var initials: String {
        let words = name.split(separator: " ").prefix(2)
        let chars = words.compactMap { $0.first }.map { String($0).uppercased() }
        return chars.joined().nonEmpty ?? "?"
    }
    var logoURLResolved: URL? { logoURL?.nonEmpty.flatMap { WebRoutes.asset($0) } }

    enum CodingKeys: String, CodingKey {
        case id, slug, name, description
        case logoURL = "logo_url"
        case locationText = "location_text"
        case createdBy = "created_by"
        case upcomingEvents = "upcoming_events"
        case creatorDisplayName = "creator_display_name"
        case creatorUsername = "creator_username"
    }
}

/// Full `clubs` row for the detail page.
struct Club: Decodable, Identifiable, Equatable {
    let id: UUID
    let slug: String
    let name: String
    let description: String?
    let logoURL: String?
    let locationText: String?
    let createdBy: UUID?

    var initials: String {
        let words = name.split(separator: " ").prefix(2)
        return words.compactMap { $0.first }.map { String($0).uppercased() }.joined().nonEmpty ?? "?"
    }
    var logoURLResolved: URL? { logoURL?.nonEmpty.flatMap { WebRoutes.asset($0) } }

    enum CodingKeys: String, CodingKey {
        case id, slug, name, description
        case logoURL = "logo_url"
        case locationText = "location_text"
        case createdBy = "created_by"
    }
}

/// One upcoming/past event of a club.
struct ClubEvent: Decodable, Identifiable, Equatable {
    let id: UUID
    let slug: String
    let titleVi: String
    let titleEn: String?
    let startAt: String?
    let endAt: String?
    let locationText: String?
    let maxPlayers: Int?
    let priceVnd: Int?
    let status: String?

    var title: String { titleVi.nonEmpty ?? titleEn?.nonEmpty ?? "Sự kiện" }
    var startDate: Date? { startAt.flatMap { SocialDate.parse($0) } }

    enum CodingKeys: String, CodingKey {
        case id, slug, status
        case titleVi = "title_vi"
        case titleEn = "title_en"
        case startAt = "start_at"
        case endAt = "end_at"
        case locationText = "location_text"
        case maxPlayers = "max_players"
        case priceVnd = "price_vnd"
    }
}

/// A logged club match (from `list_club_matches` RPC).
struct ClubMatch: Decodable, Identifiable, Equatable {
    let id: UUID
    let slug: String?
    let playedAt: String?
    let format: String
    let teamAScore: [Int]
    let teamBScore: [Int]
    let winningTeam: String?
    let readyForDupr: Bool
    let submittedToDupr: Bool
    let teamAPlayers: [ClubMatchPlayer]
    let teamBPlayers: [ClubMatchPlayer]

    var formatLabel: String {
        switch format {
        case "singles": return "ĐƠN"
        case "doubles": return "ĐÔI"
        case "mixed": return "ĐÔI NAM NỮ"
        default: return format.uppercased()
        }
    }
    /// draft → "NHÁP", ready → "SẴN SÀNG GỬI", submitted → "ĐÃ GỬI DUPR".
    enum DuprState { case draft, ready, submitted }
    var duprState: DuprState { submittedToDupr ? .submitted : (readyForDupr ? .ready : .draft) }
    var teamALabel: String { teamAPlayers.map { $0.displayName ?? "—" }.joined(separator: " / ") }
    var teamBLabel: String { teamBPlayers.map { $0.displayName ?? "—" }.joined(separator: " / ") }
    var playedDate: Date? { playedAt.flatMap { SocialDate.parse($0) } }

    enum CodingKeys: String, CodingKey {
        case id, slug, format
        case playedAt = "played_at"
        case teamAScore = "team_a_score"
        case teamBScore = "team_b_score"
        case winningTeam = "winning_team"
        case readyForDupr = "ready_for_dupr"
        case submittedToDupr = "submitted_to_dupr"
        case teamAPlayers = "team_a_players"
        case teamBPlayers = "team_b_players"
    }
}

struct ClubMatchPlayer: Decodable, Equatable {
    let profileID: UUID?
    let displayName: String?
    let position: Int?
    enum CodingKeys: String, CodingKey {
        case profileID = "profile_id"
        case displayName = "display_name"
        case position
    }
}

/// A club member row (from `list_club_members` RPC).
struct ClubMember: Decodable, Identifiable, Equatable {
    let profileID: UUID
    let displayName: String?
    let avatarURL: String?
    let status: String
    let duprDoubles: Double?
    let duprSingles: Double?

    var id: UUID { profileID }
    var name: String { displayName?.nonEmpty ?? "Thành viên" }
    var initials: String {
        let words = name.split(separator: " ").prefix(2)
        return words.compactMap { $0.first }.map { String($0).uppercased() }.joined().nonEmpty ?? "?"
    }

    enum CodingKeys: String, CodingKey {
        case profileID = "profile_id"
        case displayName = "display_name"
        case avatarURL = "avatar_url"
        case status
        case duprDoubles = "dupr_doubles"
        case duprSingles = "dupr_singles"
    }
}

/// Membership state machine (web `my_club_membership_status`).
enum ClubMembership: String {
    case anonymous, none, pending, active, manager, creator

    var isMember: Bool { self == .active || self == .manager || self == .creator }
    var canManage: Bool { self == .manager || self == .creator }
}
