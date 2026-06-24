import SwiftUI

@Observable
final class ToolsViewModel {
    enum Phase: Equatable { case loading, loaded, failed(String) }

    /// Which set of tournaments the list shows. `.all` is admin-only — every
    /// tournament on the platform, not just the ones the user created.
    enum Scope: String, CaseIterable, Identifiable {
        case mine, all
        var id: String { rawValue }
        var label: String { self == .mine ? "Của tôi" : "Tất cả" }
    }

    var phase: Phase = .loading
    var mine: [MyTournament] = []
    var all: [MyTournament] = []
    var isAdmin = false
    var scope: Scope = .mine
    var loadingAll = false
    var filter: ToolsFilter = .all
    var search = ""

    private let repo = ToolsRepository()
    private var loaded = false
    private var allLoaded = false

    /// Active dataset for the current scope.
    var tournaments: [MyTournament] { scope == .all ? all : mine }

    var showSearch: Bool { tournaments.count > 6 }

    var filtered: [MyTournament] {
        var list = tournaments
        if filter != .all { list = list.filter { $0.state.matchesFilter == filter } }
        let q = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if !q.isEmpty { list = list.filter { $0.displayName.lowercased().contains(q) } }
        return list
    }

    @MainActor
    func load() async {
        if loaded { return }
        phase = .loading
        async let mineTask = repo.myTournaments()
        async let adminTask = repo.isCurrentUserAdmin()
        mine = await mineTask
        isAdmin = await adminTask
        loaded = true
        phase = .loaded
    }

    @MainActor
    func reload() async {
        loaded = false
        allLoaded = false
        all = []
        await load()
        if scope == .all { await selectScope(.all) }
    }

    /// Switch scope. The admin "Tất cả" set is fetched lazily on first use, then cached.
    @MainActor
    func selectScope(_ next: Scope) async {
        scope = next
        guard next == .all, !allLoaded, !loadingAll else { return }
        loadingAll = true
        all = await repo.allTournaments()
        allLoaded = true
        loadingAll = false
    }
}

/// Tools tab — Bracket Lab. Design: "Phương Án 2 / luồng" — hero, format picker
/// (featured + compact rows), then the user's managed tournaments as rich cards.
/// Creating/scoring still opens the web until the native creation flow ships.
struct ToolsView: View {
    @State private var model = ToolsViewModel()
    @State private var openURL: IdentifiedURL?
    @State private var showFinder = false
    @State private var showCreate = false
    @State private var showCreateTeamMatch = false
    @State private var showCreateDoubles = false
    @State private var navTarget: MyTournament?
    @State private var createdTarget: CreatedRef?
    @State private var createdTeamMatch: CreatedRef?
    @State private var createdDoubles: CreatedRef?
    @State private var recentExpanded = false

    private let recentCap = 8

    struct CreatedRef: Identifiable, Hashable { let id: String; let name: String } // id = share_id

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    hero
                    formatSection
                    recentSection
                }
                .padding(.vertical, 18)
            }
            .background(TLColor.bg)
            .navigationTitle("Công cụ")
            .navigationBarTitleDisplayMode(.large)
            .task { await model.load() }
            .refreshable { await model.reload() }
            .sheet(item: $openURL) { SafariView(url: $0.url).ignoresSafeArea() }
            .sheet(isPresented: $showFinder) {
                FormatFinderSheet { url in openURL = IdentifiedURL(url: url) }
            }
            .sheet(isPresented: $showCreate) {
                CreateQuickTableView(onCreated: { shareID, name in
                    Task { await model.reload() }
                    createdTarget = CreatedRef(id: shareID, name: name)
                }, onOpenWeb: { url in
                    Task { await model.reload() }
                    openURL = IdentifiedURL(url: url)
                })
            }
            .navigationDestination(item: $navTarget) { t in
                switch t.format {
                case .doublesElim:
                    DoublesElimDetailView(shareID: t.shareID, fallbackName: t.displayName)
                case .teamMatch:
                    TeamMatchDetailView(shareID: t.shareID, fallbackName: t.displayName)
                default:
                    QuickTableDetailView(shareID: t.shareID, fallbackName: t.displayName)
                }
            }
            .sheet(isPresented: $showCreateTeamMatch) {
                CreateTeamMatchView { shareID, name in
                    Task { await model.reload() }
                    createdTeamMatch = CreatedRef(id: shareID, name: name)
                }
            }
            .navigationDestination(item: $createdTarget) { ref in
                QuickTableDetailView(shareID: ref.id, fallbackName: ref.name)
            }
            .navigationDestination(item: $createdTeamMatch) { ref in
                TeamMatchDetailView(shareID: ref.id, fallbackName: ref.name)
            }
            .sheet(isPresented: $showCreateDoubles) {
                CreateDoublesElimView { shareID, name in
                    Task { await model.reload() }
                    createdDoubles = CreatedRef(id: shareID, name: name)
                }
            }
            .navigationDestination(item: $createdDoubles) { ref in
                DoublesElimDetailView(shareID: ref.id, fallbackName: ref.name)
            }
        }
    }

    // MARK: Hero

    private var hero: some View {
        VStack(alignment: .leading, spacing: 13) {
            Text("BRACKET LAB")
                .font(TLFont.mono(11, .semibold)).tracking(2.4).foregroundStyle(TLColor.accentText)
            (Text("Tạo giải đấu ").foregroundColor(TLColor.fg)
                + Text("trong vài phút.").foregroundColor(TLColor.accentText))
                .font(TLFont.serif(31)).italic()
                .fixedSize(horizontal: false, vertical: true)
            Text("Chọn thể thức, mời người chơi và công bố bảng đấu — tất cả trong một luồng.")
                .font(TLFont.sans(14)).foregroundStyle(TLColor.fg3).lineSpacing(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 22)
    }

    // MARK: Section 01 — format picker

    private var formatSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            sectionHeader(num: "01", title: "Chọn thể thức").padding(.horizontal, 22)

            featuredCard.padding(.horizontal, 22).padding(.top, 15)

            VStack(spacing: 10) {
                compactFormatRow(icon: "arrow.triangle.branch", title: "Loại trực tiếp",
                                 meta: "Nhánh đơn / đôi · ≥16 đội", url: WebRoutes.toolsDoublesElimination,
                                 action: { Haptics.light(); showCreateDoubles = true })
                compactFormatRow(icon: "slider.horizontal.3", title: "Giải linh hoạt",
                                 meta: "Tùy biến hoàn toàn", url: WebRoutes.toolsFlexTournament)
                compactFormatRow(icon: "person.3.fill", title: "Đấu đồng đội",
                                 meta: "Thể thức MLP · đội 4–8", url: WebRoutes.toolsTeamMatch,
                                 action: { Haptics.light(); showCreateTeamMatch = true })
            }
            .padding(.horizontal, 22).padding(.top, 11)

            Button { showFinder = true } label: {
                HStack(spacing: 6) {
                    Image(systemName: "questionmark.circle").font(.system(size: 13))
                    Text("Không chắc chọn loại nào?").font(TLFont.sans(13, .medium))
                }
                .foregroundStyle(TLColor.accentText)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 22).padding(.top, 6)
        }
    }

    private var featuredCard: some View {
        Button { Haptics.light(); showCreate = true } label: {
            ZStack(alignment: .topTrailing) {
                Image(systemName: "tablecells")
                    .font(.system(size: 120, weight: .ultraLight))
                    .foregroundStyle(TLColor.accent.opacity(0.06))
                    .offset(x: 18, y: -14)
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 16) {
                    Text("PHỔ BIẾN NHẤT")
                        .font(TLFont.mono(9, .bold)).tracking(1.6)
                        .foregroundStyle(TLColor.accentText)
                        .padding(.horizontal, 9).padding(.vertical, 4)
                        .background(TLColor.accent.opacity(0.1), in: Capsule())
                        .overlay(Capsule().strokeBorder(TLColor.accent.opacity(0.42), lineWidth: 1))

                    HStack(alignment: .bottom, spacing: 12) {
                        VStack(alignment: .leading, spacing: 7) {
                            Text("Bảng đấu nhanh")
                                .font(TLFont.sans(20, .semibold)).foregroundStyle(TLColor.fg)
                            Text("Vòng tròn → playoff · tự xếp lịch")
                                .font(TLFont.mono(11)).foregroundStyle(TLColor.fg2)
                        }
                        Spacer(minLength: 8)
                        HStack(spacing: 6) {
                            Text("Bắt đầu").font(TLFont.sans(13, .bold))
                            Image(systemName: "arrow.right").font(.system(size: 12, weight: .bold))
                        }
                        .foregroundStyle(TLColor.accentInk)
                        .padding(.horizontal, 14).padding(.vertical, 9)
                        .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                    }
                }
                .padding(18)
            }
            .background(
                LinearGradient(colors: [TLColor.accent.opacity(0.16), TLColor.surface],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
            )
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(TLColor.accent.opacity(0.3), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Tạo Bảng đấu nhanh, thể thức phổ biến nhất")
    }

    private func compactFormatRow(icon: String, title: String, meta: String, url: URL,
                                  action: (() -> Void)? = nil) -> some View {
        Button { if let action { action() } else { open(url) } } label: {
            HStack(spacing: 14) {
                iconChip(icon)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg)
                    Text(meta).font(TLFont.mono(10.5)).foregroundStyle(TLColor.fg3)
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(TLColor.fg3).accessibilityHidden(true)
            }
            .padding(14)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(title), \(meta)")
    }

    private func iconChip(_ icon: String) -> some View {
        Image(systemName: icon)
            .font(.system(size: 17, weight: .regular)).foregroundStyle(TLColor.accentText)
            .frame(width: 40, height: 40)
            .background(TLColor.accent.opacity(0.1), in: RoundedRectangle(cornerRadius: 11, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 11, style: .continuous).strokeBorder(TLColor.accent.opacity(0.2), lineWidth: 1))
            .accessibilityHidden(true)
    }

    // MARK: Section 02 — my tournaments

    private var recentSection: some View {
        VStack(alignment: .leading, spacing: 13) {
            sectionHeader(num: "02", title: "Giải gần đây").padding(.horizontal, 22)

            switch model.phase {
            case .loading:
                skeletonCards.padding(.horizontal, 22)
            case .failed(let message):
                Text(message).font(TLFont.sans(12)).foregroundStyle(TLColor.fg3).padding(.horizontal, 22)
            case .loaded:
                if model.isAdmin { scopeToggle }
                if model.loadingAll {
                    skeletonCards.padding(.horizontal, 22)
                } else if model.tournaments.isEmpty {
                    emptyState.padding(.horizontal, 22)
                } else {
                filterChips
                if model.showSearch { searchField.padding(.horizontal, 22) }
                let items = model.filtered
                if items.isEmpty {
                    Text("Không có giải nào khớp bộ lọc.")
                        .font(TLFont.sans(13)).foregroundStyle(TLColor.fg3).padding(.horizontal, 22)
                } else {
                    let shown = recentExpanded ? items : Array(items.prefix(recentCap))
                    VStack(spacing: 12) {
                        ForEach(shown) { t in
                            TournamentCard(tournament: t) { manage(t) }
                        }
                    }
                    .padding(.horizontal, 22)
                    if !recentExpanded && items.count > recentCap {
                        Button {
                            Haptics.light()
                            withAnimation(.easeOut(duration: 0.2)) { recentExpanded = true }
                        } label: {
                            HStack(spacing: 6) {
                                Text("Xem thêm \(items.count - recentCap) giải").font(TLFont.sans(13, .semibold))
                                Image(systemName: "chevron.down").font(.system(size: 11, weight: .bold))
                            }
                            .foregroundStyle(TLColor.accentText)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                        }
                        .buttonStyle(.plain)
                        .padding(.horizontal, 22)
                    }
                }
                }
            }
        }
    }

    private var scopeToggle: some View {
        HStack(spacing: 8) {
            ForEach(ToolsViewModel.Scope.allCases) { s in
                let selected = model.scope == s
                Button {
                    Haptics.light()
                    Task { await model.selectScope(s) }
                } label: {
                    Text(s.label)
                        .font(TLFont.mono(11, selected ? .semibold : .medium)).tracking(0.4)
                        .foregroundStyle(selected ? TLColor.accentInk : TLColor.fg3)
                        .padding(.horizontal, 14).padding(.vertical, 7)
                        .background(selected ? TLColor.accent : Color.clear, in: Capsule())
                        .overlay(Capsule().strokeBorder(selected ? Color.clear : TLColor.border, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 22)
    }

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(ToolsFilter.allCases) { f in
                    let selected = model.filter == f
                    Button {
                        Haptics.light()
                        model.filter = f
                    } label: {
                        Text(f.label)
                            .font(TLFont.mono(11, selected ? .semibold : .medium)).tracking(0.4)
                            .foregroundStyle(selected ? TLColor.accentText : TLColor.fg3)
                            .padding(.horizontal, 13).padding(.vertical, 7)
                            .background((selected ? TLColor.accent.opacity(0.12) : Color.clear), in: Capsule())
                            .overlay(Capsule().strokeBorder(selected ? TLColor.accent.opacity(0.4) : TLColor.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 22)
        }
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass").font(.system(size: 13)).foregroundStyle(TLColor.fg4)
            TextField("Tìm theo tên", text: Binding(get: { model.search }, set: { model.search = $0 }))
                .font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private var skeletonCards: some View {
        VStack(spacing: 12) {
            ForEach(0..<2, id: \.self) { _ in
                VStack(alignment: .leading, spacing: 12) {
                    Text("Tên giải đấu").font(TLFont.sans(16, .semibold))
                    Capsule().fill(TLColor.surface2).frame(height: 5)
                    Text("Tạo 01.01.2026").font(TLFont.mono(10))
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .redacted(reason: .placeholder)
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "trophy").font(.system(size: 34)).foregroundStyle(TLColor.fg4)
            Text("Bạn chưa tạo giải nào")
                .font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
            Button { Haptics.light(); showCreate = true } label: {
                Text("Bắt đầu với Bảng đấu nhanh")
                    .font(TLFont.sans(14, .semibold)).foregroundStyle(TLColor.accentInk)
                    .padding(.horizontal, 16).padding(.vertical, 11)
                    .background(TLColor.accent, in: Capsule())
            }
            .buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 32)
    }

    // MARK: Helpers

    private func sectionHeader(num: String, title: String) -> some View {
        HStack(spacing: 11) {
            Text("/ \(num)").font(TLFont.mono(12, .bold)).foregroundStyle(TLColor.accentText)
            Text(title.uppercased()).font(TLFont.mono(12, .medium)).tracking(2).foregroundStyle(TLColor.fg2)
            Rectangle()
                .fill(LinearGradient(colors: [TLColor.accent.opacity(0.55), .clear], startPoint: .leading, endPoint: .trailing))
                .frame(height: 1)
        }
    }

    private func open(_ url: URL) {
        Haptics.light()
        openURL = IdentifiedURL(url: url)
    }

    /// Native formats push their detail view; the rest open the web.
    private func manage(_ t: MyTournament) {
        Haptics.light()
        if t.format.hasNativeView {
            navTarget = t
        } else {
            openURL = IdentifiedURL(url: t.format.webURL(shareID: t.shareID))
        }
    }
}

/// Rich card for a managed tournament: status badge, registration progress +
/// urgency, status-driven primary action (Share when open).
private struct TournamentCard: View {
    let tournament: MyTournament
    let onManage: () -> Void

    private var shareURL: URL { tournament.format.webURL(shareID: tournament.shareID) }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 10) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(tournament.displayName)
                        .font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg).lineLimit(1)
                    Text(tournament.metaLine)
                        .font(TLFont.mono(10.5)).foregroundStyle(TLColor.fg3)
                    if let creator = tournament.creatorName {
                        Text("bởi \(creator)")
                            .font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4).lineLimit(1)
                    }
                }
                Spacer(minLength: 8)
                statusBadge
            }

            if tournament.hasProgress {
                progressRow.padding(.top, 13)
            }

            footer.padding(.top, 13)
        }
        .padding(16)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
        .contentShape(Rectangle())
        .onTapGesture { onManage() }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(tournament.displayName), \(tournament.state.label)")
    }

    private var statusBadge: some View {
        Text(tournament.state.label.uppercased())
            .font(TLFont.mono(9, .bold)).tracking(1.2)
            .foregroundStyle(tournament.state.isAccent ? TLColor.accentText : TLColor.fg3)
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background((tournament.state.isAccent ? TLColor.accent.opacity(0.08) : Color.clear), in: Capsule())
            .overlay(Capsule().strokeBorder(tournament.state.isAccent ? TLColor.accent.opacity(0.4) : TLColor.border2, lineWidth: 1))
    }

    private var progressRow: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 10) {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(TLColor.border)
                        Capsule().fill(TLColor.accent)
                            .frame(width: geo.size.width * tournament.fillFraction)
                    }
                }
                .frame(height: 5)
                Text(tournament.regCapText)
                    .font(TLFont.mono(10)).foregroundStyle(TLColor.fg2)
            }
            .frame(height: 5)
            if let urgency = tournament.urgencyText {
                Text(urgency)
                    .font(TLFont.mono(9.5, .medium)).tracking(0.3)
                    .foregroundStyle(tournament.isNearlyFull ? TLColor.accentText : TLColor.fg3)
            }
        }
        .accessibilityElement()
        .accessibilityLabel("Đã đăng ký \(tournament.registered) trên \(tournament.capacity)")
    }

    private var footer: some View {
        HStack {
            Text(tournament.dateText)
                .font(TLFont.mono(10)).foregroundStyle(TLColor.fg4)
            Spacer()
            primaryAction
        }
        .padding(.top, 12)
        .overlay(alignment: .top) { Rectangle().fill(TLColor.border).frame(height: 1) }
    }

    @ViewBuilder
    private var primaryAction: some View {
        if tournament.state.primaryIsShare {
            ShareLink(item: shareURL) {
                actionLabel("Chia sẻ", icon: "square.and.arrow.up")
            }
            .accessibilityLabel("Chia sẻ link đăng ký \(tournament.displayName)")
        } else {
            Button { onManage() } label: {
                actionLabel(tournament.state.primaryCTA, icon: "arrow.right")
            }
            .buttonStyle(.plain)
        }
    }

    private func actionLabel(_ title: String, icon: String) -> some View {
        HStack(spacing: 5) {
            Text(title).font(TLFont.mono(10, .semibold)).tracking(0.6).textCase(.uppercase)
            Image(systemName: icon).font(.system(size: 10, weight: .bold))
        }
        .foregroundStyle(TLColor.accentText)
    }
}

/// Haptic helpers (prompt §8).
enum Haptics {
    static func light() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
    static func success() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
}
