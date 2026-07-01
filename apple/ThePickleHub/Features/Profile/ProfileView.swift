import SwiftUI

@Observable
final class ProfileViewModel {
    enum Phase: Equatable {
        case loading
        case loaded(Profile)
        case failed(String)
    }

    var phase: Phase = .loading
    private let repo = ProfileRepository()

    @MainActor
    func load() async {
        phase = .loading
        do {
            let profile = try await repo.currentUserProfile()
            phase = .loaded(profile)
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }
}

/// Profile tab. Loading the signed-in user's own profile is also the live
/// end-to-end check that the user JWT + RLS work via PostgREST.
struct ProfileView: View {
    @Environment(SessionStore.self) private var session
    @Environment(ThemeStore.self) private var theme
    @State private var model = ProfileViewModel()

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                switch model.phase {
                case .loading:
                    ProgressView().tint(TLColor.accentText).padding(.top, 60)

                case .loaded(let profile):
                    RatingCardView(profile: profile, isOwn: true)
                    communitySection
                    accountSettingsLink(profile)
                    themePicker
                    signOutButton

                case .failed(let message):
                    TLCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Label("Không tải được hồ sơ", systemImage: "xmark.octagon.fill")
                                .foregroundStyle(TLColor.live)
                                .font(.headline)
                            Text(message).font(.caption).foregroundStyle(TLColor.fg3).textSelection(.enabled)
                            Button("Thử lại") { Task { await model.load() } }
                                .foregroundStyle(TLColor.accentText)
                        }
                    }
                    themePicker
                    signOutButton
                }
            }
            .padding(20)
        }
        .background(TLColor.bg)
        .navigationTitle("Hồ sơ")
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.load() }
    }

    private var communitySection: some View {
        VStack(spacing: 10) {
            communityRow(icon: "text.bubble.fill", title: "Diễn đàn") { ForumListView() }
            communityRow(icon: "figure.pickleball", title: "Tìm bạn chơi") { FindPlayersView() }
            communityRow(icon: "bubble.left.and.bubble.right.fill", title: "Tin nhắn") { MessagesView() }
        }
    }

    private func communityRow<D: View>(icon: String, title: String, @ViewBuilder destination: @escaping () -> D) -> some View {
        NavigationLink { destination() } label: {
            HStack(spacing: 12) {
                Image(systemName: icon).font(.system(size: 15)).foregroundStyle(TLColor.accentText).frame(width: 22)
                Text(title).font(TLFont.sans(15, .medium)).foregroundStyle(TLColor.fg)
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(TLColor.fg3)
            }
            .padding(14)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func accountSettingsLink(_ profile: Profile) -> some View {
        NavigationLink {
            AccountSettingsView(profile: profile) { Task { await model.load() } }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "gearshape.fill").font(.system(size: 15)).foregroundStyle(TLColor.accentText)
                Text("Cài đặt tài khoản").font(TLFont.sans(15, .medium)).foregroundStyle(TLColor.fg)
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(TLColor.fg3)
            }
            .padding(14)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var themePicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Giao diện")
                .font(TLFont.mono(10, .semibold)).tracking(1).textCase(.uppercase)
                .foregroundStyle(TLColor.fg3)
            TLSegmented(
                options: ThemeMode.allCases,
                selection: Binding(get: { theme.mode }, set: { theme.mode = $0 }),
                label: { $0.label }
            )
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var signOutButton: some View {
        Button(role: .destructive) {
            Task { await session.signOut() }
        } label: {
            Text("Đăng xuất")
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
        }
        .foregroundStyle(TLColor.live)
        .overlay(
            RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous)
                .strokeBorder(TLColor.border2, lineWidth: 1)
        )
    }
}
