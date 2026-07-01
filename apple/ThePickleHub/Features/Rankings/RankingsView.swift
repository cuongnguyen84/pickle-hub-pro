import SwiftUI

/// Native `/rankings` — DUPR leaderboard. Scope selector (Vietnam live + DUPR.com
/// snapshot for Open/Junior/continents) over per-scope format tabs. Tapping a
/// live Vietnam player opens their native profile; snapshot rows are inert.
struct RankingsView: View {
    @State private var model = RankingsViewModel()

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                scopeChips.padding(.bottom, 12)
                formatChips.padding(.horizontal, 16).padding(.bottom, 16)
                content
                if !model.scope.isVietnam {
                    attribution.padding(.top, 20)
                }
            }
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .background(TLColor.bg)
        .navigationTitle("Xếp hạng")
        .navigationBarTitleDisplayMode(.large)
        .task { await model.load() }
    }

    // MARK: Scope selector

    private var scopeChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(DuprScope.allCases) { s in
                    let selected = s == model.scope
                    Button { Haptics.light(); Task { await model.selectScope(s) } } label: {
                        Text(s.labelVi)
                            .font(TLFont.sans(13, selected ? .semibold : .medium))
                            .foregroundStyle(selected ? TLColor.accentInk : TLColor.fg2)
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(selected ? TLColor.accent : TLColor.surface, in: Capsule())
                            .overlay(Capsule().strokeBorder(selected ? .clear : TLColor.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: Format tabs

    private var formatChips: some View {
        HStack(spacing: 8) {
            ForEach(model.formats) { f in
                let selected = f == model.format
                Button { Haptics.light(); Task { await model.selectFormat(f) } } label: {
                    Text(f.labelVi)
                        .font(TLFont.mono(11, selected ? .bold : .medium)).tracking(0.4)
                        .foregroundStyle(selected ? TLColor.accentText : TLColor.fg3)
                        .frame(maxWidth: .infinity).padding(.vertical, 8)
                        .background((selected ? TLColor.accent.opacity(0.12) : .clear), in: Capsule())
                        .overlay(Capsule().strokeBorder(selected ? TLColor.accent.opacity(0.4) : TLColor.border, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: Rows

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            ProgressView().tint(TLColor.accentText).padding(.top, 60)
        case .failed(let message):
            TLErrorState(title: "Không tải được bảng xếp hạng", message: message) { Task { await model.load() } }
        case .loaded where model.rows.isEmpty:
            TLEmptyState(icon: "trophy", title: "Chưa có dữ liệu",
                         subtitle: "Bảng xếp hạng cho mục này sẽ cập nhật sau.")
                .padding(.top, 40)
        case .loaded:
            LazyVStack(spacing: 0) {
                ForEach(model.rows) { row in
                    if let username = row.username {
                        NavigationLink { PlayerProfileView(username: username) } label: {
                            RankingRowView(row: row)
                        }
                        .buttonStyle(.plain)
                    } else {
                        RankingRowView(row: row)
                    }
                    Rectangle().fill(TLColor.border).frame(height: 1).padding(.leading, 16)
                }
            }
        }
    }

    private var attribution: some View {
        VStack(spacing: 4) {
            Text("Nguồn: DUPR.com").font(TLFont.mono(10, .semibold)).foregroundStyle(TLColor.fg3)
            Text("Ảnh chụp \(duprLastUpdated)").font(TLFont.mono(9)).foregroundStyle(TLColor.fg4)
        }
        .frame(maxWidth: .infinity)
    }
}

private struct RankingRowView: View {
    let row: RankRow

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
                Text(row.name)
                    .font(TLFont.sans(15, .semibold))
                    .foregroundStyle(TLColor.fg)
                    .lineLimit(1)
                if let subtitle = row.subtitle?.nonEmpty {
                    Text(subtitle)
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
                    TLColor.surface2
                }
            } else {
                Text(String(row.name.prefix(1)).uppercased())
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
