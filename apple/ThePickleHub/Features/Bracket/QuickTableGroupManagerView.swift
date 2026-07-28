import SwiftUI

@Observable
@MainActor
private final class QuickTableGroupManagerModel {
    var detail: QuickTableDetail
    var busy = false
    var errorMessage: String?

    private let shareID: String
    private let repo = QuickTableRepository()

    init(shareID: String, detail: QuickTableDetail) {
        self.shareID = shareID
        self.detail = detail
    }

    func reload() async throws {
        detail = try await repo.load(shareID: shareID)
    }

    func move(_ player: QTPlayer, to group: QTGroup) async {
        guard let oldGroupID = player.groupID, oldGroupID != group.id else { return }
        await mutate("Chuyển VĐV") {
            try await repo.movePlayer(playerID: player.id, to: group.id)
            let oldPlayers = detail.players.filter { $0.groupID == oldGroupID && $0.id != player.id }.map(\.id)
            let newPlayers = detail.players.filter { $0.groupID == group.id }.map(\.id) + [player.id]
            try await repo.regenerateGroupMatches(
                tableID: detail.table.id, groupID: oldGroupID, playerIDs: oldPlayers
            )
            try await repo.regenerateGroupMatches(
                tableID: detail.table.id, groupID: group.id, playerIDs: newPlayers
            )
        }
    }

    func add(name: String, name2: String, team: String, seed: Int?, to group: QTGroup) async {
        let first = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let second = name2.trimmingCharacters(in: .whitespacesAndNewlines)
        let doubles = detail.table.isDoubles == true
        let label = doubles ? "\(first) & \(second)" : first
        await mutate("Thêm VĐV") {
            try await repo.addPlayer(
                tableID: detail.table.id,
                groupID: group.id,
                name: label,
                player1Name: first,
                player2Name: doubles ? second : nil,
                team: team,
                seed: seed
            )
            let refreshed = try await repo.load(shareID: shareID)
            try await repo.regenerateGroupMatches(
                tableID: detail.table.id,
                groupID: group.id,
                playerIDs: refreshed.players.filter { $0.groupID == group.id }.map(\.id)
            )
        }
    }

    func remove(_ player: QTPlayer) async {
        guard let groupID = player.groupID else { return }
        await mutate("Xóa VĐV") {
            try await repo.removePlayer(playerID: player.id)
            let remaining = detail.players.filter { $0.groupID == groupID && $0.id != player.id }.map(\.id)
            try await repo.regenerateGroupMatches(
                tableID: detail.table.id, groupID: groupID, playerIDs: remaining
            )
        }
    }

    func deleteTournament() async throws {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        try await repo.deleteTable(tableID: detail.table.id)
    }

    private func mutate(_ action: String, operation: () async throws -> Void) async {
        guard !busy else { return }
        busy = true
        errorMessage = nil
        defer { busy = false }
        do {
            try await operation()
            try await reload()
            Haptics.success()
        } catch {
            errorMessage = UserFacingError.message(action: action, error: error)
            Haptics.error()
        }
    }
}

struct QuickTableGroupManagerView: View {
    let shareID: String
    let initialDetail: QuickTableDetail
    let onChanged: () -> Void
    let onDeleted: () -> Void

    @State private var model: QuickTableGroupManagerModel
    @State private var addGroup: QTGroup?
    @State private var removePlayer: QTPlayer?
    @State private var showDeleteTournament = false
    @Environment(\.dismiss) private var dismiss

    init(shareID: String, initialDetail: QuickTableDetail,
         onChanged: @escaping () -> Void, onDeleted: @escaping () -> Void) {
        self.shareID = shareID
        self.initialDetail = initialDetail
        self.onChanged = onChanged
        self.onDeleted = onDeleted
        _model = State(initialValue: QuickTableGroupManagerModel(shareID: shareID, detail: initialDetail))
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Form {
                    Section {
                        Label(
                            "Thêm, chuyển hoặc xóa VĐV sẽ sinh lại lịch của bảng liên quan và xóa điểm cũ trong các bảng đó.",
                            systemImage: "exclamationmark.triangle"
                        )
                        .font(.footnote)
                        .foregroundStyle(.orange)
                    }
                    ForEach(model.detail.groups) { group in
                        let players = model.detail.players.filter { $0.groupID == group.id }
                        Section {
                            ForEach(players) { player in
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(player.name)
                                        if let team = player.team?.nonEmpty {
                                            Text(team).font(.caption).foregroundStyle(.secondary)
                                        }
                                    }
                                    Spacer()
                                    Menu {
                                        Section("Chuyển đến") {
                                            ForEach(model.detail.groups.filter { $0.id != group.id }) { target in
                                                Button("Bảng \(target.name)") {
                                                    Task { await model.move(player, to: target) }
                                                }
                                            }
                                        }
                                        Button("Xóa VĐV", role: .destructive) {
                                            removePlayer = player
                                        }
                                    } label: {
                                        Image(systemName: "ellipsis.circle")
                                            .frame(width: 44, height: 44)
                                    }
                                    .accessibilityLabel("Tùy chọn \(player.name)")
                                }
                            }
                            Button {
                                addGroup = group
                            } label: {
                                Label("Thêm vào bảng \(group.name)", systemImage: "person.badge.plus")
                                    .frame(minHeight: 44)
                            }
                        } header: {
                            Text("Bảng \(group.name) · \(players.count) VĐV")
                        }
                    }

                    Section {
                        Button("Xóa toàn bộ giải", role: .destructive) {
                            showDeleteTournament = true
                        }
                        .frame(minHeight: 44)
                    }
                }
                .disabled(model.busy)

                if model.busy {
                    Color.black.opacity(0.2).ignoresSafeArea()
                    ProgressView("Đang cập nhật…")
                        .padding(18)
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
                }
            }
            .navigationTitle("Quản lý vòng bảng")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Xong") {
                        onChanged()
                        dismiss()
                    }
                }
            }
        }
        .sheet(item: $addGroup) { group in
            QuickTableAddPlayerSheet(isDoubles: model.detail.table.isDoubles == true) {
                name, name2, team, seed in
                Task { await model.add(name: name, name2: name2, team: team, seed: seed, to: group) }
            }
            .presentationDetents([.medium])
        }
        .alert("Xóa VĐV?", isPresented: Binding(
            get: { removePlayer != nil },
            set: { if !$0 { removePlayer = nil } }
        ), presenting: removePlayer) { player in
            Button("Xóa", role: .destructive) { Task { await model.remove(player) } }
            Button("Hủy", role: .cancel) {}
        } message: { player in
            Text("Xóa “\(player.name)” và sinh lại toàn bộ trận trong bảng này?")
        }
        .alert("Xóa toàn bộ giải?", isPresented: $showDeleteTournament) {
            Button("Xóa vĩnh viễn", role: .destructive) {
                Task {
                    do {
                        try await model.deleteTournament()
                        dismiss()
                        onDeleted()
                    } catch {
                        model.errorMessage = UserFacingError.message(action: "Xóa giải", error: error)
                    }
                }
            }
            Button("Hủy", role: .cancel) {}
        } message: {
            Text("Tất cả bảng, VĐV, trận đấu và kết quả sẽ bị xóa. Không thể hoàn tác.")
        }
        .alert("Không thể cập nhật", isPresented: Binding(
            get: { model.errorMessage != nil },
            set: { if !$0 { model.errorMessage = nil } }
        )) {
            Button("Đã hiểu", role: .cancel) { model.errorMessage = nil }
        } message: {
            Text(model.errorMessage ?? "Lỗi không xác định")
        }
    }
}

private struct QuickTableAddPlayerSheet: View {
    let isDoubles: Bool
    let onAdd: (String, String, String, Int?) -> Void

    @State private var name = ""
    @State private var name2 = ""
    @State private var team = ""
    @State private var seed = ""
    @Environment(\.dismiss) private var dismiss

    private var valid: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && (!isDoubles || !name2.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("VĐV") {
                    TextField(isDoubles ? "VĐV 1" : "Tên VĐV", text: $name)
                    if isDoubles { TextField("VĐV 2", text: $name2) }
                    TextField("Team (tùy chọn)", text: $team)
                    TextField("Seed (tùy chọn)", text: $seed).keyboardType(.numberPad)
                }
            }
            .navigationTitle("Thêm VĐV")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Hủy") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Thêm") {
                        onAdd(name, name2, team, Int(seed))
                        dismiss()
                    }
                    .disabled(!valid)
                }
            }
        }
    }
}
