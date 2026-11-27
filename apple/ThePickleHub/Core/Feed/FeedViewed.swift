import Foundation

/// Seen-items tracking for the feed, the native port of the web
/// `useFeedViewedTracking` (PR #1124). Items the viewer has already
/// seen sink below everything still unseen on the NEXT load; the
/// partition always uses the at-load snapshot, so the list never
/// re-orders itself under the reader's thumb during a visit.
///
/// Storage mirrors the web shape - a JSON map of key -> { t: epochMs,
/// e?: engagementAtMark } - kept in UserDefaults under the same key
/// name, pruned to entries younger than 30 days and at most 1000.
///
/// Revival (the web's Facebook-pattern rule): a seen item whose
/// engagement has GROWN since its mark counts as having something new
/// and rejoins the unseen group. Only match items carry engagement in
/// their payload today, exactly as on the web.
struct FeedViewedEntry: Codable, Equatable {
    /// epoch milliseconds of the last mark.
    var t: Double
    /// Kudos + comments at mark time, when the item carries any.
    var e: Int?
}

enum FeedViewedStore {
    static let storageKey = "tph_feed_viewed_v1"
    static let ttlMs: Double = 30 * 24 * 60 * 60 * 1000
    static let maxEntries = 1000

    static func load(from defaults: UserDefaults = .standard) -> [String: FeedViewedEntry] {
        guard let data = defaults.data(forKey: storageKey),
              let decoded = try? JSONDecoder().decode([String: FeedViewedEntry].self, from: data)
        else { return [:] }
        return decoded
    }

    static func save(_ map: [String: FeedViewedEntry], to defaults: UserDefaults = .standard) {
        guard let data = try? JSONEncoder().encode(map) else { return }
        defaults.set(data, forKey: storageKey)
    }

    /// Drop entries older than the TTL, then keep the newest
    /// `maxEntries` marks - the web prune, verbatim.
    static func prune(_ map: [String: FeedViewedEntry], nowMs: Double) -> [String: FeedViewedEntry] {
        let cutoff = nowMs - ttlMs
        let fresh = map.filter { $0.value.t >= cutoff }
        guard fresh.count > maxEntries else { return fresh }
        let newest = fresh.sorted { $0.value.t > $1.value.t }.prefix(maxEntries)
        return Dictionary(uniqueKeysWithValues: newest.map { ($0.key, $0.value) })
    }
}

extension FeedItem {
    /// The seen-tracking key. Keys are per-platform (the web uses its
    /// cursor_ids in localStorage; native uses its own in
    /// UserDefaults) - the mechanism is what matches, not the strings.
    var seenKey: String {
        switch kind {
        case .match: return "match:\(id.uuidString)"
        case .blog(let blog): return "blog:\(blog.slug)"
        case .news: return "news:\(id.uuidString)"
        case .socialPost: return "post:\(id.uuidString)"
        case .video(let video): return "video:\(video.videoID.uuidString)"
        case .highlight: return "highlight:\(id.uuidString)"
        case .embed: return "embed:\(id.uuidString)"
        case .happening: return "happening:\(id.uuidString)"
        }
    }

    /// Engagement carried in the payload (match items only, as on the
    /// web) - the revival baseline input.
    var seenEngagement: Int? {
        if case .match(let match) = kind {
            return match.kudosCount + match.commentCount
        }
        return nil
    }
}

/// The unseen-first partition, applied AFTER the recency sort: unseen
/// items keep their recency order on top, seen items keep theirs
/// below. Pure and stable - unit-tested.
enum FeedSeenPartition {
    static func isSeenAtLoad(_ item: FeedItem, entriesAtLoad: [String: FeedViewedEntry]) -> Bool {
        guard let entry = entriesAtLoad[item.seenKey] else { return false }
        if let baseline = entry.e, let current = item.seenEngagement, current > baseline {
            return false // revived: engagement grew since the mark
        }
        return true
    }

    static func applied(to sortedItems: [FeedItem], entriesAtLoad: [String: FeedViewedEntry]) -> [FeedItem] {
        guard !entriesAtLoad.isEmpty else { return sortedItems }
        var unseen: [FeedItem] = []
        var seen: [FeedItem] = []
        for item in sortedItems {
            if isSeenAtLoad(item, entriesAtLoad: entriesAtLoad) {
                seen.append(item)
            } else {
                unseen.append(item)
            }
        }
        return unseen + seen
    }
}

/// Owns the live viewed map for one feed session. The at-load snapshot
/// is frozen at init (a new feed view model = a new visit); marks made
/// during the visit persist for the next one but never move the
/// current list.
@MainActor
final class FeedViewedTracker {
    private(set) var entriesAtLoad: [String: FeedViewedEntry]
    private var live: [String: FeedViewedEntry]
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        let nowMs = Date().timeIntervalSince1970 * 1000
        live = FeedViewedStore.prune(FeedViewedStore.load(from: defaults), nowMs: nowMs)
        entriesAtLoad = live
    }

    func markViewed(_ item: FeedItem) {
        let key = item.seenKey
        let nowMs = Date().timeIntervalSince1970 * 1000
        // Re-marking within a minute with the same engagement is a
        // no-op (appear observers can fire repeatedly) - web rule.
        if let existing = live[key], nowMs - existing.t < 60_000, existing.e == item.seenEngagement {
            return
        }
        live[key] = FeedViewedEntry(t: nowMs, e: item.seenEngagement ?? live[key]?.e)
        live = FeedViewedStore.prune(live, nowMs: nowMs)
        FeedViewedStore.save(live, to: defaults)
    }
}
