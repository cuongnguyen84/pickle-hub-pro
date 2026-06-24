import SwiftUI

@Observable
final class QuickTableViewModel {
    enum Phase: Equatable {
        case loading
        case loaded(QuickTableDetail)
        case failed(String)
    }

    enum Tab: String, CaseIterable, Identifiable {
        case groups, playoff
        var id: String { rawValue }
    }

    var phase: Phase = .loading
    var editable = false
    var tab: Tab = .groups
    var selectedGroupID: UUID?
    var scoringMatch: QTMatch?

    private let repo = QuickTableRepository()

    var detail: QuickTableDetail? { if case .loaded(let d) = phase { return d } ; return nil }

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
            // Default to playoff tab once it exists and group stage is done.
            if detail.hasPlayoff && detail.table.isPlayoffStage && tab == .groups && detail.groups.isEmpty == false {
                // keep current tab; don't force-switch so the user can browse groups
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

/// Native Quick Table view — group standings + matches, playoff bracket with
/// champion, inline score entry (creator only). Mirrors web QuickTableView read
/// surfaces; roster/registration management + playoff generation stay on web.
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
            VStack(alignment: .leading, spacing: 18) {
                header(detail.table)
                if model.editable && detail.groupStageComplete && !detail.hasPlayoff && detail.table.status == "group_stage" {
                    advanceBanner
                }
                tabPicker(detail)
                switch model.tab {
                case .groups: groupsTab(detail)
                case .playoff: playoffTab(detail)
                }
            }
            .padding(.horizontal, 16).padding(.top, 8)
        }
    }

    // MARK: Header

    private func header(_ table: QTTable) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(table.displayName).font(TLFont.serif(26)).foregroundStyle(TLColor.fg)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 8) {
                Text(table.statusLabel.uppercased())
                    .font(TLFont.mono(9, .bold)).tracking(1)
                    .foregroundStyle(table.status == "completed" ? TLColor.fg3 : TLColor.accentText)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background((table.status == "completed" ? TLColor.surface : TLColor.accent.opacity(0.1)), in: Capsule())
                Text((table.isDoubles ?? true) ? "ĐÔI" : "ĐƠN")
                    .font(TLFont.mono(9, .medium)).tracking(1).foregroundStyle(TLColor.fg3)
            }
        }
    }

    private var advanceBanner: some View {
        Button { openWeb = true } label: {
            HStack(spacing: 12) {
                Image(systemName: "flag.checkered").font(.system(size: 18)).foregroundStyle(TLColor.accentText)
                VStack(alignment: .leading, spacing: 3) {
                    Text("Vòng bảng đã hoàn tất!").font(TLFont.sans(14.5, .semibold)).foregroundStyle(TLColor.fg)
                    Text("Mở web để bắt đầu Playoff.").font(TLFont.sans(12.5)).foregroundStyle(TLColor.fg2)
                }
                Spacer()
                Image(systemName: "arrow.up.right.square").foregroundStyle(TLColor.accentText)
            }
            .padding(14)
            .background(TLColor.accent.opacity(0.1), in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.accent.opacity(0.4), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func tabPicker(_ detail: QuickTableDetail) -> some View {
        if detail.hasPlayoff {
            Picker("", selection: Binding(get: { model.tab }, set: { model.tab = $0 })) {
                Text("Vòng bảng").tag(QuickTableViewModel.Tab.groups)
                Text("Playoff").tag(QuickTableViewModel.Tab.playoff)
            }
            .pickerStyle(.segmented)
        }
    }

    // MARK: Groups tab

    @ViewBuilder
    private func groupsTab(_ detail: QuickTableDetail) -> some View {
        if detail.groups.isEmpty {
            note("Chưa chia bảng.")
        } else {
            VStack(alignment: .leading, spacing: 18) {
                groupPicker(detail.groups)
                if let gid = model.selectedGroupID {
                    standingsCard(detail, groupID: gid)
                    matchesSection(detail, groupID: gid)
                }
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
        let topN = detail.table.topPerGroup ?? 2
        return VStack(spacing: 0) {
            HStack(spacing: 0) {
                Text("#").frame(width: 28, alignment: .leading)
                Text("VĐV").frame(maxWidth: .infinity, alignment: .leading)
                Text("T").frame(width: 30, alignment: .trailing)
                Text("TR").frame(width: 30, alignment: .trailing)
                Text("+/–").frame(width: 44, alignment: .trailing)
            }
            .font(TLFont.mono(9, .medium)).foregroundStyle(TLColor.fg4).tracking(0.5)
            .padding(.horizontal, 14).padding(.vertical, 9)

            ForEach(Array(rows.enumerated()), id: \.element.id) { index, p in
                Rectangle().fill(TLColor.border).frame(height: 1)
                let qualified = detail.hasPlayoff && index < topN
                HStack(spacing: 0) {
                    HStack(spacing: 3) {
                        Text("\(index + 1)").font(TLFont.mono(12, .semibold))
                            .foregroundStyle(qualified ? TLColor.accentText : TLColor.fg4)
                        if qualified { Image(systemName: "chevron.right").font(.system(size: 8, weight: .bold)).foregroundStyle(TLColor.accentText) }
                    }
                    .frame(width: 28, alignment: .leading)
                    HStack(spacing: 6) {
                        Text(p.name).font(TLFont.sans(14, .medium)).foregroundStyle(TLColor.fg).lineLimit(1)
                        if p.isWildcard == true {
                            Text("WC").font(TLFont.mono(8, .medium)).foregroundStyle(TLColor.fg3)
                                .padding(.horizontal, 4).padding(.vertical, 1)
                                .background(TLColor.surface2, in: RoundedRectangle(cornerRadius: 3))
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Text("\(p.matchesWon)").font(TLFont.mono(13, .semibold)).foregroundStyle(TLColor.fg).frame(width: 30, alignment: .trailing)
                    Text("\(p.matchesPlayed)").font(TLFont.mono(13)).foregroundStyle(TLColor.fg3).frame(width: 30, alignment: .trailing)
                    Text(p.pointDiff >= 0 ? "+\(p.pointDiff)" : "\(p.pointDiff)")
                        .font(TLFont.mono(13))
                        .foregroundStyle(p.pointDiff > 0 ? TLColor.accentText : p.pointDiff < 0 ? TLColor.live : TLColor.fg2)
                        .frame(width: 44, alignment: .trailing)
                }
                .padding(.horizontal, 14).padding(.vertical, 11)
                .background(qualified ? TLColor.accent.opacity(0.05) : Color.clear)
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
            VStack(spacing: 6) {
                if let court = m.courtName?.nonEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "mappin.and.ellipse").font(.system(size: 9)).foregroundStyle(TLColor.fg4)
                        Text(court).font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg3)
                        Spacer()
                    }
                }
                HStack(spacing: 10) {
                    playerName(detail.name(for: m.player1ID), won: m.isCompleted && m.winnerID == m.player1ID)
                    scoreBlock(m)
                    playerName(detail.name(for: m.player2ID), won: m.isCompleted && m.winnerID == m.player2ID, trailing: true)
                }
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

    // MARK: Playoff tab

    // Bracket geometry.
    private var cardW: CGFloat { 190 }
    private var cardH: CGFloat { 76 }
    private var gap0: CGFloat { 16 }
    private var pitch: CGFloat { cardH + gap0 }
    private var connW: CGFloat { 26 }
    private var headerBlock: CGFloat { 30 } // round header height + spacing

    @ViewBuilder
    private func playoffTab(_ detail: QuickTableDetail) -> some View {
        let rounds = detail.playoffByRound
        VStack(alignment: .leading, spacing: 18) {
            if let champID = detail.championID {
                championBanner(detail.name(for: champID))
            }
            if rounds.isEmpty {
                note("Chưa tạo nhánh playoff.")
            } else {
                bracket(detail, rounds)
            }
        }
    }

    /// Horizontal single-elimination bracket: one column per round, matches
    /// vertically centered between their feeders, elbow connectors between rounds.
    private func bracket(_ detail: QuickTableDetail, _ rounds: [(round: Int, matches: [QTMatch])]) -> some View {
        let firstCount = rounds.first?.matches.count ?? 1
        let totalH = headerBlock + CGFloat(firstCount) * pitch
        return ScrollView(.horizontal, showsIndicators: true) {
            HStack(alignment: .top, spacing: 0) {
                ForEach(Array(rounds.enumerated()), id: \.element.round) { r, round in
                    roundColumn(detail, round: round, index: r)
                    if r < rounds.count - 1 {
                        connector(leftCount: round.matches.count, index: r)
                    }
                }
            }
            .frame(height: totalH, alignment: .top)
            .padding(.horizontal, 16)
        }
        .frame(height: totalH)              // explicit height so the nested
        .padding(.horizontal, -16)          // h-scroll never collapses inside the v-scroll
    }

    private func roundColumn(_ detail: QuickTableDetail, round: (round: Int, matches: [QTMatch]), index r: Int) -> some View {
        let unit = pitch * p2(r)
        return VStack(spacing: 0) {
            HStack(spacing: 6) {
                Text(roundLabel(round.matches.count).uppercased())
                    .font(TLFont.mono(10, .semibold)).tracking(0.8).foregroundStyle(TLColor.fg2)
                Text("\(round.matches.filter { $0.isCompleted }.count)/\(round.matches.count)")
                    .font(TLFont.mono(9)).foregroundStyle(TLColor.fg4).monospacedDigit()
            }
            .frame(height: headerBlock, alignment: .center)

            VStack(spacing: unit - cardH) {
                ForEach(round.matches) { m in bracketCard(detail, m) }
            }
            .padding(.top, unit / 2 - cardH / 2)
            Spacer(minLength: 0)
        }
        .frame(width: cardW)
    }

    /// Elbow connectors linking each pair of feeder matches to the next round.
    private func connector(leftCount: Int, index r: Int) -> some View {
        let unit = pitch * p2(r)
        let pairs = max(0, leftCount / 2)
        return VStack(spacing: 0) {
            Color.clear.frame(height: headerBlock + unit * 0.5)
            ForEach(0..<pairs, id: \.self) { i in
                ZStack(alignment: .leading) {
                    Rectangle().fill(TLColor.border2).frame(width: 1.5)
                    Rectangle().fill(TLColor.border2).frame(height: 1.5)
                }
                .frame(width: connW, height: unit)
                if i < pairs - 1 { Color.clear.frame(height: unit) }
            }
            Spacer(minLength: 0)
        }
        .frame(width: connW)
    }

    private func bracketCard(_ detail: QuickTableDetail, _ m: QTMatch) -> some View {
        let canScore = model.editable && m.hasBothPlayers
        return Button {
            if canScore { Haptics.light(); model.scoringMatch = m }
        } label: {
            VStack(spacing: 0) {
                bracketRow(detail.name(for: m.player1ID), score: m.score1, won: m.isCompleted && m.winnerID == m.player1ID, completed: m.isCompleted)
                Rectangle().fill(TLColor.border).frame(height: 1)
                bracketRow(detail.name(for: m.player2ID), score: m.score2, won: m.isCompleted && m.winnerID == m.player2ID, completed: m.isCompleted)
            }
            .frame(width: cardW, height: cardH)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!canScore)
    }

    private func bracketRow(_ name: String, score: Int?, won: Bool, completed: Bool) -> some View {
        HStack(spacing: 8) {
            Rectangle().fill(won ? TLColor.accent : Color.clear).frame(width: 2)
            Text(name).font(TLFont.sans(13, won ? .semibold : .regular))
                .foregroundStyle(won ? TLColor.fg : TLColor.fg2).lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(completed ? "\(score ?? 0)" : "–")
                .font(TLFont.mono(13, .semibold)).monospacedDigit()
                .foregroundStyle(won ? TLColor.accentText : TLColor.fg4)
                .padding(.trailing, 10)
        }
        .frame(maxHeight: .infinity)
        .background(won ? TLColor.accent.opacity(0.08) : Color.clear)
    }

    private func p2(_ r: Int) -> CGFloat { pow(2, CGFloat(r)) }

    private func championBanner(_ name: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: "trophy.fill").font(.system(size: 22)).foregroundStyle(TLColor.accentText)
            VStack(alignment: .leading, spacing: 3) {
                Text("NHÀ VÔ ĐỊCH").font(TLFont.mono(10, .bold)).tracking(1.5).foregroundStyle(TLColor.accentText)
                Text(name).font(TLFont.serif(24)).foregroundStyle(TLColor.fg)
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

    private func roundLabel(_ count: Int) -> String {
        switch count {
        case 1: return "Chung kết"
        case 2: return "Bán kết"
        case 3...4: return "Tứ kết"
        case 5...8: return "Vòng 16"
        default: return "Vòng loại"
        }
    }

    // MARK: Helpers

    private func note(_ text: String) -> some View {
        Text(text).font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, style: StrokeStyle(lineWidth: 1, dash: [4])))
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
