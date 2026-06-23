import Foundation
import Supabase

/// Loads the data-backed homepage sections that aren't already covered by other
/// repositories (news → FeedRepository, upcoming → TournamentsRepository).
struct HomeRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    /// "Tuần này" feature stories — newest published VI blog posts.
    func featuredPosts(limit: Int = 6) async throws -> [BlogPostSummary] {
        try await client
            .from("vi_blog_posts")
            .select("id, slug, title, excerpt, cover_image_url, category, tags, published_at")
            .eq("status", value: "published")
            .order("published_at", ascending: false)
            .limit(limit)
            .execute()
            .value
    }

    /// Headline stats row (tournaments + players).
    func stats() async throws -> HomeStats? {
        let rows: [HomeStats] = try await client
            .rpc("get_homepage_stats")
            .execute()
            .value
        return rows.first
    }
}
