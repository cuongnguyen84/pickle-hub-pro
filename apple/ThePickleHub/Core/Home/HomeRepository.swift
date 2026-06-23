import Foundation
import Supabase

/// Loads the data-backed homepage sections that aren't already covered by other
/// repositories (news → FeedRepository, upcoming → TournamentsRepository).
struct HomeRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    /// Full body of a single published VI blog post, for the native reader.
    func post(slug: String) async throws -> BlogPostDetail? {
        let rows: [BlogPostDetail] = try await client
            .from("vi_blog_posts")
            .select("title, content_html, cover_image_url, category, published_at")
            .eq("slug", value: slug)
            .eq("status", value: "published")
            .limit(1)
            .execute()
            .value
        return rows.first
    }

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

    /// "Sân đấu" highlight videos — newest published.
    func highlightVideos(limit: Int = 6) async throws -> [VideoSummary] {
        try await client
            .from("videos")
            .select("id, title, thumbnail_url, mux_playback_id, storage_path, duration_seconds, published_at, type, organization:organizations(name)")
            .eq("status", value: "published")
            .order("published_at", ascending: false)
            .limit(limit)
            .execute()
            .value
    }

    /// Currently-live broadcasts for the homepage live section.
    func liveStreams() async throws -> [LivestreamSummary] {
        try await client
            .from("public_livestreams")
            .select("id, title, thumbnail_url, mux_playback_id, scheduled_start_at, organization:organizations(name)")
            .eq("status", value: "live")
            .order("scheduled_start_at", ascending: true)
            .execute()
            .value
    }
}

