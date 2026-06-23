import Foundation

/// A row from the `profiles` table (only the fields the rating card needs).
struct Profile: Decodable, Identifiable, Equatable {
    let id: UUID
    let username: String?
    let displayName: String?
    let avatarURL: String?
    let duprSingles: Double?
    let duprDoubles: Double?
    // Public-profile gate fields — present only when fetching another player's
    // profile (own-profile fetch omits them, so they decode as nil).
    let bio: String?
    let city: String?
    let isGhost: Bool?
    let isPublicProfile: Bool?
    let isPro: Bool?
    let isVerified: Bool?

    enum CodingKeys: String, CodingKey {
        case id
        case username
        case displayName = "display_name"
        case avatarURL = "avatar_url"
        case duprSingles = "dupr_singles"
        case duprDoubles = "dupr_doubles"
        case bio
        case city
        case isGhost = "is_ghost"
        case isPublicProfile = "is_public_profile"
        case isPro = "is_pro"
        case isVerified = "is_verified"
    }

    var resolvedDisplayName: String {
        displayName?.trimmingCharacters(in: .whitespaces).nilIfEmpty
            ?? username?.nilIfEmpty
            ?? "—"
    }

    var resolvedUsername: String {
        username?.nilIfEmpty ?? "—"
    }

    var isUnrated: Bool { duprSingles == nil && duprDoubles == nil }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
