import SwiftUI

@Observable
final class TeamMatchViewModel {
    enum Phase: Equatable {
        case loading
        case loaded(TMDetail)
        case failed(String)
    }
    enum Tab: String, CaseIterable, Identifiable {
        case matches, teams
        var id: String { rawValue }
        var label: String { self == .matches ? "Trận đấu" : "Đội" }
    }

    var phase: Phase = .loading
    var editable = false
    var tab: Tab = .matches
    var expanded: Set<UUID> = []

    private let repo = TeamMatchRepository()
    var detail: TMDetail? { if case .loaded(let d) = phase { return d } ; return nil }

    @MainActor
    func load(shareID: String) async {
        if case .loaded = phase {} else { phase = .loading }
        do {
            let detail = try await repo.load(shareID: shareID)
            let uid = await repo.currentUserID()
            editable = detail.tournament.createdBy != nil && detail.tournament.createdBy == uid
            phase = .loaded(detail)
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }
}

/// Native Team Match (MLP) read view — team-vs-team matches with sub-game
/// breakdown + lineups, and the team list. Scoring (lineup + sub-games +
/// dreambreaker) still happens on web; a per-match button opens it.
struct TeamMatchDetailView: View {
    let shareID: String
    let fallbackName: String

    @State private var model = TeamMatchViewModel()
    @State private var openWeb = false

    var body: some View {
        ScrollView {
            content.padding(.bottom, 28)
        }
        .background(TLColor.bg)
        .navigationTitle(fallbackName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { openWeb = true } label: {
                    Image(systemName: "safari").foregroundStyle(TLColor.accentText)
                }
                .accessibilityLabel("Mở trên web")
            }
        }
        .task { await model.load(shareID: shareID) }
        .refreshable { await model.load(shareID: shareID) }
        .sheet(isPresented: $openWeb) {
            SafariView(url: WebRoutes.toolsTeamMatchView(shareID: shareID)).ignoresSafeArea()
        }
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
                Picker("", selection: Binding(get: { model.tab }, set: { model.tab = $0 })) {
                    ForEach(TeamMatchViewModel.Tab.allCases) { Text($0.label).tag($0) }
                }
                .pickerStyle(.segmented)
                switch model.tab {
                case .matches: matchesTab(detail)
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
        let sections = detail.sections
        if sections.isEmpty {
            note("Chưa có trận đấu. BTC tạo lịch trên web.")
        } else {
            ForEach(Array(sections.enumerated()), id: \.offset) { _, section in
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 8) {
                        RoundedRectangle(cornerRadius: 1).fill(TLColor.accent).frame(width: 3, height: 15)
                        Text(section.title.uppercased()).font(TLFont.mono(11, .semibold)).tracking(1).foregroundStyle(TLColor.fg)
                    }
                    ForEach(section.matches) { m in matchCard(detail, m) }
                }
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
            if model.editable {
                Button { openWeb = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "square.and.pencil").font(.system(size: 11))
                        Text("Chấm điểm trên web").font(TLFont.mono(10.5, .semibold))
                    }
                    .foregroundStyle(TLColor.accentText)
                    .frame(maxWidth: .infinity).padding(.vertical, 11)
                }
                .buttonStyle(.plain)
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

    // MARK: Teams

    private func teamsTab(_ detail: TMDetail) -> some View {
        VStack(spacing: 0) {
            if detail.teams.isEmpty {
                note("Chưa có đội.")
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
