import Foundation
import Observation

/// Drives the `/feed`-equivalent Trending timeline: first load, keyset
/// pagination of the RPC stream, a one-time news overlay merged by score, and
/// pull-to-refresh. Dedupes by item id so overlapping pages never double-render.
@Observable
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

    private let repo = FeedRepository()
    private var cursor: FeedCursor?
    private var rpcItems: [FeedItem] = []
    private var newsItems: [FeedItem] = []
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
            // News is a static overlay (like the web): fetched once per refresh,
            // never advancing the RPC cursor.
            newsItems = (try? await repo.news()) ?? []
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

    /// Merge the paginated RPC items with the news overlay, sorted by score
    /// (recency tiebreak) — the same ordering the web Trending feed produces.
    private func rebuild() {
        let rpcIDs = Set(rpcItems.map(\.id))
        var merged = rpcItems
        merged.append(contentsOf: newsItems.filter { !rpcIDs.contains($0.id) })
        merged.sort { lhs, rhs in
            if lhs.score != rhs.score { return lhs.score > rhs.score }
            return (lhs.publishedAt ?? .distantPast) > (rhs.publishedAt ?? .distantPast)
        }
        items = merged
    }
}
