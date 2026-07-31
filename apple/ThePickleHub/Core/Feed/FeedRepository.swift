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
            .select("id, title, summary, source, image_url, language, slug, published_at, ai_translated")
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

    /// Complete rewritten article for the native reader. The query remains on
    /// the public editorial fields and never requests the protected origin URL.
    func newsDetail(slug: String, language: String) async throws -> NewsArticleDetail? {
        let rows: [NewsArticleDetail] = try await client
            .from("news_items")
            .select("title, summary, content_html, image_url, source, language, category, published_at, ai_translated")
            .eq("slug", value: slug)
            .eq("language", value: language)
            .eq("status", value: "published")
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    /// Admin-curated + auto-ingested Instagram reels (feed_embeds), scored
    /// client-side and merged like news. Mirrors `useFeedEmbeds.ts`.
    func embeds() async throws -> [FeedItem] {
        let windowStart = ISO8601DateFormatter().string(from: Date().addingTimeInterval(-30 * 24 * 60 * 60))
        let rows: [FeedEmbedRow] = try await client
            .from("feed_embeds")
            .select("id, url, caption, author_name, thumbnail_url, published_at")
            .eq("is_active", value: true)
            .gte("published_at", value: windowStart)
            .order("published_at", ascending: false)
            .limit(20)
            .execute()
            .value
        let now = Date()
        return rows.compactMap { FeedItem(embed: $0, now: now) }
    }

    /// System-generated highlight cards (feed_highlights: milestones, weekly
    /// movers, pro digests, AI recaps). Mirrors `useFeedHighlights.ts`.
    func highlights() async throws -> [FeedItem] {
        let windowStart = ISO8601DateFormatter().string(from: Date().addingTimeInterval(-14 * 24 * 60 * 60))
        let rows: [FeedHighlightRow] = try await client
            .from("feed_highlights")
            .select("id, kind, title_vi, body_vi, href, published_at")
            .eq("is_active", value: true)
            .gte("published_at", value: windowStart)
            .order("published_at", ascending: false)
            .limit(20)
            .execute()
            .value
        let now = Date()
        return rows.map { FeedItem(highlight: $0, now: now) }
    }

    /// Live platform activity: live streams, open-registration tournaments,
    /// upcoming social events. Mirrors `useFeedHappenings.ts`; failures in one
    /// source never sink the others.
    func happenings() async -> [FeedItem] {
        struct LiveRow: Decodable {
            let id: UUID
            let title: String
            let startedAt: String?
            enum CodingKeys: String, CodingKey {
                case id, title
                case startedAt = "started_at"
            }
        }
        struct TournamentRow: Decodable {
            let id: UUID
            let name: String
            let shareID: String
            let teamCount: Int
            let updatedAt: String
            enum CodingKeys: String, CodingKey {
                case id, name
                case shareID = "share_id"
                case teamCount = "team_count"
                case updatedAt = "updated_at"
            }
        }
        struct EventRow: Decodable {
            let id: UUID
            let slug: String
            let titleVi: String?
            let startAt: String
            let locationText: String?
            let maxPlayers: Int?
            enum CodingKeys: String, CodingKey {
                case id, slug
                case titleVi = "title_vi"
                case startAt = "start_at"
                case locationText = "location_text"
                case maxPlayers = "max_players"
            }
        }

        let now = Date()
        var items: [FeedItem] = []

        async let liveRows: [LiveRow]? = try? client
            .from("livestreams")
            .select("id, title, started_at")
            .eq("status", value: "live")
            .order("started_at", ascending: false)
            .limit(3)
            .execute()
            .value
        async let tournamentRows: [TournamentRow]? = try? client
            .from("doubles_elimination_tournaments")
            .select("id, name, share_id, team_count, updated_at")
            .eq("status", value: "registration_open")
            .order("updated_at", ascending: false)
            .limit(5)
            .execute()
            .value
        async let eventRows: [EventRow]? = try? client
            .from("social_events")
            .select("id, slug, title_vi, start_at, location_text, max_players")
            .eq("status", value: "published")
            .eq("visibility", value: "public")
            .gt("start_at", value: ISO8601DateFormatter().string(from: now))
            .order("start_at", ascending: true)
            .limit(5)
            .execute()
            .value

        for row in await liveRows ?? [] {
            let date = row.startedAt.flatMap(FeedDate.parse) ?? now
            let happening = FeedHappening(
                kind: .live,
                title: row.title,
                meta: String(localized: "Đang phát trực tiếp — bấm để xem"),
                url: WebRoutes.live(id: row.id)
            )
            items.append(FeedItem(id: row.id, happening: happening, publishedAt: date, now: now))
        }
        for row in await tournamentRows ?? [] {
            let happening = FeedHappening(
                kind: .tournament,
                title: row.name.trimmingCharacters(in: .whitespaces),
                meta: String(localized: "Đang mở đăng ký · tối đa \(row.teamCount) đội"),
                url: WebRoutes.toolsDoublesEliminationView(shareID: row.shareID)
            )
            items.append(FeedItem(id: row.id, happening: happening, publishedAt: FeedDate.parse(row.updatedAt), now: now))
        }
        for row in await eventRows ?? [] {
            guard let title = row.titleVi?.nonEmpty else { continue }
            let start = FeedDate.parse(row.startAt)
            var meta = start.map { $0.formatted(.dateTime.weekday(.abbreviated).day().month().hour().minute()) } ?? ""
            if let location = row.locationText?.nonEmpty { meta += " · \(location)" }
            if let cap = row.maxPlayers { meta += String(localized: " · \(cap) chỗ") }
            let happening = FeedHappening(
                kind: .event,
                title: title,
                meta: meta,
                url: WebRoutes.social(slug: row.slug)
            )
            // Future start date → age 0 → no decay until the event begins.
            items.append(FeedItem(id: row.id, happening: happening, publishedAt: start, now: now))
        }
        return items
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
