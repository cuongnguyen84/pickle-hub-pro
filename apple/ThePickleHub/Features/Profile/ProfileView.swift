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
    @State private var langChoice = AppLanguage.current
    @State private var showLanguageRestartNote = false

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                switch model.phase {
                case .loading:
                    ProgressView().tint(TLColor.accentText).padding(.top, 60)

                case .loaded(let profile):
                    RatingCardView(profile: profile, isOwn: true)
                    NavigationLink { OnboardingView(profile: profile) { Task { await model.load() } } } label: {
                        onboardingRowLabel(profile)
                    }.buttonStyle(.plain)
                    communitySection
                    accountSettingsLink(profile)
                    themePicker
                    languagePicker
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
                    languagePicker
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

    /// "Thiết lập hồ sơ" — prompts profile completion (username/skill) when the
    /// user has no username yet, else offers to edit it.
    private func onboardingRowLabel(_ profile: Profile) -> some View {
        let needs = (profile.username?.nonEmpty == nil)
        return HStack(spacing: 12) {
            Image(systemName: needs ? "sparkles" : "person.text.rectangle")
                .font(.system(size: 15)).foregroundStyle(TLColor.accentText).frame(width: 22)
            VStack(alignment: .leading, spacing: 2) {
                Text(needs ? "Hoàn tất hồ sơ" : "Thiết lập hồ sơ").font(TLFont.sans(15, .medium)).foregroundStyle(TLColor.fg)
                if needs {
                    Text("Đặt username + trình độ").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg3)
                }
            }
            Spacer()
            Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(TLColor.fg3)
        }
        .padding(14)
        .background((needs ? TLColor.accent.opacity(0.06) : TLColor.surface), in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(needs ? TLColor.accent.opacity(0.4) : TLColor.border, lineWidth: 1))
    }

    private var communitySection: some View {
        VStack(spacing: 10) {
            communityRow(icon: "text.bubble.fill", title: "Diễn đàn") { ForumListView() }
            communityRow(icon: "figure.pickleball", title: String(localized: "Tìm bạn chơi")) { FindPlayersView() }
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

    /// D3: hàng "Ngôn ngữ" — đổi per-app AppleLanguages, hiệu lực sau khi mở lại app.
    private var languagePicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Ngôn ngữ")
                .font(TLFont.mono(10, .semibold)).tracking(1).textCase(.uppercase)
                .foregroundStyle(TLColor.fg3)
            TLSegmented(
                options: [AppLanguage.vi, .en, .system],
                selection: Binding(get: { langChoice }, set: { choice in
                    guard choice != langChoice else { return }
                    langChoice = choice
                    AppLanguage.apply(choice)
                    showLanguageRestartNote = true
                }),
                label: { choice in
                    switch choice {
                    case .vi: "Tiếng Việt"   // tên ngôn ngữ giữ nguyên bản xứ — không dịch
                    case .en: "English"      // tên ngôn ngữ giữ nguyên bản xứ — không dịch
                    case .system: String(localized: "Theo máy")
                    }
                }
            )
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .alert("Khởi động lại ứng dụng để áp dụng ngôn ngữ mới.", isPresented: $showLanguageRestartNote) {
            Button("OK") {}
        }
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
