import SwiftUI

/// Native Vietnam DUPR leaderboard with a Đôi/Đơn toggle. Tapping a player
/// pushes their native profile (gated to public profiles).
struct RankingsView: View {
    @State private var model = RankingsViewModel()
    @State private var format: RankingsRepository.Format = .doubles

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                formatToggle
                    .padding(.horizontal, 16)
                    .padding(.bottom, 16)

                content
            }
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .background(TLColor.bg)
        .navigationTitle("Xếp hạng")
        .navigationBarTitleDisplayMode(.large)
        .task(id: format) { await model.load(format: format) }
    }

    private var formatToggle: some View {
        TLSegmented(options: RankingsRepository.Format.allCases,
                    selection: $format,
                    label: { $0.label })
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            ProgressView().tint(TLColor.accentText).padding(.top, 60)
        case .failed(let message):
            errorState(message)
        case .loaded where model.rows.isEmpty:
            Text("Chưa có ai trong bảng xếp hạng.")
                .font(TLFont.sans(14))
                .foregroundStyle(TLColor.fg3)
                .padding(.top, 60)
        case .loaded:
            LazyVStack(spacing: 0) {
                ForEach(model.rows) { row in
                    NavigationLink {
                        PlayerProfileView(username: row.username)
                    } label: {
                        RankingRowView(row: row)
                    }
                    .buttonStyle(.plain)
                    Rectangle().fill(TLColor.border).frame(height: 1)
                        .padding(.leading, 16)
                }
            }
        }
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "trophy")
                .font(.largeTitle).foregroundStyle(TLColor.fg3)
            Text("Không tải được bảng xếp hạng")
                .font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
            Text(message)
                .font(TLFont.sans(12)).foregroundStyle(TLColor.fg3)
                .multilineTextAlignment(.center)
            Button("Thử lại") { Task { await model.load(format: format) } }
                .foregroundStyle(TLColor.accentText)
        }
        .frame(maxWidth: .infinity).padding(.horizontal, 32).padding(.top, 60)
    }
}

private struct RankingRowView: View {
    let row: RankingRow

    private var rankColor: Color {
        switch row.rank {
        case 1: return TLColor.gold
        case 2, 3: return TLColor.fg
        default: return TLColor.fg3
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            Text(row.rankText)
                .font(TLFont.mono(15, .semibold))
                .foregroundStyle(rankColor)
                .frame(width: 30, alignment: .trailing)

            avatar

            VStack(alignment: .leading, spacing: 2) {
                Text(row.resolvedName)
                    .font(TLFont.sans(15, .semibold))
                    .foregroundStyle(TLColor.fg)
                    .lineLimit(1)
                if let city = row.city?.nonEmpty {
                    Text(city)
                        .font(TLFont.mono(10))
                        .foregroundStyle(TLColor.fg4)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 8)

            if row.isStale {
                Image(systemName: "circle.lefthalf.filled")
                    .font(.system(size: 10))
                    .foregroundStyle(TLColor.fg4)
            }
            Text(row.ratingText)
                .font(TLFont.mono(16, .semibold))
                .monospacedDigit()
                .foregroundStyle(TLColor.accentText)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }

    private var avatar: some View {
        Group {
            if let urlString = row.avatarURL, let url = WebRoutes.asset(urlString) {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Color(hex: 0x18181B)
                }
            } else {
                Text(String(row.resolvedName.prefix(1)).uppercased())
                    .font(TLFont.sans(13, .bold))
                    .foregroundStyle(TLColor.accentText)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(TLColor.surface2)
            }
        }
        .frame(width: 32, height: 32)
        .clipShape(Circle())
        .overlay(Circle().strokeBorder(TLColor.border, lineWidth: 1))
    }
}
