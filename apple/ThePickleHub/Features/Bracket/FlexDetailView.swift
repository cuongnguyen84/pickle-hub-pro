import SwiftUI

@Observable
final class FlexViewModel {
    enum Phase: Equatable { case loading, loaded(FlexData), failed(String) }

    var phase: Phase = .loading
    var editable = false       // creator || referee → can score
    var isCreator = false
    var currentUserID: UUID?
    var scoringMatch: FlexMatch?

    private let repo = FlexRepository()
    var data: FlexData? { if case .loaded(let d) = phase { return d } ; return nil }

    @MainActor
    func load(shareID: String) async {
        if case .loaded = phase {} else { phase = .loading }
        do {
            let data = try await repo.load(shareID: shareID)
            let uid = await repo.currentUserID()
            currentUserID = uid
            isCreator = data.tournament.creatorUserID != nil && data.tournament.creatorUserID == uid
            let referee = uid != nil ? await repo.isReferee(tournamentID: data.tournament.id, userID: uid!) : false
            editable = isCreator || referee
            phase = .loaded(data)
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    @MainActor
    func submitScore(match: FlexMatch, scoreA: Int, scoreB: Int, shareID: String) async {
        guard let data else { return }
        do {
            try await repo.score(match: match, scoreA: scoreA, scoreB: scoreB, data: data)
            scoringMatch = nil
            await load(shareID: shareID)
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }
}

/// Native Flex (custom-format) view — read groups + standings + matches and
/// inline score entry. Create/manage (drag-drop workspace) stays on web.
struct FlexDetailView: View {
    let shareID: String
    let fallbackName: String

    @State private var model = FlexViewModel()
    @State private var openWeb = false
    @State private var showSettings = false
    @Environment(\.dismiss) private var dismiss

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
                        }.accessibilityLabel("Cài đặt giải")
                    }
                    Button { openWeb = true } label: {
                        Image(systemName: "safari").foregroundStyle(TLColor.accentText)
                    }.accessibilityLabel("Mở trên web")
                }
            }
        }
        .task { await model.load(shareID: shareID) }
        .task(id: shareID) {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(15))
                if Task.isCancelled { break }
                if model.scoringMatch == nil && !showSettings { await model.load(shareID: shareID) }
            }
        }
        .refreshable { await model.load(shareID: shareID) }
        .sheet(isPresented: $openWeb) {
            SafariView(url: WebRoutes.toolsFlexView(shareID: shareID)).ignoresSafeArea()
        }
        .sheet(isPresented: $showSettings) {
            if let data = model.data {
                FlexSettingsSheet(tournament: data.tournament,
                                  onChanged: { Task { await model.load(shareID: shareID) } },
                                  onDeleted: { dismiss() })
            }
        }
        .sheet(item: Binding(get: { model.scoringMatch }, set: { model.scoringMatch = $0 })) { match in
            if let data = model.data {
                FlexScoreSheet(data: data, match: match) { a, b in
                    Task { await model.submitScore(match: match, scoreA: a, scoreB: b, shareID: shareID) }
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
        case .loaded(let data):
            VStack(alignment: .leading, spacing: 20) {
                header(data)
                ForEach(data.groups) { group in
                    FlexGroupSection(data: data, group: group, editable: model.editable) { m in
                        Haptics.light(); model.scoringMatch = m
                    }
                }
                let ungrouped = data.ungroupedMatches
                if !ungrouped.isEmpty {
                    sectionHeader(title: "Trận chưa xếp bảng", count: ungrouped.count)
                    VStack(spacing: 8) {
                        ForEach(ungrouped) { m in
                            FlexMatchRow(data: data, match: m, editable: model.editable) {
                                Haptics.light(); model.scoringMatch = m
                            }
                        }
                    }
                }
                if data.groups.isEmpty && ungrouped.isEmpty {
                    note("Chưa có bảng hay trận nào. Tạo nội dung trên web.")
                }
            }
            .padding(.horizontal, 16).padding(.top, 8)
        }
    }

    private func header(_ data: FlexData) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("◆ Format tự do · \(data.players.count) VĐV · \(data.matches.count) trận")
                .font(TLFont.mono(10.5, .medium)).tracking(1).foregroundStyle(TLColor.fg3)
            Text(data.tournament.displayName).font(TLFont.serif(26)).foregroundStyle(TLColor.fg)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 6) {
                Image(systemName: data.tournament.isPublic ? "globe" : "lock.fill")
                    .font(.system(size: 9))
                Text(data.tournament.isPublic ? "CÔNG KHAI" : "KHÔNG NIÊM YẾT")
                    .font(TLFont.mono(9, .bold)).tracking(1)
            }
            .foregroundStyle(data.tournament.isPublic ? TLColor.accentText : TLColor.fg3)
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background((data.tournament.isPublic ? TLColor.accent.opacity(0.1) : TLColor.surface), in: Capsule())
        }
    }

    private func sectionHeader(title: String, count: Int) -> some View {
        HStack(spacing: 8) {
            RoundedRectangle(cornerRadius: 1).fill(TLColor.accent).frame(width: 3, height: 15)
            Text(title.uppercased()).font(TLFont.mono(11, .semibold)).tracking(1).foregroundStyle(TLColor.fg)
            Spacer()
            Text("\(count)").font(TLFont.mono(10)).foregroundStyle(TLColor.fg3).monospacedDigit()
        }
    }

    private func note(_ text: String) -> some View {
        Text(text).font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
            .frame(maxWidth: .infinity, alignment: .leading).padding(14)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, style: StrokeStyle(lineWidth: 1, dash: [4])))
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "square.stack.3d.up").font(.largeTitle).foregroundStyle(TLColor.fg3)
            Text("Không tải được giải").font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
            Text(message).font(TLFont.sans(12)).foregroundStyle(TLColor.fg3).multilineTextAlignment(.center)
            Button("Thử lại") { Task { await model.load(shareID: shareID) } }.foregroundStyle(TLColor.accentText)
        }
        .frame(maxWidth: .infinity).padding(.horizontal, 32).padding(.top, 60)
    }
}

// MARK: Group section (standings + matches)

private struct FlexGroupSection: View {
    let data: FlexData
    let group: FlexGroup
    let editable: Bool
    let onScore: (FlexMatch) -> Void

    enum Seg: Hashable { case singles, doubles, teams, individuals }
    @State private var seg: Seg = .singles

    private var isTeamGroup: Bool { data.groupType(group) == "team" }
    private var groupMatches: [FlexMatch] { data.matches(in: group) }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                RoundedRectangle(cornerRadius: 1).fill(TLColor.accent).frame(width: 3, height: 16)
                Text(group.name).font(TLFont.mono(12, .semibold)).tracking(0.6).foregroundStyle(TLColor.fg)
                Spacer()
                Text("\(groupMatches.count) trận").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
            }

            standingsPicker
            standingsTable

            if !groupMatches.isEmpty {
                VStack(spacing: 8) {
                    ForEach(groupMatches) { m in
                        FlexMatchRow(data: data, match: m, editable: editable) { onScore(m) }
                    }
                }
            }
        }
        .padding(14)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
        .onAppear { seg = isTeamGroup ? .teams : .singles }
    }

    @ViewBuilder
    private var standingsPicker: some View {
        Picker("", selection: $seg) {
            if isTeamGroup {
                Text("Đội").tag(Seg.teams)
                Text("VĐV").tag(Seg.individuals)
            } else {
                Text("Đơn").tag(Seg.singles)
                Text("Đôi").tag(Seg.doubles)
            }
        }
        .pickerStyle(.segmented)
    }

    private var rows: [FlexStanding] {
        switch seg {
        case .singles, .individuals: return data.singlesStandings(group)
        case .doubles: return data.pairStandings(group)
        case .teams: return data.teamStandings(group)
        }
    }

    @ViewBuilder
    private var standingsTable: some View {
        let standings = rows
        if standings.isEmpty {
            Text("Chưa có dữ liệu xếp hạng.").font(TLFont.sans(12.5)).foregroundStyle(TLColor.fg3)
        } else {
            VStack(spacing: 0) {
                HStack(spacing: 8) {
                    Text("#").font(TLFont.mono(9, .semibold)).foregroundStyle(TLColor.fg4).frame(width: 20)
                    Text("TÊN").font(TLFont.mono(9, .semibold)).tracking(0.5).foregroundStyle(TLColor.fg4)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text("T").font(TLFont.mono(9, .semibold)).foregroundStyle(TLColor.fg4).frame(width: 24)
                    Text("B").font(TLFont.mono(9, .semibold)).foregroundStyle(TLColor.fg4).frame(width: 24)
                    Text("+/-").font(TLFont.mono(9, .semibold)).foregroundStyle(TLColor.fg4).frame(width: 36)
                }
                .padding(.bottom, 6)
                ForEach(Array(standings.enumerated()), id: \.element.id) { i, s in
                    HStack(spacing: 8) {
                        Text("\(i + 1)").font(TLFont.mono(11, .medium)).foregroundStyle(i == 0 ? TLColor.accentText : TLColor.fg3).frame(width: 20)
                        Text(s.name).font(TLFont.sans(13, i == 0 ? .semibold : .regular)).foregroundStyle(TLColor.fg).lineLimit(1)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Text("\(s.wins)").font(TLFont.mono(12, .semibold)).foregroundStyle(TLColor.fg).frame(width: 24)
                        Text("\(s.losses)").font(TLFont.mono(12)).foregroundStyle(TLColor.fg3).frame(width: 24)
                        Text(s.pointDiff >= 0 ? "+\(s.pointDiff)" : "\(s.pointDiff)")
                            .font(TLFont.mono(12, .semibold))
                            .foregroundStyle(s.pointDiff >= 0 ? TLColor.accentText : TLColor.live).frame(width: 36)
                    }
                    .padding(.vertical, 7)
                    if i < standings.count - 1 { Rectangle().fill(TLColor.border).frame(height: 1) }
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(TLColor.bg, in: RoundedRectangle(cornerRadius: 10))
        }
    }
}

// MARK: Match row

private struct FlexMatchRow: View {
    let data: FlexData
    let match: FlexMatch
    let editable: Bool
    let onScore: () -> Void

    private var names: (a: String, b: String) { data.sideNames(match) }
    private var hasSlots: Bool {
        match.isTeamMatch
            ? (match.slotATeamID != nil && match.slotBTeamID != nil)
            : (match.slotA1PlayerID != nil && match.slotB1PlayerID != nil)
    }
    private var canScore: Bool { editable && hasSlots }

    var body: some View {
        Button { if canScore { onScore() } } label: {
            VStack(spacing: 0) {
                HStack(spacing: 6) {
                    Text(match.isDoubles ? "ĐÔI" : "ĐƠN").font(TLFont.mono(8.5, .medium)).tracking(0.4)
                        .foregroundStyle(TLColor.fg3).padding(.horizontal, 5).padding(.vertical, 2)
                        .background(TLColor.surface2, in: Capsule())
                    if !match.countsForStandings {
                        Text("Không tính BXH").font(TLFont.mono(8.5)).foregroundStyle(TLColor.fg4)
                    }
                    Spacer()
                    if match.isCompleted { Text("XONG").font(TLFont.mono(8.5, .medium)).foregroundStyle(TLColor.fg3) }
                }
                .padding(.horizontal, 10).padding(.top, 8).padding(.bottom, 6)
                side(names.a, score: match.scoreA, won: match.winnerSide == "a")
                Rectangle().fill(TLColor.border).frame(height: 1)
                side(names.b, score: match.scoreB, won: match.winnerSide == "b")
                if canScore && !match.isCompleted {
                    HStack {
                        Spacer()
                        Text("Chấm điểm").font(TLFont.mono(10, .semibold)).foregroundStyle(TLColor.accentText)
                        Image(systemName: "arrow.right").font(.system(size: 9, weight: .bold)).foregroundStyle(TLColor.accentText)
                    }
                    .padding(.horizontal, 10).padding(.vertical, 7)
                    .background(TLColor.surface2.opacity(0.5))
                }
            }
            .background(TLColor.bg, in: RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TLRadius.sm, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain).disabled(!canScore)
    }

    private func side(_ name: String, score: Int, won: Bool) -> some View {
        HStack(spacing: 8) {
            Rectangle().fill(won ? TLColor.accent : Color.clear).frame(width: 2)
            Text(name).font(TLFont.sans(13.5, won ? .semibold : .regular))
                .foregroundStyle(name == "?" ? TLColor.fg4 : (won ? TLColor.fg : TLColor.fg2))
                .lineLimit(1).frame(maxWidth: .infinity, alignment: .leading)
            Text(match.hasScore ? "\(score)" : "–")
                .font(TLFont.mono(13, .semibold)).monospacedDigit()
                .foregroundStyle(won ? TLColor.accentInk : TLColor.fg2)
                .frame(width: 30, height: 26)
                .background(won ? TLColor.accent : TLColor.surface2, in: RoundedRectangle(cornerRadius: 6))
        }
        .padding(.trailing, 10).padding(.vertical, 7)
        .background(won ? TLColor.accent.opacity(0.08) : Color.clear)
    }
}

// MARK: Score sheet

private struct FlexScoreSheet: View {
    let data: FlexData
    let match: FlexMatch
    let onSave: (Int, Int) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var a: String
    @State private var b: String

    init(data: FlexData, match: FlexMatch, onSave: @escaping (Int, Int) -> Void) {
        self.data = data; self.match = match; self.onSave = onSave
        _a = State(initialValue: match.hasScore ? String(match.scoreA) : "")
        _b = State(initialValue: match.hasScore ? String(match.scoreB) : "")
    }

    private var valid: Bool {
        guard let ai = Int(a), let bi = Int(b) else { return false }
        return ai != bi
    }

    var body: some View {
        let names = data.sideNames(match)
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    HStack {
                        Text(names.a).font(TLFont.sans(14, .semibold)).foregroundStyle(TLColor.fg)
                            .frame(maxWidth: .infinity, alignment: .leading).lineLimit(1)
                        Text("vs").font(TLFont.mono(11)).foregroundStyle(TLColor.fg4)
                        Text(names.b).font(TLFont.sans(14, .semibold)).foregroundStyle(TLColor.fg)
                            .frame(maxWidth: .infinity, alignment: .trailing).lineLimit(1)
                    }
                    HStack(spacing: 14) {
                        field(text: $a)
                        Text("–").font(TLFont.serif(20)).foregroundStyle(TLColor.fg4)
                        field(text: $b)
                    }
                }
                .padding(20)
            }
            .background(TLColor.bg)
            .navigationTitle("Nhập tỉ số")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Hủy") { dismiss() }.foregroundStyle(TLColor.fg3) }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Lưu") { if valid, let ai = Int(a), let bi = Int(b) { Haptics.light(); onSave(ai, bi) } }
                        .foregroundStyle(valid ? TLColor.accentText : TLColor.fg4).disabled(!valid)
                }
            }
        }
        .presentationDetents([.medium])
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
