import Foundation

/// A row from the `dupr_leaderboard_vietnam` RPC — the live Vietnam DUPR
/// leaderboard. Mirrors `VietnamRankingRow` in useVietnamRankings.ts.
struct RankingRow: Decodable, Identifiable, Equatable {
    let rank: Int
    let userID: UUID
    let username: String
    let displayName: String?
    let avatarURL: String?
    let city: String?
    let duprRating: Double
    let duprSyncedAt: String?

    var id: UUID { userID }

    var resolvedName: String {
        displayName?.trimmingCharacters(in: .whitespaces).nonEmpty ?? username
    }

    var ratingText: String { String(format: "%.3f", duprRating) }

    var rankText: String { String(format: "%02d", rank) }

    /// DUPR not synced in over 30 days — shown with a stale marker, like the web.
    var isStale: Bool {
        guard let synced = duprSyncedAt, let date = FeedDate.parse(synced) else { return false }
        return Date().timeIntervalSince(date) > 30 * 24 * 60 * 60
    }

    enum CodingKeys: String, CodingKey {
        case rank
        case userID = "user_id"
        case username
        case displayName = "display_name"
        case avatarURL = "avatar_url"
        case city
        case duprRating = "dupr_rating"
        case duprSyncedAt = "dupr_synced_at"
    }
}
