import SwiftUI

@Observable
@MainActor
final class ToolsViewModel {
    enum Phase: Equatable { case loading, loaded, failed(String) }

    /// Which set of tournaments the list shows. `.all` is admin-only — every
    /// tournament on the platform, not just the ones the user created.
    enum Scope: String, CaseIterable, Identifiable {
        case mine, all
        var id: String { rawValue }
        var label: String { self == .mine ? String(localized: "Của tôi") : "Tất cả" }
    }

    var phase: Phase = .loading
    var mine: [MyTournament] = []
    var refereeing: [MyTournament] = []
    var parentTournaments: [ParentTournament] = []
    var publicFlex: [FlexTournament] = []
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
        async let refTask = repo.myRefereeingTournaments()
        async let adminTask = repo.isCurrentUserAdmin()
        async let parentTask: [ParentTournament] =
            (try? await ParentTournamentRepository().mine()) ?? []
        async let publicFlexTask = FlexRepository().publicTournaments()
        mine = await mineTask
        refereeing = await refTask
        isAdmin = await adminTask
        parentTournaments = await parentTask
        publicFlex = await publicFlexTask
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
/// All four formats (QuickTable, Doubles-Elim, Team-Match, Flex) create/score
/// natively; the finder launches the native flows too.
struct ToolsView: View {
    @State private var model = ToolsViewModel()
    @State private var showFinder = false
    @State private var pendingFinderPick: FormatFinderSheet.Pick?
    @State private var showCreate = false
    @State private var showCreateTeamMatch = false
    @State private var showCreateDoubles = false
    @State private var showCreateFlex = false
    @State private var showCreateParent = false
    @State private var showDashboard = false
    @State private var navTarget: MyTournament?
    @State private var parentTarget: ParentTournament?
    @State private var createdTarget: CreatedRef?
    @State private var createdTeamMatch: CreatedRef?
    @State private var createdDoubles: CreatedRef?
    @State private var createdFlex: CreatedRef?
    @State private var recentExpanded = false

    private let recentCap = 8

    struct CreatedRef: Identifiable, Hashable { let id: String; let name: String } // id = share_id

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    hero
                    formatSection
                    parentTournamentSection
                    publicFlexSection
                    refereeSection
                    recentSection
                }
                .padding(.vertical, 18)
            }
            .background(TLColor.bg)
            .navigationTitle("Công cụ")
            .navigationBarTitleDisplayMode(.large)
            .task { await model.load() }
            .refreshable { await model.reload() }
            .sheet(isPresented: $showFinder, onDismiss: {
                // Present the native create flow only after the finder has fully
                // dismissed — presenting a second sheet mid-dismiss drops it.
                guard let pick = pendingFinderPick else { return }
                pendingFinderPick = nil
                switch pick {
                case .quickTable:  showCreate = true
                case .doublesElim: showCreateDoubles = true
                }
            }) {
                FormatFinderSheet { pick in pendingFinderPick = pick }
            }
            .sheet(isPresented: $showCreate) {
                AuthenticationRequiredView {
                    CreateQuickTableView(onCreated: { shareID, name in
                        Task { await model.reload() }
                        createdTarget = CreatedRef(id: shareID, name: name)
                    })
                }
            }
            .sheet(isPresented: $showCreateParent) {
                AuthenticationRequiredView {
                    CreateParentTournamentView { tournament in
                        Task { await model.reload() }
                        parentTarget = tournament
                    }
                }
            }
            .navigationDestination(item: $parentTarget) { tournament in
                ParentTournamentDetailView(
                    shareID: tournament.shareID,
                    fallbackName: tournament.name
                )
            }
            .navigationDestination(isPresented: $showDashboard) {
                TournamentDashboardPickerView()
            }
            .navigationDestination(item: $navTarget) { t in
                switch t.format {
                case .doublesElim:
                    DoublesElimDetailView(shareID: t.shareID, fallbackName: t.displayName)
                case .teamMatch:
                    TeamMatchDetailView(shareID: t.shareID, fallbackName: t.displayName)
                case .flex:
                    FlexDetailView(shareID: t.shareID, fallbackName: t.displayName)
                default:
                    QuickTableDetailView(shareID: t.shareID, fallbackName: t.displayName)
                }
            }
            .sheet(isPresented: $showCreateTeamMatch) {
                AuthenticationRequiredView {
                    CreateTeamMatchView { shareID, name in
                        Task { await model.reload() }
                        createdTeamMatch = CreatedRef(id: shareID, name: name)
                    }
                }
            }
            .navigationDestination(item: $createdTarget) { ref in
                QuickTableDetailView(shareID: ref.id, fallbackName: ref.name)
            }
            .navigationDestination(item: $createdTeamMatch) { ref in
                TeamMatchDetailView(shareID: ref.id, fallbackName: ref.name)
            }
            .sheet(isPresented: $showCreateDoubles) {
                AuthenticationRequiredView {
                    CreateDoublesElimView { shareID, name in
                        Task { await model.reload() }
                        createdDoubles = CreatedRef(id: shareID, name: name)
                    }
                }
            }
            .navigationDestination(item: $createdDoubles) { ref in
                DoublesElimDetailView(shareID: ref.id, fallbackName: ref.name)
            }
            .sheet(isPresented: $showCreateFlex) {
                AuthenticationRequiredView {
                    CreateFlexView { shareID, name in
                        Task { await model.reload() }
                        createdFlex = CreatedRef(id: shareID, name: name)
                    }
                }
            }
            .navigationDestination(item: $createdFlex) { ref in
                FlexDetailView(shareID: ref.id, fallbackName: ref.name)
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
            sectionHeader(num: "01", title: String(localized: "Chọn thể thức")).padding(.horizontal, 22)

            featuredCard.padding(.horizontal, 22).padding(.top, 15)

            VStack(spacing: 10) {
                compactFormatRow(icon: "arrow.triangle.branch", title: BracketFormat.doublesElim.labelVi,
                                 meta: String(localized: "Nhánh đơn / đôi · 40–128 đội"),
                                 action: { Haptics.light(); showCreateDoubles = true })
                compactFormatRow(icon: "slider.horizontal.3", title: String(localized: "Giải linh hoạt"),
                                 meta: String(localized: "Tùy biến hoàn toàn"),
                                 action: { Haptics.light(); showCreateFlex = true })
                compactFormatRow(icon: "person.3.fill", title: String(localized: "Đấu đồng đội"),
                                 meta: String(localized: "Thể thức MLP · đội 4–8"),
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

            Button {
                Haptics.light()
                showDashboard = true
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "display")
                        .font(.system(size: 16, weight: .semibold))
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Bảng sân trực tiếp")
                            .font(TLFont.sans(14, .semibold))
                        Text("Theo dõi LIVE · chế độ TV")
                            .font(TLFont.mono(9.5))
                            .foregroundStyle(TLColor.fg3)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .bold))
                }
                .foregroundStyle(TLColor.accentText)
                .frame(minHeight: 44)
                .padding(.horizontal, 14)
                .background(TLColor.accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(TLColor.accent.opacity(0.24), lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 22)
            .padding(.top, 4)
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

    private func compactFormatRow(icon: String, title: String, meta: String,
                                  action: @escaping () -> Void) -> some View {
        Button(action: action) {
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

    // MARK: Section — multi-event tournaments

    private var parentTournamentSection: some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack(spacing: 11) {
                sectionHeader(num: "02", title: String(localized: "Giải nhiều nội dung"))
                Button {
                    Haptics.light()
                    showCreateParent = true
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(TLColor.accentInk)
                        .frame(width: 44, height: 44)
                        .background(TLColor.accent, in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Tạo giải nhiều nội dung")
            }
            .padding(.horizontal, 22)

            if model.phase == .loading {
                skeletonCards.padding(.horizontal, 22)
            } else if model.parentTournaments.isEmpty {
                Button {
                    Haptics.light()
                    showCreateParent = true
                } label: {
                    HStack(spacing: 13) {
                        iconChip("square.stack.3d.up")
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Gom nhiều Quick Table vào một giải")
                                .font(TLFont.sans(14, .semibold))
                                .foregroundStyle(TLColor.fg)
                            Text("Ví dụ: Đơn nam, Đơn nữ, Đôi nam nữ")
                                .font(TLFont.mono(10))
                                .foregroundStyle(TLColor.fg3)
                        }
                        Spacer()
                        Text("Tạo")
                            .font(TLFont.sans(12, .bold))
                            .foregroundStyle(TLColor.accentText)
                    }
                    .padding(14)
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 14))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14)
                            .strokeBorder(TLColor.border, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 22)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(model.parentTournaments) { tournament in
                            Button {
                                Haptics.light()
                                parentTarget = tournament
                            } label: {
                                ParentTournamentCard(tournament: tournament)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 22)
                }
            }
        }
    }

    @ViewBuilder
    private var publicFlexSection: some View {
        if model.phase == .loaded && !model.publicFlex.isEmpty {
            VStack(alignment: .leading, spacing: 13) {
                sectionHeader(num: "03", title: String(localized: "Khám phá Flex công khai"))
                    .padding(.horizontal, 22)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(model.publicFlex, id: \.id) { tournament in
                            Button {
                                Haptics.light()
                                createdFlex = CreatedRef(
                                    id: tournament.shareID,
                                    name: tournament.displayName
                                )
                            } label: {
                                VStack(alignment: .leading, spacing: 12) {
                                    HStack {
                                        Image(systemName: "globe.asia.australia.fill")
                                            .foregroundStyle(TLColor.blue)
                                        Spacer()
                                        Text(tournament.status.uppercased())
                                            .font(TLFont.mono(8, .bold))
                                            .foregroundStyle(TLColor.fg3)
                                    }
                                    Text(tournament.displayName)
                                        .font(TLFont.serif(19))
                                        .italic()
                                        .foregroundStyle(TLColor.fg)
                                        .lineLimit(2)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                    Text("XEM BẢNG ĐẤU")
                                        .font(TLFont.mono(9, .bold))
                                        .tracking(0.7)
                                        .foregroundStyle(TLColor.blue)
                                }
                                .padding(15)
                                .frame(width: 210, height: 132, alignment: .topLeading)
                                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 15))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 15)
                                        .strokeBorder(TLColor.blue.opacity(0.25), lineWidth: 1)
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 22)
                }
            }
        }
    }

    // MARK: Section — tournaments I referee ("Giải tôi chấm")

    @ViewBuilder
    private var refereeSection: some View {
        if model.phase == .loaded && !model.refereeing.isEmpty {
            VStack(alignment: .leading, spacing: 13) {
                sectionHeader(num: "02", title: String(localized: "Giải tôi chấm")).padding(.horizontal, 22)
                VStack(spacing: 12) {
                    ForEach(model.refereeing) { t in
                        TournamentCard(tournament: t) { manage(t) }
                    }
                }
                .padding(.horizontal, 22)
            }
        }
    }

    // MARK: Section 03 — my tournaments

    private var recentSection: some View {
        VStack(alignment: .leading, spacing: 13) {
            sectionHeader(num: "03", title: String(localized: "Giải gần đây")).padding(.horizontal, 22)

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
            Text(title).textCase(.uppercase).font(TLFont.mono(12, .medium)).tracking(2).foregroundStyle(TLColor.fg2)
            Rectangle()
                .fill(LinearGradient(colors: [TLColor.accent.opacity(0.55), .clear], startPoint: .leading, endPoint: .trailing))
                .frame(height: 1)
        }
    }

    /// Every Bracket Lab format now opens its native detail workspace.
    private func manage(_ t: MyTournament) {
        Haptics.light()
        navTarget = t
    }
}

private struct ParentTournamentCard: View {
    let tournament: ParentTournament

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "trophy.fill")
                    .foregroundStyle(TLColor.accentText)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(TLColor.fg4)
            }
            Text(tournament.name)
                .font(TLFont.serif(20))
                .italic()
                .foregroundStyle(TLColor.fg)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: 5) {
                if let date = tournament.eventDate?.nonEmpty {
                    Image(systemName: "calendar")
                    Text(date)
                } else {
                    Text("NHIỀU NỘI DUNG")
                }
            }
            .font(TLFont.mono(9, .semibold))
            .tracking(0.7)
            .foregroundStyle(TLColor.fg3)
        }
        .padding(16)
        .frame(width: 220, height: 142, alignment: .topLeading)
        .background(
            LinearGradient(
                colors: [TLColor.accent.opacity(0.12), TLColor.surface],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 16, style: .continuous)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(TLColor.border, lineWidth: 1)
        )
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
                    if let champion = tournament.displayChampion {
                        (Text("VÔ ĐỊCH  ").font(TLFont.mono(9.5, .medium)).foregroundStyle(TLColor.fg3)
                            + Text(champion).font(TLFont.sans(13, .medium)).foregroundStyle(TLColor.fg))
                            .lineLimit(2)
                    }
                    if let creator = tournament.creatorName {
                        Text("bởi \(creator)")
                            .font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4).lineLimit(1)
                    }
                }
                Spacer(minLength: 8)
                // Champion thay pill trạng thái — "Đã kết thúc" + tên vô địch là thừa một cái.
                if tournament.displayChampion == nil { statusBadge }
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
