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
    private(set) var loaded = false

    private let home = HomeRepository()
    private let feed = FeedRepository()

    @MainActor
    func load() async {
        async let postsTask = try? home.featuredPosts()
        async let newsTask = try? feed.news()
        async let statsTask = try? home.stats()

        posts = await postsTask ?? []
        news = Array((await newsTask ?? []).prefix(4))
        stats = await statsTask ?? nil
        loaded = true
    }
}
