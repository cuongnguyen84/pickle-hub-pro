import SwiftUI

/// "Sắp diễn ra." — upcoming/ongoing tournaments (the web also merges scheduled
/// streams; those arrive with LiveSection). Empty state mirrors the web copy.
struct HomeUpcomingSection: View {
    let tournaments: [Tournament]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                HomeSectionHeader(title: "Sắp diễn ra.")
                Text("Lịch giải, lịch sóng — 30 ngày kế tiếp, sắp xếp theo thứ tự có mặt.")
                    .font(TLFont.sans(14))
                    .foregroundStyle(TLColor.fg3)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if tournaments.isEmpty {
                emptyCard
            } else {
                VStack(spacing: 10) {
                    ForEach(tournaments) { tournament in
                        NavigationLink {
                            TournamentDetailView(tournament: tournament)
                        } label: {
                            row(tournament)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func row(_ tournament: Tournament) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                TournamentStatusBadge(kind: tournament.kind)
                Text(tournament.name)
                    .font(TLFont.serif(18))
                    .foregroundStyle(TLColor.fg)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                if let range = tournament.dateRange {
                    Text(range).font(TLFont.mono(10)).foregroundStyle(TLColor.fg4)
                }
            }
            Spacer(minLength: 8)
            Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(TLColor.fg4)
        }
        .feedCard()
    }

    private var emptyCard: some View {
        VStack(spacing: 8) {
            Text("CHƯA CÓ SỰ KIỆN SẮP TỚI")
                .font(TLFont.mono(11, .semibold)).tracking(1).foregroundStyle(TLColor.fg3)
            Text("Lịch sẽ cập nhật khi giải mở đăng ký hoặc stream được lên lịch.")
                .font(TLFont.sans(13)).foregroundStyle(TLColor.fg4)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
        .padding(.horizontal, 20)
        .overlay(
            RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous)
                .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
                .foregroundStyle(TLColor.border2)
        )
    }
}
