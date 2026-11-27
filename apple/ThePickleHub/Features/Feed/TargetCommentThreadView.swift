import SwiftUI

/// Inline comment thread for one engagement target, the native twin of
/// the web `TargetCommentThread`: threaded replies (depth-indented),
/// soft-delete tombstones, and a composer for signed-in users. Guests
/// read everything and see a sign-in footnote instead of the composer.
struct TargetCommentThreadView: View {
    let target: EngagementTarget
    let store: EngagementStore
    let isSignedIn: Bool
    let currentUserID: UUID?

    private let repo = EngagementRepository()

    @State private var rawRows: [TargetComment] = []
    @State private var loaded = false
    @State private var loadingMore = false
    @State private var reachedEnd = false
    @State private var draft = ""
    @State private var replyTarget: TargetComment?
    @State private var sending = false
    @State private var errorText: String?

    private var displayRows: [TargetComment] { TargetCommentTree.flattened(rawRows) }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if !loaded {
                HStack(spacing: 8) {
                    ProgressView().tint(TLColor.fg3)
                    Text("Đang tải bình luận...")
                        .font(TLFont.sans(13))
                        .foregroundStyle(TLColor.fg3)
                }
            } else if displayRows.isEmpty {
                Text("Chưa có bình luận nào. Hãy là người đầu tiên chia sẻ cảm nghĩ.")
                    .font(TLFont.sans(13))
                    .foregroundStyle(TLColor.fg3)
            } else {
                ForEach(displayRows) { comment in
                    commentRow(comment)
                }
                if !reachedEnd {
                    Button("Xem thêm bình luận") { Task { await loadMore() } }
                        .font(TLFont.sans(13, .semibold))
                        .foregroundStyle(TLColor.accentText)
                        .disabled(loadingMore)
                }
            }

            if let errorText {
                Text(errorText)
                    .font(TLFont.sans(12))
                    .foregroundStyle(TLColor.live)
            }

            composer
        }
        .task { await load() }
    }

    // MARK: - Rows

    private func commentRow(_ comment: TargetComment) -> some View {
        HStack(alignment: .top, spacing: 8) {
            avatar(for: comment)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    if !comment.isDeleted {
                        Text(comment.authorLabel)
                            .font(TLFont.sans(13, .semibold))
                            .foregroundStyle(TLColor.fg)
                            .lineLimit(1)
                    }
                    Text(FeedDate.relative(FeedDate.parse(comment.createdAt)))
                        .font(TLFont.sans(11))
                        .foregroundStyle(TLColor.fg4)
                }
                Text(comment.body)
                    .font(TLFont.sans(14))
                    .foregroundStyle(comment.isDeleted ? TLColor.fg4 : TLColor.fg2)
                    .italic(comment.isDeleted)
                    .fixedSize(horizontal: false, vertical: true)
                if !comment.isDeleted {
                    HStack(spacing: 14) {
                        if isSignedIn {
                            Button("Trả lời") { replyTarget = comment }
                                .font(TLFont.sans(12, .semibold))
                                .foregroundStyle(TLColor.fg3)
                            if comment.userID == currentUserID {
                                Button("Xoá") { Task { await delete(comment) } }
                                    .font(TLFont.sans(12, .semibold))
                                    .foregroundStyle(TLColor.fg3)
                            }
                        }
                    }
                    .padding(.top, 1)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.leading, CGFloat(min(comment.depth, 4)) * 14)
    }

    private func avatar(for comment: TargetComment) -> some View {
        Group {
            if !comment.isDeleted, let urlString = comment.avatarURL?.nonEmpty, let url = URL(string: urlString) {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else {
                        Circle().fill(TLColor.surface2)
                    }
                }
            } else {
                Circle().fill(TLColor.surface2)
                    .overlay(
                        Image(systemName: "person.fill")
                            .font(.system(size: 11))
                            .foregroundStyle(TLColor.fg4)
                    )
            }
        }
        .frame(width: 26, height: 26)
        .clipShape(Circle())
    }

    // MARK: - Composer

    @ViewBuilder
    private var composer: some View {
        if isSignedIn {
            VStack(alignment: .leading, spacing: 8) {
                if let replyTarget {
                    HStack(spacing: 6) {
                        Text("Đang trả lời \(replyTarget.authorLabel)")
                            .font(TLFont.sans(12))
                            .foregroundStyle(TLColor.fg3)
                            .lineLimit(1)
                        Button("Huỷ") { self.replyTarget = nil }
                            .font(TLFont.sans(12, .semibold))
                            .foregroundStyle(TLColor.accentText)
                    }
                }
                HStack(alignment: .bottom, spacing: 8) {
                    TextField("Viết bình luận...", text: $draft, axis: .vertical)
                        .font(TLFont.sans(14))
                        .foregroundStyle(TLColor.fg)
                        .lineLimit(1...4)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .background(TLColor.surface2, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
                    Button {
                        Task { await send() }
                    } label: {
                        Image(systemName: "paperplane.fill")
                            .font(.system(size: 14))
                            .foregroundStyle(TLColor.accentInk)
                            .frame(width: 34, height: 34)
                            .background(TLColor.accent, in: Circle())
                    }
                    .buttonStyle(.plain)
                    .disabled(sending || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .opacity(sending || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.4 : 1)
                    .accessibilityLabel("Gửi bình luận")
                }
            }
        } else {
            Text("Đăng nhập để tham gia bình luận.")
                .font(TLFont.sans(12))
                .foregroundStyle(TLColor.fg4)
        }
    }

    // MARK: - Data

    private func load() async {
        guard !loaded else { return }
        do {
            rawRows = try await repo.comments(target: target, after: nil)
            reachedEnd = rawRows.count < 50
        } catch {
            errorText = String(localized: "Không tải được bình luận, thử lại sau.")
        }
        loaded = true
    }

    private func loadMore() async {
        guard !loadingMore, let last = rawRows.last else { return }
        loadingMore = true
        defer { loadingMore = false }
        do {
            let page = try await repo.comments(target: target, after: last)
            rawRows.append(contentsOf: page)
            reachedEnd = page.count < 50
        } catch {
            errorText = String(localized: "Không tải được bình luận, thử lại sau.")
        }
    }

    private func send() async {
        switch CommentBody.validated(draft) {
        case .failure(.empty):
            return
        case .failure(.tooLong):
            errorText = String(localized: "Bình luận tối đa 500 ký tự.")
            return
        case .success(let body):
            sending = true
            defer { sending = false }
            do {
                try await repo.addComment(target: target, body: body, parentID: replyTarget?.commentID)
                draft = ""
                replyTarget = nil
                errorText = nil
                store.adjustComments(target: target, delta: 1)
                rawRows = try await repo.comments(target: target, after: nil)
                reachedEnd = rawRows.count < 50
            } catch {
                errorText = String(localized: "Gửi bình luận thất bại, thử lại sau.")
            }
        }
    }

    private func delete(_ comment: TargetComment) async {
        do {
            try await repo.deleteComment(id: comment.commentID)
            if let index = rawRows.firstIndex(where: { $0.commentID == comment.commentID }) {
                let old = rawRows[index]
                rawRows[index] = TargetComment(
                    commentID: old.commentID,
                    parentCommentID: old.parentCommentID,
                    depth: old.depth,
                    body: "[deleted]",
                    userID: old.userID,
                    username: old.username,
                    displayName: nil,
                    avatarURL: nil,
                    createdAt: old.createdAt,
                    isDeleted: true
                )
            }
            store.adjustComments(target: target, delta: -1)
        } catch {
            errorText = String(localized: "Xoá bình luận thất bại, thử lại sau.")
        }
    }
}
