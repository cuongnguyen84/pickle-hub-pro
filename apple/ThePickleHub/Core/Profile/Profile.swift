import Foundation

/// A row from the `profiles` table (only the fields the rating card needs).
struct Profile: Decodable, Identifiable, Equatable {
    let id: UUID
    let username: String?
    let displayName: String?
    let avatarURL: String?
    let duprSingles: Double?
    let duprDoubles: Double?

    enum CodingKeys: String, CodingKey {
        case id
        case username
        case displayName = "display_name"
        case avatarURL = "avatar_url"
        case duprSingles = "dupr_singles"
        case duprDoubles = "dupr_doubles"
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
