import Foundation
import Observation

/// Loads the homepage's data-backed sections concurrently. Each source fails
/// soft (a missing section just renders empty) so one slow query never blanks
/// the whole page.
@Observable
final class HomeViewModel {
    private(set) var posts: [BlogPostSummary] = []
    private(set) var news: [FeedItem] = []      // .news items, with publishedAt
    private(set) var stats: HomeStats?
    private(set) var videos: [VideoSummary] = []
    private(set) var upcoming: [Tournament] = []
    private(set) var live: [LivestreamSummary] = []
    private(set) var tickers: [TickerItem] = []
    private(set) var loaded = false

    private let home = HomeRepository()
    private let feed = FeedRepository()
    private let tournaments = TournamentsRepository()

    @MainActor
    func load() async {
        async let postsTask = try? home.featuredPosts()
        async let newsTask = try? feed.news()
        async let statsTask = try? home.stats()
        async let videosTask = try? home.highlightVideos()
        async let tournamentsTask = try? tournaments.list()
        async let liveTask = try? home.liveStreams()
        async let feedTask = try? feed.page(cursor: nil)

        posts = await postsTask ?? []
        news = Array((await newsTask ?? []).prefix(4))
        stats = await statsTask ?? nil
        videos = await videosTask ?? []
        upcoming = upcomingFrom(await tournamentsTask ?? [])
        live = await liveTask ?? []
        tickers = Array((await feedTask ?? []).compactMap(TickerItem.from).prefix(8))
        loaded = true
    }

    /// Not-ended tournaments, earliest first, top 5 — the web "Sắp diễn ra" set.
    private func upcomingFrom(_ all: [Tournament]) -> [Tournament] {
        all.filter { $0.kind != .ended }
            .sorted { ($0.startDate ?? "9999") < ($1.startDate ?? "9999") }
            .prefix(5)
            .map { $0 }
    }
}
