import Foundation
import Supabase

/// Reads livestreams (live / scheduled / replays) and highlight videos for the
/// native Live tab. Mirrors web `useLivestreamData` / `useVideoData`.
struct LiveRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    private static let streamColumns =
        "id, title, thumbnail_url, mux_playback_id, scheduled_start_at, ended_at, status, vod_url, hls_url, organization:organizations(name)"
    private static let videoColumns =
        "id, title, thumbnail_url, mux_playback_id, storage_path, duration_seconds, published_at, type, organization:organizations(name)"

    /// Live now + upcoming, soonest first.
    func liveAndUpcoming(limit: Int = 24) async throws -> [LivestreamSummary] {
        try await client
            .from("public_livestreams")
            .select(Self.streamColumns)
            .in("status", values: ["live", "scheduled"])
            .order("scheduled_start_at", ascending: true)
            .limit(limit)
            .execute()
            .value
    }

    /// Ended streams with a playable recording, most recent first.
    func replays(limit: Int = 24) async throws -> [LivestreamSummary] {
        let rows: [LivestreamSummary] = try await client
            .from("public_livestreams")
            .select(Self.streamColumns)
            .eq("status", value: "ended")
            .order("ended_at", ascending: false)
            .limit(limit)
            .execute()
            .value
        // Only keep replays that can actually play.
        return rows.filter { $0.playbackURL != nil }
    }

    /// Published highlight videos, newest first.
    func videos(limit: Int = 48) async throws -> [VideoSummary] {
        try await client
            .from("videos")
            .select(Self.videoColumns)
            .eq("status", value: "published")
            .order("published_at", ascending: false)
            .limit(limit)
            .execute()
            .value
    }
}
