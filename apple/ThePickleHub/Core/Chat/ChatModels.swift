import Foundation

/// One live-chat line. Server columns are snake_case; `pending`/`failed` are
/// client-only optimistic flags (defaulted, so Decodable ignores them).
struct ChatMessage: Decodable, Identifiable, Equatable {
    let id: String
    let livestreamID: String
    let userID: String
    let displayName: String
    let avatarURL: String?
    let message: String
    let createdAt: String
    var clientMessageID: String?

    var pending: Bool = false
    var failed: Bool = false

    enum CodingKeys: String, CodingKey {
        case id
        case livestreamID   = "livestream_id"
        case userID         = "user_id"
        case displayName    = "display_name"
        case avatarURL      = "avatar_url"
        case message
        case createdAt      = "created_at"
        case clientMessageID = "client_message_id"
    }
}

/// Per-room chat controls (moderator-owned). Absent row ⇒ enabled, no slow mode.
struct ChatSettings: Decodable, Equatable {
    let livestreamID: String
    var isChatEnabled: Bool
    var slowModeSeconds: Int

    enum CodingKeys: String, CodingKey {
        case livestreamID   = "livestream_id"
        case isChatEnabled  = "is_chat_enabled"
        case slowModeSeconds = "slow_mode_seconds"
    }

    static func defaultFor(_ id: String) -> ChatSettings {
        ChatSettings(livestreamID: id, isChatEnabled: true, slowModeSeconds: 0)
    }
}

/// An active mute for a user in a room.
struct ChatMute: Decodable, Equatable {
    let id: String
    let userID: String
    let mutedUntil: String

    enum CodingKeys: String, CodingKey {
        case id
        case userID     = "user_id"
        case mutedUntil = "muted_until"
    }

    var isActive: Bool {
        guard let until = FeedDate.parse(mutedUntil) else { return false }
        return until > Date()
    }
}

/// A row from the `get_chat_leaderboard` RPC — most active chatters.
struct ChatLeaderboardEntry: Decodable, Identifiable {
    let userID: String
    let displayName: String
    let avatarURL: String?
    let messageCount: Int
    let rank: Int

    var id: String { userID }

    enum CodingKeys: String, CodingKey {
        case userID       = "user_id"
        case displayName  = "display_name"
        case avatarURL    = "avatar_url"
        case messageCount = "message_count"
        case rank
    }
}
