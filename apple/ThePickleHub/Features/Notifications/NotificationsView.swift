import SwiftUI

@Observable
final class NotificationsViewModel {
    enum Phase: Equatable { case loading, loaded([AppNotification]), failed(String) }

    var phase: Phase = .loading
    var items: [AppNotification] = []
    var unread: Int = 0
    var signedOut = false

    private let repo = NotificationRepository()

    @MainActor
    func load() async {
        guard await repo.currentUserID() != nil else { signedOut = true; phase = .loaded([]); return }
        signedOut = false
        do {
            let list = try await repo.fetch()
            items = list
            unread = list.filter { !$0.isRead }.count
            phase = .loaded(list)
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    @MainActor
    func markRead(_ n: AppNotification) async {
        guard !n.isRead else { return }
        await repo.markRead(n)
        items = items.map { $0.id == n.id ? AppNotification(id: $0.id, source: $0.source, type: $0.type, title: $0.title, body: $0.body, linkURL: $0.linkURL, isRead: true, createdAt: $0.createdAt) : $0 }
        unread = items.filter { !$0.isRead }.count
    }

    @MainActor
    func markAll() async {
        await repo.markAllRead()
        await load()
    }
}

/// Native notifications inbox — unified legacy livestream + social notifications.
/// Tapping a player-follow opens the native profile; everything else opens the
/// web page in an in-app Safari sheet.
struct NotificationsView: View {
    @State private var model = NotificationsViewModel()
    @State private var webURL: IdentifiedURL?
    @State private var profileTarget: IdentifiedUsername?

    private struct IdentifiedUsername: Identifiable, Hashable { let id: String; var username: String { id } }

    var body: some View {
        ScrollView {
            content.padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 28)
        }
        .background(TLColor.bg)
        .navigationTitle("Thông báo")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if model.unread > 0 {
                    Button("Đọc tất cả") { Haptics.light(); Task { await model.markAll() } }
                        .font(TLFont.mono(11, .semibold)).foregroundStyle(TLColor.accentText)
                }
            }
        }
        .task { await model.load() }
        .refreshable { await model.load() }
        .navigationDestination(item: $profileTarget) { PlayerProfileView(username: $0.username) }
        .sheet(item: $webURL) { SafariView(url: $0.url).ignoresSafeArea() }
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            ProgressView().tint(TLColor.accentText).frame(maxWidth: .infinity).padding(.top, 80)
        case .failed(let message):
            errorState(message)
        case .loaded:
            if model.signedOut {
                emptyState(icon: "person.crop.circle.badge.questionmark",
                           title: "Cần đăng nhập", subtitle: "Đăng nhập để xem thông báo của bạn.")
            } else if model.items.isEmpty {
                emptyState(icon: "bell.slash", title: "Chưa có thông báo nào.",
                           subtitle: "Thông báo theo dõi, lượt thích, bình luận và trận đấu sẽ hiện ở đây.")
            } else {
                LazyVStack(spacing: 0) {
                    ForEach(Array(model.items.enumerated()), id: \.element.id) { i, n in
                        if i > 0 { Rectangle().fill(TLColor.border).frame(height: 1) }
                        row(n)
                    }
                }
                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
            }
        }
    }

    private func row(_ n: AppNotification) -> some View {
        Button {
            Haptics.light()
            Task { await model.markRead(n) }
            switch n.target {
            case .profile(let username): profileTarget = IdentifiedUsername(id: username)
            case .web(let url): webURL = IdentifiedURL(url: url)
            case .none: break
            }
        } label: {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: n.icon.name)
                    .font(.system(size: 15)).foregroundStyle(n.icon.tint)
                    .frame(width: 34, height: 34)
                    .background(n.icon.tint.opacity(0.12), in: Circle())
                VStack(alignment: .leading, spacing: 3) {
                    Text(n.title).font(TLFont.sans(14, n.isRead ? .regular : .semibold))
                        .foregroundStyle(TLColor.fg).lineLimit(2).multilineTextAlignment(.leading)
                    if let body = n.body?.nonEmpty {
                        Text(body).font(TLFont.sans(12.5)).foregroundStyle(TLColor.fg3).lineLimit(2).multilineTextAlignment(.leading)
                    }
                    if n.createdAt != nil {
                        Text(FeedDate.relative(n.createdAt)).font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                    }
                }
                Spacer(minLength: 4)
                if !n.isRead {
                    Circle().fill(TLColor.accent).frame(width: 8, height: 8).padding(.top, 4)
                }
            }
            .padding(.horizontal, 14).padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func emptyState(icon: String, title: String, subtitle: String) -> some View {
        VStack(spacing: 10) {
            Image(systemName: icon).font(.largeTitle).foregroundStyle(TLColor.fg3)
            Text(title).font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
            Text(subtitle).font(TLFont.sans(12.5)).foregroundStyle(TLColor.fg3).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity).padding(.horizontal, 32).padding(.top, 70)
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "wifi.exclamationmark").font(.largeTitle).foregroundStyle(TLColor.fg3)
            Text("Không tải được thông báo").font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
            Text(message).font(TLFont.sans(12)).foregroundStyle(TLColor.fg3).multilineTextAlignment(.center)
            Button("Thử lại") { Task { await model.load() } }.foregroundStyle(TLColor.accentText)
        }
        .frame(maxWidth: .infinity).padding(.horizontal, 32).padding(.top, 60)
    }
}
