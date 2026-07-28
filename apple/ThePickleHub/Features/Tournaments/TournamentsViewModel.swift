import Foundation
import Observation

/// Backs the native `/tournaments` screen: a **Watch** tab (pro events + live
/// broadcasts, ordered ongoing → upcoming → ended) and a **Community** tab
/// (public brackets across the 4 formats). Default tab mirrors the web:
/// Community unless there's pro/live "watch" content.
@Observable
@MainActor
final class TournamentsViewModel {
    enum Phase: Equatable { case loading, loaded, failed(String) }
    enum Tab: Hashable { case watch, community }
    /// Web /tournaments status sub-tabs (UX-08): ongoing = active + open-reg,
    /// ended = completed.
    enum CommunityStatus: Hashable { case ongoing, ended }

    private(set) var phase: Phase = .loading
    private(set) var tournaments: [Tournament] = []      // Watch (pro)
    private(set) var community: [MyTournament] = []       // Community
    /// nil = not fetched yet ("Đã kết thúc" loads lazily on first switch).
    private(set) var communityEnded: [MyTournament]?
    private(set) var liveCount = 0

    /// User's explicit choice; nil ⇒ use the default rule.
    var userTab: Tab?

    /// Community filters — client-side over the fetched lists (web parity:
    /// format tabs + ongoing/ended sub-tabs on /tournaments).
    var communityFormat: BracketFormat?
    var communityStatus: CommunityStatus = .ongoing

    var filteredCommunity: [MyTournament] {
        Self.filter(communityStatus == .ongoing ? community : (communityEnded ?? []),
                    format: communityFormat)
    }

    var endedLoading: Bool { communityStatus == .ended && communityEnded == nil }

    /// Pure filter — nil format = all. Split out for tests.
    static func filter(_ list: [MyTournament], format: BracketFormat?) -> [MyTournament] {
        guard let format else { return list }
        return list.filter { $0.format == format }
    }

    @MainActor
    func loadEndedIfNeeded() async {
        guard communityEnded == nil else { return }
        communityEnded = await communityRepo.completedCommunity()
    }

    private let repo = TournamentsRepository()
    private let live = HomeRepository()
    private let communityRepo = CommunityRepository()

    // Default to Watch only when there's live creator content — scraped pro-tour
    // events (often all finished) must NOT force the Watch tab. ponytail: liveCount
    // only; add ongoing-pro check here if we ever want upcoming pro to default too.
    var hasWatchContent: Bool { liveCount > 0 }
    var tab: Tab { userTab ?? (hasWatchContent ? .watch : .community) }
    var communityCount: Int { community.count }

    @MainActor
    func load() async {
        phase = .loading
        async let proTask = try? repo.list()
        async let liveTask = try? live.liveStreams()
        async let communityTask = communityRepo.activeCommunity()

        let pro = (await proTask ?? []).sorted { lhs, rhs in
            if lhs.kind.priority != rhs.kind.priority { return lhs.kind.priority < rhs.kind.priority }
            return (lhs.startDate ?? "") > (rhs.startDate ?? "")
        }
        tournaments = pro
        liveCount = (await liveTask ?? []).count
        community = await communityTask
        // Refresh the ended list only if the user already opened it.
        if communityEnded != nil {
            communityEnded = await communityRepo.completedCommunity()
        }
        phase = .loaded
    }
}
