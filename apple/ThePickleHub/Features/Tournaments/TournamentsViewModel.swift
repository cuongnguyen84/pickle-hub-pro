import Foundation
import Observation

/// Backs the native `/tournaments` screen: a **Watch** tab (pro events + live
/// broadcasts, ordered ongoing → upcoming → ended) and a **Community** tab
/// (public brackets across the 4 formats). Default tab mirrors the web:
/// Community unless there's pro/live "watch" content.
@Observable
final class TournamentsViewModel {
    enum Phase: Equatable { case loading, loaded, failed(String) }
    enum Tab: Hashable { case watch, community }

    private(set) var phase: Phase = .loading
    private(set) var tournaments: [Tournament] = []      // Watch (pro)
    private(set) var community: [MyTournament] = []       // Community
    private(set) var liveCount = 0

    /// User's explicit choice; nil ⇒ use the default rule.
    var userTab: Tab?

    private let repo = TournamentsRepository()
    private let live = HomeRepository()
    private let communityRepo = CommunityRepository()

    var hasWatchContent: Bool { !tournaments.isEmpty || liveCount > 0 }
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
        phase = .loaded
    }
}
