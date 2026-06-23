import Foundation
import Observation

/// Drives the `/feed`-equivalent timeline: first load, keyset pagination, and
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

    /// Called as the last few rows appear; fetches the next page once.
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
        }
        do {
            let page = try await repo.page(cursor: cursor)
            if reset {
                items = []
                seen.removeAll()
            }
            let fresh = page.filter { seen.insert($0.id).inserted }
            items.append(contentsOf: fresh)
            cursor = page.last?.cursor
            if page.count < FeedRepository.pageSize { reachedEnd = true }
            phase = .loaded
        } catch {
            if reset { phase = .failed(error.localizedDescription) }
            // a failed "load more" keeps the existing list; the row spinner clears
        }
    }
}
