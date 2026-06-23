import SwiftUI

/// Native tournament detail with the core info we hold; brackets/schedule and
/// livestream/video tabs live on the web for now (and Phase 6).
struct TournamentDetailView: View {
    let tournament: Tournament

    @State private var showWeb = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                TournamentStatusBadge(kind: tournament.kind)

                Text(tournament.name)
                    .font(TLFont.serif(32))
                    .foregroundStyle(TLColor.fg)
                    .lineSpacing(2)
                    .fixedSize(horizontal: false, vertical: true)

                VStack(alignment: .leading, spacing: 8) {
                    if let range = tournament.dateRange {
                        Label(range, systemImage: "calendar")
                            .font(TLFont.mono(12))
                            .foregroundStyle(TLColor.fg2)
                    }
                    if let org = tournament.organization?.name {
                        Label(org, systemImage: "building.2")
                            .font(TLFont.mono(12))
                            .foregroundStyle(TLColor.fg2)
                    }
                }

                if let description = tournament.description?.nonEmpty {
                    Text(description)
                        .font(TLFont.sans(16))
                        .foregroundStyle(TLColor.fg2)
                        .lineSpacing(5)
                        .fixedSize(horizontal: false, vertical: true)
                }

                TLPrimaryButton(title: "Xem trên web") { showWeb = true }
                    .padding(.top, 4)
            }
            .padding(20)
        }
        .background(TLColor.bg)
        .navigationTitle("Giải đấu")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showWeb) {
            SafariView(url: WebRoutes.tournament(slug: tournament.slug)).ignoresSafeArea()
        }
    }
}
