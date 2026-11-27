import Foundation
import Testing
@testable import ThePickleHub

// Feed parity port (PR-N5, twin of web #1126 + #1124 + #1131): the
// VI blog overlay mapping with its canonical engagement key, and the
// seen-items partition (unseen first, at-load snapshot, engagement
// revival). Guest post reading is an RLS/query-shape change covered
// by the web E2E posture; the pure logic is what is tested here.

struct FeedParityTests {

    // MARK: - Blog overlay

    private func viBlogJSON(alternate: String?) -> Data {
        Data("""
        {
          "id": "77777777-7777-7777-7777-777777777777",
          "slug": "bai-viet-tieng-viet",
          "alternate_en_slug": \(alternate.map { "\"\($0)\"" } ?? "null"),
          "title": "Bài viết tiếng Việt",
          "excerpt": "Tóm tắt",
          "cover_image_url": "https://example.com/cover.webp",
          "category": "tournament",
          "published_at": "2026-11-24T03:30:00+00:00"
        }
        """.utf8)
    }

    @Test func viBlogRowMapsToItem() throws {
        let row = try JSONDecoder().decode(ViBlogRow.self, from: viBlogJSON(alternate: nil))
        let item = try #require(FeedItem(viBlog: row))
        guard case .blog(let blog) = item.kind else {
            Issue.record("expected a blog item")
            return
        }
        #expect(blog.slug == "bai-viet-tieng-viet")
        #expect(blog.canonicalSlug == nil)
        #expect(item.publishedAt == item.rankedAt)
        #expect(item.score == 0)
    }

    @Test func viBlogWithoutPublishedAtIsSkipped() throws {
        let row = try JSONDecoder().decode(ViBlogRow.self, from: Data("""
        {
          "id": "77777777-7777-7777-7777-777777777777",
          "slug": "khong-ngay",
          "alternate_en_slug": null,
          "title": "Không ngày",
          "excerpt": null,
          "cover_image_url": null,
          "category": null,
          "published_at": null
        }
        """.utf8))
        #expect(FeedItem(viBlog: row) == nil)
    }

    @Test func viBlogEngagementKeyUsesTheAlternateSlug() throws {
        // A split pair NOT in the hardcoded slug map: the stamped
        // alternate_en_slug must still land on the EN thread.
        let row = try JSONDecoder().decode(ViBlogRow.self, from: viBlogJSON(alternate: "create-tournament-by-chat"))
        let item = try #require(FeedItem(viBlog: row))
        #expect(item.engagementTarget == EngagementTarget(
            type: "blog",
            id: UUID(uuidString: "72415D40-0A62-5324-AF89-B187B530371B")!
        ))
    }

    // MARK: - Seen store

    @Test func pruneDropsExpiredEntries() {
        let now = 100 * FeedViewedStore.ttlMs
        let map = [
            "fresh": FeedViewedEntry(t: now - 1000, e: nil),
            "stale": FeedViewedEntry(t: now - FeedViewedStore.ttlMs - 1, e: nil),
        ]
        let pruned = FeedViewedStore.prune(map, nowMs: now)
        #expect(pruned.keys.contains("fresh"))
        #expect(!pruned.keys.contains("stale"))
    }

    @Test func pruneKeepsTheNewestThousand() {
        var map: [String: FeedViewedEntry] = [:]
        for index in 0..<1100 {
            map["k\(index)"] = FeedViewedEntry(t: Double(index), e: nil)
        }
        let pruned = FeedViewedStore.prune(map, nowMs: 2000)
        #expect(pruned.count == 1000)
        #expect(pruned["k1099"] != nil)
        #expect(pruned["k99"] == nil)
    }

    @Test func storeRoundTripsThroughUserDefaults() {
        let defaults = UserDefaults(suiteName: "FeedParityTests")!
        defaults.removePersistentDomain(forName: "FeedParityTests")
        let map = ["match:abc": FeedViewedEntry(t: 12345, e: 7)]
        FeedViewedStore.save(map, to: defaults)
        #expect(FeedViewedStore.load(from: defaults) == map)
        defaults.removePersistentDomain(forName: "FeedParityTests")
    }

    // MARK: - Seen partition

    private func matchItem(id: UUID, kudos: Int, comments: Int) throws -> FeedItem {
        let json = """
        {
          "item_type": "match",
          "item_id": "\(id.uuidString)",
          "published_at": "2026-11-24T03:30:00+00:00",
          "score": 1.0,
          "title": "Trận",
          "format": "doubles",
          "match_type": "rec",
          "winning_team": "a",
          "source_provider": "community",
          "kudos_count": \(kudos),
          "comment_count": \(comments)
        }
        """
        let row = try JSONDecoder().decode(FeedRow.self, from: Data(json.utf8))
        return try #require(FeedItem(row: row))
    }

    private func postItem(id: UUID) throws -> FeedItem {
        let row = try JSONDecoder().decode(FeedSocialPostRow.self, from: Data("""
        {
          "id": "\(id.uuidString)",
          "author_id": "22222222-2222-2222-2222-222222222222",
          "body": null,
          "image_url": "https://example.supabase.co/post-images/a.webp",
          "topic": null,
          "status": "approved",
          "created_at": "2026-11-24T03:30:00+00:00"
        }
        """.utf8))
        return try #require(FeedItem(socialPost: row, authorName: "A"))
    }

    @Test func partitionSinksSeenBelowUnseenStably() throws {
        let seenID = UUID(), freshID = UUID(), freshID2 = UUID()
        let seenPost = try postItem(id: seenID)
        let freshPost = try postItem(id: freshID)
        let freshMatch = try matchItem(id: freshID2, kudos: 0, comments: 0)
        let entries = [seenPost.seenKey: FeedViewedEntry(t: 1000, e: nil)]
        let ordered = FeedSeenPartition.applied(to: [seenPost, freshPost, freshMatch], entriesAtLoad: entries)
        #expect(ordered.map(\.id) == [freshID, freshID2, seenID])
    }

    @Test func partitionRevivesMatchesWithGrownEngagement() throws {
        let id = UUID()
        let grown = try matchItem(id: id, kudos: 5, comments: 2)
        let entries = [grown.seenKey: FeedViewedEntry(t: 1000, e: 3)]
        #expect(!FeedSeenPartition.isSeenAtLoad(grown, entriesAtLoad: entries))

        let flat = try matchItem(id: id, kudos: 2, comments: 1)
        #expect(FeedSeenPartition.isSeenAtLoad(flat, entriesAtLoad: entries))
    }

    @Test func legacyEntriesWithoutBaselineStaySeen() throws {
        let id = UUID()
        let item = try matchItem(id: id, kudos: 99, comments: 99)
        let entries = [item.seenKey: FeedViewedEntry(t: 1000, e: nil)]
        #expect(FeedSeenPartition.isSeenAtLoad(item, entriesAtLoad: entries))
    }

    @Test func seenKeysAreKindScoped() throws {
        let id = UUID()
        let post = try postItem(id: id)
        let match = try matchItem(id: id, kudos: 0, comments: 0)
        #expect(post.seenKey != match.seenKey)
        #expect(post.seenKey.hasPrefix("post:"))
        #expect(match.seenKey.hasPrefix("match:"))
        #expect(match.seenEngagement == 0)
        #expect(post.seenEngagement == nil)
    }
}
