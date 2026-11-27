import SwiftUI

/// Which moderation list is on screen.
enum ModerationGroup: Equatable {
    case pending
    case history
}

@Observable
final class PostModerationViewModel {
    var group: ModerationGroup = .pending
    var pending: [ModerationPost] = []
    var history: [ModerationPost] = []
    var loaded = false
    var acting: Set<UUID> = []
    var errorMessage: String?

    private let repo = ModerationRepository()

    var visiblePosts: [ModerationPost] { group == .pending ? pending : history }

    @MainActor
    func load() async {
        do {
            // Bind the (Sendable, stateless) repository locally so the
            // async-let children capture it, not the MainActor self.
            let repo = self.repo
            async let pendingTask = repo.pendingPosts()
            async let historyTask = repo.historyPosts()
            pending = try await pendingTask
            history = try await historyTask
            errorMessage = nil
        } catch {
            errorMessage = "Không tải được hàng đợi duyệt. Vuốt xuống để thử lại."
        }
        loaded = true
    }

    /// Applies an action, then reloads both lists so the post lands in
    /// the right group (the web invalidates the same queries).
    @MainActor
    func act(_ post: ModerationPost, _ action: ModerationAction) async {
        guard !acting.contains(post.id) else { return }
        acting.insert(post.id)
        defer { acting.remove(post.id) }
        do {
            try await repo.setStatus(id: post.id, status: action.targetStatus)
            await load()
        } catch {
            errorMessage = "Không lưu được thay đổi. Thử lại sau."
        }
    }
}

/// Admin moderation queue for community photo posts - the native twin
/// of the web "Bài người dùng" tab in /admin/moderation (#1125). Only
/// reachable from the profile tab when the signed-in user is an admin;
/// RLS + the status-guard trigger enforce that server-side as well.
struct PostModerationView: View {
    @State private var model = PostModerationViewModel()

    var body: some View {
        Group {
            if !model.loaded {
                ProgressView().tint(TLColor.accentText)
            } else {
                List {
                    if let error = model.errorMessage {
                        Text(error)
                            .font(TLFont.sans(13))
                            .foregroundStyle(TLColor.fg3)
                            .listRowBackground(TLColor.bg)
                            .listRowSeparator(.hidden)
                    }
                    if model.visiblePosts.isEmpty {
                        Text(model.group == .pending
                            ? String(localized: "Không có bài nào đang chờ duyệt.")
                            : String(localized: "Chưa có bài nào được xử lý."))
                            .font(TLFont.sans(14))
                            .foregroundStyle(TLColor.fg3)
                            .listRowBackground(TLColor.bg)
                            .listRowSeparator(.hidden)
                    }
                    ForEach(model.visiblePosts) { post in
                        card(post)
                            .listRowBackground(TLColor.bg)
                            .listRowSeparator(.hidden)
                            .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
                .refreshable { await model.load() }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(TLColor.bg)
        .navigationTitle("Duyệt bài cộng đồng")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Picker("Nhóm", selection: $model.group) {
                    Text("Chờ duyệt (\(model.pending.count))").tag(ModerationGroup.pending)
                    Text("Lịch sử").tag(ModerationGroup.history)
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: 260)
            }
        }
        .task { await model.load() }
    }

    private func card(_ post: ModerationPost) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            // Author row: avatar + name + verified seal (web #1128).
            HStack(spacing: 8) {
                AsyncImage(url: post.authorAvatarURL) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else {
                        Circle().fill(TLColor.surface2)
                    }
                }
                .frame(width: 28, height: 28)
                .clipShape(Circle())
                Text(post.authorName)
                    .font(TLFont.sans(14, .semibold))
                    .foregroundStyle(TLColor.fg)
                    .lineLimit(1)
                if post.authorVerified {
                    VerifiedBadge(size: 15)
                }
                Spacer()
                statusBadge(post)
            }
            .padding(12)

            // Natural aspect, never cropped (web #1138).
            AsyncImage(url: post.imageURL) { phase in
                if let image = phase.image {
                    image.resizable().scaledToFit()
                } else {
                    Rectangle().fill(TLColor.surface2).aspectRatio(4 / 3, contentMode: .fit)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(maxHeight: 720)
            .background(TLColor.bgElev)
            .clipped()

            VStack(alignment: .leading, spacing: 8) {
                if let body = post.body?.nonEmpty {
                    Text(body)
                        .font(TLFont.sans(14))
                        .foregroundStyle(TLColor.fg2)
                        .fixedSize(horizontal: false, vertical: true)
                }
                HStack(spacing: 8) {
                    if let label = post.topicLabel {
                        Text(label)
                            .font(TLFont.mono(9, .medium)).tracking(0.8).textCase(.uppercase)
                            .foregroundStyle(TLColor.accentText)
                    }
                    if let created = post.createdAt {
                        Text(FeedDate.relative(created))
                            .font(TLFont.sans(11))
                            .foregroundStyle(TLColor.fg4)
                    }
                    if post.reportCount > 0 {
                        Text("Bị báo cáo \(post.reportCount) lần")
                            .font(TLFont.sans(11, .medium))
                            .foregroundStyle(Color.orange)
                    }
                }

                // Action row (web renderPostActions).
                HStack(spacing: 8) {
                    ForEach(ModerationActions.actions(forStatus: post.status), id: \.self) { action in
                        Button {
                            Task { await model.act(post, action) }
                        } label: {
                            Text(action.label)
                                .font(TLFont.sans(13, .semibold))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 7)
                        }
                        .buttonStyle(.bordered)
                        .tint(action == .approve ? TLColor.accentText : (action == .reject ? Color.red : TLColor.fg3))
                        .disabled(model.acting.contains(post.id))
                    }
                    if model.acting.contains(post.id) {
                        ProgressView().controlSize(.small)
                    }
                }
            }
            .padding(12)
        }
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private func statusBadge(_ post: ModerationPost) -> some View {
        Text(post.statusLabel)
            .font(TLFont.sans(11, .semibold))
            .foregroundStyle(badgeColor(post.status))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(badgeColor(post.status).opacity(0.12), in: Capsule())
    }

    private func badgeColor(_ status: String) -> Color {
        switch status {
        case "approved": return .green
        case "rejected": return .red
        case "hidden": return .orange
        default: return .yellow
        }
    }
}
