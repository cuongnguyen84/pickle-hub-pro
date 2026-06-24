import SwiftUI

@Observable
final class DoublesElimViewModel {
    enum Phase: Equatable {
        case loading
        case loaded(DEDetail)
        case failed(String)
    }

    enum Tab: String, CaseIterable, Identifiable {
        case preliminary, playoff, courts, teams
        var id: String { rawValue }
        var label: String {
            switch self {
            case .preliminary: return "Sơ loại"
            case .playoff: return "Playoff"
            case .courts: return "Sân"
            case .teams: return "Đội"
            }
        }
    }

    var phase: Phase = .loading
    var editable = false          // creator OR referee → can score
    var isCreator = false         // creator only → registration management + settings
    var currentUserID: UUID?
    var tab: Tab = .preliminary
    var scoringMatch: DEMatch?
    var regBusy = false
    var regMessage: String?

    private let repo = DoublesElimRepository()

    var detail: DEDetail? { if case .loaded(let d) = phase { return d } ; return nil }

    @MainActor
    func load(shareID: String) async {
        await fetch(shareID: shareID)
        if editable { await maintain(shareID: shareID) }
    }

    @MainActor
    private func fetch(shareID: String) async {
        if case .loaded = phase {} else { phase = .loading }
        do {
            let detail = try await repo.load(shareID: shareID)
            let uid = await repo.currentUserID()
            currentUserID = uid
            isCreator = detail.tournament.creatorUserID != nil && detail.tournament.creatorUserID == uid
            let referee = uid != nil ? await repo.isReferee(tournamentID: detail.tournament.id, userID: uid!) : false
            editable = isCreator || referee
            phase = .loaded(detail)
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    /// Auto-assign R3 + auto-generate playoff (creator only). RLS still enforces.
    @MainActor
    private func maintain(shareID: String) async {
        guard case .loaded(let d) = phase else { return }
        var didWork = false
        if d.r1Completed && d.r2Completed && d.r3NeedsAssignment {
            didWork = ((try? await repo.checkAndAssignR3(tournamentID: d.tournament.id)) ?? false) || didWork
        }
        if d.r3Completed && !d.hasPlayoff {
            didWork = ((try? await repo.checkAndGeneratePlayoff(tournamentID: d.tournament.id)) ?? false) || didWork
        }
        if didWork { await fetch(shareID: shareID) }
    }

    @MainActor
    func submitScore(match: DEMatch, gameScores: [(Int, Int)], shareID: String) async {
        do {
            try await repo.score(match: match, gameScores: gameScores)
            scoringMatch = nil
            await load(shareID: shareID)
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    // MARK: Registration actions (registration_open mode)

    @MainActor
    func register(partnerUserID: UUID, teamName: String?, shareID: String) async {
        guard let id = detail?.tournament.id else { return }
        regBusy = true; regMessage = nil
        switch await repo.registerTeam(tournamentID: id, partnerUserID: partnerUserID, teamName: teamName) {
        case .ok(let avg):
            regMessage = "Đăng ký thành công" + (avg.map { String(format: " · DUPR %.2f", $0) } ?? "")
            await fetch(shareID: shareID)
        case .failed(let m): regMessage = m
        }
        regBusy = false
    }

    @MainActor
    func cancelRegistration(shareID: String) async {
        guard let id = detail?.tournament.id else { return }
        regBusy = true; regMessage = nil
        switch await repo.cancelTeamRegistration(tournamentID: id) {
        case .ok: regMessage = "Đã huỷ đăng ký"; await fetch(shareID: shareID)
        case .failed(let m): regMessage = m
        }
        regBusy = false
    }

    @MainActor
    func organizerAdd(player1: UUID, player2: UUID, teamName: String?, shareID: String) async -> Bool {
        guard let id = detail?.tournament.id else { return false }
        regBusy = true; regMessage = nil
        let ok: Bool
        switch await repo.organizerAddTeam(tournamentID: id, player1: player1, player2: player2, teamName: teamName) {
        case .ok(let avg): regMessage = "Đã thêm đội" + (avg.map { String(format: " · DUPR %.2f", $0) } ?? ""); await fetch(shareID: shareID); ok = true
        case .failed(let m): regMessage = m; ok = false
        }
        regBusy = false
        return ok
    }

    @MainActor
    func organizerRemove(team: DETeam, shareID: String) async {
        guard let id = detail?.tournament.id else { return }
        regBusy = true; regMessage = nil
        switch await repo.organizerRemoveTeam(tournamentID: id, teamID: team.id) {
        case .ok: regMessage = "Đã xoá đội"; await fetch(shareID: shareID)
        case .failed(let m): regMessage = m
        }
        regBusy = false
    }

    @MainActor
    func closeRegistration(shareID: String) async {
        guard let id = detail?.tournament.id else { return }
        regBusy = true; regMessage = nil
        do {
            _ = try await repo.closeRegistrationAndGenerate(tournamentID: id)
            regMessage = nil
            await load(shareID: shareID)
        } catch {
            regMessage = error.localizedDescription
        }
        regBusy = false
    }
}

/// Native Doubles Elimination view — preliminary (R1/R2/R3) + playoff round lists,
/// teams, and inline score entry with full winner/loser advancement. Faithful
/// port of the web bracket; bracket tree viz deferred (round-grouped lists).
struct DoublesElimDetailView: View {
    let shareID: String
    let fallbackName: String

    @State private var model = DoublesElimViewModel()
    @State private var openWeb = false
    @State private var showSettings = false

    var body: some View {
        ScrollView {
            content.padding(.bottom, 28)
        }
        .background(TLColor.bg)
        .navigationTitle(fallbackName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                HStack(spacing: 14) {
                    if model.isCreator {
                        Button { Haptics.light(); showSettings = true } label: {
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
        }
        .task { await model.load(shareID: shareID) }
        .task(id: shareID) {
            // Live polling (web parity: refetchInterval 15s). Skip while a sheet
            // is open so the list can't shift under the user.
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(15))
                if Task.isCancelled { break }
                if model.scoringMatch == nil && !showSettings { await model.load(shareID: shareID) }
            }
        }
        .refreshable { await model.load(shareID: shareID) }
        .sheet(isPresented: $openWeb) {
            SafariView(url: WebRoutes.toolsDoublesEliminationView(shareID: shareID)).ignoresSafeArea()
        }
        .sheet(isPresented: $showSettings) {
            if let detail = model.detail {
                DoublesElimSettingsSheet(
                    tournament: detail.tournament,
                    onChanged: { Task { await model.load(shareID: shareID) } },
                    onDeleted: { dismiss() })
            }
        }
        .sheet(item: Binding(get: { model.scoringMatch }, set: { model.scoringMatch = $0 })) { match in
            if let detail = model.detail {
                DEScoreSheet(detail: detail, match: match) { pairs in
                    Task { await model.submitScore(match: match, gameScores: pairs, shareID: shareID) }
                }
            }
        }
    }

    @Environment(\.dismiss) private var dismiss

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
                if detail.isRegistrationOpen {
                    DoublesElimRegistrationView(detail: detail, model: model, shareID: shareID)
                } else {
                    tabPicker(detail)
                    switch model.tab {
                    case .preliminary: preliminary(detail)
                    case .playoff: playoff(detail)
                    case .courts: courtsTab(detail)
                    case .teams: teamsTab(detail)
                    }
                }
            }
            .padding(.horizontal, 16).padding(.top, 8)
        }
    }

    // MARK: Header

    private func header(_ t: DETournament) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("◆ Loại kép · \(t.teamCount) đội")
                .font(TLFont.mono(10.5, .medium)).tracking(1).foregroundStyle(TLColor.fg3)
            Text(t.displayName).font(TLFont.serif(26)).foregroundStyle(TLColor.fg)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 8) {
                Text(t.statusLabel.uppercased())
                    .font(TLFont.mono(9, .bold)).tracking(1)
                    .foregroundStyle(t.status == "ongoing" ? TLColor.accentText : TLColor.fg3)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background((t.status == "ongoing" ? TLColor.accent.opacity(0.1) : TLColor.surface), in: Capsule())
                Text("\(t.earlyRoundsFormat.uppercased()) / \(t.finalsFormat.uppercased())")
                    .font(TLFont.mono(9, .medium)).tracking(0.5).foregroundStyle(TLColor.fg3)
            }
        }
    }

    private func tabPicker(_ detail: DEDetail) -> some View {
        Picker("", selection: Binding(get: { model.tab }, set: { model.tab = $0 })) {
            Text(DoublesElimViewModel.Tab.preliminary.label).tag(DoublesElimViewModel.Tab.preliminary)
            Text(DoublesElimViewModel.Tab.playoff.label).tag(DoublesElimViewModel.Tab.playoff)
            if detail.hasUpcomingCourtMatches {
                Text(DoublesElimViewModel.Tab.courts.label).tag(DoublesElimViewModel.Tab.courts)
            }
            Text(DoublesElimViewModel.Tab.teams.label).tag(DoublesElimViewModel.Tab.teams)
        }
        .pickerStyle(.segmented)
    }

    // MARK: Preliminary

    @ViewBuilder
    private func preliminary(_ detail: DEDetail) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            if !detail.r1Matches.isEmpty {
                roundSection(title: "Vòng 1", subtitle: "Winner Bracket", detail: detail, matches: detail.r1Matches)
            }
            if !detail.r2Matches.isEmpty {
                roundSection(title: "Vòng 2", subtitle: "Loser Bracket", detail: detail, matches: detail.r2Matches)
            }
            if !detail.r3Matches.isEmpty {
                if detail.r3NeedsAssignment && !(detail.r1Completed && detail.r2Completed) {
                    roundHeader(title: "Vòng 3", subtitle: "Sơ loại cuối")
                    note("Chờ V1 & V2 hoàn thành")
                } else if detail.r3NeedsAssignment {
                    roundHeader(title: "Vòng 3", subtitle: "Sơ loại cuối")
                    note(model.editable ? "Đang phân vòng 3…" : "Chờ phân vòng 3")
                } else {
                    roundSection(title: "Vòng 3", subtitle: "Sơ loại cuối", detail: detail, matches: detail.r3Matches)
                }
            }
            if detail.r1Matches.isEmpty && detail.r2Matches.isEmpty && detail.r3Matches.isEmpty {
                note("Chưa có bracket.")
            }
        }
    }

    // MARK: Playoff

    @ViewBuilder
    private func playoff(_ detail: DEDetail) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            if let champ = detail.champion {
                championBanner(champ)
            }
            if !detail.hasPlayoff {
                note("Vòng playoff sẽ bắt đầu sau khi hoàn thành vòng sơ loại.")
            } else {
                roundHeader(title: "Sơ đồ playoff", subtitle: "")
                BracketTreeView(rounds: playoffBracketRounds(detail))
                if let tp = detail.thirdPlaceMatch {
                    roundHeader(title: "Tranh hạng 3", subtitle: "")
                    matchCard(detail, tp)
                }
            }
        }
    }

    /// Map the playoff rounds (R4+, clean single-elimination) to BracketTreeView.
    private func playoffBracketRounds(_ detail: DEDetail) -> [BracketRound] {
        detail.playoffRounds.map { r in
            let slots = r.matches.map { m -> BracketSlot in
                let canScore = model.editable && m.hasBothTeams && !m.isCompleted
                let showScore = m.isCompleted || m.isLive
                let a = m.isBestOf ? m.gamesWonA : m.scoreA
                let b = m.isBestOf ? m.gamesWonB : m.scoreB
                return BracketSlot(
                    id: m.id,
                    topName: detail.teamLabel(m.teamAID),
                    botName: detail.teamLabel(m.teamBID),
                    topScore: showScore ? String(a) : "",
                    botScore: showScore ? String(b) : "",
                    topWon: m.isCompleted && m.winnerID == m.teamAID,
                    botWon: m.isCompleted && m.winnerID == m.teamBID,
                    completed: m.isCompleted,
                    onTap: canScore ? { Haptics.light(); model.scoringMatch = m } : nil)
            }
            return BracketRound(id: r.round, title: roundLabel(r.type, r.matches.count),
                                doneCount: r.matches.filter { $0.isCompleted }.count, slots: slots)
        }
    }

    // MARK: Courts (queue board grouped by court_number)

    @ViewBuilder
    private func courtsTab(_ detail: DEDetail) -> some View {
        let upcoming = detail.upcomingCourtMatches
        if upcoming.isEmpty {
            note("Không còn trận nào trong hàng đợi.")
        } else {
            let grouped = Dictionary(grouping: upcoming) { $0.courtNumber.map { "Sân \($0)" } ?? "Chưa gán sân" }
            VStack(alignment: .leading, spacing: 14) {
                ForEach(grouped.keys.sorted(), id: \.self) { court in
                    courtColumn(detail, court: court, matches: grouped[court] ?? [])
                }
            }
        }
    }

    private func courtColumn(_ detail: DEDetail, court: String, matches: [DEMatch]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "sportscourt").font(.system(size: 13)).foregroundStyle(TLColor.accentText)
                Text(court.uppercased()).font(TLFont.mono(11, .semibold)).tracking(0.8).foregroundStyle(TLColor.fg)
                Spacer()
                Text("\(matches.count) trận").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
            }
            ForEach(Array(matches.enumerated()), id: \.element.id) { i, m in
                courtMatchRow(detail, m, next: i == 0)
            }
        }
        .padding(14)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private func courtMatchRow(_ detail: DEDetail, _ m: DEMatch, next: Bool) -> some View {
        let canScore = model.editable && m.hasBothTeams
        return Button {
            if canScore { Haptics.light(); model.scoringMatch = m }
        } label: {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(detail.teamLabel(m.teamAID)).font(TLFont.sans(13.5, next ? .semibold : .regular)).foregroundStyle(TLColor.fg).lineLimit(1)
                    Text(detail.teamLabel(m.teamBID)).font(TLFont.sans(13.5, next ? .semibold : .regular)).foregroundStyle(TLColor.fg2).lineLimit(1)
                }
                Spacer(minLength: 6)
                if let time = m.startTime?.nonEmpty {
                    Text(time).font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                }
                if next {
                    Text("TIẾP THEO").font(TLFont.mono(8.5, .bold)).tracking(0.5).foregroundStyle(TLColor.accentInk)
                        .padding(.horizontal, 7).padding(.vertical, 3).background(TLColor.accent, in: Capsule())
                } else {
                    Text("chờ").font(TLFont.mono(9)).foregroundStyle(TLColor.fg4)
                }
                if canScore {
                    Image(systemName: "square.and.pencil").font(.system(size: 12)).foregroundStyle(TLColor.accentText)
                }
            }
            .padding(.vertical, 9).padding(.horizontal, 12)
            .background(next ? TLColor.accent.opacity(0.06) : TLColor.bg, in: RoundedRectangle(cornerRadius: 10))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain).disabled(!canScore)
    }

    private func championBanner(_ team: DETeam) -> some View {
        HStack(spacing: 14) {
            Image(systemName: "trophy.fill").font(.system(size: 22)).foregroundStyle(TLColor.accentText)
            VStack(alignment: .leading, spacing: 3) {
                Text("VÔ ĐỊCH").font(TLFont.mono(10, .bold)).tracking(1.5).foregroundStyle(TLColor.accentText)
                Text(team.displayLabel).font(TLFont.serif(24)).foregroundStyle(TLColor.fg)
            }
            Spacer()
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(colors: [TLColor.accent.opacity(0.16), TLColor.surface], startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous)
        )
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.accent.opacity(0.35), lineWidth: 1))
    }

    // MARK: Teams tab

    private func teamsTab(_ detail: DEDetail) -> some View {
        VStack(spacing: 0) {
            ForEach(Array(detail.teamsBySeed.enumerated()), id: \.element.id) { index, team in
                if index > 0 { Rectangle().fill(TLColor.border).frame(height: 1) }
                HStack(spacing: 12) {
                    Text("#\(team.seed.map(String.init) ?? "—")")
                        .font(TLFont.mono(11, .medium)).foregroundStyle(TLColor.fg3)
                        .frame(width: 34, alignment: .leading)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(team.teamName).font(TLFont.sans(14.5, .medium)).foregroundStyle(TLColor.fg).lineLimit(1)
                        Text(team.playersLine).font(TLFont.sans(12.5)).foregroundStyle(TLColor.fg3).lineLimit(1)
                    }
                    Spacer(minLength: 8)
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("+\(team.totalPointsFor) / -\(team.totalPointsAgainst)")
                            .font(TLFont.mono(11)).foregroundStyle(TLColor.fg3)
                        Text(team.pointDiff >= 0 ? "+\(team.pointDiff)" : "\(team.pointDiff)")
                            .font(TLFont.mono(12, .semibold))
                            .foregroundStyle(team.pointDiff >= 0 ? TLColor.accentText : TLColor.live)
                    }
                    if team.isEliminated {
                        Text("LOẠI R\(team.eliminatedAtRound.map(String.init) ?? "")")
                            .font(TLFont.mono(8.5, .medium)).tracking(0.4).foregroundStyle(TLColor.fg3)
                            .padding(.horizontal, 6).padding(.vertical, 3)
                            .background(TLColor.surface2, in: Capsule())
                    }
                }
                .padding(.horizontal, 14).padding(.vertical, 11)
                .opacity(team.isEliminated ? 0.55 : 1)
            }
        }
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    // MARK: Round section + match card

    private func roundSection(title: String, subtitle: String, detail: DEDetail, matches: [DEMatch]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            roundHeader(title: title, subtitle: subtitle,
                        progress: "\(matches.filter { $0.isCompleted }.count)/\(matches.count)")
            ForEach(matches) { m in matchCard(detail, m) }
        }
    }

    private func roundHeader(title: String, subtitle: String, progress: String? = nil) -> some View {
        HStack(spacing: 8) {
            RoundedRectangle(cornerRadius: 1).fill(TLColor.accent).frame(width: 3, height: 15)
            Text(title.uppercased()).font(TLFont.mono(11, .semibold)).tracking(1).foregroundStyle(TLColor.fg)
            if !subtitle.isEmpty {
                Text(subtitle).font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg3)
            }
            Spacer()
            if let progress {
                Text(progress).font(TLFont.mono(10)).foregroundStyle(TLColor.fg2).monospacedDigit()
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(TLColor.surface, in: Capsule())
            }
        }
    }

    private func matchCard(_ detail: DEDetail, _ m: DEMatch) -> some View {
        let canScore = model.editable && m.hasBothTeams
        let scoreA = m.isBestOf ? m.gamesWonA : m.scoreA
        let scoreB = m.isBestOf ? m.gamesWonB : m.scoreB
        return Button {
            if canScore { Haptics.light(); model.scoringMatch = m }
        } label: {
            VStack(spacing: 0) {
                HStack(spacing: 6) {
                    Text("Trận \(m.matchNumber)").font(TLFont.mono(10, .medium)).foregroundStyle(TLColor.fg2)
                    if let court = m.courtNumber { Text("S\(court)").font(TLFont.mono(9)).foregroundStyle(TLColor.fg3) }
                    if let time = m.startTime?.nonEmpty { Text(time).font(TLFont.mono(9)).foregroundStyle(TLColor.fg3) }
                    Spacer()
                    if m.isBestOf { badge("BO\(m.bestOf)", accent: false) }
                    if m.isLive { badge("LIVE", accent: false, live: true) }
                    else if m.isCompleted { badge("XONG", accent: false) }
                }
                .padding(.horizontal, 12).padding(.vertical, 8)
                .background(TLColor.surface2.opacity(0.5))

                teamRow(detail.teamLabel(m.teamAID), score: scoreA, won: m.isCompleted && m.winnerID == m.teamAID, placeholder: m.teamAID == nil)
                Rectangle().fill(TLColor.border).frame(height: 1)
                teamRow(detail.teamLabel(m.teamBID), score: scoreB, won: m.isCompleted && m.winnerID == m.teamBID, placeholder: m.teamBID == nil)

                if canScore && !m.isCompleted {
                    HStack {
                        Spacer()
                        Text("Chấm điểm").font(TLFont.mono(10, .semibold)).foregroundStyle(TLColor.accentText)
                        Image(systemName: "arrow.right").font(.system(size: 9, weight: .bold)).foregroundStyle(TLColor.accentText)
                    }
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(TLColor.surface2.opacity(0.5))
                }
            }
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous)
                .strokeBorder(m.isLive ? TLColor.live.opacity(0.6) : TLColor.border, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!canScore)
    }

    private func teamRow(_ name: String, score: Int, won: Bool, placeholder: Bool) -> some View {
        HStack(spacing: 10) {
            Rectangle().fill(won ? TLColor.accent : Color.clear).frame(width: 2)
            Text(name)
                .font(TLFont.serif(16)).italic()
                .foregroundStyle(placeholder ? TLColor.fg3 : (won ? TLColor.fg : TLColor.fg2))
                .lineLimit(1).frame(maxWidth: .infinity, alignment: .leading)
            Text("\(score)")
                .font(TLFont.mono(14, .semibold)).monospacedDigit()
                .foregroundStyle(won ? TLColor.accentInk : TLColor.fg2)
                .frame(width: 34, height: 30)
                .background(won ? TLColor.accent : TLColor.surface2, in: RoundedRectangle(cornerRadius: 6))
            if won { Image(systemName: "crown.fill").font(.system(size: 12)).foregroundStyle(TLColor.accentText) }
        }
        .padding(.trailing, 12).padding(.vertical, 9)
        .background(won ? TLColor.accent.opacity(0.08) : Color.clear)
    }

    private func badge(_ text: String, accent: Bool, live: Bool = false) -> some View {
        Text(text)
            .font(TLFont.mono(8.5, .medium)).tracking(0.5)
            .foregroundStyle(live ? TLColor.live : TLColor.fg3)
            .padding(.horizontal, 6).padding(.vertical, 3)
            .background((live ? TLColor.live.opacity(0.12) : TLColor.surface2), in: Capsule())
    }

    private func note(_ text: String) -> some View {
        Text(text).font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, style: StrokeStyle(lineWidth: 1, dash: [4])))
    }

    private func roundLabel(_ type: String, _ count: Int) -> String {
        switch type {
        case "quarterfinal": return "Tứ kết"
        case "semifinal": return "Bán kết"
        case "final": return "Chung kết"
        case "elimination":
            if count == 1 { return "Chung kết" }
            if count == 2 { return "Bán kết" }
            if count <= 4 { return "Tứ kết" }
            if count <= 8 { return "Vòng 16" }
            return "Vòng \(count * 2)"
        default: return "Playoff"
        }
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "arrow.triangle.branch").font(.largeTitle).foregroundStyle(TLColor.fg3)
            Text("Không tải được giải").font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
            Text(message).font(TLFont.sans(12)).foregroundStyle(TLColor.fg3).multilineTextAlignment(.center)
            Button("Thử lại") { Task { await model.load(shareID: shareID) } }.foregroundStyle(TLColor.accentText)
        }
        .frame(maxWidth: .infinity).padding(.horizontal, 32).padding(.top, 60)
    }
}

/// Adaptive score entry: one row for BO1, up to best_of game rows otherwise.
private struct DEScoreSheet: View {
    let detail: DEDetail
    let match: DEMatch
    let onSave: ([(Int, Int)]) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var rows: [(a: String, b: String)]

    init(detail: DEDetail, match: DEMatch, onSave: @escaping ([(Int, Int)]) -> Void) {
        self.detail = detail
        self.match = match
        self.onSave = onSave
        let count = max(1, match.bestOf)
        var initial = Array(repeating: (a: "", b: ""), count: count)
        for g in match.games where g.game - 1 < count {
            initial[g.game - 1] = (a: String(g.scoreA), b: String(g.scoreB))
        }
        if match.bestOf <= 1 {
            initial[0] = (a: match.scoreA == 0 && match.scoreB == 0 ? "" : String(match.scoreA),
                          b: match.scoreA == 0 && match.scoreB == 0 ? "" : String(match.scoreB))
        }
        _rows = State(initialValue: initial)
    }

    private var pairs: [(Int, Int)] {
        rows.compactMap { r in
            guard let a = Int(r.a), let b = Int(r.b), a != b else { return nil }
            return (a, b)
        }
    }
    private var valid: Bool { !pairs.isEmpty }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    teamHeader
                    ForEach(rows.indices, id: \.self) { i in
                        gameRow(i)
                    }
                }
                .padding(20)
            }
            .background(TLColor.bg)
            .navigationTitle(match.isBestOf ? "Nhập tỉ số (BO\(match.bestOf))" : "Nhập tỉ số")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Hủy") { dismiss() }.foregroundStyle(TLColor.fg3)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Lưu") { if valid { Haptics.light(); onSave(pairs) } }
                        .foregroundStyle(valid ? TLColor.accentText : TLColor.fg4)
                        .disabled(!valid)
                }
            }
        }
        .presentationDetents(match.isBestOf ? [.large] : [.medium])
    }

    private var teamHeader: some View {
        HStack {
            Text(detail.teamLabel(match.teamAID)).font(TLFont.sans(14, .semibold)).foregroundStyle(TLColor.fg)
                .frame(maxWidth: .infinity, alignment: .leading).lineLimit(1)
            Text("vs").font(TLFont.mono(11)).foregroundStyle(TLColor.fg4)
            Text(detail.teamLabel(match.teamBID)).font(TLFont.sans(14, .semibold)).foregroundStyle(TLColor.fg)
                .frame(maxWidth: .infinity, alignment: .trailing).lineLimit(1)
        }
    }

    private func gameRow(_ i: Int) -> some View {
        HStack(spacing: 14) {
            if match.isBestOf {
                Text("G\(i + 1)").font(TLFont.mono(11, .medium)).foregroundStyle(TLColor.fg3).frame(width: 28)
            }
            field(text: Binding(get: { rows[i].a }, set: { rows[i].a = $0 }))
            Text("–").font(TLFont.serif(20)).foregroundStyle(TLColor.fg4)
            field(text: Binding(get: { rows[i].b }, set: { rows[i].b = $0 }))
        }
    }

    private func field(text: Binding<String>) -> some View {
        TextField("0", text: text)
            .keyboardType(.numberPad).multilineTextAlignment(.center)
            .font(TLFont.mono(22, .semibold)).monospacedDigit().foregroundStyle(TLColor.fg)
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }
}
