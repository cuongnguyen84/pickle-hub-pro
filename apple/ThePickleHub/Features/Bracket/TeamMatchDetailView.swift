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
    var membership: TMMembership?  // my roster row in this tournament (join or captain)
    var dupr: [UUID: Double] = [:]   // roster userID → DUPR (for chia-bảng constraint check)
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
            if detail.tournament.requireRegistration == true {
                if !auth.isCreator { myTeam = await repo.userTeam(tournamentID: detail.tournament.id) }
                membership = await repo.userMembership(tournamentID: detail.tournament.id)
            }
            if auth.isCreator {
                let ids = Array(Set(detail.roster.compactMap { $0.userID }))
                dupr = (try? await repo.duprByUser(ids)) ?? [:]
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

    @MainActor func joinTeam(shareID: String, teamID: UUID, playerName: String, gender: String) async -> Bool {
        working = true; actionError = nil
        guard let d = detail else { working = false; return false }
        do {
            try await repo.joinTeam(teamID: teamID, tournamentID: d.tournament.id, playerName: playerName, gender: gender)
            await load(shareID: shareID); working = false; return true
        } catch { actionError = error.localizedDescription; working = false; return false }
    }

    @MainActor func approveRoster(shareID: String, memberID: UUID) async {
        working = true; actionError = nil
        do { try await repo.updateRosterStatus(id: memberID, status: "approved"); await load(shareID: shareID) }
        catch { actionError = error.localizedDescription }
        working = false
    }

    @MainActor func rejectRoster(shareID: String, memberID: UUID) async {
        working = true; actionError = nil
        do { try await repo.removeRosterMember(id: memberID); await load(shareID: shareID) }
        catch { actionError = error.localizedDescription }
        working = false
    }

    @MainActor func setupGroups(shareID: String, distribution: [[UUID]], randomizeGameOrder: Bool) async {
        guard let d = detail else { return }
        working = true; actionError = nil
        do {
            try await repo.setupGroups(tournamentID: d.tournament.id, distribution: distribution,
                                       hasDreambreaker: d.tournament.hasDreambreaker ?? false,
                                       randomizeGameOrder: randomizeGameOrder)
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
    @State private var showTeamRoster = false
    @State private var livePulse = false   // drives the LIVE match card pulse
    @State private var joinTeamTarget: TMTeam?
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
        .onAppear {
            withAnimation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true)) { livePulse = true }
        }
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
                    roster: detail.roster,
                    dupr: model.dupr,
                    rosterSize: detail.tournament.teamRosterSize ?? 4,
                    requireDupr: detail.tournament.requiresDupr,
                    working: model.working
                ) { distribution, randomize in
                    showGroupSetup = false
                    Task { await model.setupGroups(shareID: shareID, distribution: distribution, randomizeGameOrder: randomize) }
                }
            }
        }
        .sheet(isPresented: $showRegister) {
            if let detail = model.detail {
                TeamMatchRegisterSheet(tournamentID: detail.tournament.id,
                                       rosterSize: detail.tournament.teamRosterSize ?? 4,
                                       requireDupr: detail.tournament.requiresDupr,
                                       duprMaxMale: detail.tournament.duprMaxMale,
                                       duprMaxFemale: detail.tournament.duprMaxFemale) {
                    Task { await model.load(shareID: shareID) }
                }
            }
        }
        .sheet(isPresented: $showTeamRoster) {
            if let detail = model.detail, let team = model.myTeam {
                TeamMatchTeamRosterSheet(teamID: team.id, teamName: team.teamName,
                                         rosterSize: detail.tournament.teamRosterSize ?? 4) {
                    Task { await model.load(shareID: shareID) }
                }
            }
        }
        .sheet(item: $joinTeamTarget) { team in
            if let detail = model.detail {
                TeamMatchJoinSheet(teamName: team.teamName,
                                   requireDupr: detail.tournament.requiresDupr,
                                   duprMaxMale: detail.tournament.duprMaxMale,
                                   duprMaxFemale: detail.tournament.duprMaxFemale) { name, gender in
                    let ok = await model.joinTeam(shareID: shareID, teamID: team.id, playerName: name, gender: gender)
                    if ok { joinTeamTarget = nil }
                    return ok
                }
            }
        }
    }

    /// Registration-mode section: captain team + join requests, player membership
    /// status, register CTA, and a "join an approved team" list (players + creator).
    @ViewBuilder
    private func registrationSection(_ detail: TMDetail) -> some View {
        if detail.tournament.requireRegistration == true {
            if model.currentUID == nil {
                note("Đăng nhập để đăng ký / tham gia đội.")
            } else {
                let regOpen = detail.tournament.status == "registration" || detail.tournament.status == "setup"
                VStack(alignment: .leading, spacing: 12) {
                    if let team = model.myTeam {
                        captainTeamCard(detail, team)
                    } else if let m = model.membership, !m.isCaptain {
                        membershipCard(detail, m)
                    } else if !model.auth.isCreator {
                        registerCTA
                    }
                    if regOpen && model.myTeam == nil && model.membership == nil {
                        joinTeamsList(detail)
                    }
                    if let err = model.actionError { Text(err).font(TLFont.sans(12)).foregroundStyle(TLColor.live) }
                }
            }
        }
    }

    private var registerCTA: some View {
        Button { Haptics.light(); showRegister = true } label: {
            HStack(spacing: 8) {
                Image(systemName: "person.3.sequence.fill").font(.system(size: 14))
                Text("Đăng ký đội").font(TLFont.sans(14, .semibold))
            }
            .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 12)
            .background(TLColor.accent, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
        }.buttonStyle(.plain)
    }

    private func statusCard(title: String, subtitle: String, color: Color) -> some View {
        HStack(spacing: 10) {
            Circle().fill(color).frame(width: 8, height: 8)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(TLFont.sans(13.5, .semibold)).foregroundStyle(TLColor.fg)
                Text(subtitle).font(TLFont.mono(10)).foregroundStyle(TLColor.fg3)
            }
            Spacer()
        }
        .padding(14)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    // Captain: own team status + inline approve/reject of pending join requests.
    @ViewBuilder
    private func captainTeamCard(_ detail: TMDetail, _ team: TMTeam) -> some View {
        let color: Color = team.status == "approved" ? TLColor.accentText : team.status == "rejected" ? TLColor.live : TLColor.gold
        let pending = detail.roster.filter { $0.teamID == team.id && $0.status == "pending" && $0.isCaptain != true }
        VStack(alignment: .leading, spacing: 10) {
            statusCard(title: "Đội của bạn: \(team.teamName)",
                       subtitle: team.status == "approved" ? "Đã được duyệt" : team.status == "rejected" ? "Bị từ chối" : "Đang chờ duyệt",
                       color: color)
            Button { Haptics.light(); showTeamRoster = true } label: {
                HStack(spacing: 6) { Image(systemName: "person.2.badge.gearshape"); Text("Quản lý đội hình") }
                    .font(TLFont.mono(10.5, .semibold)).foregroundStyle(TLColor.accentText)
            }.buttonStyle(.plain)
            if !pending.isEmpty {
                Text("Yêu cầu tham gia (\(pending.count))").font(TLFont.mono(10, .semibold)).foregroundStyle(TLColor.gold)
                ForEach(pending) { m in pendingRequestRow(detail, m) }
            }
        }
    }

    private func pendingRequestRow(_ detail: TMDetail, _ m: TMRosterPlayer) -> some View {
        HStack(spacing: 8) {
            Text(m.playerName).font(TLFont.sans(13)).foregroundStyle(TLColor.fg2).lineLimit(1)
            Text(m.genderLabel).font(TLFont.mono(9)).foregroundStyle(TLColor.fg4)
            Spacer()
            Button { Haptics.success(); Task { await model.approveRoster(shareID: shareID, memberID: m.id) } } label: {
                Text("Duyệt").font(TLFont.mono(10, .bold)).foregroundStyle(TLColor.accentInk)
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 8))
            }.buttonStyle(.plain)
            Button { Haptics.light(); Task { await model.rejectRoster(shareID: shareID, memberID: m.id) } } label: {
                Image(systemName: "xmark").font(.system(size: 11, weight: .bold)).foregroundStyle(TLColor.live)
                    .padding(.horizontal, 8).padding(.vertical, 6)
                    .background(TLColor.surface2, in: RoundedRectangle(cornerRadius: 8))
            }.buttonStyle(.plain)
        }
        .disabled(model.working)
        .padding(.horizontal, 12).padding(.vertical, 6)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 9))
    }

    // Player joined a team (not captain): status + withdraw if pending.
    @ViewBuilder
    private func membershipCard(_ detail: TMDetail, _ m: TMMembership) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            statusCard(title: "Bạn ở đội: \(m.teamName)",
                       subtitle: m.status == "approved" ? "Đã được duyệt vào đội" : "Chờ đội trưởng duyệt",
                       color: m.status == "approved" ? TLColor.accentText : TLColor.gold)
            Button { Haptics.light(); Task { await model.rejectRoster(shareID: shareID, memberID: m.id) } } label: {
                Text(m.status == "approved" ? "Rời đội" : "Huỷ yêu cầu")
                    .font(TLFont.mono(10.5, .semibold)).foregroundStyle(TLColor.live)
                    .padding(.horizontal, 12).padding(.vertical, 7)
                    .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(TLColor.live.opacity(0.4), lineWidth: 1))
            }.buttonStyle(.plain).disabled(model.working)
        }
    }

    // Approved teams a player (or the creator) can request to join.
    @ViewBuilder
    private func joinTeamsList(_ detail: TMDetail) -> some View {
        let teams = detail.teams.filter { $0.status == "approved" && $0.id != model.myTeam?.id }
        if !teams.isEmpty {
            Text("Hoặc tham gia một đội đã có").font(TLFont.mono(10, .semibold)).foregroundStyle(TLColor.fg3)
            ForEach(teams) { team in
                HStack(spacing: 8) {
                    Text(team.teamName).font(TLFont.sans(14, .semibold)).foregroundStyle(TLColor.fg).lineLimit(1)
                    let cap = detail.roster.first { $0.teamID == team.id && $0.isCaptain == true }
                    if let cap { Text("· \(cap.playerName)").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4).lineLimit(1) }
                    Spacer()
                    Button { Haptics.light(); joinTeamTarget = team } label: {
                        HStack(spacing: 4) { Image(systemName: "person.badge.plus").font(.system(size: 11)); Text("Yêu cầu tham gia") }
                            .font(TLFont.mono(10, .bold)).foregroundStyle(TLColor.accentInk)
                            .padding(.horizontal, 12).padding(.vertical, 8)
                            .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 9))
                    }.buttonStyle(.plain)
                }
                .padding(12)
                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
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
                        if m.isLive {
                            HStack(spacing: 4) {
                                Circle().fill(.white).frame(width: 6, height: 6).opacity(livePulse ? 0.35 : 1)
                                Text("LIVE").font(TLFont.mono(9.5, .bold)).tracking(1).foregroundStyle(.white)
                            }
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(TLColor.live, in: Capsule())
                            .shadow(color: TLColor.live.opacity(0.5), radius: livePulse ? 7 : 2)
                        }
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
        .background(m.isLive ? TLColor.live.opacity(0.07) : TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous)
            .strokeBorder(m.isLive ? TLColor.live.opacity(livePulse ? 0.5 : 0.9) : TLColor.border, lineWidth: m.isLive ? 2 : 1))
        .shadow(color: m.isLive ? TLColor.live.opacity(0.25) : .clear, radius: m.isLive ? 10 : 0)
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
    let roster: [TMRosterPlayer]
    let dupr: [UUID: Double]          // userID → DUPR
    let rosterSize: Int
    let requireDupr: Bool
    let working: Bool
    let onConfirm: ([[UUID]], Bool) -> Void   // distribution, randomizeGameOrder
    @Environment(\.dismiss) private var dismiss

    // Constraint check (warning only — never blocks): full roster, gender
    // balance (half/half), and — when required — every member has DUPR.
    private var violations: [(name: String, issues: [String])] {
        let half = rosterSize / 2
        var out: [(name: String, issues: [String])] = []
        for team in teams {
            let members = roster.filter { $0.teamID == team.id }
            var issues: [String] = []
            if members.count != rosterSize { issues.append("\(members.count)/\(rosterSize) người") }
            let males = members.filter { $0.isMale }.count
            let females = members.filter { $0.isFemale }.count
            if males != half || females != half { issues.append("\(males) nam / \(females) nữ (cần \(half)/\(half))") }
            if requireDupr {
                let noDupr = members.filter { m in m.userID.map { dupr[$0] == nil } ?? true }.count
                if noDupr > 0 { issues.append("\(noDupr) chưa có DUPR") }
            }
            if !issues.isEmpty { out.append((team.teamName, issues)) }
        }
        return out
    }

    enum Mode: String, CaseIterable { case random = "Ngẫu nhiên", manual = "Thủ công" }
    @State private var groupCount = 0
    @State private var mode: Mode = .random
    @State private var assign: [UUID: Int] = [:]   // teamID -> group index
    @State private var randomizeGameOrder = false
    // Draw ceremony (random mode): reveal teams into groups one-by-one.
    @State private var revealed = 0
    @State private var order: [UUID] = []          // reveal order (shuffled)
    @State private var drawID = UUID()             // cancels the running reveal
    @State private var subPhase: DrawSub = .scan
    @State private var spinName = ""
    @State private var hasStarted = false   // draw only runs after user taps "Chia bảng"
    @Namespace private var flyNS

    enum DrawSub { case scan, reveal }
    private var revealedSet: Set<UUID> { Set(order.prefix(revealed)) }
    private var drawComplete: Bool { mode == .manual || revealed >= teams.count }
    private var currentTeam: TMTeam? { revealed < order.count ? teams.first { $0.id == order[revealed] } : nil }
    private var currentGroup: Int? { currentTeam.flatMap { assign[$0.id] } }

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
                        if !violations.isEmpty { constraintWarning }
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
                            if hasStarted {
                                drawSpotlight
                                HStack {
                                    Button { randomize() } label: {
                                        Label("Bốc lại", systemImage: "shuffle")
                                            .font(TLFont.sans(13, .semibold)).foregroundStyle(TLColor.accentText)
                                    }.buttonStyle(.plain)
                                    Spacer()
                                    if !drawComplete {
                                        Button { skipDraw() } label: {
                                            Text("Bỏ qua").font(TLFont.mono(11, .semibold)).foregroundStyle(TLColor.fg3)
                                        }.buttonStyle(.plain)
                                    }
                                }
                                preview
                            } else {
                                Button { Haptics.light(); hasStarted = true; randomize() } label: {
                                    Label("Bốc thăm chia bảng", systemImage: "shuffle")
                                        .font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.accentInk)
                                        .frame(maxWidth: .infinity).padding(.vertical, 13)
                                        .background(TLColor.accent, in: RoundedRectangle(cornerRadius: TLRadius.sm))
                                }.buttonStyle(.plain).disabled(groupCount < 2)
                            }
                        } else {
                            manualList
                        }
                        Toggle(isOn: $randomizeGameOrder) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Thứ tự ra sân ngẫu nhiên")
                                    .font(TLFont.sans(14, .semibold)).foregroundStyle(TLColor.fg)
                                Text("Mỗi trận có thứ tự các game (đôi nữ / đôi nam / đôi nam nữ) khác nhau.")
                                    .font(TLFont.sans(12)).foregroundStyle(TLColor.fg3)
                            }
                        }.tint(TLColor.accent)
                    }
                }.padding(16)
            }
            .background(TLColor.bg)
            .navigationTitle("Chia bảng").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Huỷ") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Xác nhận") { onConfirm(distribution, randomizeGameOrder) }
                        .fontWeight(.bold).disabled(!valid || working || !drawComplete)
                }
            }
            .onAppear {
                if groupCount == 0 { groupCount = suggestions.first?.groupCount ?? 0 }
            }
            .onChange(of: groupCount) { _, _ in
                if mode == .manual { clamp() } else { hasStarted = false; drawID = UUID(); revealed = 0 }
            }
            .onChange(of: mode) { _, _ in hasStarted = false; drawID = UUID(); revealed = 0 }
        }
    }

    private var constraintWarning: some View {
        let half = rosterSize / 2
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "exclamationmark.triangle.fill").font(.system(size: 14)).foregroundStyle(TLColor.gold)
                Text("\(violations.count) đội chưa đạt ràng buộc")
                    .font(TLFont.sans(13.5, .semibold)).foregroundStyle(TLColor.fg)
            }
            ForEach(violations, id: \.name) { v in
                (Text(v.name).foregroundStyle(TLColor.fg).fontWeight(.medium)
                 + Text(" — ").foregroundStyle(TLColor.fg3)
                 + Text(v.issues.joined(separator: " · ")).foregroundStyle(TLColor.gold))
                    .font(TLFont.sans(12.5))
            }
            Text("Yêu cầu: \(rosterSize) người · \(half) nam \(half) nữ\(requireDupr ? " · tất cả có DUPR" : ""). Bạn vẫn có thể chia bảng.")
                .font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg3)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(TLColor.gold.opacity(0.08), in: RoundedRectangle(cornerRadius: TLRadius.sm))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.sm).strokeBorder(TLColor.gold.opacity(0.4), lineWidth: 1))
    }

    private func randomize() {
        guard groupCount >= 2 else { return }
        // Balanced assignment on a shuffle…
        let assignShuffle = teams.map(\.id).shuffled()
        var a: [UUID: Int] = [:]
        for (i, id) in assignShuffle.enumerated() { a[id] = i % groupCount }
        assign = a
        // …but reveal in an INDEPENDENT random order so the draw doesn't look
        // like teams walking A, B, C, D… into the groups in sequence.
        order = teams.map(\.id).shuffled()
        if mode == .manual { revealed = teams.count; return }
        runDraw()
    }

    // Ceremony per pick (matches web): scan team names (roulette) → lock the
    // pick (big reveal) → the team name flies into its group slot.
    private func runDraw() {
        revealed = 0; subPhase = .scan; spinName = ""
        let id = UUID(); drawID = id
        Task { @MainActor in
            for i in 0..<order.count {
                if drawID != id { return }
                subPhase = .scan
                for _ in 0..<16 {
                    if drawID != id { return }
                    spinName = teams.randomElement()?.teamName ?? ""
                    try? await Task.sleep(for: .milliseconds(70))
                }
                if drawID != id { return }
                withAnimation(.easeOut(duration: 0.2)) { subPhase = .reveal }
                try? await Task.sleep(for: .milliseconds(1100))
                if drawID != id { return }
                withAnimation(.spring(response: 0.5, dampingFraction: 0.78)) {
                    revealed = i + 1; subPhase = .scan; spinName = ""
                }
                try? await Task.sleep(for: .milliseconds(450))
            }
            if drawID == id { subPhase = .reveal }
        }
    }
    private func skipDraw() { drawID = UUID(); subPhase = .reveal; withAnimation { revealed = teams.count } }
    private func clamp() {
        for t in teams where (assign[t.id] ?? 0) >= groupCount { assign[t.id] = 0 }
        revealed = teams.count
    }

    @ViewBuilder
    private func labeled<Content: View>(_ title: String, @ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title.uppercased()).font(TLFont.mono(10, .medium)).tracking(1).foregroundStyle(TLColor.fg3)
            content()
        }
    }

    @ViewBuilder
    private var drawSpotlight: some View {
        let done = drawComplete
        let revealing = subPhase == .reveal && !done
        HStack(spacing: 12) {
            Image(systemName: done ? "sparkles" : "shuffle").font(.system(size: 18)).foregroundStyle(TLColor.accent)
            if done {
                Text("Bốc thăm hoàn tất").font(TLFont.serif(21)).foregroundStyle(TLColor.fg)
            } else if revealing, let cur = currentTeam, let gi = currentGroup {
                VStack(alignment: .leading, spacing: 5) {
                    Text("Lượt \(revealed + 1)/\(teams.count)").font(TLFont.mono(10, .semibold)).foregroundStyle(TLColor.accentText)
                    HStack(spacing: 8) {
                        Text(cur.teamName).font(TLFont.serif(23)).foregroundStyle(TLColor.fg).lineLimit(1)
                            .matchedGeometryEffect(id: cur.id, in: flyNS)
                        Image(systemName: "arrow.right").font(.system(size: 12, weight: .bold)).foregroundStyle(TLColor.accent)
                        Text("Bảng \(names[gi])").font(TLFont.mono(13, .bold)).foregroundStyle(TLColor.accentInk)
                            .padding(.horizontal, 10).padding(.vertical, 4).background(TLColor.accent, in: Capsule())
                    }
                }.transition(.scale.combined(with: .opacity))
            } else {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Đang bốc thăm… \(min(revealed + 1, teams.count))/\(teams.count)")
                        .font(TLFont.mono(10)).foregroundStyle(TLColor.fg3)
                    Text(spinName.isEmpty ? "…" : spinName).font(TLFont.serif(21)).foregroundStyle(TLColor.fg2)
                        .lineLimit(1).opacity(0.85)
                }
            }
            Spacer()
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 70, alignment: .leading)
        .background((done || revealing) ? TLColor.accent.opacity(0.08) : TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.sm).strokeBorder((done || revealing) ? TLColor.accent.opacity(0.45) : TLColor.border, lineWidth: 1))
    }

    private var preview: some View {
        VStack(spacing: 10) {
            ForEach(Array(0..<groupCount), id: \.self) { gi in
                let members = teams.filter { assign[$0.id] == gi && revealedSet.contains($0.id) }
                let isTarget = subPhase == .reveal && !drawComplete && currentGroup == gi
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("Bảng \(names[gi])").font(TLFont.sans(14, .semibold))
                            .foregroundStyle(isTarget ? TLColor.accentText : TLColor.fg)
                        Spacer()
                        Text("\(members.count) đội").font(TLFont.mono(10)).foregroundStyle(TLColor.fg4)
                    }
                    ForEach(members) { t in
                        Text(t.teamName).font(TLFont.sans(12.5)).foregroundStyle(TLColor.fg2)
                            .matchedGeometryEffect(id: t.id, in: flyNS)
                    }
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background((isTarget ? TLColor.accent.opacity(0.08) : TLColor.surface), in: RoundedRectangle(cornerRadius: TLRadius.sm))
                .overlay(RoundedRectangle(cornerRadius: TLRadius.sm).strokeBorder(isTarget ? TLColor.accent : TLColor.border, lineWidth: isTarget ? 2 : 1))
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
