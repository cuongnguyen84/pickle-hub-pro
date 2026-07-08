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

    /// Live + scheduled broadcasts for the homepage live section. Scheduled
    /// streams must always surface at the top of Home (mirrors web Index.tsx).
    func liveStreams() async throws -> [LivestreamSummary] {
        try await client
            .from("public_livestreams")
            .select("id, title, status, thumbnail_url, mux_playback_id, scheduled_start_at, organization:organizations(name)")
            .in("status", values: ["live", "scheduled"])
            .order("scheduled_start_at", ascending: true)
            .execute()
            .value
    }

    /// Luồng vừa kết thúc (≤7 ngày) cho mục "Vừa kết thúc" trên Home — kèm
    /// mux_asset_playback_id/vod/hls để phát lại được trong LiveWatchScreen.
    func recentEndedStreams(limit: Int = 4) async throws -> [LivestreamSummary] {
        let cutoff = ISO8601DateFormatter().string(from: Date().addingTimeInterval(-7 * 86_400))
        return try await client
            .from("public_livestreams")
            .select("id, title, status, thumbnail_url, mux_playback_id, mux_asset_playback_id, scheduled_start_at, ended_at, vod_url, hls_url, organization:organizations(name)")
            .eq("status", value: "ended")
            .gte("ended_at", value: cutoff)
            .order("ended_at", ascending: false)
            .limit(limit)
            .execute()
            .value
    }
}

