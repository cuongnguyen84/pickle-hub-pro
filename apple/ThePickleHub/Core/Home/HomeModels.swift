import Foundation

/// A published Vietnamese blog post, as shown in the homepage "Tuần này"
/// feature feed. Mirrors `usePublishedViBlogPosts()` (vi_blog_posts).
struct BlogPostSummary: Decodable, Identifiable, Equatable {
    let id: UUID
    let slug: String
    let title: String
    let excerpt: String?
    let coverImageURL: String?
    let category: String?
    let tags: [String]?
    let publishedAt: String?

    /// Badge label: category, else first tag.
    var tag: String? { category?.nonEmpty ?? tags?.first?.nonEmpty }

    enum CodingKeys: String, CodingKey {
        case id, slug, title, excerpt, category, tags
        case coverImageURL = "cover_image_url"
        case publishedAt = "published_at"
    }
}

/// Full body of a VI blog post for the native reader.
struct BlogPostDetail: Decodable, Equatable {
    let title: String
    let contentHtml: String
    let coverImageURL: String?
    let category: String?
    let publishedAt: String?

    enum CodingKeys: String, CodingKey {
        case title, category
        case contentHtml = "content_html"
        case coverImageURL = "cover_image_url"
        case publishedAt = "published_at"
    }
}

/// Headline numbers from the `get_homepage_stats` RPC.
struct HomeStats: Decodable, Equatable {
    let totalTournaments: Int
    let totalUsers: Int

    enum CodingKeys: String, CodingKey {
        case totalTournaments = "total_tournaments"
        case totalUsers = "total_users"
    }

    /// "1,816" grouped with thousands separators.
    static func grouped(_ value: Int) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.groupingSeparator = ","
        return f.string(from: NSNumber(value: value)) ?? "\(value)"
    }
}
