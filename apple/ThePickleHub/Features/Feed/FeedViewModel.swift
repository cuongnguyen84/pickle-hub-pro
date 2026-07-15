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
    private var overlayItems: [FeedItem] = []
    private var seen = Set<UUID>()
    // Pull-to-refresh phải cho nội dung MỚI thay vì lặp lại đúng thứ tự cũ
    // (web làm bằng session shuffle + viewed tracking): item đã hiện ở các
    // lần trước bị giáng điểm, cộng jitter theo salt đổi mỗi lần refresh.
    private var shownIDs = Set<UUID>()
    private var refreshSalt: UInt64 = .random(in: .min ... .max)

    @MainActor
    func loadInitial() async {
        guard items.isEmpty else { return }
        phase = .loading
        await fetch(reset: true)
    }

    @MainActor
    func refresh() async {
        // Những gì đang trên màn hình coi như đã xem → lần này tụt xuống dưới.
        shownIDs.formUnion(items.prefix(12).map(\.id))
        if shownIDs.count > 400 { shownIDs.removeAll() } // ponytail: reset thô khi phình
        refreshSalt = .random(in: .min ... .max)
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
            // Overlays (like the web): fetched once per refresh, never
            // advancing the RPC cursor — news, IG reels, happenings
            // (live/tournament/event), and system highlights.
            async let news = (try? repo.news()) ?? []
            async let embeds = (try? repo.embeds()) ?? []
            async let highlights = (try? repo.highlights()) ?? []
            async let happenings = repo.happenings()
            overlayItems = await news + embeds + highlights + happenings
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

    /// Merge the paginated RPC items with the overlays, sorted by score
    /// (recency tiebreak) — the same ordering the web Trending feed produces,
    /// điều chỉnh bởi shown-penalty + refresh jitter để mỗi lần refresh nổi
    /// nội dung khác lên đầu. Salt cố định giữa các trang load-more nên thứ
    /// tự không nhảy trong lúc cuộn.
    private func rebuild() {
        let rpcIDs = Set(rpcItems.map(\.id))
        var merged = rpcItems
        merged.append(contentsOf: overlayItems.filter { !rpcIDs.contains($0.id) })
        merged.sort { lhs, rhs in
            let l = effectiveScore(lhs)
            let r = effectiveScore(rhs)
            if l != r { return l > r }
            return (lhs.publishedAt ?? .distantPast) > (rhs.publishedAt ?? .distantPast)
        }
        items = merged
    }

    private func effectiveScore(_ item: FeedItem) -> Double {
        var score = item.score
        if shownIDs.contains(item.id) { score *= 0.55 } // đã xem → nhường chỗ
        var hasher = Hasher()
        hasher.combine(item.id)
        hasher.combine(refreshSalt)
        // hash → jitter 0.85–1.15, ổn định trong 1 lần refresh.
        let unit = Double(UInt64(bitPattern: Int64(hasher.finalize()))) / Double(UInt64.max)
        return score * (0.85 + unit * 0.3)
    }
}
