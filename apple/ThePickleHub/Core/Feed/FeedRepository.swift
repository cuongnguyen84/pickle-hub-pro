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
}
