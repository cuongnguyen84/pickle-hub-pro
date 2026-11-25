import Foundation

/// Pure recency ordering for the merged native feed — the twin of the
/// web `sortFeedByRecency` in `src/lib/social/feed-ranking.ts` (PR #1111).
/// One shared timestamp per item, newest first; no type bonuses, no
/// engagement multiplier, no viewed demotion, no jitter. This replaces
/// the pre-#1111 score ordering the native feed used to mirror.
enum FeedRecency {

    /// The timestamp an item competes with: a live happening counts as
    /// happening right now; everything else uses `rankedAt ?? publishedAt`.
    /// Match RPCs set rankedAt to played_at, so a backfill cannot outrank
    /// a match that was played later. Unparseable timestamps fall back to
    /// the distant past. Future timestamps (upcoming events) clamp to
    /// `now`, so nothing unstarted can outrank breaking items by more
    /// than arriving first.
    static func timestamp(for item: FeedItem, now: Date) -> Date {
        if case .happening(let happening) = item.kind, happening.kind == .live {
            return now
        }
        let raw = item.rankedAt ?? item.publishedAt ?? .distantPast
        return min(raw, now)
    }

    static func isLive(_ item: FeedItem) -> Bool {
        if case .happening(let happening) = item.kind { return happening.kind == .live }
        return false
    }

    /// Newest first. Ties break toward live happenings, then toward the
    /// larger id (the web tie-breaks on cursor_id DESC), so the order is
    /// total and stable across refreshes. Does not mutate the input.
    static func sorted(_ items: [FeedItem], now: Date) -> [FeedItem] {
        items.sorted { lhs, rhs in
            let l = timestamp(for: lhs, now: now)
            let r = timestamp(for: rhs, now: now)
            if l != r { return l > r }
            let lLive = isLive(lhs)
            let rLive = isLive(rhs)
            if lLive != rLive { return lLive }
            return lhs.id.uuidString > rhs.id.uuidString
        }
    }
}
