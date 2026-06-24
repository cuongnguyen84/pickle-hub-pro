import SwiftUI

@Observable
final class QuickTableViewModel {
    enum Phase: Equatable {
        case loading
        case loaded(QuickTableDetail)
        case failed(String)
    }

    var phase: Phase = .loading
    var editable = false
    var selectedGroupID: UUID?
    var scoringMatch: QTMatch?

    private let repo = QuickTableRepository()

    @MainActor
    func load(shareID: String) async {
        if case .loaded = phase {} else { phase = .loading }
        do {
            let detail = try await repo.load(shareID: shareID)
            let uid = await repo.currentUserID()
            editable = detail.table.creatorUserID != nil && detail.table.creatorUserID == uid
            if selectedGroupID == nil || !detail.groups.contains(where: { $0.id == selectedGroupID }) {
                selectedGroupID = detail.groups.first?.id
            }
            phase = .loaded(detail)
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    @MainActor
    func submitScore(tableID: UUID, match: QTMatch, score1: Int, score2: Int, shareID: String) async {
        do {
            try await repo.score(tableID: tableID, match: match, score1: score1, score2: score2)
            scoringMatch = nil
            await load(shareID: shareID)
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }
}

/// Native Quick Table view — standings + matches per group, playoff list, and
/// inline score entry (creator only). P1 of the Bracket Lab native port.
struct QuickTableDetailView: View {
    let shareID: String
    let fallbackName: String

    @State private var model = QuickTableViewModel()
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
            SafariView(url: WebRoutes.quickTable(shareID: shareID)).ignoresSafeArea()
        }
        .sheet(item: Binding(get: { model.scoringMatch }, set: { model.scoringMatch = $0 })) { match in
            if case .loaded(let detail) = model.phase {
                ScoreSheet(detail: detail, match: match) { s1, s2 in
                    Task { await model.submitScore(tableID: detail.table.id, match: match, score1: s1, score2: s2, shareID: shareID) }
                }
            }
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
            VStack(alignment: .leading, spacing: 20) {
                header(detail.table)
                if !detail.groups.isEmpty {
                    groupPicker(detail.groups)
                    if let gid = model.selectedGroupID {
                        standingsCard(detail, groupID: gid)
                        matchesSection(detail, groupID: gid)
                    }
                }
                if detail.table.isPlayoffStage {
                    playoffSection(detail)
                }
            }
            .padding(.horizontal, 16).padding(.top, 8)
        }
    }

    private func header(_ table: QTTable) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(table.displayName).font(TLFont.serif(26)).foregroundStyle(TLColor.fg)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 8) {
                Text(table.statusLabel.uppercased())
                    .font(TLFont.mono(9, .bold)).tracking(1)
                    .foregroundStyle(TLColor.accentText)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(TLColor.accent.opacity(0.1), in: Capsule())
                Text((table.isDoubles ?? true) ? "ĐÔI" : "ĐƠN")
                    .font(TLFont.mono(9, .medium)).tracking(1).foregroundStyle(TLColor.fg3)
            }
        }
    }

    private func groupPicker(_ groups: [QTGroup]) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(groups) { g in
                    let selected = g.id == model.selectedGroupID
                    Button { model.selectedGroupID = g.id } label: {
                        Text("Bảng \(g.name)")
                            .font(TLFont.mono(12, selected ? .semibold : .medium))
                            .foregroundStyle(selected ? TLColor.accentInk : TLColor.fg2)
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(selected ? TLColor.accent : TLColor.surface, in: Capsule())
                            .overlay(Capsule().strokeBorder(selected ? .clear : TLColor.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: Standings

    private func standingsCard(_ detail: QuickTableDetail, groupID: UUID) -> some View {
        let rows = detail.standings(groupID: groupID)
        return VStack(spacing: 0) {
            HStack(spacing: 0) {
                Text("#").frame(width: 24, alignment: .leading)
                Text("VĐV").frame(maxWidth: .infinity, alignment: .leading)
                Text("T").frame(width: 30, alignment: .trailing)
                Text("TR").frame(width: 30, alignment: .trailing)
                Text("+/–").frame(width: 44, alignment: .trailing)
            }
            .font(TLFont.mono(9, .medium)).foregroundStyle(TLColor.fg4).tracking(0.5)
            .padding(.horizontal, 14).padding(.vertical, 9)

            ForEach(Array(rows.enumerated()), id: \.element.id) { index, p in
                Rectangle().fill(TLColor.border).frame(height: 1)
                HStack(spacing: 0) {
                    Text("\(index + 1)")
                        .font(TLFont.mono(12, .semibold))
                        .foregroundStyle(index < (detail.table.topPerGroup ?? 2) ? TLColor.accentText : TLColor.fg4)
                        .frame(width: 24, alignment: .leading)
                    Text(p.name).font(TLFont.sans(14, .medium)).foregroundStyle(TLColor.fg)
                        .lineLimit(1).frame(maxWidth: .infinity, alignment: .leading)
                    Text("\(p.matchesWon)").font(TLFont.mono(13, .semibold)).foregroundStyle(TLColor.fg).frame(width: 30, alignment: .trailing)
                    Text("\(p.matchesPlayed)").font(TLFont.mono(13)).foregroundStyle(TLColor.fg3).frame(width: 30, alignment: .trailing)
                    Text(p.pointDiff >= 0 ? "+\(p.pointDiff)" : "\(p.pointDiff)")
                        .font(TLFont.mono(13)).foregroundStyle(TLColor.fg2).frame(width: 44, alignment: .trailing)
                }
                .padding(.horizontal, 14).padding(.vertical, 11)
            }
        }
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    // MARK: Matches

    private func matchesSection(_ detail: QuickTableDetail, groupID: UUID) -> some View {
        let matches = detail.matches(groupID: groupID)
        return VStack(alignment: .leading, spacing: 10) {
            Text("TRẬN ĐẤU").font(TLFont.mono(10, .semibold)).tracking(0.8).foregroundStyle(TLColor.fg3)
            if matches.isEmpty {
                Text("Chưa có trận.").font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
            } else {
                ForEach(matches) { m in matchRow(detail, m) }
            }
        }
    }

    private func matchRow(_ detail: QuickTableDetail, _ m: QTMatch) -> some View {
        let canScore = model.editable && m.hasBothPlayers
        return Button {
            if canScore { Haptics.light(); model.scoringMatch = m }
        } label: {
            HStack(spacing: 10) {
                playerName(detail.name(for: m.player1ID), won: m.isCompleted && m.winnerID == m.player1ID)
                scoreBlock(m)
                playerName(detail.name(for: m.player2ID), won: m.isCompleted && m.winnerID == m.player2ID, trailing: true)
            }
            .padding(.horizontal, 14).padding(.vertical, 12)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!canScore)
    }

    private func playerName(_ name: String, won: Bool, trailing: Bool = false) -> some View {
        Text(name)
            .font(TLFont.sans(14, won ? .semibold : .regular))
            .foregroundStyle(won ? TLColor.fg : TLColor.fg2)
            .lineLimit(1)
            .frame(maxWidth: .infinity, alignment: trailing ? .trailing : .leading)
            .multilineTextAlignment(trailing ? .trailing : .leading)
    }

    @ViewBuilder
    private func scoreBlock(_ m: QTMatch) -> some View {
        if m.isCompleted, let s1 = m.score1, let s2 = m.score2 {
            HStack(spacing: 5) {
                Text("\(s1)").foregroundStyle(s1 > s2 ? TLColor.accentText : TLColor.fg3)
                Text("–").foregroundStyle(TLColor.fg4)
                Text("\(s2)").foregroundStyle(s2 > s1 ? TLColor.accentText : TLColor.fg3)
            }
            .font(TLFont.mono(15, .semibold)).monospacedDigit()
        } else {
            Text(model.editable ? "Nhập" : "vs")
                .font(TLFont.mono(10, .medium)).foregroundStyle(model.editable ? TLColor.accentText : TLColor.fg4)
                .frame(minWidth: 40)
        }
    }

    // MARK: Playoff

    private func playoffSection(_ detail: QuickTableDetail) -> some View {
        let matches = detail.playoffMatches
        return VStack(alignment: .leading, spacing: 10) {
            Text("PLAYOFF").font(TLFont.mono(10, .semibold)).tracking(0.8).foregroundStyle(TLColor.fg3)
            if matches.isEmpty {
                Text("Chưa tạo nhánh playoff.").font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
            } else {
                ForEach(matches) { m in matchRow(detail, m) }
            }
        }
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "tablecells").font(.largeTitle).foregroundStyle(TLColor.fg3)
            Text("Không tải được giải").font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
            Text(message).font(TLFont.sans(12)).foregroundStyle(TLColor.fg3).multilineTextAlignment(.center)
            Button("Thử lại") { Task { await model.load(shareID: shareID) } }.foregroundStyle(TLColor.accentText)
        }
        .frame(maxWidth: .infinity).padding(.horizontal, 32).padding(.top, 60)
    }
}

/// Two-field score entry for a single match.
private struct ScoreSheet: View {
    let detail: QuickTableDetail
    let match: QTMatch
    let onSave: (Int, Int) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var s1: String
    @State private var s2: String

    init(detail: QuickTableDetail, match: QTMatch, onSave: @escaping (Int, Int) -> Void) {
        self.detail = detail
        self.match = match
        self.onSave = onSave
        _s1 = State(initialValue: match.score1.map(String.init) ?? "")
        _s2 = State(initialValue: match.score2.map(String.init) ?? "")
    }

    private var v1: Int? { Int(s1) }
    private var v2: Int? { Int(s2) }
    private var valid: Bool { if let a = v1, let b = v2 { return a != b } ; return false }

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                row(name: detail.name(for: match.player1ID), text: $s1)
                Text("–").font(TLFont.serif(24)).foregroundStyle(TLColor.fg4)
                row(name: detail.name(for: match.player2ID), text: $s2)
                Spacer()
            }
            .padding(20)
            .frame(maxWidth: .infinity)
            .background(TLColor.bg)
            .navigationTitle("Nhập tỉ số")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Hủy") { dismiss() }.foregroundStyle(TLColor.fg3)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Lưu") {
                        if let a = v1, let b = v2 { Haptics.light(); onSave(a, b) }
                    }
                    .foregroundStyle(valid ? TLColor.accentText : TLColor.fg4)
                    .disabled(!valid)
                }
            }
        }
        .presentationDetents([.medium])
    }

    private func row(name: String, text: Binding<String>) -> some View {
        HStack(spacing: 14) {
            Text(name).font(TLFont.sans(16, .medium)).foregroundStyle(TLColor.fg)
                .frame(maxWidth: .infinity, alignment: .leading).lineLimit(1)
            TextField("0", text: text)
                .keyboardType(.numberPad).multilineTextAlignment(.center)
                .font(TLFont.mono(22, .semibold)).monospacedDigit().foregroundStyle(TLColor.fg)
                .frame(width: 72, height: 52)
                .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
        }
    }
}
