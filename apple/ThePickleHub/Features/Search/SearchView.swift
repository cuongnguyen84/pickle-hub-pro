import SwiftUI

@Observable
final class SearchViewModel {
    var query = ""
    var results = SearchResults()
    var searching = false
    var hasSearched = false

    private let repo = SearchRepository()
    private var task: Task<Void, Never>?

    func scheduleSearch() {
        task?.cancel()
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard q.count >= 2 else { results = SearchResults(); hasSearched = false; searching = false; return }
        searching = true
        task = Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(300))
            if Task.isCancelled { return }
            let r = await repo.search(q)
            if Task.isCancelled { return }
            results = r
            hasSearched = true
            searching = false
        }
    }
}

/// Native global search — players, tournaments, videos. Players → native profile,
/// tournament → native detail, video → native player. Mirrors web `/search`
/// (media + tournaments) and adds player search (the high-value mobile case).
struct SearchView: View {
    @State private var model = SearchViewModel()
    @State private var tournamentTarget: TournamentTarget?
    @State private var profileTarget: IdentifiedUsername?
    @State private var videoTarget: SearchVideoHit?

    private struct IdentifiedUsername: Identifiable, Hashable { let id: String }
    /// id-keyed wrapper so `navigationDestination(item:)` (needs Hashable) works
    /// without making the shared Tournament model Hashable.
    private struct TournamentTarget: Identifiable, Hashable {
        let tournament: Tournament
        var id: UUID { tournament.id }
        static func == (l: Self, r: Self) -> Bool { l.id == r.id }
        func hash(into h: inout Hasher) { h.combine(id) }
    }

    var body: some View {
        ScrollView {
            content.padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 28)
        }
        .background(TLColor.bg)
        .navigationTitle("Tìm kiếm")
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: Binding(get: { model.query }, set: { model.query = $0 }),
                    placement: .navigationBarDrawer(displayMode: .always),
                    prompt: "Người chơi, giải đấu, video…")
        .onChange(of: model.query) { _, _ in model.scheduleSearch() }
        .navigationDestination(item: $tournamentTarget) { TournamentDetailView(tournament: $0.tournament) }
        .navigationDestination(item: $profileTarget) { PlayerProfileView(username: $0.id) }
        .navigationDestination(item: $videoTarget) { FeedVideoPlayerView(video: $0.asFeedVideo) }
    }

    @ViewBuilder
    private var content: some View {
        if model.searching && model.results.isEmpty {
            ProgressView().tint(TLColor.accentText).frame(maxWidth: .infinity).padding(.top, 60)
        } else if model.query.trimmingCharacters(in: .whitespaces).count < 2 {
            hint("Nhập từ khoá để tìm người chơi, giải đấu, video.")
        } else if model.hasSearched && model.results.isEmpty {
            hint("Không tìm thấy kết quả cho “\(model.query)”.")
        } else {
            VStack(alignment: .leading, spacing: 22) {
                if !model.results.players.isEmpty {
                    section("Người chơi") {
                        ForEach(model.results.players) { p in playerRow(p) }
                    }
                }
                if !model.results.tournaments.isEmpty {
                    section("Giải đấu") {
                        ForEach(model.results.tournaments) { t in tournamentRow(t) }
                    }
                }
                if !model.results.videos.isEmpty {
                    section("Video") {
                        ForEach(model.results.videos) { v in videoRow(v) }
                    }
                }
            }
        }
    }

    private func section(_ title: String, @ViewBuilder _ rows: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                RoundedRectangle(cornerRadius: 1).fill(TLColor.accent).frame(width: 3, height: 14)
                Text(title.uppercased()).font(TLFont.mono(11, .semibold)).tracking(1).foregroundStyle(TLColor.fg)
            }
            VStack(spacing: 8) { rows() }
        }
    }

    private func playerRow(_ p: SearchPlayerHit) -> some View {
        Button {
            guard let username = p.username else { return }
            Haptics.light(); profileTarget = IdentifiedUsername(id: username)
        } label: {
            HStack(spacing: 12) {
                avatar(p.avatarURL, initial: p.displayName.first.map { String($0).uppercased() } ?? "?")
                VStack(alignment: .leading, spacing: 2) {
                    Text(p.displayName).font(TLFont.sans(14.5, .semibold)).foregroundStyle(TLColor.fg).lineLimit(1)
                    if let u = p.username { Text("@\(u)").font(TLFont.mono(10)).foregroundStyle(TLColor.fg4).lineLimit(1) }
                }
                Spacer(minLength: 6)
                if let rating = p.rating {
                    Text(String(format: "%.2f", rating)).font(TLFont.mono(13, .semibold)).foregroundStyle(TLColor.accentText)
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(TLColor.border, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain).disabled(p.username == nil)
    }

    private func tournamentRow(_ t: Tournament) -> some View {
        Button { Haptics.light(); tournamentTarget = TournamentTarget(tournament: t) } label: {
            HStack(spacing: 12) {
                Image(systemName: "trophy.fill").font(.system(size: 15)).foregroundStyle(TLColor.accentText)
                    .frame(width: 34, height: 34).background(TLColor.accent.opacity(0.12), in: Circle())
                VStack(alignment: .leading, spacing: 2) {
                    Text(t.name).font(TLFont.sans(14.5, .semibold)).foregroundStyle(TLColor.fg).lineLimit(1)
                    Text(t.kind.label).font(TLFont.mono(10)).foregroundStyle(TLColor.fg3)
                }
                Spacer(minLength: 6)
                Image(systemName: "chevron.right").font(.system(size: 11, weight: .bold)).foregroundStyle(TLColor.fg4)
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(TLColor.border, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func videoRow(_ v: SearchVideoHit) -> some View {
        Button { Haptics.light(); videoTarget = v } label: {
            HStack(spacing: 12) {
                ZStack {
                    if let thumb = v.thumbnailURL, let url = WebRoutes.asset(thumb) {
                        AsyncImage(url: url) { img in img.resizable().scaledToFill() } placeholder: { TLColor.surface2 }
                    } else { TLColor.surface2 }
                    Image(systemName: "play.circle.fill").font(.system(size: 20)).foregroundStyle(.white.opacity(0.9))
                }
                .frame(width: 64, height: 40).clipShape(RoundedRectangle(cornerRadius: 8))
                Text(v.title).font(TLFont.sans(14, .medium)).foregroundStyle(TLColor.fg).lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if let d = FeedFormat.duration(v.durationSeconds) {
                    Text(d).font(TLFont.mono(10)).foregroundStyle(TLColor.fg4)
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(TLColor.border, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func avatar(_ urlString: String?, initial: String) -> some View {
        Group {
            if let urlString, let url = URL(string: urlString) {
                AsyncImage(url: url) { img in img.resizable().scaledToFill() } placeholder: { initialAvatar(initial) }
            } else { initialAvatar(initial) }
        }
        .frame(width: 36, height: 36).clipShape(Circle())
        .overlay(Circle().strokeBorder(TLColor.border, lineWidth: 1))
    }

    private func initialAvatar(_ initial: String) -> some View {
        Text(initial).font(TLFont.sans(14, .bold)).foregroundStyle(TLColor.accentText)
            .frame(maxWidth: .infinity, maxHeight: .infinity).background(TLColor.surface2)
    }

    private func hint(_ text: String) -> some View {
        Text(text).font(TLFont.sans(13.5)).foregroundStyle(TLColor.fg3)
            .multilineTextAlignment(.center).frame(maxWidth: .infinity).padding(.horizontal, 32).padding(.top, 70)
    }
}
