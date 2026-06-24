import SwiftUI

/// Native MLP lineup selection — port of web LineupSelectionSheet. Assign roster
/// players to each sub-game honoring gender + count rules (WD/MD/MX/WS/MS), then
/// submit. Organizer edits either team anytime; a captain edits only their own
/// team and only before the match starts / before submission.
@Observable
final class TMLineupModel {
    let detail: TMDetail
    let match: TMMatch
    let auth: TMScoreAuth

    var teamA: Bool                       // which team is being edited
    var selections: [UUID: [UUID]] = [:]  // gameId → ordered roster ids
    var saving = false
    var error: String?

    private let repo = TeamMatchRepository()

    init(detail: TMDetail, match: TMMatch, auth: TMScoreAuth) {
        self.detail = detail
        self.match = match
        self.auth = auth
        // Default to the team the user can edit: own team for a captain, else team A.
        if let cap = auth.captainTeamID, cap == match.teamBID, !auth.isOwner {
            self.teamA = false
        } else {
            self.teamA = true
        }
        loadSelections()
    }

    var games: [TMGame] { detail.games(for: match.id) }
    var editingTeamID: UUID? { teamA ? match.teamAID : match.teamBID }
    var editingRoster: [TMRosterPlayer] { editingTeamID.map { detail.roster(for: $0) } ?? [] }

    /// Owner may switch teams; a captain is locked to their own team.
    var canSwitchTeam: Bool { auth.isOwner }

    private var matchStarted: Bool { match.status == "in_progress" || match.status == "completed" }
    private var submitted: Bool { teamA ? match.lineupASubmitted : match.lineupBSubmitted }

    /// Whether the current user can edit the currently-selected team's lineup.
    var canEdit: Bool {
        if auth.isOwner { return true }
        guard let cap = auth.captainTeamID, cap == editingTeamID else { return false }
        return !matchStarted && !submitted
    }

    func loadSelections() {
        var map: [UUID: [UUID]] = [:]
        for g in games {
            map[g.id] = (teamA ? g.lineupTeamA : g.lineupTeamB) ?? []
        }
        selections = map
    }

    func requirement(_ g: TMGame) -> TMLineupRequirement {
        TMLineupRules.requirement(gameType: g.gameType, isDreambreaker: g.isDreambreaker == true)
    }
    func totalNeeded(_ g: TMGame) -> Int {
        TMLineupRules.totalPlayers(gameType: g.gameType, isDreambreaker: g.isDreambreaker == true)
    }

    func isSelected(_ g: TMGame, _ player: TMRosterPlayer) -> Bool {
        (selections[g.id] ?? []).contains(player.id)
    }

    /// Toggle a player in a game, enforcing count + gender capacity.
    func toggle(_ g: TMGame, _ player: TMRosterPlayer) {
        guard canEdit else { return }
        var sel = selections[g.id] ?? []
        if let idx = sel.firstIndex(of: player.id) {
            sel.remove(at: idx)
        } else if sel.count < totalNeeded(g) {
            if g.isDreambreaker != true {
                let req = requirement(g)
                let chosen = editingRoster.filter { sel.contains($0.id) }
                if player.isMale && chosen.filter({ $0.isMale }).count >= req.male { return }
                if player.isFemale && chosen.filter({ $0.isFemale }).count >= req.female { return }
            }
            sel.append(player.id)
        }
        selections[g.id] = sel
    }

    func isValid(_ g: TMGame) -> Bool {
        let sel = selections[g.id] ?? []
        if g.isDreambreaker == true { return sel.count == TMLineupRules.dreambreakerCount }
        guard sel.count == totalNeeded(g) else { return false }
        let chosen = editingRoster.filter { sel.contains($0.id) }
        let req = requirement(g)
        return chosen.filter { $0.isMale }.count == req.male
            && chosen.filter { $0.isFemale }.count == req.female
    }

    var allValid: Bool { !games.isEmpty && games.allSatisfy { isValid($0) } }

    @MainActor
    func save(onSaved: () -> Void) async {
        guard let _ = editingTeamID, canEdit, allValid else { return }
        saving = true; error = nil
        do {
            try await repo.saveLineup(matchID: match.id, isTeamA: teamA, lineups: selections)
            onSaved()
        } catch {
            self.error = error.localizedDescription
        }
        saving = false
    }
}

struct TeamMatchLineupSheet: View {
    let detail: TMDetail
    let match: TMMatch
    let auth: TMScoreAuth
    let onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var model: TMLineupModel

    init(detail: TMDetail, match: TMMatch, auth: TMScoreAuth, onSaved: @escaping () -> Void) {
        self.detail = detail; self.match = match; self.auth = auth; self.onSaved = onSaved
        _model = State(initialValue: TMLineupModel(detail: detail, match: match, auth: auth))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if model.canSwitchTeam { teamPicker }
                    if model.editingRoster.isEmpty {
                        Text("Đội chưa có VĐV trong danh sách.")
                            .font(TLFont.sans(13)).foregroundStyle(TLColor.fg3).padding(.top, 8)
                    } else {
                        ForEach(model.games) { g in gameBlock(g) }
                    }
                    if let err = model.error {
                        Text(err).font(TLFont.sans(12)).foregroundStyle(TLColor.live)
                    }
                }
                .padding(16)
            }
            .background(TLColor.bg)
            .navigationTitle("Đội hình")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Đóng") { dismiss() }.foregroundStyle(TLColor.fg3)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    if model.canEdit {
                        Button {
                            Haptics.success()
                            Task { await model.save { onSaved(); dismiss() } }
                        } label: {
                            if model.saving { ProgressView().tint(TLColor.accentText) }
                            else { Text("Lưu").font(TLFont.sans(15, .semibold)) }
                        }
                        .foregroundStyle(model.allValid ? TLColor.accentText : TLColor.fg4)
                        .disabled(!model.allValid || model.saving)
                    }
                }
            }
        }
    }

    private var teamPicker: some View {
        Picker("", selection: Binding(
            get: { model.teamA },
            set: { model.teamA = $0; model.loadSelections() }
        )) {
            Text(detail.teamName(match.teamAID)).tag(true)
            Text(detail.teamName(match.teamBID)).tag(false)
        }
        .pickerStyle(.segmented)
    }

    @ViewBuilder
    private func gameBlock(_ g: TMGame) -> some View {
        let req = model.requirement(g)
        let valid = model.isValid(g)
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Text(g.typeLabel.uppercased())
                    .font(TLFont.mono(11, .bold)).tracking(0.6)
                    .foregroundStyle(g.isDreambreaker == true ? TLColor.live : TLColor.accentText)
                Text(requirementText(g, req)).font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg3)
                Spacer()
                Image(systemName: valid ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 13)).foregroundStyle(valid ? TLColor.accent : TLColor.fg4)
            }
            FlowChips(players: model.editingRoster,
                      isSelected: { model.isSelected(g, $0) },
                      isEnabled: { model.canEdit },
                      tap: { model.toggle(g, $0) })
        }
        .padding(14)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private func requirementText(_ g: TMGame, _ req: TMLineupRequirement) -> String {
        if g.isDreambreaker == true { return "Chọn \(TMLineupRules.dreambreakerCount) VĐV" }
        var parts: [String] = []
        if req.male > 0 { parts.append("\(req.male) nam") }
        if req.female > 0 { parts.append("\(req.female) nữ") }
        return parts.joined(separator: " + ")
    }
}

/// Simple wrapping chip layout for roster players.
private struct FlowChips: View {
    let players: [TMRosterPlayer]
    let isSelected: (TMRosterPlayer) -> Bool
    let isEnabled: () -> Bool
    let tap: (TMRosterPlayer) -> Void

    private let columns = [GridItem(.adaptive(minimum: 96), spacing: 8)]

    var body: some View {
        LazyVGrid(columns: columns, alignment: .leading, spacing: 8) {
            ForEach(players) { p in
                let sel = isSelected(p)
                Button { Haptics.light(); tap(p) } label: {
                    HStack(spacing: 6) {
                        Circle().fill(p.isFemale ? TLColor.live.opacity(0.6) : TLColor.accent.opacity(0.6))
                            .frame(width: 6, height: 6)
                        Text(p.playerName).font(TLFont.sans(12.5, sel ? .semibold : .regular)).lineLimit(1)
                    }
                    .foregroundStyle(sel ? TLColor.accentInk : TLColor.fg2)
                    .padding(.horizontal, 10).padding(.vertical, 8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(sel ? TLColor.accent : TLColor.surface2, in: RoundedRectangle(cornerRadius: 9))
                    .overlay(RoundedRectangle(cornerRadius: 9).strokeBorder(sel ? Color.clear : TLColor.border, lineWidth: 1))
                }
                .buttonStyle(.plain)
                .disabled(!isEnabled())
                .opacity(isEnabled() ? 1 : 0.55)
            }
        }
    }
}
