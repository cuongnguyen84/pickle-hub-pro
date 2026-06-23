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
    @State private var model = ProfileViewModel()

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                switch model.phase {
                case .loading:
                    ProgressView().tint(TLColor.green).padding(.top, 60)

                case .loaded(let profile):
                    RatingCardView(profile: profile, isOwn: true)
                    signOutButton

                case .failed(let message):
                    TLCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Label("Không tải được hồ sơ", systemImage: "xmark.octagon.fill")
                                .foregroundStyle(TLColor.live)
                                .font(.headline)
                            Text(message).font(.caption).foregroundStyle(TLColor.fg3).textSelection(.enabled)
                            Button("Thử lại") { Task { await model.load() } }
                                .foregroundStyle(TLColor.green)
                        }
                    }
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
