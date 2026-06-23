import SwiftUI

/// Native list of pro tournaments, ordered ongoing → upcoming → ended. Tapping
/// a card pushes the native detail.
struct TournamentsView: View {
    @State private var model = TournamentsViewModel()

    var body: some View {
        ScrollView {
            content
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 24)
        }
        .background(TLColor.bg)
        .navigationTitle("Giải đấu")
        .navigationBarTitleDisplayMode(.large)
        .task { await model.load() }
        .refreshable { await model.load() }
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            ProgressView().tint(TLColor.accentText).padding(.top, 60)
        case .failed(let message):
            errorState(message)
        case .loaded where model.tournaments.isEmpty:
            Text("Chưa có giải đấu nào.")
                .font(TLFont.sans(14)).foregroundStyle(TLColor.fg3).padding(.top, 60)
        case .loaded:
            LazyVStack(spacing: 12) {
                ForEach(model.tournaments) { tournament in
                    NavigationLink {
                        TournamentDetailView(tournament: tournament)
                    } label: {
                        TournamentCard(tournament: tournament)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "trophy").font(.largeTitle).foregroundStyle(TLColor.fg3)
            Text("Không tải được giải đấu")
                .font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
            Text(message).font(TLFont.sans(12)).foregroundStyle(TLColor.fg3)
                .multilineTextAlignment(.center)
            Button("Thử lại") { Task { await model.load() } }
                .foregroundStyle(TLColor.accentText)
        }
        .frame(maxWidth: .infinity).padding(.horizontal, 32).padding(.top, 60)
    }
}

private struct TournamentCard: View {
    let tournament: Tournament

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            TournamentStatusBadge(kind: tournament.kind)

            Text(tournament.name)
                .font(TLFont.serif(22))
                .foregroundStyle(TLColor.fg)
                .lineSpacing(1)
                .lineLimit(3)
                .fixedSize(horizontal: false, vertical: true)

            if let range = tournament.dateRange {
                Label(range, systemImage: "calendar")
                    .font(TLFont.mono(11))
                    .foregroundStyle(TLColor.fg3)
            }

            if let org = tournament.organization?.name {
                Text(org)
                    .font(TLFont.mono(10))
                    .foregroundStyle(TLColor.fg4)
                    .lineLimit(1)
            }
        }
        .feedCard()
    }
}
