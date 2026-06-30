import SwiftUI

/// Native MLP scoring — port of web TeamMatchScoringSheet. Enter each sub-game's
/// score; on save we persist the game then recompute the match (games won, total
/// points, winner, status) and advance the playoff bracket. Dreambreaker is just
/// the last game and is scored like any other.
@Observable
final class TMScoringModel {
    struct Row: Identifiable, Equatable {
        let game: TMGame
        var a: Int
        var b: Int
        var id: UUID { game.id }
        var hasScore: Bool { a > 0 || b > 0 }
        var decided: Bool { a != b }
        var aWon: Bool { a > b }
        var bWon: Bool { b > a }
    }

    var rows: [Row]
    var selected: Int = 0
    var saving = false
    var error: String?
    var justSaved = false

    let detail: TMDetail
    let match: TMMatch
    private let repo = TeamMatchRepository()

    init(detail: TMDetail, match: TMMatch) {
        self.detail = detail
        self.match = match
        self.rows = detail.games(for: match.id).map { Row(game: $0, a: $0.scoreA ?? 0, b: $0.scoreB ?? 0) }
        // Open on the first game without a winner, else the last.
        self.selected = rows.firstIndex { !$0.decided } ?? max(0, rows.count - 1)
    }

    var gamesWonA: Int { rows.filter { $0.aWon }.count }
    var gamesWonB: Int { rows.filter { $0.bWon }.count }
    var teamAName: String { detail.teamName(match.teamAID) }
    var teamBName: String { detail.teamName(match.teamBID) }

    // Total-score mode overrides each game's target with pointsPerGame and plays
    // to it with no deuce (mỗi game tới N điểm, không deuce). Normal mode keeps
    // the per-game type target (rally 21 / sideout 11) with win-by-2.
    var isTotalScore: Bool { detail.tournament.isTotalScore }
    func winTarget(for game: TMGame) -> Int {
        isTotalScore ? (detail.tournament.pointsPerGame ?? game.winTarget) : game.winTarget
    }

    func lineupNames(_ ids: [UUID]?) -> String? {
        guard let ids, !ids.isEmpty else { return nil }
        return ids.map { detail.rosterName($0) }.joined(separator: " / ")
    }

    /// 2 tên riêng cho doubles → bật lớp vị trí giao/đỡ. nil nếu không phải đôi.
    func lineupNameArray(_ ids: [UUID]?) -> [String]? {
        guard let ids, ids.count == 2 else { return nil }
        return ids.map { detail.rosterName($0) }
    }

    func bump(teamA: Bool, by delta: Int) {
        guard rows.indices.contains(selected) else { return }
        if teamA { rows[selected].a = max(0, rows[selected].a + delta) }
        else { rows[selected].b = max(0, rows[selected].b + delta) }
        justSaved = false
    }

    /// Đặt thẳng tỉ số cuối game (từ engine chấm trực tiếp của trọng tài).
    func bumpTo(teamA: Int, teamB: Int) {
        guard rows.indices.contains(selected) else { return }
        rows[selected].a = teamA; rows[selected].b = teamB; justSaved = false
    }

    func reset() {
        guard rows.indices.contains(selected) else { return }
        rows[selected].a = 0; rows[selected].b = 0; justSaved = false
    }

    @MainActor
    func saveSelected(onSaved: () -> Void) async {
        guard rows.indices.contains(selected) else { return }
        saving = true; error = nil
        let row = rows[selected]
        do {
            try await repo.saveGameScore(gameID: row.game.id, scoreA: row.a, scoreB: row.b)
            try await repo.saveMatchResult(
                match: match, scores: rows.map { (a: $0.a, b: $0.b) },
                tournamentID: detail.tournament.id,
                hasDreambreaker: detail.tournament.hasDreambreaker ?? false)
            justSaved = true
            onSaved()
        } catch {
            self.error = error.localizedDescription
        }
        saving = false
    }
}

struct TeamMatchScoringSheet: View {
    let detail: TMDetail
    let match: TMMatch
    /// Called after a successful save so the parent can reload from the server.
    let onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var model: TMScoringModel
    @State private var refereeing = false

    init(detail: TMDetail, match: TMMatch, onSaved: @escaping () -> Void) {
        self.detail = detail
        self.match = match
        self.onSaved = onSaved
        _model = State(initialValue: TMScoringModel(detail: detail, match: match))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    matchHeader
                    if model.rows.isEmpty {
                        Text("Trận này chưa có ván con.")
                            .font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
                            .frame(maxWidth: .infinity, alignment: .leading).padding(.top, 8)
                    } else {
                        gameSlots
                        currentGame
                    }
                }
                .padding(16)
            }
            .background(TLColor.bg)
            .navigationTitle("Chấm điểm")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Xong") { dismiss() }.foregroundStyle(TLColor.accentText)
                }
            }
        }
    }

    // MARK: Header

    private var matchHeader: some View {
        VStack(spacing: 10) {
            scoreRow(name: model.teamAName, won: model.gamesWonA > model.gamesWonB, games: model.gamesWonA)
            Rectangle().fill(TLColor.border).frame(height: 1)
            scoreRow(name: model.teamBName, won: model.gamesWonB > model.gamesWonA, games: model.gamesWonB)
        }
        .padding(16)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private func scoreRow(name: String, won: Bool, games: Int) -> some View {
        HStack(spacing: 12) {
            Text(name).font(TLFont.serif(20)).italic()
                .foregroundStyle(won ? TLColor.fg : TLColor.fg2).lineLimit(1)
            Spacer(minLength: 8)
            Text("\(games)").font(TLFont.mono(22, .semibold)).monospacedDigit()
                .foregroundStyle(won ? TLColor.accentText : TLColor.fg3)
        }
    }

    // MARK: Game slots

    private var gameSlots: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Array(model.rows.enumerated()), id: \.element.id) { idx, row in
                    let selected = idx == model.selected
                    Button {
                        Haptics.light(); model.selected = idx; model.justSaved = false
                    } label: {
                        VStack(spacing: 3) {
                            Text(row.game.isDreambreaker == true ? "DB" : "G\(idx + 1)")
                                .font(TLFont.mono(10, .bold)).tracking(0.5)
                            Text(row.hasScore ? "\(row.a)–\(row.b)" : "—")
                                .font(TLFont.mono(11, .medium)).monospacedDigit()
                        }
                        .foregroundStyle(selected ? TLColor.accentInk : TLColor.fg3)
                        .frame(minWidth: 46).padding(.vertical, 8).padding(.horizontal, 10)
                        .background(selected ? TLColor.accent : TLColor.surface, in: RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(
                            selected ? Color.clear : (row.game.isDreambreaker == true ? TLColor.live.opacity(0.5) : TLColor.border), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: Current game editor

    @ViewBuilder
    private var currentGame: some View {
        if model.rows.indices.contains(model.selected) {
            let row = model.rows[model.selected]
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Text(row.game.typeLabel.uppercased())
                        .font(TLFont.mono(11, .bold)).tracking(0.8)
                        .foregroundStyle(row.game.isDreambreaker == true ? TLColor.live : TLColor.accentText)
                    Spacer()
                    Text("Tới \(model.winTarget(for: row.game))").font(TLFont.mono(10)).foregroundStyle(TLColor.fg4)
                }

                Button {
                    Haptics.light(); refereeing = true
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "play.circle.fill").font(.system(size: 13, weight: .bold))
                        Text("CHẤM TRỰC TIẾP").font(TLFont.mono(11, .bold)).tracking(0.5)
                    }
                    .foregroundStyle(TLColor.accentText).frame(maxWidth: .infinity).padding(.vertical, 11)
                    .background(TLColor.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.accent.opacity(0.5), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .fullScreenCover(isPresented: $refereeing) {
                    RefereeScoringView(
                        teamAName: model.teamAName, teamBName: model.teamBName,
                        lineupA: model.lineupNames(row.game.lineupTeamA),
                        lineupB: model.lineupNames(row.game.lineupTeamB),
                        playersA: model.lineupNameArray(row.game.lineupTeamA),
                        playersB: model.lineupNameArray(row.game.lineupTeamB),
                        mode: row.game.scoringType == "sideout11" ? .sideOut : .rally,
                        isSingles: row.game.gameType == "WS" || row.game.gameType == "MS",
                        winTarget: model.winTarget(for: row.game),
                        winByTwo: !model.isTotalScore,
                        onLiveScore: { a, b in
                            Task { try? await TeamMatchRepository().updateGameLiveScore(gameID: row.game.id, scoreA: a, scoreB: b) }
                        },
                        onClaimLive: {
                            Task { try? await TeamMatchRepository().claimGameLive(gameID: row.game.id) }
                        }) { a, b, _ in
                        model.bumpTo(teamA: a, teamB: b)
                        Task { await model.saveSelected(onSaved: onSaved) }
                    }
                }

                stepperRow(name: model.teamAName, score: row.a, won: row.aWon,
                           lineup: model.lineupNames(row.game.lineupTeamA), teamA: true)
                stepperRow(name: model.teamBName, score: row.b, won: row.bWon,
                           lineup: model.lineupNames(row.game.lineupTeamB), teamA: false)

                if let err = model.error {
                    Text(err).font(TLFont.sans(12)).foregroundStyle(TLColor.live)
                }

                HStack(spacing: 10) {
                    Button { Haptics.light(); model.reset() } label: {
                        Text("Đặt lại").font(TLFont.mono(11, .semibold))
                            .foregroundStyle(TLColor.fg3).frame(maxWidth: .infinity).padding(.vertical, 12)
                            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                            .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)

                    Button {
                        Haptics.success()
                        Task { await model.saveSelected(onSaved: onSaved) }
                    } label: {
                        HStack(spacing: 6) {
                            if model.saving { ProgressView().tint(TLColor.accentInk) }
                            else { Image(systemName: model.justSaved ? "checkmark" : "square.and.arrow.down").font(.system(size: 12, weight: .bold)) }
                            Text(model.justSaved ? "Đã lưu" : "Lưu ván").font(TLFont.mono(11, .bold))
                        }
                        .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 12)
                        .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 11))
                    }
                    .buttonStyle(.plain)
                    .disabled(model.saving)
                }
            }
            .padding(16)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
        }
    }

    private func stepperRow(name: String, score: Int, won: Bool, lineup: String?, teamA: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(name).font(TLFont.sans(15, .semibold)).foregroundStyle(won ? TLColor.fg : TLColor.fg2).lineLimit(1)
                    if let lineup { Text(lineup).font(TLFont.mono(10)).foregroundStyle(TLColor.fg4).lineLimit(1) }
                }
                Spacer(minLength: 8)
                Button { Haptics.light(); model.bump(teamA: teamA, by: -1) } label: {
                    stepIcon("minus")
                }.buttonStyle(.plain)
                Text("\(score)").font(TLFont.mono(26, .bold)).monospacedDigit()
                    .foregroundStyle(won ? TLColor.accentText : TLColor.fg).frame(minWidth: 42)
                Button { Haptics.light(); model.bump(teamA: teamA, by: 1) } label: {
                    stepIcon("plus")
                }.buttonStyle(.plain)
            }
        }
    }

    private func stepIcon(_ name: String) -> some View {
        Image(systemName: name).font(.system(size: 14, weight: .bold))
            .foregroundStyle(TLColor.fg2).frame(width: 38, height: 38)
            .background(TLColor.surface2, in: RoundedRectangle(cornerRadius: 10))
    }
}
