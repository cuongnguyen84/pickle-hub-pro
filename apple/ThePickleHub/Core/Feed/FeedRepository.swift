import Foundation
import Supabase

/// Reads the scored, mixed timeline from the `get_feed_timeline` RPC.
/// Keyset pagination on `(score DESC, item_id DESC)`; pass the previous page's
/// last cursor to fetch the next page.
struct FeedRepository {
    private var client: SupabaseClient { SupabaseManager.shared.client }

    static let pageSize = 20

    /// Optional params are omitted when nil (synthesized `encodeIfPresent`),
    /// so the RPC falls back to its `DEFAULT NULL` arguments on the first page
    /// and for anonymous viewers.
    private struct Params: Encodable {
        let p_limit: Int
        let p_cursor_score: Double?
        let p_cursor_item_id: String?
        let p_viewer_id: String?
    }

    func page(cursor: FeedCursor?) async throws -> [FeedItem] {
        let viewerID = try? await client.auth.session.user.id
        let params = Params(
            p_limit: Self.pageSize,
            p_cursor_score: cursor?.score,
            p_cursor_item_id: cursor?.itemID.uuidString,
            p_viewer_id: viewerID?.uuidString
        )
        let rows: [FeedRow] = try await client
            .rpc("get_feed_timeline", params: params)
            .execute()
            .value
        return rows.compactMap(FeedItem.init(row:))
    }

    /// Recent published news for the viewer's language, scored client-side and
    /// merged into the timeline by the view model. Mirrors `useFeedNews.ts`:
    /// status=published, last 30 days, newest first, capped at 30.
    func news(language: String = "vi") async throws -> [FeedItem] {
        let windowStart = ISO8601DateFormatter().string(from: Date().addingTimeInterval(-30 * 24 * 60 * 60))
        let rows: [FeedNewsRow] = try await client
            .from("news_items")
            .select("id, title, summary, source, source_url, image_url, language, slug, published_at, ai_translated")
            .eq("status", value: "published")
            .eq("language", value: language)
            .gte("published_at", value: windowStart)
            .order("published_at", ascending: false)
            .limit(30)
            .execute()
            .value
        let now = Date()
        return rows.compactMap { FeedItem(news: $0, now: now) }
    }

    /// Fetch a single video's playable URL (Mux HLS or storage file) so a feed
    /// video card can play natively via AVPlayer instead of opening the web page.
    func videoPlayback(id: UUID) async -> (url: URL, title: String)? {
        struct Row: Decodable {
            let title: String?
            let muxPlaybackID: String?
            let storagePath: String?
            enum CodingKeys: String, CodingKey {
                case title
                case muxPlaybackID = "mux_playback_id"
                case storagePath = "storage_path"
            }
            var playbackURL: URL? {
                if let mux = muxPlaybackID?.nonEmpty { return URL(string: "https://stream.mux.com/\(mux).m3u8") }
                if let path = storagePath?.nonEmpty {
                    return AppConfig.supabaseURL.appending(path: "storage/v1/object/public/videos/\(path)")
                }
                return nil
            }
        }
        guard let row: Row = try? await client
            .from("videos").select("title, mux_playback_id, storage_path")
            .eq("id", value: id).single().execute().value,
              let url = row.playbackURL else { return nil }
        return (url, row.title?.nonEmpty ?? "Video")
    }
}
