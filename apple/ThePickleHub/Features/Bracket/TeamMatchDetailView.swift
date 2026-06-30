import SwiftUI

@Observable
final class TeamMatchViewModel {
    enum Phase: Equatable {
        case loading
        case loaded(TMDetail)
        case failed(String)
    }
    enum Tab: String, CaseIterable, Identifiable {
        case matches, playoff, teams
        var id: String { rawValue }
        var label: String {
            switch self {
            case .matches: return "Trận đấu"
            case .playoff: return "Playoff"
            case .teams: return "Xếp hạng"
            }
        }
    }

    var phase: Phase = .loading
    var auth = TMScoreAuth(canScore: false, isOwner: false, isCreator: false, captainTeamID: nil)
    var tab: Tab = .matches
    var expanded: Set<UUID> = []
    var working = false
    var actionError: String?
    var myTeam: TMTeam?          // captain's own team (registration mode)
    var currentUID: UUID?

    private let repo = TeamMatchRepository()
    var detail: TMDetail? { if case .loaded(let d) = phase { return d } ; return nil }

    /// Tabs — bỏ "Xếp hạng" cho thể thức đồng đội (không cần BXH; playoff vẫn dùng standings ngầm).
    func tabs(for detail: TMDetail) -> [Tab] {
        detail.hasPlayoff ? [.matches, .playoff, .teams] : [.matches, .teams]
    }

    @MainActor
    func load(shareID: String) async {
        if case .loaded = phase {} else { phase = .loading }
        do {
            let detail = try await repo.load(shareID: shareID)
            auth = await repo.scoreAuth(detail: detail)
            currentUID = await repo.currentUserID()
            if detail.tournament.requireRegistration == true && !auth.isCreator {
                myTeam = await repo.userTeam(tournamentID: detail.tournament.id)
            }
            phase = .loaded(detail)
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    @MainActor
    func generateSchedule(shareID: String) async {
        guard let d = detail else { return }
        working = true; actionError = nil
        do {
            let t = d.tournament
            if t.format == "single_elimination" {
                try await repo.generateSingleElimination(
                    tournamentID: t.id, hasThirdPlace: t.hasThirdPlaceMatch ?? false,
                    hasDreambreaker: t.hasDreambreaker ?? false)
            } else {
                try await repo.generateRoundRobin(
                    tournamentID: t.id, hasDreambreaker: t.hasDreambreaker ?? false)
            }
            await load(shareID: shareID)
        } catch { actionError = error.localizedDescription }
        working = false
    }

    @MainActor
    func setupGroups(shareID: String, distribution: [[UUID]]) async {
        guard let d = detail else { return }
        working = true; actionError = nil
        do {
            try await repo.setupGroups(tournamentID: d.tournament.id, distribution: distribution,
                                       hasDreambreaker: d.tournament.hasDreambreaker ?? false)
            await load(shareID: shareID)
        } catch { actionError = error.localizedDescription }
        working = false
    }

    @MainActor
    func generatePlayoff(shareID: String) async {
        guard let d = detail else { return }
        let target = d.tournament.playoffTeamCount ?? 4
        working = true; actionError = nil
        do {
            // Seed THEO BẢNG khi: rr_playoff + có bảng + playoff = 2×số bảng (top-2 mỗi bảng) + số bảng chẵn.
            // → nhất bảng gặp nhì bảng khác, 2 đội cùng bảng ở hai nửa (chỉ gặp lại ở chung kết).
            if d.tournament.format == "rr_playoff", d.hasGroups, target == d.groups.count * 2,
               let pairs = groupPairedFirstRound(d) {
                try await repo.generatePlayoffFromGroupPairs(
                    tournamentID: d.tournament.id, firstRound: pairs,
                    hasDreambreaker: d.tournament.hasDreambreaker ?? false)
            } else {
                // Fallback: BXH tổng + seed-position chuẩn.
                let seeded = Array(d.standings.map { $0.team.id.uuidString.lowercased() }.prefix(target))
                guard seeded.count >= 2, seeded.count & (seeded.count - 1) == 0 else {
                    actionError = "Số đội vào playoff phải là luỹ thừa của 2 và đủ đội đã xếp hạng."
                    working = false; return
                }
                try await repo.generatePlayoffFromSeeds(
                    tournamentID: d.tournament.id, seededTeamIDs: seeded,
                    hasDreambreaker: d.tournament.hasDreambreaker ?? false)
            }
            await load(shareID: shareID)
        } catch { actionError = error.localizedDescription }
        working = false
    }

    /// First-round theo bảng: nhất/nhì mỗi bảng (per-group standings) → TeamMatchRepository.groupPairings.
    private func groupPairedFirstRound(_ d: TMDetail) -> [(a: String, b: String)]? {
        let groups = d.groups.sorted { ($0.displayOrder ?? 0) < ($1.displayOrder ?? 0) }
        var winners: [String] = [], runnersUp: [String] = []
        for g in groups {
            let ids = Set(d.teams.filter { $0.groupID == g.id }.map { $0.id })
            let st = d.standings(teamIDs: ids)
            guard st.count >= 2 else { return nil }
            winners.append(st[0].team.id.uuidString.lowercased())
            runnersUp.append(st[1].team.id.uuidString.lowercased())
        }
        return TeamMatchRepository.groupPairings(winners: winners, runnersUp: runnersUp)
    }

    @MainActor
    func deleteSchedule(shareID: String) async {
        guard let d = detail else { return }
        working = true; actionError = nil
        do {
            if d.tournament.format == "rr_playoff" {
                try await repo.resetGroupStage(tournamentID: d.tournament.id)   // xoá cả bảng, về registration
            } else {
                try await repo.deleteMatches(tournamentID: d.tournament.id)
            }
            await load(shareID: shareID)
        } catch { actionError = error.localizedDescription }
        working = false
    }
}

/// Native Team Match (MLP) read view — team-vs-team matches with sub-game
/// breakdown + lineups, and the team list. Scoring (lineup + sub-games +
/// dreambreaker) still happens on web; a per-match button opens it.
struct TeamMatchDetailView: View {
    let shareID: String
    let fallbackName: String

    @Environment(\.dismiss) private var dismiss
    @State private var model = TeamMatchViewModel()
    @State private var openWeb = false
    @State private var showSettings = false
    @State private var showManageTeams = false
    @State private var showGroupSetup = false
    @State private var showRegister = false
    @State private var selectedGroupID: UUID?   // bảng đang xem (tab ngang)
    @State private var scoringMatch: TMMatch?
    @State private var lineupMatch: TMMatch?

    var body: some View {
        ScrollView {
            content.padding(.bottom, 28)
        }
        .background(TLColor.bg)
        .navigationTitle(fallbackName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                if model.auth.isCreator {
                    Button { showSettings = true } label: {
                        Image(systemName: "gearshape").foregroundStyle(TLColor.accentText)
                    }
                    .accessibilityLabel("Cài đặt giải")
                }
                Button { openWeb = true } label: {
                    Image(systemName: "safari").foregroundStyle(TLColor.accentText)
                }
                .accessibilityLabel("Mở trên web")
            }
        }
        .task { await model.load(shareID: shareID) }
        .task(id: shareID) {
            // Live polling (web parity: refetchInterval 15s). Skip while a
            // scoring/lineup sheet is open to avoid the list shifting underneath.
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(15))
                if Task.isCancelled { break }
                if scoringMatch == nil && lineupMatch == nil { await model.load(shareID: shareID) }
            }
        }
        .refreshable { await model.load(shareID: shareID) }
        .sheet(isPresented: $openWeb) {
            SafariView(url: WebRoutes.toolsTeamMatchView(shareID: shareID)).ignoresSafeArea()
        }
        .sheet(item: $scoringMatch) { m in
            if let detail = model.detail {
                TeamMatchScoringSheet(detail: detail, match: m) {
                    Task { await model.load(shareID: shareID) }
                }
            }
        }
        .sheet(item: $lineupMatch) { m in
            if let detail = model.detail {
                TeamMatchLineupSheet(detail: detail, match: m, auth: model.auth) {
                    Task { await model.load(shareID: shareID) }
                }
            }
        }
        .sheet(isPresented: $showSettings) {
            if let detail = model.detail {
                TeamMatchSettingsSheet(
                    detail: detail,
                    onChanged: { Task { await model.load(shareID: shareID) } },
                    onDeleted: { dismiss() })
            }
        }
        .sheet(isPresented: $showManageTeams) {
            if let detail = model.detail {
                TeamMatchManageTeamsView(detail: detail) {
                    Task { await model.load(shareID: shareID) }
                }
            }
        }
        .sheet(isPresented: $showGroupSetup) {
            if let detail = model.detail {
                GroupSetupSheet(
                    teams: detail.teams.filter { $0.status == "approved" }
                        .sorted { ($0.seed ?? 9999) < ($1.seed ?? 9999) },
                    working: model.working
                ) { distribution in
                    showGroupSetup = false
                    Task { await model.setupGroups(shareID: shareID, distribution: distribution) }
                }
            }
        }
        .sheet(isPresented: $showRegister) {
            if let detail = model.detail {
                TeamMatchRegisterSheet(tournamentID: detail.tournament.id,
                                       rosterSize: detail.tournament.teamRosterSize ?? 4) {
                    Task { await model.load(shareID: shareID) }
                }
            }
        }
    }

    /// Captain self-registration (registration-mode, non-organizer). Shows their
    /// team status if registered, else a register CTA.
    @ViewBuilder
    private func registrationSection(_ detail: TMDetail) -> some View {
        if detail.tournament.requireRegistration == true && !model.auth.isCreator {
            if model.currentUID == nil {
                note("Đăng nhập để đăng ký đội.")
            } else if let team = model.myTeam {
                HStack(spacing: 10) {
                    let color: Color = team.status == "approved" ? TLColor.accentText
                        : team.status == "rejected" ? TLColor.live : TLColor.gold
                    Circle().fill(color).frame(width: 8, height: 8)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Đội của bạn: \(team.teamName)").font(TLFont.sans(13.5, .semibold)).foregroundStyle(TLColor.fg)
                        Text(team.status == "approved" ? "Đã được duyệt" : team.status == "rejected" ? "Bị từ chối" : "Đang chờ duyệt")
                            .font(TLFont.mono(10)).foregroundStyle(TLColor.fg3)
                    }
                    Spacer()
                }
                .padding(14)
                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
            } else {
                Button { Haptics.light(); showRegister = true } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "person.3.sequence.fill").font(.system(size: 14))
                        Text("Đăng ký đội").font(TLFont.sans(14, .semibold))
                    }
                    .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 12)
                    .background(TLColor.accent, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
                }.buttonStyle(.plain)
            }
        }
    }

    private func actionFooterLabel(_ title: String, icon: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon).font(.system(size: 11))
            Text(title).font(TLFont.mono(10.5, .semibold))
        }
        .foregroundStyle(TLColor.accentText)
        .frame(maxWidth: .infinity).padding(.vertical, 11)
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            ProgressView().tint(TLColor.accentText).frame(maxWidth: .infinity).padding(.top, 80)
        case .failed(let message):
            errorState(message)
        case .loaded(let detail):
            VStack(alignment: .leading, spacing: 18) {
                header(detail.tournament)
                registrationSection(detail)
                Picker("", selection: Binding(get: { model.tab }, set: { model.tab = $0 })) {
                    ForEach(model.tabs(for: detail)) { Text($0.label).tag($0) }
                }
                .pickerStyle(.segmented)
                switch model.tab {
                case .matches: matchesTab(detail)
                case .playoff: playoffTab(detail)
                case .teams: teamsTab(detail)
                }
            }
            .padding(.horizontal, 16).padding(.top, 8)
        }
    }

    private func header(_ t: TMTournament) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("◆ Đồng đội · \(t.teamCount.map(String.init) ?? "—") đội × \(t.teamRosterSize.map(String.init) ?? "—")")
                .font(TLFont.mono(10.5, .medium)).tracking(1).foregroundStyle(TLColor.fg3)
            Text(t.displayName).font(TLFont.serif(26)).foregroundStyle(TLColor.fg)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 8) {
                Text(t.statusLabel.uppercased())
                    .font(TLFont.mono(9, .bold)).tracking(1)
                    .foregroundStyle(t.status == "ongoing" ? TLColor.accentText : TLColor.fg3)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background((t.status == "ongoing" ? TLColor.accent.opacity(0.1) : TLColor.surface), in: Capsule())
                Text(t.formatLabel).font(TLFont.mono(9, .medium)).tracking(0.5).foregroundStyle(TLColor.fg3)
            }
        }
    }

    // MARK: Matches

    @ViewBuilder
    private func matchesTab(_ detail: TMDetail) -> some View {
        let hasAny = !detail.matches.isEmpty
        VStack(alignment: .leading, spacing: 14) {
            if model.auth.isCreator { scheduleControls(detail, hasMatches: hasAny) }
            if !hasAny {
                if !model.auth.isCreator { note("Chưa có lịch thi đấu.") }
            } else {
                if detail.hasGroups {
                    groupTabs(detail)   // các bảng dạng tab ngang, xem 1 bảng/lúc
                } else {
                    // Round-robin phẳng: theo Lượt
                    ForEach(Array(detail.rrSections.enumerated()), id: \.offset) { _, section in
                        roundSection(detail, title: section.title, matches: section.matches)
                    }
                }
                // Playoff giờ ở tab riêng (playoffTab) để dễ theo dõi.
            }
        }
    }

    // MARK: Playoff (tab riêng)

    @ViewBuilder
    private func playoffTab(_ detail: TMDetail) -> some View {
        if detail.mlpPlayoffRounds.isEmpty {
            note("Chưa sinh vòng Playoff — BTC bấm “Sinh vòng Playoff” ở tab Trận đấu khi vòng bảng xong.")
        } else {
            VStack(alignment: .leading, spacing: 14) {
                if let champ = detail.champion { mlpChampionBanner(detail.teamName(champ)) }
                HStack(spacing: 8) {
                    RoundedRectangle(cornerRadius: 1).fill(TLColor.accent).frame(width: 3, height: 15)
                    Text("PLAYOFF").font(TLFont.mono(11, .semibold)).tracking(1).foregroundStyle(TLColor.fg)
                }
                BracketTreeView(rounds: mlpBracketRounds(detail))
                if let tp = detail.thirdPlaceMatch { thirdPlaceCard(detail, tp) }
            }
        }
    }

    private func roundSection(_ detail: TMDetail, title: String, matches: [TMMatch]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                RoundedRectangle(cornerRadius: 1).fill(TLColor.accent).frame(width: 3, height: 15)
                Text(title.uppercased()).font(TLFont.mono(11, .semibold)).tracking(1).foregroundStyle(TLColor.fg)
            }
            ForEach(matches) { m in matchCard(detail, m) }
        }
    }

    /// Hàng chip cuộn ngang chọn bảng (dùng chung tab Trận đấu + Xếp hạng; chia sẻ selectedGroupID).
    private func groupChipBar(_ groups: [TMGroup], selected: UUID?) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(groups) { g in
                    let isSel = g.id == selected
                    Button { Haptics.light(); selectedGroupID = g.id } label: {
                        Text(g.name)
                            .font(TLFont.mono(11, .semibold)).tracking(0.5)
                            .foregroundStyle(isSel ? TLColor.accentInk : TLColor.fg2)
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(isSel ? TLColor.accent : TLColor.surface, in: Capsule())
                            .overlay(Capsule().strokeBorder(isSel ? Color.clear : TLColor.border, lineWidth: 1))
                    }.buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 1)
        }
    }

    private func selectedGroup(_ sections: [(group: TMGroup, teams: [TMTeam], matches: [TMMatch])]) -> UUID? {
        sections.first(where: { $0.group.id == selectedGroupID })?.group.id ?? sections.first?.group.id
    }

    /// Tab Trận đấu: các bảng dạng tab ngang; xem trận của 1 bảng/lúc.
    @ViewBuilder
    private func groupTabs(_ detail: TMDetail) -> some View {
        let sections = detail.groupSections
        let selected = selectedGroup(sections)
        VStack(alignment: .leading, spacing: 14) {
            groupChipBar(sections.map { $0.group }, selected: selected)
            if let sec = sections.first(where: { $0.group.id == selected }) {
                groupSection(detail, teams: sec.teams, matches: sec.matches)
            }
        }
    }

    /// Tab Xếp hạng: các bảng dạng tab ngang; bảng xếp hạng của 1 bảng/lúc.
    @ViewBuilder
    private func groupStandingsTabs(_ detail: TMDetail) -> some View {
        let sections = detail.groupSections
        let selected = selectedGroup(sections)
        VStack(alignment: .leading, spacing: 14) {
            groupChipBar(sections.map { $0.group }, selected: selected)
            if let sec = sections.first(where: { $0.group.id == selected }) {
                standingsTable(detail.standings(teamIDs: Set(sec.teams.map { $0.id })))
            }
        }
    }

    /// Nội dung 1 bảng: danh sách đội + trận (vòng tròn nội bảng). Tên bảng do tab phía trên hiển thị.
    private func groupSection(_ detail: TMDetail, teams: [TMTeam], matches: [TMMatch]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("\(teams.count) đội · \(matches.count) trận")
                .font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
            if !teams.isEmpty {
                Text(teams.map(\.teamName).joined(separator: "  ·  "))
                    .font(TLFont.sans(12)).foregroundStyle(TLColor.fg3)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if matches.isEmpty {
                note("Chưa có trận trong bảng.")
            } else {
                ForEach(matches) { m in matchCard(detail, m) }
            }
        }
    }

    private func mlpBracketRounds(_ detail: TMDetail) -> [BracketRound] {
        detail.mlpPlayoffRounds.map { round in
            let slots = round.matches.map { m -> BracketSlot in
                let aWon = m.isCompleted && m.winnerTeamID == m.teamAID
                let bWon = m.isCompleted && m.winnerTeamID == m.teamBID
                let canScore = model.auth.canScore && m.hasBothTeams && !detail.games(for: m.id).isEmpty
                return BracketSlot(
                    id: m.id,
                    topName: detail.teamName(m.teamAID), botName: detail.teamName(m.teamBID),
                    topScore: m.isCompleted ? "\(m.gamesWonA)" : "", botScore: m.isCompleted ? "\(m.gamesWonB)" : "",
                    topWon: aWon, botWon: bWon, completed: m.isCompleted,
                    onTap: canScore ? { scoringMatch = m } : nil)
            }
            return BracketRound(id: round.round, title: mlpRoundTitle(round.matches.count),
                                doneCount: round.matches.filter { $0.isCompleted }.count, slots: slots)
        }
    }

    private func mlpRoundTitle(_ count: Int) -> String {
        switch count {
        case 1: return "Chung kết"
        case 2: return "Bán kết"
        case 3...4: return "Tứ kết"
        default: return "Vòng \(count * 2)"
        }
    }

    private func mlpChampionBanner(_ name: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: "trophy.fill").font(.system(size: 22)).foregroundStyle(TLColor.accentText)
            VStack(alignment: .leading, spacing: 3) {
                Text("NHÀ VÔ ĐỊCH").font(TLFont.mono(10, .bold)).tracking(1.5).foregroundStyle(TLColor.accentText)
                Text(name).font(TLFont.serif(24)).foregroundStyle(TLColor.fg)
            }
            Spacer()
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading)
        .background(LinearGradient(colors: [TLColor.accent.opacity(0.16), TLColor.surface], startPoint: .topLeading, endPoint: .bottomTrailing),
                    in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
    }

    private func thirdPlaceCard(_ detail: TMDetail, _ m: TMMatch) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("TRANH HẠNG 3").font(TLFont.mono(10, .semibold)).tracking(0.8).foregroundStyle(TLColor.fg3)
            matchCard(detail, m)
        }
    }

    /// Creator-only generate / regenerate schedule. Round-robin & single-
    /// elimination generate fully native; rr_playoff generates the group stage
    /// (playoff seeding still happens on web).
    @ViewBuilder
    private func scheduleControls(_ detail: TMDetail, hasMatches: Bool) -> some View {
        let approved = detail.teams.filter { $0.status == "approved" }.count
        VStack(alignment: .leading, spacing: 8) {
            if !hasMatches {
                if detail.tournament.format == "rr_playoff" {
                    Button {
                        Haptics.light(); showGroupSetup = true
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "rectangle.split.3x1").font(.system(size: 12))
                            Text("Chia bảng").font(TLFont.sans(14, .semibold))
                        }
                        .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 12)
                        .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain).disabled(model.working || approved < 6)
                    Text(approved < 6 ? "Cần ≥ 6 đội đã duyệt để chia bảng."
                                      : "\(approved) đội · chia ngẫu nhiên hoặc thủ công rồi đá vòng bảng")
                        .font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                } else {
                    Button {
                        Haptics.success(); Task { await model.generateSchedule(shareID: shareID) }
                    } label: {
                        HStack(spacing: 6) {
                            if model.working { ProgressView().tint(TLColor.accentInk) }
                            else { Image(systemName: "calendar.badge.plus").font(.system(size: 12)) }
                            Text("Sinh lịch thi đấu").font(TLFont.sans(14, .semibold))
                        }
                        .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 12)
                        .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain).disabled(model.working || approved < 2)
                    Text(approved < 2 ? "Cần ≥ 2 đội đã duyệt — thêm đội ở tab Đội."
                                      : "\(approved) đội · \(detail.tournament.formatLabel)")
                        .font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                }
            } else {
                if detail.tournament.format == "rr_playoff" && detail.groupStageComplete && !detail.hasPlayoff {
                    Button {
                        Haptics.success(); Task { await model.generatePlayoff(shareID: shareID) }
                    } label: {
                        HStack(spacing: 6) {
                            if model.working { ProgressView().tint(TLColor.accentInk) }
                            else { Image(systemName: "trophy").font(.system(size: 12)) }
                            Text("Sinh vòng Playoff").font(TLFont.sans(14, .semibold))
                        }
                        .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 12)
                        .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
                    }.buttonStyle(.plain).disabled(model.working)
                    Text("Vòng bảng đã xong · lấy \(detail.tournament.playoffTeamCount ?? 4) đội đầu BXH").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                }
                Button { Haptics.light(); Task { await model.deleteSchedule(shareID: shareID) } } label: {
                    HStack(spacing: 5) { Image(systemName: "arrow.clockwise").font(.system(size: 10)); Text("Xóa & tạo lại lịch").font(TLFont.mono(10, .semibold)) }
                        .foregroundStyle(TLColor.fg3)
                }.buttonStyle(.plain).disabled(model.working)
            }
            if let err = model.actionError {
                Text(err).font(TLFont.sans(12)).foregroundStyle(TLColor.live)
            }
        }
    }

    private func matchCard(_ detail: TMDetail, _ m: TMMatch) -> some View {
        let isOpen = model.expanded.contains(m.id)
        let aWon = m.isCompleted && m.winnerTeamID == m.teamAID
        let bWon = m.isCompleted && m.winnerTeamID == m.teamBID
        return VStack(spacing: 0) {
            Button {
                Haptics.light()
                if isOpen { model.expanded.remove(m.id) } else { model.expanded.insert(m.id) }
            } label: {
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 6) {
                        teamLine(detail.teamName(m.teamAID), won: aWon)
                        teamLine(detail.teamName(m.teamBID), won: bWon)
                    }
                    Spacer(minLength: 8)
                    VStack(spacing: 6) {
                        // Total mode: hiện TỔNG điểm (28–x); thường: số game thắng.
                        scorePill(detail.tournament.isTotalScore ? (m.totalPointsA ?? 0) : m.gamesWonA, win: aWon)
                        scorePill(detail.tournament.isTotalScore ? (m.totalPointsB ?? 0) : m.gamesWonB, win: bWon)
                    }
                    Image(systemName: isOpen ? "chevron.up" : "chevron.down")
                        .font(.system(size: 11, weight: .bold)).foregroundStyle(TLColor.fg4)
                }
                .padding(14)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if isOpen {
                Rectangle().fill(TLColor.border).frame(height: 1)
                subGames(detail, m)
            }
        }
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private func subGames(_ detail: TMDetail, _ m: TMMatch) -> some View {
        let games = detail.games(for: m.id)
        return VStack(alignment: .leading, spacing: 0) {
            if games.isEmpty {
                Text("Chưa có ván con.").font(TLFont.sans(12.5)).foregroundStyle(TLColor.fg3)
                    .padding(14)
            } else {
                ForEach(Array(games.enumerated()), id: \.element.id) { idx, g in
                    if idx > 0 { Rectangle().fill(TLColor.border).frame(height: 1) }
                    gameRow(detail, g, m)
                }
            }
            if model.auth.canScore && m.hasBothTeams && !games.isEmpty {
                HStack(spacing: 1) {
                    Button { Haptics.light(); lineupMatch = m } label: {
                        actionFooterLabel("Đội hình", icon: "person.2")
                    }
                    .buttonStyle(.plain)
                    Button { Haptics.light(); scoringMatch = m } label: {
                        actionFooterLabel(m.isCompleted ? "Sửa điểm" : "Chấm điểm", icon: "square.and.pencil")
                    }
                    .buttonStyle(.plain)
                }
                .background(TLColor.surface2.opacity(0.5))
            }
        }
    }

    private func gameRow(_ detail: TMDetail, _ g: TMGame, _ m: TMMatch) -> some View {
        let aWon = g.winnerTeamID == m.teamAID
        let bWon = g.winnerTeamID == m.teamBID
        return VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(g.typeLabel.uppercased())
                    .font(TLFont.mono(9, .semibold)).tracking(0.6)
                    .foregroundStyle(g.isDreambreaker == true ? TLColor.live : TLColor.fg3)
                Spacer()
                if let sa = g.scoreA, let sb = g.scoreB {
                    HStack(spacing: 5) {
                        Text("\(sa)").foregroundStyle(aWon ? TLColor.accentText : TLColor.fg3)
                        Text("–").foregroundStyle(TLColor.fg4)
                        Text("\(sb)").foregroundStyle(bWon ? TLColor.accentText : TLColor.fg3)
                    }
                    .font(TLFont.mono(13, .semibold)).monospacedDigit()
                } else {
                    Text("—").font(TLFont.mono(12)).foregroundStyle(TLColor.fg4)
                }
            }
            if let names = lineupLine(detail, g.lineupTeamA), !names.isEmpty {
                lineupText(names, won: aWon)
            }
            if let names = lineupLine(detail, g.lineupTeamB), !names.isEmpty {
                lineupText(names, won: bWon)
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
    }

    private func lineupLine(_ detail: TMDetail, _ ids: [UUID]?) -> String? {
        guard let ids, !ids.isEmpty else { return nil }
        return ids.map { detail.rosterName($0) }.joined(separator: " / ")
    }

    private func lineupText(_ text: String, won: Bool) -> some View {
        Text(text)
            .font(TLFont.sans(12.5, won ? .semibold : .regular))
            .foregroundStyle(won ? TLColor.fg : TLColor.fg3)
            .lineLimit(1)
    }

    private func teamLine(_ name: String, won: Bool) -> some View {
        Text(name)
            .font(TLFont.serif(16)).italic()
            .foregroundStyle(won ? TLColor.fg : TLColor.fg2)
            .lineLimit(1)
    }

    private func scorePill(_ n: Int, win: Bool) -> some View {
        Text("\(n)")
            .font(TLFont.mono(14, .semibold)).monospacedDigit()
            .foregroundStyle(win ? TLColor.accentInk : TLColor.fg2)
            .frame(width: 30, height: 28)
            .background(win ? TLColor.accent : TLColor.surface2, in: RoundedRectangle(cornerRadius: 6))
    }

    // MARK: Standings

    @ViewBuilder
    private func standingsTable(_ rows: [TMStanding]) -> some View {
        VStack(spacing: 0) {
            // Header row
            HStack(spacing: 0) {
                Text("#").font(TLFont.mono(10, .semibold)).foregroundStyle(TLColor.fg3).frame(width: 26, alignment: .leading)
                Text("ĐỘI").font(TLFont.mono(10, .semibold)).foregroundStyle(TLColor.fg3).frame(maxWidth: .infinity, alignment: .leading)
                 forEachStat(["Tr", "T", "B", "Ván", "+/-"])
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
            Rectangle().fill(TLColor.border).frame(height: 1)

            if rows.isEmpty {
                Text("Chưa có kết quả vòng tròn.").font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
                    .frame(maxWidth: .infinity, alignment: .leading).padding(14)
            } else {
                ForEach(Array(rows.enumerated()), id: \.element.id) { index, s in
                    if index > 0 { Rectangle().fill(TLColor.border).frame(height: 1) }
                    HStack(spacing: 0) {
                        Text("\(index + 1)").font(TLFont.mono(11, .semibold))
                            .foregroundStyle(index < 4 ? TLColor.accentText : TLColor.fg3)
                            .frame(width: 26, alignment: .leading)
                        Text(s.team.teamName).font(TLFont.sans(14, .medium)).foregroundStyle(TLColor.fg)
                            .lineLimit(1).frame(maxWidth: .infinity, alignment: .leading)
                        forEachStat([
                            "\(s.played)", "\(s.won)", "\(s.lost)",
                            "\(s.gameDiff >= 0 ? "+" : "")\(s.gameDiff)",
                            "\(s.pointsDiff >= 0 ? "+" : "")\(s.pointsDiff)",
                        ], emphasizeFirst: true)
                    }
                    .padding(.horizontal, 14).padding(.vertical, 12)
                }
            }
        }
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    /// Fixed-width numeric stat columns: Tr (played), T (won), B (lost), game diff, point diff.
    private func forEachStat(_ values: [String], emphasizeFirst: Bool = false) -> some View {
        HStack(spacing: 0) {
            ForEach(Array(values.enumerated()), id: \.offset) { i, v in
                Text(v)
                    .font(TLFont.mono(11, i == 1 ? .semibold : .medium)).monospacedDigit()
                    .foregroundStyle(i == 1 && emphasizeFirst ? TLColor.fg : TLColor.fg3)
                    .frame(width: 34, alignment: .trailing)
            }
        }
    }

    // MARK: Teams

    // Tab "Xếp hạng": quản lý đội (creator) + xếp hạng theo từng bảng (tab ngang). Chưa chia bảng → danh sách đội.
    private func teamsTab(_ detail: TMDetail) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            if model.auth.isCreator {
                Button { Haptics.light(); showManageTeams = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "person.2.badge.gearshape").font(.system(size: 12))
                        Text("Quản lý đội & VĐV").font(TLFont.sans(13, .semibold))
                    }
                    .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 11)
                    .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
                }.buttonStyle(.plain)
            }
            if detail.hasGroups {
                groupStandingsTabs(detail)
            } else {
                teamsList(detail)
            }
        }
    }

    private func teamsList(_ detail: TMDetail) -> some View {
        VStack(spacing: 0) {
            if detail.teams.isEmpty {
                note(model.auth.isCreator ? "Chưa có đội — bấm “Quản lý đội” để thêm." : "Chưa có đội.")
            } else {
                ForEach(Array(detail.teamsBySeed.enumerated()), id: \.element.id) { index, team in
                    if index > 0 { Rectangle().fill(TLColor.border).frame(height: 1) }
                    let rosterCount = detail.roster.filter { $0.teamID == team.id }.count
                    HStack(spacing: 12) {
                        Text("#\(team.seed.map(String.init) ?? "—")")
                            .font(TLFont.mono(11, .medium)).foregroundStyle(TLColor.fg3).frame(width: 34, alignment: .leading)
                        Text(team.teamName).font(TLFont.sans(14.5, .medium)).foregroundStyle(TLColor.fg).lineLimit(1)
                        Spacer()
                        Text("\(rosterCount) VĐV").font(TLFont.mono(10.5)).foregroundStyle(TLColor.fg3)
                    }
                    .padding(.horizontal, 14).padding(.vertical, 12)
                }
            }
        }
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private func note(_ text: String) -> some View {
        Text(text).font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, style: StrokeStyle(lineWidth: 1, dash: [4])))
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "person.3").font(.largeTitle).foregroundStyle(TLColor.fg3)
            Text("Không tải được giải").font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
            Text(message).font(TLFont.sans(12)).foregroundStyle(TLColor.fg3).multilineTextAlignment(.center)
            Button("Thử lại") { Task { await model.load(shareID: shareID) } }.foregroundStyle(TLColor.accentText)
        }
        .frame(maxWidth: .infinity).padding(.horizontal, 32).padding(.top, 60)
    }
}

// MARK: - Chia bảng (Ngẫu nhiên / Thủ công)

private struct GroupSetupSheet: View {
    let teams: [TMTeam]               // đã duyệt, sort theo seed
    let working: Bool
    let onConfirm: ([[UUID]]) -> Void
    @Environment(\.dismiss) private var dismiss

    enum Mode: String, CaseIterable { case random = "Ngẫu nhiên", manual = "Thủ công" }
    @State private var groupCount = 0
    @State private var mode: Mode = .random
    @State private var assign: [UUID: Int] = [:]   // teamID -> group index

    private let names = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
    private var suggestions: [GroupSuggestion] { GroupSuggestion.suggest(playerCount: teams.count) }
    private var distribution: [[UUID]] {
        guard groupCount >= 2 else { return [] }
        return (0..<groupCount).map { gi in teams.filter { assign[$0.id] == gi }.map(\.id) }
    }
    private var valid: Bool { groupCount >= 2 && distribution.allSatisfy { $0.count >= 2 } }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    if suggestions.isEmpty {
                        Text("Cần ≥ 6 đội đã duyệt để chia bảng (mỗi bảng tối thiểu 3 đội).")
                            .font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
                    } else {
                        labeled("Số bảng") {
                            Picker("", selection: $groupCount) {
                                ForEach(suggestions) { Text("\($0.groupCount) bảng").tag($0.groupCount) }
                            }.pickerStyle(.segmented)
                        }
                        labeled("Cách chia") {
                            Picker("", selection: $mode) {
                                ForEach(Mode.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                            }.pickerStyle(.segmented)
                        }
                        if mode == .random {
                            Button { randomize() } label: {
                                Label("Chia lại ngẫu nhiên", systemImage: "shuffle")
                                    .font(TLFont.sans(13, .semibold)).foregroundStyle(TLColor.accentText)
                            }.buttonStyle(.plain)
                            preview
                        } else {
                            manualList
                        }
                    }
                }.padding(16)
            }
            .background(TLColor.bg)
            .navigationTitle("Chia bảng").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Huỷ") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Xác nhận") { onConfirm(distribution) }
                        .fontWeight(.bold).disabled(!valid || working)
                }
            }
            .onAppear {
                if groupCount == 0 { groupCount = suggestions.first?.groupCount ?? 0 }
                randomize()
            }
            .onChange(of: groupCount) { _, _ in if mode == .random { randomize() } else { clamp() } }
            .onChange(of: mode) { _, m in if m == .random { randomize() } }
        }
    }

    private func randomize() {
        guard groupCount >= 2 else { return }
        var a: [UUID: Int] = [:]
        for (i, id) in teams.map(\.id).shuffled().enumerated() { a[id] = i % groupCount }
        assign = a
    }
    private func clamp() {
        for t in teams where (assign[t.id] ?? 0) >= groupCount { assign[t.id] = 0 }
    }

    @ViewBuilder
    private func labeled<Content: View>(_ title: String, @ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title.uppercased()).font(TLFont.mono(10, .medium)).tracking(1).foregroundStyle(TLColor.fg3)
            content()
        }
    }

    private var preview: some View {
        VStack(spacing: 10) {
            ForEach(Array(0..<groupCount), id: \.self) { gi in
                let members = teams.filter { assign[$0.id] == gi }
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("Bảng \(names[gi])").font(TLFont.sans(14, .semibold)).foregroundStyle(TLColor.fg)
                        Spacer()
                        Text("\(members.count) đội").font(TLFont.mono(10)).foregroundStyle(TLColor.fg4)
                    }
                    ForEach(members) { t in
                        Text(t.teamName).font(TLFont.sans(12.5)).foregroundStyle(TLColor.fg2)
                    }
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm))
                .overlay(RoundedRectangle(cornerRadius: TLRadius.sm).strokeBorder(TLColor.border, lineWidth: 1))
            }
        }
    }

    private var manualList: some View {
        VStack(spacing: 8) {
            ForEach(teams) { t in
                HStack {
                    Text(t.teamName).font(TLFont.sans(13.5)).foregroundStyle(TLColor.fg)
                    Spacer()
                    Picker("", selection: Binding(get: { assign[t.id] ?? 0 }, set: { assign[t.id] = $0 })) {
                        ForEach(Array(0..<groupCount), id: \.self) { gi in Text("Bảng \(names[gi])").tag(gi) }
                    }.pickerStyle(.menu).tint(TLColor.accentText)
                }
                .padding(.horizontal, 12).padding(.vertical, 9)
                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 10))
            }
        }
    }
}
