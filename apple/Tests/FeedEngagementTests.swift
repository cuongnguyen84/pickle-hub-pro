import Foundation
import Testing
@testable import ThePickleHub

// Feed engagement for every card kind (PR-N3, twin of web PR #1136):
// the deterministic blog target id, the per-kind target mapping, the
// comment-thread flattening and the comment body rules. All pure - the
// RPC layer itself is exercised by the web E2E and the pgTAP contract.

struct FeedEngagementTests {

    // MARK: - BlogTargetId (vectors verified against the web implementation)

    @Test func blogTargetIdMatchesWebVectors() {
        #expect(
            BlogTargetId.uuid(forSlug: "create-tournament-by-chat").uuidString.lowercased()
                == "72415d40-0a62-5324-af89-b187b530371b"
        )
        #expect(
            BlogTargetId.uuid(forSlug: "line-call-rules-ly-hoang-nam-fair-play").uuidString.lowercased()
                == "dc8d31f7-4632-50f1-8ba6-f41af1a30344"
        )
    }

    @Test func blogTargetIdIsDeterministicAndSlugSensitive() {
        #expect(BlogTargetId.uuid(forSlug: "abc") == BlogTargetId.uuid(forSlug: "abc"))
        #expect(BlogTargetId.uuid(forSlug: "abc") != BlogTargetId.uuid(forSlug: "abd"))
    }

    @Test func canonicalSlugMapsTheSplitPairs() {
        #expect(BlogTargetId.canonicalSlug(for: "tao-giai-pickleball-bang-ai") == "create-tournament-by-chat")
        #expect(
            BlogTargetId.canonicalSlug(for: "luat-goi-bong-out-ly-hoang-nam-fair-play")
                == "line-call-rules-ly-hoang-nam-fair-play"
        )
        // Shared slugs pass through untouched, so the EN and VI cards of
        // a pair land on the SAME engagement thread.
        #expect(BlogTargetId.canonicalSlug(for: "7-beginner-pickleball-drills") == "7-beginner-pickleball-drills")
        #expect(
            BlogTargetId.uuid(forSlug: BlogTargetId.canonicalSlug(for: "tao-giai-pickleball-bang-ai"))
                == BlogTargetId.uuid(forSlug: "create-tournament-by-chat")
        )
        #expect(
            BlogTargetId.uuid(forSlug: BlogTargetId.canonicalSlug(for: "luat-goi-bong-out-ly-hoang-nam-fair-play"))
                == BlogTargetId.uuid(forSlug: "line-call-rules-ly-hoang-nam-fair-play")
        )
    }

    // MARK: - FeedItem.engagementTarget

    private func feedRow(type: String, slug: String? = nil) throws -> FeedItem {
        let json = """
        {
          "item_type": "\(type)",
          "item_id": "33333333-3333-3333-3333-333333333333",
          "published_at": "2026-11-24T03:30:00+00:00",
          "score": 1.0,
          "slug": \(slug.map { "\"\($0)\"" } ?? "null"),
          "title": "Tiêu đề",
          "format": "doubles",
          "match_type": "rec",
          "winning_team": "a",
          "source_provider": "community"
        }
        """
        let row = try JSONDecoder().decode(FeedRow.self, from: Data(json.utf8))
        return try #require(FeedItem(row: row))
    }

    @Test func matchTargetUsesItemId() throws {
        let item = try feedRow(type: "match")
        #expect(item.engagementTarget == EngagementTarget(
            type: "match",
            id: UUID(uuidString: "33333333-3333-3333-3333-333333333333")!
        ))
    }

    @Test func blogTargetUsesCanonicalSlugId() throws {
        let item = try feedRow(type: "blog", slug: "tao-giai-pickleball-bang-ai")
        #expect(item.engagementTarget == EngagementTarget(
            type: "blog",
            id: UUID(uuidString: "72415D40-0A62-5324-AF89-B187B530371B")!
        ))
    }

    @Test func videoTargetUsesVideoId() throws {
        let item = try feedRow(type: "video")
        #expect(item.engagementTarget.type == "video")
        #expect(item.engagementTarget.id == item.id)
    }

    @Test func overlayTargetsUseTheirRowIds() throws {
        let postRow = try JSONDecoder().decode(FeedSocialPostRow.self, from: Data("""
        {
          "id": "44444444-4444-4444-4444-444444444444",
          "author_id": "22222222-2222-2222-2222-222222222222",
          "body": null,
          "image_url": "https://example.supabase.co/post-images/a.webp",
          "topic": null,
          "status": "approved",
          "created_at": "2026-11-24T03:30:00+00:00"
        }
        """.utf8))
        let post = try #require(FeedItem(socialPost: postRow, authorName: "A"))
        #expect(post.engagementTarget.type == "post")
        #expect(post.engagementTarget.id == postRow.id)

        let live = FeedItem(
            id: UUID(uuidString: "55555555-5555-5555-5555-555555555555")!,
            happening: FeedHappening(kind: .live, title: "T", meta: "", url: URL(string: "https://example.com")!),
            publishedAt: nil,
            now: Date()
        )
        #expect(live.engagementTarget.type == "livestream")
        #expect(live.engagementTarget.id == live.id)

        let event = FeedItem(
            id: UUID(uuidString: "66666666-6666-6666-6666-666666666666")!,
            happening: FeedHappening(kind: .event, title: "T", meta: "", url: URL(string: "https://example.com")!),
            publishedAt: nil,
            now: Date()
        )
        #expect(event.engagementTarget.type == "event")
    }

    // MARK: - TargetCommentTree

    private func comment(_ id: Int, parent: Int? = nil, depth: Int = 0, deleted: Bool = false) -> TargetComment {
        TargetComment(
            commentID: UUID(uuidString: String(format: "00000000-0000-0000-0000-%012d", id))!,
            parentCommentID: parent.map { UUID(uuidString: String(format: "00000000-0000-0000-0000-%012d", $0))! },
            depth: depth,
            body: deleted ? "[deleted]" : "c\(id)",
            userID: UUID(),
            username: "user",
            displayName: deleted ? nil : "User",
            avatarURL: nil,
            createdAt: "2026-11-24T03:30:00+00:00",
            isDeleted: deleted
        )
    }

    @Test func threadFlattensDepthFirst() {
        let rows = [comment(1), comment(2), comment(3, parent: 1, depth: 1), comment(4, parent: 3, depth: 2), comment(5, parent: 1, depth: 1)]
        let flat = TargetCommentTree.flattened(rows)
        #expect(flat.map(\.body) == ["c1", "c3", "c4", "c5", "c2"])
    }

    @Test func threadTreatsOrphansAsRoots() {
        let rows = [comment(9, parent: 99, depth: 1), comment(1)]
        let flat = TargetCommentTree.flattened(rows)
        #expect(flat.count == 2)
        #expect(flat.first?.body == "c9")
    }

    @Test func threadKeepsTombstonesAsAnchors() {
        let rows = [comment(1, deleted: true), comment(2, parent: 1, depth: 1)]
        let flat = TargetCommentTree.flattened(rows)
        #expect(flat.count == 2)
        #expect(flat.first?.isDeleted == true)
        #expect(flat.last?.body == "c2")
    }

    // MARK: - CommentBody

    @Test func commentBodyValidationMirrorsTheServer() {
        #expect(CommentBody.validated("  xin chào  ") == .success("xin chào"))
        #expect(CommentBody.validated("   ") == .failure(.empty))
        #expect(CommentBody.validated("") == .failure(.empty))
        #expect(CommentBody.validated(String(repeating: "a", count: 500)).isSuccess)
        #expect(CommentBody.validated(String(repeating: "a", count: 501)) == .failure(.tooLong))
    }

    // MARK: - Store grouping

    @Test func countsRequestsGroupByType() {
        let a = UUID(), b = UUID(), c = UUID()
        let grouped = EngagementStore.groupedByType([
            EngagementTarget(type: "news", id: a),
            EngagementTarget(type: "news", id: b),
            EngagementTarget(type: "post", id: c),
        ])
        #expect(grouped.count == 2)
        #expect(Set(grouped["news"] ?? []) == [a, b])
        #expect(grouped["post"] == [c])
    }
}

private extension Result {
    var isSuccess: Bool {
        if case .success = self { return true }
        return false
    }
}
