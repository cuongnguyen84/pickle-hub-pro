import Foundation
import Testing
@testable import ThePickleHub

/// PR-N6: the admin moderation queue (web /admin/moderation "Bài
/// người dùng" tab, #1125) - the action matrix per status and the
/// row -> post mapping with author enrichment.
@Suite("Post moderation")
struct PostModerationTests {

    // MARK: - Action matrix (web renderPostActions)

    @Test func pendingOffersAllThreeActions() {
        #expect(ModerationActions.actions(forStatus: "pending") == [.approve, .reject, .hide])
    }

    @Test func approvedOffersOnlyHide() {
        #expect(ModerationActions.actions(forStatus: "approved") == [.hide])
    }

    @Test func rejectedOffersOnlyApprove() {
        #expect(ModerationActions.actions(forStatus: "rejected") == [.approve])
    }

    @Test func hiddenOffersApproveAndRejectless() {
        // Hidden posts can be approved again but not re-hidden, and
        // reject is a pending-only action on the web.
        #expect(ModerationActions.actions(forStatus: "hidden") == [.approve])
    }

    @Test func actionTargetStatuses() {
        #expect(ModerationAction.approve.targetStatus == "approved")
        #expect(ModerationAction.reject.targetStatus == "rejected")
        #expect(ModerationAction.hide.targetStatus == "hidden")
    }

    // MARK: - Status labels (web getPostStatusBadge)

    private func post(status: String) -> ModerationPost {
        ModerationPost(
            id: UUID(), authorID: UUID(), authorName: "A", authorAvatarURL: nil,
            authorVerified: false, body: nil, imageURL: URL(string: "https://example.com/a.webp")!,
            topic: nil, status: status, createdAt: nil, reportCount: 0
        )
    }

    @Test func statusLabelsMatchWeb() {
        #expect(post(status: "approved").statusLabel == "Đã duyệt")
        #expect(post(status: "rejected").statusLabel == "Đã từ chối")
        #expect(post(status: "hidden").statusLabel == "Đã ẩn")
        #expect(post(status: "pending").statusLabel == "Chờ duyệt")
    }

    // MARK: - Mapping

    private func row(id: UUID, authorID: UUID, imageURL: String = "https://example.com/p.webp") -> ModerationPostRow {
        ModerationPostRow(
            id: id, authorID: authorID, body: "Xin chào", imageURL: imageURL,
            topic: "ket-qua", status: "pending", createdAt: "2026-11-27T03:00:00Z"
        )
    }

    @Test func mappingJoinsAuthorAndReportCount() {
        let postID = UUID()
        let authorID = UUID()
        let avatar = URL(string: "https://example.com/av.webp")!
        let posts = ModerationMapping.posts(
            rows: [row(id: postID, authorID: authorID)],
            authors: [authorID: .init(name: "Nguyễn Văn A", avatarURL: avatar, verified: true)],
            reportCounts: [postID: 2]
        )
        #expect(posts.count == 1)
        #expect(posts[0].authorName == "Nguyễn Văn A")
        #expect(posts[0].authorAvatarURL == avatar)
        #expect(posts[0].authorVerified)
        #expect(posts[0].reportCount == 2)
        #expect(posts[0].topicLabel != nil)
        #expect(posts[0].createdAt != nil)
    }

    @Test func mappingFallsBackForMissingAuthor() {
        let posts = ModerationMapping.posts(
            rows: [row(id: UUID(), authorID: UUID())],
            authors: [:],
            reportCounts: [:]
        )
        #expect(posts.count == 1)
        #expect(posts[0].authorName == "ThePickleHub")
        #expect(posts[0].authorVerified == false)
        #expect(posts[0].reportCount == 0)
    }

    // Note: there is deliberately no "unusable image URL is skipped"
    // test - modern Foundation percent-encodes almost any string into
    // a relative URL instead of returning nil, so the mapping's skip
    // guard cannot be exercised deterministically across OS versions.
}
