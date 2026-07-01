import Foundation

/// A `forum_categories` row.
struct ForumCategory: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let nameEN: String?
    let slug: String
    let displayOrder: Int?
    enum CodingKeys: String, CodingKey {
        case id, name, slug
        case nameEN = "name_en"
        case displayOrder = "display_order"
    }
}

/// A `forum_posts` row. Author/category display fields are enriched after fetch
/// (web joins via get_public_profiles RPC) so they're excluded from CodingKeys.
struct ForumPost: Decodable, Identifiable, Equatable {
    let id: String
    let userID: String
    let categoryID: String?
    let title: String
    let content: String
    let imageURLs: [String]?
    let tags: [String]?
    let isPinned: Bool
    let isQA: Bool
    let likeCount: Int
    let commentCount: Int
    let createdAt: String
    let updatedAt: String?
    // enriched (not part of select("*"))
    var authorName: String?
    var authorAvatar: String?
    var categoryName: String?
    var categorySlug: String?

    enum CodingKeys: String, CodingKey {
        case id, title, content, tags
        case userID = "user_id"
        case categoryID = "category_id"
        case imageURLs = "image_urls"
        case isPinned = "is_pinned"
        case isQA = "is_qa"
        case likeCount = "like_count"
        case commentCount = "comment_count"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// A `forum_comments` row (flat list with parent-quote for replies).
struct ForumComment: Decodable, Identifiable, Equatable {
    let id: String
    let postID: String
    let userID: String
    let parentID: String?
    let content: String
    let imageURLs: [String]?
    let isBestAnswer: Bool
    let likeCount: Int
    let createdAt: String
    // enriched
    var authorName: String?
    var authorAvatar: String?
    var parentAuthorName: String?
    var parentContent: String?

    enum CodingKeys: String, CodingKey {
        case id, content
        case postID = "post_id"
        case userID = "user_id"
        case parentID = "parent_id"
        case imageURLs = "image_urls"
        case isBestAnswer = "is_best_answer"
        case likeCount = "like_count"
        case createdAt = "created_at"
    }
}
