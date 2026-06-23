import SwiftUI

/// Lightweight Home landing. For now it's an entry hub to the native surfaces
/// that live outside the bottom tabs (Rankings today; more as phases land).
struct HomeHub: View {
    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                NavigationLink {
                    TournamentsView()
                } label: {
                    HubCard(
                        icon: "trophy.circle.fill",
                        title: "Giải đấu",
                        subtitle: "Theo dõi các giải pro & cộng đồng"
                    )
                }
                .buttonStyle(.plain)

                NavigationLink {
                    RankingsView()
                } label: {
                    HubCard(
                        icon: "chart.bar.fill",
                        title: "Bảng xếp hạng",
                        subtitle: "DUPR Việt Nam · Đôi & Đơn"
                    )
                }
                .buttonStyle(.plain)
            }
            .padding(20)
        }
        .background(TLColor.bg)
    }
}

private struct HubCard: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(TLColor.accent)
                .frame(width: 44, height: 44)
                .background(TLColor.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(TLFont.sans(17, .semibold))
                    .foregroundStyle(TLColor.fg)
                Text(subtitle)
                    .font(TLFont.mono(11))
                    .foregroundStyle(TLColor.fg3)
            }

            Spacer(minLength: 8)

            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(TLColor.fg4)
        }
        .feedCard()
    }
}
