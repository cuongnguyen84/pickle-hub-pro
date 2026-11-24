import Foundation
import Observation

/// Drives the `/feed`-equivalent Trending timeline: first load, keyset
/// pagination of the RPC stream, one-time overlays (news, embeds,
/// highlights, happenings, and — for admins in this phase — community
/// photo posts) merged by pure recency, and pull-to-refresh. Dedupes by
/// item id so overlapping pages never double-render.
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
    /// Site-admin flag, loaded on each reset. In this phase community
    /// photo posts join the feed for admins only — the same gate the web
    /// applies (PR-A) — and the composer button keys off it too.
    private(set) var isAdmin = false

    private let repo = FeedRepository()
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
        // Pure recency (PR #1111 parity): a refresh simply re-reads the
        // sources, so genuinely new content lands on top — no viewed
        // demotion or jitter like the old score model had.
        await fetch(reset: true)
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
            isAdmin = await TournamentService.shared.isCurrentUserAdmin()
            // Overlays (like the web): fetched once per refresh, never
            // advancing the RPC cursor — news, IG reels, happenings
            // (live/tournament/event), system highlights, and community
            // photo posts (admins only in this phase, as on the web).
            async let news = (try? repo.news()) ?? []
            async let embeds = (try? repo.embeds()) ?? []
            async let highlights = (try? repo.highlights()) ?? []
            async let happenings = repo.happenings()
            async let posts = isAdmin ? (try? repo.socialPosts()) ?? [] : []
            overlayItems = await news + embeds + highlights + happenings + posts
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

    /// Merge the paginated RPC items with the overlays, ordered by pure
    /// recency (`FeedRecency`) — the ordering the web feed adopted in
    /// PR #1111: newest first on one shared timestamp, no type bonuses,
    /// no engagement or viewed adjustments. The RPC stream keeps its
    /// server-side keyset pagination; only the final merged order is
    /// recency.
    private func rebuild() {
        let rpcIDs = Set(rpcItems.map(\.id))
        var merged = rpcItems
        merged.append(contentsOf: overlayItems.filter { !rpcIDs.contains($0.id) })
        items = FeedRecency.sorted(merged, now: Date())
    }
}
