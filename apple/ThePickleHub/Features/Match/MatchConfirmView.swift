import SwiftUI

/// Confirm + history for community match proposals — native port of the web
/// `/match` Pending + History tabs. Pending shows matches logged by others that
/// need my confirmation (Xác nhận / Tranh chấp); History shows every proposal I'm
/// in with its lifecycle status. Create still lives in MatchLogView; admin approve
/// queue stays on web.
@Observable
final class MatchConfirmModel {
    enum Tab: String, CaseIterable, Identifiable { case pending, history
        var id: String { rawValue }
        var label: String { self == .pending ? "Chờ xác nhận" : "Lịch sử" }
    }
    enum Phase: Equatable { case loading, loaded, failed(String) }

    var tab: Tab = .pending { didSet { if tab != oldValue { Task { await load() } } } }
    var phase: Phase = .loading
    var rows: [MatchProposalRow] = []
    var names: [String: String] = [:]
    var myID = ""
    var actioningID: String?

    private let repo = MatchProposalRepository()

    func isPlayer(_ row: MatchProposalRow) -> Bool {
        let mine = myID.lowercased()
        return row.teamAPlayerIDs.map { $0.lowercased() }.contains(mine)
            || row.teamBPlayerIDs.map { $0.lowercased() }.contains(mine)
    }

    func name(_ id: String) -> String { names[id.lowercased()] ?? "Người chơi" }

    @MainActor
    func load() async {
        phase = .loading
        if myID.isEmpty { myID = (try? await repo.currentUserID()) ?? "" }
        do {
            let list = try await repo.myProposals(pendingOnly: tab == .pending)
            let ids = list.flatMap { $0.teamAPlayerIDs + $0.teamBPlayerIDs }
            names = await repo.displayNames(ids: ids)
            rows = list
            phase = .loaded
        } catch { phase = .failed(error.localizedDescription) }
    }

    @MainActor
    func verify(_ row: MatchProposalRow) async {
        actioningID = row.id
        try? await repo.verify(proposalID: row.id)
        Haptics.success()
        await load()
        actioningID = nil
    }

    @MainActor
    func dispute(_ row: MatchProposalRow, reason: String) async {
        actioningID = row.id
        try? await repo.dispute(proposalID: row.id, reason: reason)
        Haptics.light()
        await load()
        actioningID = nil
    }
}

struct MatchConfirmView: View {
    @State private var model = MatchConfirmModel()
    @State private var disputeRow: MatchProposalRow?
    @State private var disputeReason = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Picker("", selection: Binding(get: { model.tab }, set: { model.tab = $0 })) {
                    ForEach(MatchConfirmModel.Tab.allCases) { Text($0.label).tag($0) }
                }.pickerStyle(.segmented)

                switch model.phase {
                case .loading:
                    ProgressView().tint(TLColor.accentText).frame(maxWidth: .infinity).padding(.top, 40)
                case .failed(let msg):
                    Text(msg).font(TLFont.sans(13)).foregroundStyle(TLColor.fg3).padding(.top, 20)
                case .loaded:
                    if model.rows.isEmpty {
                        Text(model.tab == .pending ? "Không có trận nào đợi bạn xác nhận." : "Chưa có trận nào.")
                            .font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
                            .frame(maxWidth: .infinity).padding(.top, 40)
                    } else {
                        ForEach(model.rows) { row in card(row) }
                    }
                }
            }
            .padding(20)
        }
        .background(TLColor.bg)
        .navigationTitle("Xác nhận trận")
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.load() }
        .refreshable { await model.load() }
        .alert("Tranh chấp tỉ số", isPresented: Binding(get: { disputeRow != nil }, set: { if !$0 { disputeRow = nil } })) {
            TextField("Lý do (tùy chọn)", text: $disputeReason)
            Button("Huỷ", role: .cancel) { disputeRow = nil; disputeReason = "" }
            Button("Gửi tranh chấp", role: .destructive) {
                if let row = disputeRow {
                    let reason = disputeReason
                    Task { await model.dispute(row, reason: reason) }
                }
                disputeRow = nil; disputeReason = ""
            }
        } message: {
            Text("Đối thủ và BTC sẽ được thông báo để xem lại tỉ số.")
        }
    }

    private func card(_ row: MatchProposalRow) -> some View {
        let busy = model.actioningID == row.id
        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(row.isDoubles ? "ĐÔI" : "ĐƠN")
                    .font(TLFont.mono(9, .bold)).tracking(1).foregroundStyle(TLColor.fg3)
                if let d = row.matchDate {
                    Text(d).font(TLFont.mono(10)).foregroundStyle(TLColor.fg4)
                }
                Spacer()
                statusPill(row.status)
            }

            teamLine(ids: row.teamAPlayerIDs, scores: row.teamAScores)
            Rectangle().fill(TLColor.border).frame(height: 1)
            teamLine(ids: row.teamBPlayerIDs, scores: row.teamBScores)

            if let code = row.duprMatchCode, !code.isEmpty {
                Text("DUPR: \(code)").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
            }

            if model.tab == .pending && model.isPlayer(row) {
                HStack(spacing: 10) {
                    Button { Task { await model.verify(row) } } label: {
                        HStack(spacing: 5) {
                            if busy { ProgressView().tint(TLColor.accentInk) }
                            Text("Xác nhận").font(TLFont.sans(13, .bold))
                        }
                        .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 10)
                        .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 10))
                    }.buttonStyle(.plain).disabled(busy)
                    Button { disputeRow = row } label: {
                        Text("Tranh chấp").font(TLFont.sans(13, .semibold))
                            .foregroundStyle(TLColor.live).frame(maxWidth: .infinity).padding(.vertical, 10)
                            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(TLColor.live.opacity(0.5), lineWidth: 1))
                    }.buttonStyle(.plain).disabled(busy)
                }
            }
        }
        .padding(14)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private func teamLine(ids: [String], scores: [Int]) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text(ids.map { model.name($0) }.joined(separator: " / "))
                .font(TLFont.sans(14, .medium)).foregroundStyle(TLColor.fg)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 8)
            Text(scores.map(String.init).joined(separator: "  "))
                .font(TLFont.mono(14, .semibold)).foregroundStyle(TLColor.fg2)
        }
    }

    private func statusPill(_ status: String) -> some View {
        let accent = MatchProposalStatus.isAccent(status)
        let warn = MatchProposalStatus.isWarn(status)
        let color = warn ? TLColor.live : (accent ? TLColor.accentText : TLColor.fg3)
        return Text(MatchProposalStatus.label(status))
            .font(TLFont.mono(9, .bold)).tracking(0.8).foregroundStyle(color)
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background((warn ? TLColor.live : TLColor.accent).opacity(accent || warn ? 0.1 : 0), in: Capsule())
            .overlay(Capsule().strokeBorder(color.opacity(0.4), lineWidth: 1))
    }
}
