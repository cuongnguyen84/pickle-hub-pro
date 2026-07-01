import Foundation

/// A `play_requests` row (open-play "tìm kèo" board) + its joined author/venue.
/// Backing tables are not in the generated types; native decodes them directly.
struct PlayRequest: Decodable, Identifiable, Equatable {
    let id: String
    let authorID: String
    let city: String?
    let district: String?
    let venueID: String?
    let skillMin: Double?
    let skillMax: Double?
    let playAt: String?
    let note: String
    let status: String
    let createdAt: String?
    let author: Author?
    let venue: Venue?

    struct Author: Decodable, Equatable {
        let username: String?
        let displayName: String?
        let avatarURL: String?
        let profileSlug: String?
        enum CodingKeys: String, CodingKey {
            case username
            case displayName = "display_name"
            case avatarURL = "avatar_url"
            case profileSlug = "profile_slug"
        }
    }
    struct Venue: Decodable, Equatable {
        let slug: String
        let name: String
    }

    var authorName: String {
        author?.displayName?.nonEmpty ?? author?.username?.nonEmpty ?? "Người chơi"
    }
    var authorUsername: String? { author?.username?.nonEmpty }

    /// "2.5–3", "4+", or nil (matches web number formatting: trailing .0 dropped).
    var skillRange: String? {
        guard let mn = skillMin else { return nil }
        func f(_ v: Double) -> String { v.truncatingRemainder(dividingBy: 1) == 0 ? String(Int(v)) : String(v) }
        if let mx = skillMax { return "\(f(mn))–\(f(mx))" }
        return "\(f(mn))+"
    }

    var location: String? {
        [district, city].compactMap { $0?.nonEmpty }.joined(separator: ", ").nonEmpty
    }

    enum CodingKeys: String, CodingKey {
        case id, city, district, note, status, author, venue
        case authorID = "author_id"
        case venueID = "venue_id"
        case skillMin = "skill_min"
        case skillMax = "skill_max"
        case playAt = "play_at"
        case createdAt = "created_at"
    }
}

/// Skill bands for the post form — mirror of web `BANDS`.
struct SkillBand: Identifiable, Equatable {
    let key: String; let label: String; let min: Double; let max: Double
    var id: String { key }
    static let all: [SkillBand] = [
        .init(key: "u2.5", label: "< 2.5", min: 0, max: 2.5),
        .init(key: "2.5", label: "2.5 – 3.0", min: 2.5, max: 3.0),
        .init(key: "3.0", label: "3.0 – 3.5", min: 3.0, max: 3.5),
        .init(key: "3.5", label: "3.5 – 4.0", min: 3.5, max: 4.0),
        .init(key: "4.0", label: "4.0+", min: 4.0, max: 99),
    ]
}
