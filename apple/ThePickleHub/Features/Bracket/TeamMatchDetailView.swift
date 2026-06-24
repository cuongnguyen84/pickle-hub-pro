import SwiftUI

@Observable
final class TeamMatchViewModel {
    enum Phase: Equatable {
        case loading
        case loaded(TMDetail)
        case failed(String)
    }
    enum Tab: String, CaseIterable, Identifiable {
        case matches, standings, teams
        var id: String { rawValue }
        var label: String {
            switch self {
            case .matches: return "Trận đấu"
            case .standings: return "Xếp hạng"
            case .teams: return "Đội"
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

    /// Tabs available for this tournament — standings only for round-robin formats.
    func tabs(for detail: TMDetail) -> [Tab] {
        detail.hasStandings ? [.matches, .standings, .teams] : [.matches, .teams]
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
            if tab == .standings && !detail.hasStandings { tab = .matches }
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
    func generatePlayoff(shareID: String) async {
        guard let d = detail else { return }
        let target = d.tournament.playoffTeamCount ?? 4
        let ranked = d.standings.map { $0.team.id.uuidString.lowercased() }
        let seeded = Array(ranked.prefix(target))
        guard seeded.count >= 2, seeded.count & (seeded.count - 1) == 0 else {
            actionError = "Số đội vào playoff phải là 2/4/8 và đủ đội đã xếp hạng."
            return
        }
        working = true; actionError = nil
        do {
            try await repo.generatePlayoffFromSeeds(
                tournamentID: d.tournament.id, seededTeamIDs: seeded,
                hasDreambreaker: d.tournament.hasDreambreaker ?? false)
            await load(shareID: shareID)
        } catch { actionError = error.localizedDescription }
        working = false
    }

    @MainActor
    func deleteSchedule(shareID: String) async {
        guard let d = detail else { return }
        working = true; actionError = nil
        do { try await repo.deleteMatches(tournamentID: d.tournament.id); await load(shareID: shareID) }
        catch { actionError = error.localizedDescription }
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
    @State private var showRegister = false
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
                case .standings: standingsTab(detail)
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
                // Round-robin rounds as lists.
                ForEach(Array(detail.rrSections.enumerated()), id: \.offset) { _, section in
                    roundSection(detail, title: section.title, matches: section.matches)
                }
                // Playoff as a horizontal bracket tree.
                if !detail.mlpPlayoffRounds.isEmpty {
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
                        scorePill(m.gamesWonA, win: aWon)
                        scorePill(m.gamesWonB, win: bWon)
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
    private func standingsTab(_ detail: TMDetail) -> some View {
        let rows = detail.standings
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

    private func teamsTab(_ detail: TMDetail) -> some View {
        VStack(alignment: .leading, spacing: 12) {
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
            teamsList(detail)
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
