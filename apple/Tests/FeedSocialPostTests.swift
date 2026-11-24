import Foundation
import Testing
@testable import ThePickleHub

// Community photo posts in the native feed (twin of the web PR-A merge)
// plus the pure-recency ordering adopted from web PR #1111.

struct FeedSocialPostTests {

    private func rowJSON(status: String = "pending") -> Data {
        Data("""
        {
          "id": "11111111-1111-1111-1111-111111111111",
          "author_id": "22222222-2222-2222-2222-222222222222",
          "body": "Buổi open play tối nay",
          "image_url": "https://example.supabase.co/storage/v1/object/public/post-images/a/b.webp",
          "topic": "tim-ban-danh",
          "status": "\(status)",
          "created_at": "2026-11-24T03:30:00+00:00"
        }
        """.utf8)
    }

    @Test func rowDecodesSnakeCase() throws {
        let row = try JSONDecoder().decode(FeedSocialPostRow.self, from: rowJSON())
        #expect(row.authorID.uuidString == "22222222-2222-2222-2222-222222222222")
        #expect(row.topic == "tim-ban-danh")
        #expect(row.status == "pending")
    }

    @Test func itemMapsRowFields() throws {
        let row = try JSONDecoder().decode(FeedSocialPostRow.self, from: rowJSON())
        let item = try #require(FeedItem(socialPost: row, authorName: "Cường"))
        guard case .socialPost(let post) = item.kind else {
            Issue.record("expected a socialPost item")
            return
        }
        #expect(post.authorName == "Cường")
        #expect(post.isPending)
        #expect(post.topicLabel == "Tìm bạn đánh")
        #expect(item.publishedAt != nil)
        #expect(item.publishedAt == item.rankedAt)
    }

    @Test func approvedPostIsNotPending() throws {
        let row = try JSONDecoder().decode(FeedSocialPostRow.self, from: rowJSON(status: "approved"))
        let item = try #require(FeedItem(socialPost: row, authorName: "A"))
        guard case .socialPost(let post) = item.kind else {
            Issue.record("expected a socialPost item")
            return
        }
        #expect(!post.isPending)
    }

    @Test func topicKeysMirrorTheWebList() {
        #expect(SocialPostTopic.allCases.map(\.rawValue) == [
            "tim-ban-danh", "hoi-ky-thuat", "khoe-vot", "ket-qua", "open-play",
        ])
        #expect(SocialPostTopic(rawValue: "unknown") == nil)
    }

    // MARK: - FeedRecency

    private func happening(id: UUID, kind: FeedHappening.Kind, at date: Date, now: Date) -> FeedItem {
        FeedItem(
            id: id,
            happening: FeedHappening(kind: kind, title: "T", meta: "", url: URL(string: "https://example.com")!),
            publishedAt: date,
            now: now
        )
    }

    private func post(id: UUID, createdAt: String) throws -> FeedItem {
        var row = try JSONDecoder().decode(FeedSocialPostRow.self, from: rowJSON())
        row = FeedSocialPostRow(
            id: id, authorID: row.authorID, body: nil, imageURL: row.imageURL,
            topic: nil, status: "approved", createdAt: createdAt
        )
        return try #require(FeedItem(socialPost: row, authorName: "A"))
    }

    @Test func recencySortsNewestFirst() throws {
        let now = try #require(FeedDate.parse("2026-11-24T12:00:00+00:00"))
        let older = try post(id: UUID(), createdAt: "2026-11-24T08:00:00+00:00")
        let newer = try post(id: UUID(), createdAt: "2026-11-24T11:00:00+00:00")
        let sorted = FeedRecency.sorted([older, newer], now: now)
        #expect(sorted.map(\.id) == [newer.id, older.id])
    }

    @Test func recencyClampsFutureToNow() throws {
        let now = try #require(FeedDate.parse("2026-11-24T12:00:00+00:00"))
        let future = happening(id: UUID(), kind: .event, at: now.addingTimeInterval(3600), now: now)
        let fresh = try post(id: UUID(), createdAt: "2026-11-24T11:59:00+00:00")
        // The future event clamps to `now`, so it still leads — but by the
        // clamp, not by its raw future timestamp; a same-instant live item
        // would outrank it via the live tie-break below.
        let sorted = FeedRecency.sorted([fresh, future], now: now)
        #expect(sorted.first?.id == future.id)
        #expect(FeedRecency.timestamp(for: future, now: now) == now)
    }

    @Test func liveHappeningWinsTheNowTieBreak() throws {
        let now = try #require(FeedDate.parse("2026-11-24T12:00:00+00:00"))
        let live = happening(id: UUID(), kind: .live, at: now.addingTimeInterval(-7200), now: now)
        let future = happening(id: UUID(), kind: .event, at: now.addingTimeInterval(3600), now: now)
        // Both timestamps resolve to `now` (live counts as now, the future
        // event clamps to now) — the live item must come first.
        let sorted = FeedRecency.sorted([future, live], now: now)
        #expect(sorted.first?.id == live.id)
    }

    @Test func idBreaksRemainingTiesDescending() throws {
        let now = try #require(FeedDate.parse("2026-11-24T12:00:00+00:00"))
        let low = try post(id: UUID(uuidString: "00000000-0000-0000-0000-000000000001")!, createdAt: "2026-11-24T10:00:00+00:00")
        let high = try post(id: UUID(uuidString: "00000000-0000-0000-0000-000000000002")!, createdAt: "2026-11-24T10:00:00+00:00")
        let sorted = FeedRecency.sorted([low, high], now: now)
        #expect(sorted.map(\.id) == [high.id, low.id])
    }
}
