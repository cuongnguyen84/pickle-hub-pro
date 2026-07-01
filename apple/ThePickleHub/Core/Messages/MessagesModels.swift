import Foundation

/// One row from the `my_conversations` RPC (inbox).
struct DMConversation: Decodable, Identifiable, Equatable {
    let conversationID: String
    let otherID: String
    let otherUsername: String?
    let otherName: String?
    let otherAvatar: String?
    let lastBody: String?
    let lastAt: String?
    let unreadCount: Int

    var id: String { conversationID }
    var title: String { otherName?.nonEmpty ?? otherUsername?.nonEmpty ?? "Trò chuyện" }

    enum CodingKeys: String, CodingKey {
        case conversationID = "conversation_id"
        case otherID = "other_id"
        case otherUsername = "other_username"
        case otherName = "other_name"
        case otherAvatar = "other_avatar"
        case lastBody = "last_body"
        case lastAt = "last_at"
        case unreadCount = "unread_count"
    }
}

/// A `messages` row within a thread.
struct DMMessage: Decodable, Identifiable, Equatable {
    let id: String
    let conversationID: String
    let senderID: String
    let body: String
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, body
        case conversationID = "conversation_id"
        case senderID = "sender_id"
        case createdAt = "created_at"
    }
}
