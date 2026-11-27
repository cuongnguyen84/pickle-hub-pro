import Foundation
import Observation
import Supabase

/// Drives the `/feed`-equivalent Trending timeline: first load, keyset
/// pagination of the RPC stream, one-time overlays (news, embeds,
/// highlights, happenings, blogs, and community photo posts) merged by
/// pure recency, and pull-to-refresh. Dedupes by item id so
/// overlapping pages never double-render. Ordering finishes with the
/// seen partition (web PR #1124): items already seen at load sink
/// below the unseen, using the frozen at-load snapshot.
@Observable
@MainActor
final class FeedViewModel {
    enum Phase: Equatable {
        case loading
        case loaded
        case failed(String)
    }

    private(set) var phase: Phase = .loading
    private(set) var items: [FeedItem] = []
    private(set) var isLoadingMore = false
    private(set) var reachedEnd = false
    /// Signed-in flag, loaded on each reset. The composer button keys
    /// off it - posting opened to every signed-in user on 2026-11-25
    /// (mirroring the web). Community posts themselves are public:
    /// guests read approved posts too (web #1131), so the posts
    /// overlay loads for everyone. The moderation queue stays the
    /// safety net for new authors.
    private(set) var isSignedIn = false
    /// The signed-in user's id, loaded with `isSignedIn` on each reset.
    /// The engagement thread uses it to mark the viewer's own comments
    /// (delete action) without another session lookup per card.
    private(set) var currentUserID: UUID?

    private let repo = FeedRepository()
    private let viewedTracker = FeedViewedTracker()
    private var cursor: FeedCursor?
    private var rpcItems: [FeedItem] = []
    private var overlayItems: [FeedItem] = []
    private var seen = Set<UUID>()

    @MainActor
    func loadInitial() async {
        guard items.isEmpty else { return }
        phase = .loading
        await fetch(reset: true)
    }

    @MainActor
    func refresh() async {
        await fetch(reset: true)
    }

    /// Marks a card as seen when it actually appears on screen (the
    /// web marks on viewport entry). The mark persists for the NEXT
    /// load; the current list never re-orders mid-visit because the
    /// partition reads the frozen at-load snapshot.
    @MainActor
    func markViewed(_ item: FeedItem) {
        viewedTracker.markViewed(item)
    }

    /// Called as the last few rows appear; fetches the next RPC page once.
    @MainActor
    func loadMoreIfNeeded(currentItem item: FeedItem) async {
        guard !isLoadingMore, !reachedEnd, phase == .loaded else { return }
        let threshold = items.index(items.endIndex, offsetBy: -5, limitedBy: items.startIndex) ?? items.startIndex
        guard let idx = items.firstIndex(where: { $0.id == item.id }), idx >= threshold else { return }
        isLoadingMore = true
        await fetch(reset: false)
        isLoadingMore = false
    }

    @MainActor
    private func fetch(reset: Bool) async {
        if reset {
            cursor = nil
            reachedEnd = false
            isSignedIn = (try? await SupabaseManager.shared.client.auth.session) != nil
            currentUserID = try? await SupabaseManager.shared.client.auth.session.user.id
            // Overlays (like the web): fetched once per refresh, never
            // advancing the RPC cursor — news, IG reels, happenings
            // (live/tournament/event), system highlights, the 30 newest
            // blog posts (PR #1126) and community photo posts (public:
            // approved posts read for guests too, PR #1131).
            async let news = (try? repo.news()) ?? []
            async let embeds = (try? repo.embeds()) ?? []
            async let highlights = (try? repo.highlights()) ?? []
            async let happenings = repo.happenings()
            async let blogs = (try? repo.blogs()) ?? []
            async let posts = (try? repo.socialPosts()) ?? []
            overlayItems = await news + embeds + highlights + happenings + blogs + posts
        }
        do {
            let page = try await repo.page(cursor: cursor)
            if reset {
                rpcItems = []
                seen.removeAll()
            }
            let fresh = page.filter { seen.insert($0.id).inserted }
            rpcItems.append(contentsOf: fresh)
            cursor = page.last?.cursor
            if page.count < FeedRepository.pageSize { reachedEnd = true }
            rebuild()
            phase = .loaded
        } catch {
            if reset { phase = .failed(error.localizedDescription) }
            // a failed "load more" keeps the existing list; the row spinner clears
        }
    }

    /// Merge the paginated RPC items with the overlays, ordered by
    /// pure recency (`FeedRecency`) — the ordering the web feed
    /// adopted in PR #1111: newest first on one shared timestamp, no
    /// type bonuses. The seen partition (PR #1124) then sinks items
    /// that were already seen when this visit loaded below the
    /// unseen, each group keeping its recency order; a seen match
    /// whose engagement grew since its mark revives into the unseen
    /// group. The RPC stream keeps its server-side keyset pagination;
    /// only the final merged order is computed here.
    private func rebuild() {
        let rpcIDs = Set(rpcItems.map(\.id))
        var merged = rpcItems
        merged.append(contentsOf: overlayItems.filter { !rpcIDs.contains($0.id) })
        let sorted = FeedRecency.sorted(merged, now: Date())
        items = FeedSeenPartition.applied(to: sorted, entriesAtLoad: viewedTracker.entriesAtLoad)
    }
}
