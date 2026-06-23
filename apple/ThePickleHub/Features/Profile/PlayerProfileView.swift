import SwiftUI

@Observable
final class PlayerProfileViewModel {
    enum Phase: Equatable {
        case loading
        case loaded(Profile, PlayerStats?)
        case notPublic
        case failed(String)
    }

    var phase: Phase = .loading
    private let repo = ProfileRepository()

    @MainActor
    func load(username: String) async {
        phase = .loading
        do {
            guard let profile = try await repo.profile(username: username) else {
                phase = .notPublic
                return
            }
            // Stats are best-effort — a failure here shouldn't blank the card.
            let stats = try? await repo.stats(username: username)
            phase = .loaded(profile, stats)
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }
}

/// Read-only profile for another player, reached by tapping a ranking row or a
/// match handle. Reuses the shared `RatingCardView` credential and adds a small
/// match-stats strip. Honors the same public-profile gate as the web.
struct PlayerProfileView: View {
    let username: String
    @State private var model = PlayerProfileViewModel()

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                switch model.phase {
                case .loading:
                    ProgressView().tint(TLColor.accentText).padding(.top, 60)

                case .loaded(let profile, let stats):
                    RatingCardView(profile: profile, isOwn: false)
                    if let stats {
                        statsStrip(stats)
                    }
                    if let bio = profile.bio?.nonEmpty {
                        bioCard(bio)
                    }

                case .notPublic:
                    emptyState(
                        icon: "lock.fill",
                        title: "Hồ sơ không công khai",
                        message: "Người chơi này chưa mở hồ sơ công khai."
                    )

                case .failed(let message):
                    TLCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Label("Không tải được hồ sơ", systemImage: "xmark.octagon.fill")
                                .foregroundStyle(TLColor.live)
                                .font(.headline)
                            Text(message).font(.caption).foregroundStyle(TLColor.fg3).textSelection(.enabled)
                            Button("Thử lại") { Task { await model.load(username: username) } }
                                .foregroundStyle(TLColor.accentText)
                        }
                    }
                }
            }
            .padding(20)
        }
        .background(TLColor.bg)
        .navigationTitle("@\(username)")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: username) { await model.load(username: username) }
    }

    // MARK: Stats strip

    private func statsStrip(_ stats: PlayerStats) -> some View {
        TLCard {
            VStack(spacing: 14) {
                HStack(spacing: 0) {
                    statCell("Trận", "\(stats.totalMatches)")
                    divider
                    statCell("Thắng", "\(stats.wins)")
                    divider
                    statCell("Thua", "\(stats.losses)")
                    divider
                    statCell("Tỉ lệ", String(format: "%.0f%%", stats.winRate))
                }
                if let form = stats.last5Form?.nonEmpty {
                    formRow(form)
                }
            }
        }
    }

    private func statCell(_ label: String, _ value: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(TLFont.mono(20, .bold)).monospacedDigit()
                .foregroundStyle(TLColor.fg)
            Text(label)
                .font(TLFont.mono(9, .medium)).tracking(0.8).textCase(.uppercase)
                .foregroundStyle(TLColor.fg3)
        }
        .frame(maxWidth: .infinity)
    }

    private var divider: some View {
        Rectangle().fill(TLColor.border).frame(width: 1, height: 28)
    }

    private func formRow(_ form: String) -> some View {
        HStack(spacing: 6) {
            Text("PHONG ĐỘ")
                .font(TLFont.mono(9, .medium)).tracking(0.8)
                .foregroundStyle(TLColor.fg3)
            Spacer(minLength: 8)
            ForEach(Array(form.prefix(5).enumerated()), id: \.offset) { _, char in
                let isWin = char == "W"
                Text(isWin ? "T" : "B")
                    .font(TLFont.mono(11, .bold))
                    .foregroundStyle(isWin ? TLColor.accentInk : TLColor.fg2)
                    .frame(width: 22, height: 22)
                    .background(isWin ? TLColor.accent : TLColor.surface2, in: Circle())
            }
        }
    }

    private func bioCard(_ bio: String) -> some View {
        TLCard {
            Text(bio)
                .font(TLFont.sans(14))
                .foregroundStyle(TLColor.fg2)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func emptyState(icon: String, title: String, message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: icon).font(.largeTitle).foregroundStyle(TLColor.fg3)
            Text(title).font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
            Text(message)
                .font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity).padding(.top, 60).padding(.horizontal, 24)
    }
}
