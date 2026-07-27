import SwiftUI

/// Native `/tournaments`: Watch (pro events + live) and Community (public brackets
/// across 4 formats). Defaults to Community unless there's pro/live watch content.
struct TournamentsView: View {
    @State private var model = TournamentsViewModel()
    @State private var navTarget: MyTournament?

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                segmented.padding(.horizontal, 16)
                content
                    .padding(.horizontal, 16)
                    .padding(.bottom, 24)
            }
            .padding(.top, 8)
        }
        .background(TLColor.bg)
        .navigationTitle("Giải đấu")
        .navigationBarTitleDisplayMode(.large)
        .task { await model.load() }
        .refreshable { await model.load() }
        .navigationDestination(item: $navTarget) { t in
            switch t.format {
            case .doublesElim: DoublesElimDetailView(shareID: t.shareID, fallbackName: t.displayName)
            case .teamMatch:   TeamMatchDetailView(shareID: t.shareID, fallbackName: t.displayName)
            case .flex:        FlexDetailView(shareID: t.shareID, fallbackName: t.displayName)
            case .quickTable:  QuickTableDetailView(shareID: t.shareID, fallbackName: t.displayName)
            }
        }
    }

    private var segmented: some View {
        TLSegmented(
            options: [.watch, .community],
            selection: Binding(get: { model.tab }, set: { model.userTab = $0 }),
            label: { tab in
                switch tab {
                case .watch: return "Theo dõi"
                case .community: return model.communityCount > 0 ? "Cộng đồng \(model.communityCount)" : "Cộng đồng"
                }
            }
        )
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            TLLoadingView(rows: 4).padding(.top, 8)
        case .failed(let message):
            TLErrorState(message: message) { Task { await model.load() } }
        case .loaded:
            switch model.tab {
            case .watch: watchList
            case .community: communityList
            }
        }
    }

    // MARK: Watch (pro)

    @ViewBuilder
    private var watchList: some View {
        if model.tournaments.isEmpty {
            TLEmptyState(icon: "trophy", title: "Chưa có giải chuyên nghiệp",
                         subtitle: "Các giải PPA, APP, MLP sẽ xuất hiện khi có lịch.")
        } else {
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

    // MARK: Community

    /// nil = all formats. Web parity: `${title} · ${titleVi}` labels.
    private static let formatOptions: [(value: BracketFormat?, label: String)] =
        [(nil, "Tất cả thể thức")] +
        [BracketFormat.quickTable, .doublesElim, .flex, .teamMatch]
            .map { ($0, "\($0.titleEn) · \($0.labelVi)") }

    @ViewBuilder
    private var communityList: some View {
        VStack(spacing: 12) {
            TLSelect(
                label: "Thể thức",
                options: Self.formatOptions,
                selection: Binding(get: { model.communityFormat },
                                   set: { model.communityFormat = $0 })
            )
            TLSegmented(
                options: [TournamentsViewModel.CommunityStatus.ongoing, .ended],
                selection: Binding(
                    get: { model.communityStatus },
                    set: { status in
                        model.communityStatus = status
                        if status == .ended { Task { await model.loadEndedIfNeeded() } }
                    }
                ),
                label: { $0 == .ongoing ? "Đang diễn ra" : "Đã kết thúc" }
            )

            if model.endedLoading {
                TLLoadingView(rows: 3).padding(.top, 4)
            } else if model.filteredCommunity.isEmpty {
                TLEmptyState(
                    icon: "person.3",
                    title: model.communityStatus == .ongoing
                        ? "Chưa có giải nào đang diễn ra"
                        : "Chưa có giải nào đã kết thúc",
                    subtitle: "Tạo bảng đấu miễn phí trong tab Công cụ.")
            } else {
                LazyVStack(spacing: 12) {
                    ForEach(model.filteredCommunity) { t in
                        Button { navTarget = t } label: { CommunityCard(tournament: t) }
                            .buttonStyle(.plain)
                    }
                }
            }
        }
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

/// Community bracket card — state badge + serif name + format meta.
private struct CommunityCard: View {
    let tournament: MyTournament

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            let s = tournament.state
            Text(s.label.uppercased())
                .font(TLFont.mono(9, .bold)).tracking(0.8)
                .foregroundStyle(s.isAccent ? TLColor.accentInk : TLColor.fg3)
                .padding(.horizontal, 8).padding(.vertical, 3)
                .background(s.isAccent ? TLColor.accent : TLColor.surface2, in: Capsule())

            Text(tournament.displayName)
                .font(TLFont.serif(22))
                .foregroundStyle(TLColor.fg)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 8) {
                metaText.font(TLFont.mono(10.5))
                if !tournament.dateText.isEmpty {
                    Text("·").foregroundStyle(TLColor.fg4)
                    Text(tournament.dateText).font(TLFont.mono(10)).foregroundStyle(TLColor.fg4)
                }
            }
        }
        .feedCard()
    }

    /// Meta line with the social-proof registration badge (#429). The badge
    /// REPLACES the capacity token on Quick Tables — never both numbers side by
    /// side ("which number is which" trap, same rule as the web renderMeta).
    private var metaText: Text {
        guard let reg = tournament.regBadgeText else {
            return Text(tournament.metaLine).foregroundStyle(TLColor.fg3)
        }
        let prefix = tournament.format == .quickTable
            ? (tournament.isDoubles ? "Đôi" : "Đơn")
            : tournament.metaLine
        return Text("\(prefix) · ").foregroundStyle(TLColor.fg3)
            + Text(reg).foregroundStyle(TLColor.accentText)
    }
}
