import SwiftUI

@Observable
@MainActor
final class FlexWorkspaceModel {
    var data: FlexData?
    var loading = false
    var busy = false
    var errorMessage: String?

    private let shareID: String
    private let repo = FlexRepository()

    init(shareID: String, initialData: FlexData) {
        self.shareID = shareID
        data = initialData
    }

    func load() async {
        loading = data == nil
        defer { loading = false }
        do {
            data = try await repo.load(shareID: shareID)
        } catch {
            errorMessage = UserFacingError.message(failure: "Không tải được dữ liệu quản lý.", error: error)
        }
    }

    func create(kind: FlexRepository.EntityKind, name: String, matchType: String? = nil,
                groupID: UUID? = nil, parentID: UUID? = nil) async {
        guard let data else { return }
        let order: Int
        switch kind {
        case .player: order = data.players.count
        case .team: order = data.teams.count
        case .group: order = data.groups.count
        case .match: order = data.matches.filter { $0.parentMatchID == parentID }.count
        }
        await mutate("Không tạo được nội dung.") {
            try await repo.createEntity(
                tournamentID: data.tournament.id,
                kind: kind,
                name: name,
                displayOrder: order,
                matchType: matchType,
                groupID: groupID,
                parentMatchID: parentID
            )
        }
    }

    func rename(kind: FlexRepository.EntityKind, id: UUID, name: String) async {
        await mutate("Không đổi được tên.") { try await repo.rename(kind: kind, id: id, name: name) }
    }

    func delete(kind: FlexRepository.EntityKind, id: UUID, parentID: UUID? = nil) async {
        await mutate("Không xóa được nội dung.") {
            try await repo.deleteEntity(kind: kind, id: id)
            if let parentID { try await repo.syncParentScore(parentID: parentID) }
        }
    }

    func addPlayer(_ playerID: UUID, to teamID: UUID) async {
        await mutate("Không thêm được thành viên.") { try await repo.addPlayer(playerID, toTeam: teamID) }
    }

    func removeMember(_ memberID: UUID) async {
        await mutate("Không xóa được thành viên.") { try await repo.removeTeamMember(memberID) }
    }

    func addPlayer(_ playerID: UUID, toGroup groupID: UUID) async {
        let order = data?.groupItems.filter { $0.groupID == groupID }.count ?? 0
        await mutate("Không thêm được VĐV vào bảng.") {
            try await repo.addPlayer(playerID, toGroup: groupID, displayOrder: order)
        }
    }

    func addTeam(_ teamID: UUID, toGroup groupID: UUID) async {
        let order = data?.groupItems.filter { $0.groupID == groupID }.count ?? 0
        await mutate("Không thêm được đội vào bảng.") {
            try await repo.addTeam(teamID, toGroup: groupID, displayOrder: order)
        }
    }

    func removeGroupItem(_ itemID: UUID) async {
        await mutate("Không xóa được khỏi bảng.") { try await repo.removeGroupItem(itemID) }
    }

    func setIncludeDoubles(_ include: Bool, groupID: UUID) async {
        await mutate("Không cập nhật được bảng xếp hạng.") {
            try await repo.setIncludeDoubles(groupID: groupID, include: include)
        }
    }

    func generateRoundRobin(group: FlexGroup) async {
        guard let data else { return }
        await mutate("Không tạo được lịch vòng tròn.") {
            try await repo.generateRoundRobin(tournamentID: data.tournament.id, group: group, data: data)
        }
    }

    func configure(_ match: FlexMatch, groupID: UUID?, counts: Bool) async {
        await mutate("Không cập nhật được trận.") {
            try await repo.configureMatch(matchID: match.id, countsForStandings: counts, groupID: groupID)
        }
    }

    func setSlot(_ matchID: UUID, slot: FlexRepository.MatchSlot, itemID: UUID?) async {
        await mutate("Không xếp được đội hình.") { try await repo.setMatchSlot(matchID: matchID, slot: slot, itemID: itemID) }
    }

    func setParticipantMode(_ matchID: UUID, teamMode: Bool) async {
        let firstTeamID = teamMode ? data?.teams.first?.id : nil
        await mutate("Không đổi được loại đối tượng.") {
            try await repo.setParticipantMode(
                matchID: matchID,
                teamMode: teamMode,
                firstTeamID: firstTeamID
            )
        }
    }

    private func mutate(_ failure: String.LocalizationValue, operation: () async throws -> Void) async {
        guard !busy else { return }
        busy = true
        errorMessage = nil
        defer { busy = false }
        do {
            try await operation()
            data = try await repo.load(shareID: shareID)
            Haptics.success()
        } catch {
            errorMessage = UserFacingError.message(failure: failure, error: error)
            Haptics.error()
        }
    }
}

/// Full native equivalent of the web Flex drag/drop workspace. On touch
/// devices, explicit menus and pickers make every destination discoverable and
/// accessible to VoiceOver users.
struct FlexWorkspaceView: View {
    let shareID: String
    let initialData: FlexData
    let onChanged: () -> Void

    @State private var model: FlexWorkspaceModel
    @State private var tab: Tab = .players
    @State private var prompt: NamePrompt?
    @State private var deleteTarget: DeleteTarget?
    @State private var roundRobinGroup: FlexGroup?
    @Environment(\.dismiss) private var dismiss

    enum Tab: String, CaseIterable, Identifiable {
        case players = "VĐV"
        case teams = "Đội"
        case groups = "Bảng"
        case matches = "Trận"
        var id: String { rawValue }
    }

    init(shareID: String, initialData: FlexData, onChanged: @escaping () -> Void) {
        self.shareID = shareID
        self.initialData = initialData
        self.onChanged = onChanged
        _model = State(initialValue: FlexWorkspaceModel(shareID: shareID, initialData: initialData))
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Form {
                    Section {
                        Picker("Nội dung", selection: $tab) {
                            ForEach(Tab.allCases) { Text($0.rawValue).tag($0) }
                        }
                        .pickerStyle(.segmented)
                        .accessibilityLabel("Chọn phần quản lý")
                    }

                    if let data = model.data {
                        switch tab {
                        case .players: playersForm(data)
                        case .teams: teamsForm(data)
                        case .groups: groupsForm(data)
                        case .matches: matchesForm(data)
                        }
                    } else if model.loading {
                        Section { ProgressView("Đang tải…") }
                    }
                }
                .scrollContentBackground(.hidden)
                .background(TLColor.bg)
                .disabled(model.busy)

                if model.busy {
                    Color.black.opacity(0.2).ignoresSafeArea()
                    ProgressView("Đang lưu…")
                        .padding(18)
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
                        .accessibilityLabel("Đang lưu thay đổi")
                }
            }
            .navigationTitle("Quản lý giải")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Đóng") {
                        onChanged()
                        dismiss()
                    }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        prompt = .create(defaultKind(for: tab))
                    } label: {
                        Label("Thêm \(tab.rawValue)", systemImage: "plus")
                    }
                    .disabled(model.busy)
                }
            }
        }
        .task { await model.load() }
        .sheet(item: $prompt) { item in
            FlexNamePrompt(item: item) { name, type, groupID in
                Task {
                    switch item {
                    case .create(let kind):
                        await model.create(kind: kind, name: name, matchType: type, groupID: groupID)
                    case .createChild(let parent):
                        await model.create(
                            kind: .match,
                            name: name,
                            matchType: type ?? "singles",
                            groupID: parent.groupID,
                            parentID: parent.id
                        )
                    case .rename(let kind, let id, _):
                        await model.rename(kind: kind, id: id, name: name)
                    }
                }
            }
            .presentationDetents([.medium])
        }
        .alert("Xóa nội dung?", isPresented: Binding(
            get: { deleteTarget != nil },
            set: { if !$0 { deleteTarget = nil } }
        ), presenting: deleteTarget) { target in
            Button("Xóa", role: .destructive) {
                Task { await model.delete(kind: target.kind, id: target.id, parentID: target.parentID) }
            }
            Button("Hủy", role: .cancel) {}
        } message: { target in
            Text("“\(target.name)” và dữ liệu liên quan sẽ bị xóa. Thao tác này không thể hoàn tác.")
        }
        .alert("Tạo lịch vòng tròn?", isPresented: Binding(
            get: { roundRobinGroup != nil },
            set: { if !$0 { roundRobinGroup = nil } }
        ), presenting: roundRobinGroup) { group in
            Button("Tạo lịch") { Task { await model.generateRoundRobin(group: group) } }
            Button("Hủy", role: .cancel) {}
        } message: { group in
            Text("Mỗi cặp trong “\(group.name)” sẽ được tạo một trận mới.")
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

    private func playersForm(_ data: FlexData) -> some View {
        Section("Danh sách VĐV · \(data.players.count)") {
            if data.players.isEmpty {
                emptyRow("Chưa có VĐV. Nhấn + để thêm.")
            }
            ForEach(data.players) { player in
                entityRow(name: player.name,
                          rename: { prompt = .rename(.player, player.id, player.name) },
                          delete: { deleteTarget = .init(kind: .player, id: player.id, name: player.name) })
            }
        }
    }

    @ViewBuilder
    private func teamsForm(_ data: FlexData) -> some View {
        if data.teams.isEmpty {
            Section { emptyRow("Chưa có đội. Nhấn + để thêm.") }
        }
        ForEach(data.teams) { team in
            let members = data.teamMembers.filter { $0.teamID == team.id }
            Section {
                if members.isEmpty { emptyRow("Đội chưa có thành viên.") }
                ForEach(members) { member in
                    HStack {
                        Label(data.playerName(member.playerID) ?? "VĐV", systemImage: "person.fill")
                        Spacer()
                        Button(role: .destructive) {
                            Task { await model.removeMember(member.id) }
                        } label: {
                            Image(systemName: "minus.circle")
                                .frame(width: 44, height: 44)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Xóa \(data.playerName(member.playerID) ?? "VĐV") khỏi đội")
                    }
                }

                let memberIDs = Set(members.map(\.playerID))
                Menu {
                    ForEach(data.players.filter { !memberIDs.contains($0.id) }) { player in
                        Button(player.name) { Task { await model.addPlayer(player.id, to: team.id) } }
                    }
                } label: {
                    Label("Thêm thành viên", systemImage: "person.badge.plus")
                        .frame(minHeight: 44)
                }
                .disabled(data.players.allSatisfy { memberIDs.contains($0.id) })
            } header: {
                HStack {
                    Text(team.name)
                    Spacer()
                    Menu {
                        Button("Đổi tên") { prompt = .rename(.team, team.id, team.name) }
                        Button("Xóa đội", role: .destructive) {
                            deleteTarget = .init(kind: .team, id: team.id, name: team.name)
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                    .accessibilityLabel("Tùy chọn đội \(team.name)")
                }
            }
        }
    }

    @ViewBuilder
    private func groupsForm(_ data: FlexData) -> some View {
        if data.groups.isEmpty {
            Section { emptyRow("Chưa có bảng. Nhấn + để thêm.") }
        }
        ForEach(data.groups) { group in
            let items = data.items(in: group)
            let itemType = items.first?.itemType
            Section {
                if items.isEmpty { emptyRow("Bảng chưa có VĐV hoặc đội.") }
                ForEach(items) { item in
                    HStack {
                        Label(
                            data.playerName(item.playerID) ?? data.teamName(item.teamID) ?? "—",
                            systemImage: item.itemType == "team" ? "person.3.fill" : "person.fill"
                        )
                        Spacer()
                        Button(role: .destructive) {
                            Task { await model.removeGroupItem(item.id) }
                        } label: {
                            Image(systemName: "minus.circle").frame(width: 44, height: 44)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Xóa khỏi \(group.name)")
                    }
                }

                addGroupItemMenu(data: data, group: group, currentType: itemType)

                Toggle("Tính trận đôi vào BXH cá nhân", isOn: Binding(
                    get: { group.includeDoublesInSingles },
                    set: { value in Task { await model.setIncludeDoubles(value, groupID: group.id) } }
                ))

                Button {
                    roundRobinGroup = group
                } label: {
                    Label("Tạo lịch vòng tròn", systemImage: "arrow.triangle.2.circlepath")
                        .frame(minHeight: 44)
                }
                .disabled(items.count < 2)
            } header: {
                HStack {
                    Text(group.name)
                    Spacer()
                    Menu {
                        Button("Đổi tên") { prompt = .rename(.group, group.id, group.name) }
                        Button("Xóa bảng", role: .destructive) {
                            deleteTarget = .init(kind: .group, id: group.id, name: group.name)
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                    .accessibilityLabel("Tùy chọn bảng \(group.name)")
                }
            }
        }
    }

    private func addGroupItemMenu(data: FlexData, group: FlexGroup, currentType: String?) -> some View {
        let usedPlayers = Set(data.groupItems.compactMap(\.playerID))
        let usedTeams = Set(data.groupItems.compactMap(\.teamID))
        return Menu {
            if currentType != "team" {
                Section("VĐV") {
                    ForEach(data.players.filter { !usedPlayers.contains($0.id) }) { player in
                        Button(player.name) { Task { await model.addPlayer(player.id, toGroup: group.id) } }
                    }
                }
            }
            if currentType != "player" {
                Section("Đội") {
                    ForEach(data.teams.filter { !usedTeams.contains($0.id) }) { team in
                        Button(team.name) { Task { await model.addTeam(team.id, toGroup: group.id) } }
                    }
                }
            }
        } label: {
            Label("Thêm vào bảng", systemImage: "plus.circle").frame(minHeight: 44)
        }
    }

    @ViewBuilder
    private func matchesForm(_ data: FlexData) -> some View {
        let topLevel = data.matches.filter { $0.parentMatchID == nil }
            .sorted { $0.displayOrder < $1.displayOrder }
        if topLevel.isEmpty {
            Section { emptyRow("Chưa có trận. Nhấn + để thêm.") }
        }
        ForEach(topLevel) { match in
            FlexMatchEditorSection(
                data: data,
                match: match,
                children: data.childMatches(of: match),
                onRename: { prompt = .rename(.match, match.id, match.name) },
                onDelete: {
                    deleteTarget = .init(kind: .match, id: match.id, name: match.name)
                },
                onAddChild: { prompt = .createChild(match) },
                onDeleteChild: { child in
                    deleteTarget = .init(
                        kind: .match,
                        id: child.id,
                        name: child.name,
                        parentID: match.id
                    )
                },
                onConfigure: { item, groupID, counts in
                    Task { await model.configure(item, groupID: groupID, counts: counts) }
                },
                onParticipantMode: { item, teamMode in
                    Task { await model.setParticipantMode(item.id, teamMode: teamMode) }
                },
                onSlot: { item, slot, value in
                    Task { await model.setSlot(item.id, slot: slot, itemID: value) }
                }
            )
        }
    }

    private func entityRow(name: String, rename: @escaping () -> Void, delete: @escaping () -> Void) -> some View {
        HStack {
            Text(name)
            Spacer()
            Menu {
                Button("Đổi tên", action: rename)
                Button("Xóa", role: .destructive, action: delete)
            } label: {
                Image(systemName: "ellipsis.circle").frame(width: 44, height: 44)
            }
            .accessibilityLabel("Tùy chọn \(name)")
        }
    }

    private func emptyRow(_ text: String) -> some View {
        Text(text).font(.footnote).foregroundStyle(.secondary).frame(minHeight: 44)
    }

    private func defaultKind(for tab: Tab) -> FlexRepository.EntityKind {
        switch tab {
        case .players: return .player
        case .teams: return .team
        case .groups: return .group
        case .matches: return .match
        }
    }
}

private struct FlexMatchEditorSection: View {
    let data: FlexData
    let match: FlexMatch
    let children: [FlexMatch]
    let onRename: () -> Void
    let onDelete: () -> Void
    let onAddChild: () -> Void
    let onDeleteChild: (FlexMatch) -> Void
    let onConfigure: (FlexMatch, UUID?, Bool) -> Void
    let onParticipantMode: (FlexMatch, Bool) -> Void
    let onSlot: (FlexMatch, FlexRepository.MatchSlot, UUID?) -> Void

    var body: some View {
        Section {
            Picker("Bảng", selection: groupBinding(match)) {
                Text("Không thuộc bảng").tag(UUID?.none)
                ForEach(data.groups) { Text($0.name).tag(Optional($0.id)) }
            }

            Toggle("Tính vào bảng xếp hạng", isOn: countsBinding(match))

            Picker("Đối tượng thi đấu", selection: participantModeBinding(match)) {
                Text("VĐV").tag("player")
                Text("Đội").tag("team").disabled(data.teams.isEmpty)
            }
            .pickerStyle(.segmented)

            if match.isTeamMatch {
                teamPicker("Đội A", value: match.slotATeamID) { onSlot(match, .aTeam, $0) }
                teamPicker("Đội B", value: match.slotBTeamID) { onSlot(match, .bTeam, $0) }
            } else {
                playerPicker("Bên A · VĐV 1", value: match.slotA1PlayerID) { onSlot(match, .a1, $0) }
                if match.isDoubles {
                    playerPicker("Bên A · VĐV 2", value: match.slotA2PlayerID) { onSlot(match, .a2, $0) }
                }
                playerPicker("Bên B · VĐV 1", value: match.slotB1PlayerID) { onSlot(match, .b1, $0) }
                if match.isDoubles {
                    playerPicker("Bên B · VĐV 2", value: match.slotB2PlayerID) { onSlot(match, .b2, $0) }
                }
            }

            if match.isTeamMatch {
                Button(action: onAddChild) {
                    Label("Thêm trận cá nhân", systemImage: "plus.rectangle.on.rectangle")
                        .frame(minHeight: 44)
                }
            }

            ForEach(children) { child in
                DisclosureGroup {
                    playerPicker("Bên A · VĐV 1", value: child.slotA1PlayerID) { onSlot(child, .a1, $0) }
                    if child.isDoubles {
                        playerPicker("Bên A · VĐV 2", value: child.slotA2PlayerID) { onSlot(child, .a2, $0) }
                    }
                    playerPicker("Bên B · VĐV 1", value: child.slotB1PlayerID) { onSlot(child, .b1, $0) }
                    if child.isDoubles {
                        playerPicker("Bên B · VĐV 2", value: child.slotB2PlayerID) { onSlot(child, .b2, $0) }
                    }
                    Button("Xóa trận con", role: .destructive) { onDeleteChild(child) }
                } label: {
                    Label(child.name, systemImage: "arrow.turn.down.right")
                }
            }
        } header: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(match.name)
                    Text(match.isDoubles ? "ĐÔI" : "ĐƠN")
                        .font(.caption2)
                }
                Spacer()
                Menu {
                    Button("Đổi tên", action: onRename)
                    Button("Xóa trận", role: .destructive, action: onDelete)
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
                .accessibilityLabel("Tùy chọn trận \(match.name)")
            }
        }
    }

    private func groupBinding(_ item: FlexMatch) -> Binding<UUID?> {
        Binding(
            get: { item.groupID },
            set: { onConfigure(item, $0, item.countsForStandings) }
        )
    }

    private func countsBinding(_ item: FlexMatch) -> Binding<Bool> {
        Binding(
            get: { item.countsForStandings },
            set: { onConfigure(item, item.groupID, $0) }
        )
    }

    private func participantModeBinding(_ item: FlexMatch) -> Binding<String> {
        Binding(
            get: { item.isTeamMatch ? "team" : "player" },
            set: { onParticipantMode(item, $0 == "team") }
        )
    }

    private func playerPicker(
        _ title: String,
        value: UUID?,
        onChange: @escaping @MainActor @Sendable (UUID?) -> Void
    ) -> some View {
        Picker(title, selection: Binding(get: { value }, set: { onChange($0) })) {
            Text("Chưa chọn").tag(UUID?.none)
            ForEach(data.players) { Text($0.name).tag(Optional($0.id)) }
        }
    }

    private func teamPicker(
        _ title: String,
        value: UUID?,
        onChange: @escaping @MainActor @Sendable (UUID?) -> Void
    ) -> some View {
        Picker(title, selection: Binding(get: { value }, set: { onChange($0) })) {
            Text("Chưa chọn").tag(UUID?.none)
            ForEach(data.teams) { Text($0.name).tag(Optional($0.id)) }
        }
    }
}

private enum NamePrompt: Identifiable {
    case create(FlexRepository.EntityKind)
    case createChild(FlexMatch)
    case rename(FlexRepository.EntityKind, UUID, String)

    var id: String {
        switch self {
        case .create(let kind): return "create-\(kind.rawValue)"
        case .createChild(let match): return "child-\(match.id)"
        case .rename(let kind, let id, _): return "rename-\(kind.rawValue)-\(id)"
        }
    }
}

private struct DeleteTarget: Identifiable {
    let kind: FlexRepository.EntityKind
    let id: UUID
    let name: String
    var parentID: UUID?
}

private struct FlexNamePrompt: View {
    let item: NamePrompt
    let onSave: (String, String?, UUID?) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var matchType = "singles"
    @State private var groupID: UUID?

    init(item: NamePrompt, onSave: @escaping (String, String?, UUID?) -> Void) {
        self.item = item
        self.onSave = onSave
        switch item {
        case .rename(_, _, let current):
            _name = State(initialValue: current)
        case .createChild(let parent):
            _name = State(initialValue: "Trận \(parent.name)")
            _groupID = State(initialValue: parent.groupID)
        case .create(let kind):
            let value: String
            switch kind {
            case .player: value = ""
            case .team: value = "Đội mới"
            case .group: value = "Bảng mới"
            case .match: value = "Trận mới"
            }
            _name = State(initialValue: value)
        }
    }

    private var kind: FlexRepository.EntityKind? {
        switch item {
        case .create(let kind), .rename(let kind, _, _): return kind
        case .createChild: return .match
        }
    }

    private var isCreateMatch: Bool {
        switch item {
        case .create(.match), .createChild: return true
        default: return false
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Tên", text: $name)
                        .textInputAutocapitalization(.words)
                        .submitLabel(.done)
                }
                if isCreateMatch {
                    Section("Loại trận") {
                        Picker("Loại trận", selection: $matchType) {
                            Text("Đơn").tag("singles")
                            Text("Đôi").tag("doubles")
                        }
                        .pickerStyle(.segmented)
                    }
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Hủy") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lưu") {
                        onSave(name, isCreateMatch ? matchType : nil, groupID)
                        dismiss()
                    }
                    .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }

    private var title: String {
        switch item {
        case .create(.player): return "Thêm VĐV"
        case .create(.team): return "Thêm đội"
        case .create(.group): return "Thêm bảng"
        case .create(.match): return "Thêm trận"
        case .createChild: return "Thêm trận cá nhân"
        case .rename: return "Đổi tên"
        }
    }
}
