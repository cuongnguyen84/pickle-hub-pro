import SwiftUI

struct QuickTableTeamManagerSheet: View {
    private struct PendingAction: Identifiable {
        let team: QTTeamRegistration
        let action: String
        var id: String { "\(team.id.uuidString)-\(action)" }
    }

    let model: QuickTableViewModel
    let onStarted: () -> Void

    @State private var showSetup = false
    @State private var selectedIDs: Set<UUID> = []
    @State private var pendingAction: PendingAction?
    @Environment(\.dismiss) private var dismiss

    private var pending: [QTTeamRegistration] {
        model.teams.filter {
            !$0.isApproved && $0.teamStatus != "rejected" && $0.teamStatus != "removed"
        }
    }
    private var approved: [QTTeamRegistration] {
        model.teams.filter { $0.isApproved && $0.isComplete }
    }
    private var active: [QTTeamRegistration] {
        model.teams.filter { $0.teamStatus != "rejected" && $0.teamStatus != "removed" }
    }

    var body: some View {
        NavigationStack {
            teamList
            .navigationTitle("Quản lý đội")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Xong") { dismiss() }
                }
            }
        }
        .sheet(isPresented: $showSetup) {
            if let table = model.detail?.table {
                QuickTableApprovedTeamsSetupSheet(table: table, teams: approved) {
                    showSetup = false
                    dismiss()
                    onStarted()
                }
                .presentationDetents([.large])
            }
        }
        .sheet(item: $pendingAction) { item in
            QuickTableTeamActionSheet(
                team: item.team,
                action: item.action,
                busy: model.teamBusy,
                error: model.teamError
            ) { notes in
                Task {
                    await model.manageTeam(item.team, action: item.action, notes: notes)
                    if model.teamError == nil { pendingAction = nil }
                }
            }
        }
    }

    private var teamList: some View {
        List {
            errorSection
            statsSection
            if !pending.isEmpty {
                batchSection
            }
            ForEach(model.teams) { team in
                teamSection(team)
            }
            startSection
        }
    }

    @ViewBuilder
    private var errorSection: some View {
        if let error = model.teamError {
            Section { Text(error).foregroundStyle(.red).font(.footnote) }
        }
    }

    private var statsSection: some View {
        let completeCount = active.filter { $0.isComplete }.count
        return Section {
            HStack {
                stat("\(active.count)", "Đã đăng ký")
                Spacer()
                stat("\(completeCount)", "Đủ đôi")
                Spacer()
                stat("\(approved.count)", "Đã duyệt")
            }
            .padding(.vertical, 8)
        }
    }

    private var batchSection: some View {
        Section("Duyệt hàng loạt") {
            Button {
                let ids = Set(pending.map(\.id))
                selectedIDs = selectedIDs == ids ? [] : ids
            } label: {
                Label(
                    selectedIDs.count == pending.count ? "Bỏ chọn tất cả" : "Chọn tất cả đội chờ",
                    systemImage: selectedIDs.count == pending.count ? "checkmark.circle.fill" : "circle"
                )
                .frame(minHeight: 44)
            }
            HStack {
                Button("Duyệt \(selectedIDs.count)") {
                    let ids = Array(selectedIDs)
                    Task {
                        await model.manageTeams(ids: ids, action: "approve")
                        if model.teamError == nil { selectedIDs.removeAll() }
                    }
                }
                .disabled(selectedIDs.isEmpty || model.teamBusy)
                Spacer()
                Button("Từ chối \(selectedIDs.count)", role: .destructive) {
                    let ids = Array(selectedIDs)
                    Task {
                        await model.manageTeams(ids: ids, action: "reject")
                        if model.teamError == nil { selectedIDs.removeAll() }
                    }
                }
                .disabled(selectedIDs.isEmpty || model.teamBusy)
            }
            .buttonStyle(.borderless)
        }
    }

    private func teamSection(_ team: QTTeamRegistration) -> some View {
        Section {
            HStack {
                if pending.contains(where: { $0.id == team.id }) {
                    Button {
                        if selectedIDs.contains(team.id) {
                            selectedIDs.remove(team.id)
                        } else {
                            selectedIDs.insert(team.id)
                        }
                    } label: {
                        Image(systemName: selectedIDs.contains(team.id) ? "checkmark.circle.fill" : "circle")
                            .font(.system(size: 21))
                            .foregroundStyle(selectedIDs.contains(team.id) ? TLColor.accentText : TLColor.fg4)
                            .frame(width: 32, height: 44)
                    }
                    .buttonStyle(.plain)
                }
                teamNames(team)
            }
            if let notes = team.btcNotes?.nonEmpty {
                Text(notes).font(.caption).foregroundStyle(.secondary)
            }
            teamActions(team)
        } header: {
            Text(team.pairName.nonEmpty ?? "Đội chưa hoàn tất")
        }
    }

    private func teamNames(_ team: QTTeamRegistration) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(team.player1DisplayName)
                Text(team.player2DisplayName?.nonEmpty ?? "Chưa có đồng đội")
                    .foregroundStyle(team.isComplete ? Color.secondary : Color.orange)
            }
            Spacer()
            status(team)
        }
    }

    private func teamActions(_ team: QTTeamRegistration) -> some View {
        HStack {
            if !team.isApproved && team.teamStatus != "removed" {
                Button("Duyệt") {
                    Task { await model.manageTeam(team, action: "approve") }
                }
                .disabled(model.teamBusy)
            }
            if team.teamStatus != "rejected" && team.teamStatus != "removed" {
                Button("Từ chối", role: .destructive) {
                    pendingAction = PendingAction(team: team, action: "reject")
                }
                .disabled(model.teamBusy)
            } else if team.teamStatus == "rejected" {
                Button("Duyệt lại") {
                    Task { await model.manageTeam(team, action: "approve") }
                }
                .disabled(model.teamBusy)
            }
            Spacer()
            Button("Loại", role: .destructive) {
                pendingAction = PendingAction(team: team, action: "remove")
            }
            .disabled(model.teamBusy || team.teamStatus == "removed")
        }
        .buttonStyle(.borderless)
    }

    @ViewBuilder
    private var startSection: some View {
        if model.detail?.table.status == "setup" {
            Section {
                Button {
                    showSetup = true
                } label: {
                    Label(
                        approved.count >= 3 ? "Tạo bảng đấu từ các đội đã duyệt" : "Cần ít nhất 3 đội đủ người đã duyệt",
                        systemImage: "tablecells"
                    )
                    .frame(maxWidth: .infinity, minHeight: 44)
                }
                .disabled(approved.count < 3 || model.teamBusy)
            }
        }
    }

    private func stat(_ number: String, _ label: String) -> some View {
        VStack(spacing: 3) {
            Text(number).font(.title2.bold()).monospacedDigit()
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
    }

    private func status(_ team: QTTeamRegistration) -> some View {
        let value: (String, Color) = {
            if team.teamStatus == "removed" { return ("Đã loại", .secondary) }
            if team.teamStatus == "rejected" { return ("Từ chối", .red) }
            if team.isApproved { return ("Đã duyệt", .green) }
            if !team.isComplete { return ("Thiếu người", .orange) }
            return ("Chờ duyệt", .yellow)
        }()
        return Text(value.0).font(.caption.bold()).foregroundStyle(value.1)
    }
}

private struct QuickTableTeamActionSheet: View {
    let team: QTTeamRegistration
    let action: String
    let busy: Bool
    let error: String?
    let onConfirm: (_ notes: String?) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var notes = ""

    private var title: String { action == "reject" ? "Từ chối đội" : "Loại đội" }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(team.pairName.nonEmpty ?? team.player1DisplayName)
                    Text(action == "reject"
                         ? "Đội có thể được duyệt lại sau."
                         : "Đội sẽ bị loại khỏi danh sách đang hoạt động.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Section("Lý do / ghi chú (không bắt buộc)") {
                    TextField("Nhập ghi chú cho đội", text: $notes, axis: .vertical)
                        .lineLimit(3...6)
                }
                if let error {
                    Section { Text(error).font(.footnote).foregroundStyle(.red) }
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Hủy") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(busy ? "Đang xử lý…" : "Xác nhận", role: .destructive) {
                        onConfirm(notes.nonEmpty)
                    }
                    .disabled(busy)
                }
            }
        }
        .presentationDetents([.medium])
    }
}

struct QuickTableMyTeamCard: View {
    let table: QTTable
    let team: QTTeamRegistration
    let allTeams: [QTTeamRegistration]
    let invitations: [QTPartnerInvitation]
    let incomingRequests: [QTPairRequest]
    let outgoingRequests: [QTPairRequest]
    let currentUserID: UUID?
    let busy: Bool
    let error: String?
    let onCreatePairRequest: (QTTeamRegistration) -> Void
    let onRespondPairRequest: (QTPairRequest, Bool) -> Void
    let onCancelPairRequest: (QTPairRequest) -> Void
    let onCreateInvitation: () -> Void
    let onCancelInvitation: (QTPartnerInvitation) -> Void
    let onRemovePartner: () -> Void
    @State private var selectedCandidate: QTTeamRegistration?

    private var activeInvitations: [QTPartnerInvitation] {
        invitations.filter { $0.status == "pending" }
    }

    private var canPair: Bool {
        team.player1UserID == currentUserID
            && !team.isComplete
            && table.status == "setup"
            && team.isLocked != true
    }

    private var availableCandidates: [QTTeamRegistration] {
        guard canPair else { return [] }
        return allTeams.filter {
            $0.id != team.id
                && !$0.isComplete
                && $0.isLocked != true
                && $0.teamStatus != "rejected"
                && $0.teamStatus != "removed"
                && $0.player1UserID != currentUserID
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("ĐỘI CỦA BẠN", systemImage: "person.2.fill")
                    .font(TLFont.mono(10, .semibold)).tracking(0.7)
                Spacer()
                Text(statusLabel)
                    .font(TLFont.mono(9, .bold))
                    .foregroundStyle(team.isApproved ? TLColor.accentText : TLColor.gold)
            }
            Text(team.player1DisplayName).font(TLFont.sans(14, .semibold))
            HStack {
                Image(systemName: "arrow.turn.down.right").foregroundStyle(TLColor.fg4)
                Text(team.player2DisplayName?.nonEmpty ?? "Chưa có đồng đội")
                    .font(TLFont.sans(14))
                    .foregroundStyle(team.isComplete ? TLColor.fg2 : TLColor.fg3)
                Spacer()
                if team.isComplete && team.player1UserID == currentUserID {
                    Button("Xóa partner", role: .destructive, action: onRemovePartner)
                        .font(TLFont.mono(9.5))
                }
            }

            if canPair && !incomingRequests.isEmpty {
                Divider().overlay(TLColor.border)
                Text("YÊU CẦU ĐANG CHỜ BẠN")
                    .font(TLFont.mono(9.5, .semibold))
                    .foregroundStyle(TLColor.fg3)
                ForEach(incomingRequests) { request in
                    HStack(spacing: 8) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(request.fromTeam?.player1DisplayName ?? "VĐV")
                                .font(TLFont.sans(13.5, .semibold))
                                .foregroundStyle(TLColor.fg)
                            if let club = request.fromTeam?.player1Team?.nonEmpty {
                                Text(club).font(TLFont.mono(10)).foregroundStyle(TLColor.fg3)
                            }
                        }
                        Spacer()
                        Button("Từ chối") { onRespondPairRequest(request, false) }
                            .font(TLFont.sans(11.5, .semibold))
                            .foregroundStyle(TLColor.live)
                            .frame(minHeight: 44)
                            .disabled(busy)
                        Button("Đồng ý") { onRespondPairRequest(request, true) }
                            .font(TLFont.sans(11.5, .semibold))
                            .foregroundStyle(TLColor.accentInk)
                            .padding(.horizontal, 10)
                            .frame(minHeight: 44)
                            .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 8))
                            .disabled(busy)
                    }
                }
            }

            if canPair && !outgoingRequests.isEmpty {
                Divider().overlay(TLColor.border)
                Text("YÊU CẦU ĐÃ GỬI")
                    .font(TLFont.mono(9.5, .semibold))
                    .foregroundStyle(TLColor.fg3)
                ForEach(outgoingRequests) { request in
                    HStack {
                        Text("Chờ \(request.toTeam?.player1DisplayName ?? "VĐV") xác nhận")
                            .font(TLFont.sans(12.5))
                            .foregroundStyle(TLColor.fg2)
                        Spacer()
                        Button("Hủy", role: .destructive) { onCancelPairRequest(request) }
                            .font(TLFont.sans(11.5, .semibold))
                            .frame(minHeight: 44)
                            .disabled(busy)
                    }
                }
            }

            if canPair && !availableCandidates.isEmpty {
                Divider().overlay(TLColor.border)
                Label("VĐV đang tìm đồng đội", systemImage: "figure.pickleball")
                    .font(TLFont.sans(13.5, .semibold))
                    .foregroundStyle(TLColor.fg)
                ForEach(availableCandidates) { candidate in
                    let sent = outgoingRequests.contains { $0.toTeamID == candidate.id }
                    let received = incomingRequests.contains { $0.fromTeamID == candidate.id }
                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(candidate.player1DisplayName)
                                .font(TLFont.sans(13.5, .semibold))
                                .foregroundStyle(TLColor.fg)
                            HStack(spacing: 6) {
                                if let club = candidate.player1Team?.nonEmpty {
                                    Text(club)
                                }
                                if let skill = candidate.player1SkillLevel {
                                    Text("\(candidate.player1RatingSystem ?? "Rating") \(skill.formatted(.number.precision(.fractionLength(1...2))))")
                                }
                            }
                            .font(TLFont.mono(9.5))
                            .foregroundStyle(TLColor.fg3)
                        }
                        Spacer()
                        if sent {
                            Text("ĐÃ GỬI")
                                .font(TLFont.mono(9, .semibold))
                                .foregroundStyle(TLColor.gold)
                        } else if received {
                            Text("CHỜ BẠN")
                                .font(TLFont.mono(9, .semibold))
                                .foregroundStyle(TLColor.accentText)
                        } else {
                            Button {
                                selectedCandidate = candidate
                            } label: {
                                Label("Ghép đôi", systemImage: "person.2.badge.plus")
                                    .font(TLFont.sans(11.5, .semibold))
                                    .foregroundStyle(TLColor.accentInk)
                                    .padding(.horizontal, 10)
                                    .frame(minHeight: 44)
                                    .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                            .disabled(busy)
                        }
                    }
                }
            }

            if !team.isComplete && team.teamStatus != "rejected" {
                Divider().overlay(TLColor.border)
                Button(action: onCreateInvitation) {
                    Label("Tạo link mời dự phòng", systemImage: "link.badge.plus")
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.bordered)
                .disabled(busy)
                ForEach(activeInvitations) { invitation in
                    HStack {
                        ShareLink(item: inviteURL(invitation)) {
                            Label("Chia sẻ link", systemImage: "square.and.arrow.up")
                        }
                        Spacer()
                        Button("Hủy", role: .destructive) { onCancelInvitation(invitation) }
                    }
                    .font(TLFont.sans(12, .medium))
                }
            }
            if let error {
                Text(error).font(TLFont.sans(12)).foregroundStyle(TLColor.live)
            }
        }
        .padding(14)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.sm))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.sm).strokeBorder(TLColor.border, lineWidth: 1))
        .confirmationDialog(
            "Gửi yêu cầu ghép đôi?",
            isPresented: Binding(
                get: { selectedCandidate != nil },
                set: { if !$0 { selectedCandidate = nil } }
            ),
            titleVisibility: .visible,
            presenting: selectedCandidate
        ) { candidate in
            Button("Gửi cho \(candidate.player1DisplayName)") {
                onCreatePairRequest(candidate)
                selectedCandidate = nil
            }
            Button("Hủy", role: .cancel) { selectedCandidate = nil }
        } message: { candidate in
            Text("Nếu \(candidate.player1DisplayName) đồng ý, hai đăng ký sẽ được ghép thành một đội.")
        }
    }

    private var statusLabel: String {
        if team.teamStatus == "rejected" { return "BỊ TỪ CHỐI" }
        if team.isApproved { return "ĐÃ DUYỆT" }
        if team.isComplete { return "CHỜ BTC DUYỆT" }
        return "CHỜ ĐỒNG ĐỘI"
    }

    private func inviteURL(_ invitation: QTPartnerInvitation) -> URL {
        WebRoutes.base.appending(path: "join/\(invitation.inviteCode)")
    }
}

private struct QuickTableApprovedTeamsSetupSheet: View {
    struct Entry: Identifiable {
        let id: UUID
        let player1: String
        let player2: String
        var team: String
        var seed = ""
        var groupIndex = 0
        var name: String { "\(player1) & \(player2)" }
    }

    let table: QTTable
    let onFinished: () -> Void
    @State private var entries: [Entry]
    @State private var manual = false
    @State private var courts: String
    @State private var startTime: String
    @State private var busy = false
    @State private var errorMessage: String?
    @Environment(\.dismiss) private var dismiss
    private let repo = QuickTableRepository()

    init(table: QTTable, teams: [QTTeamRegistration], onFinished: @escaping () -> Void) {
        self.table = table
        self.onFinished = onFinished
        _entries = State(initialValue: teams.compactMap {
            guard let second = $0.player2DisplayName?.nonEmpty else { return nil }
            return Entry(id: $0.id, player1: $0.player1DisplayName, player2: second,
                         team: $0.player1Team ?? $0.player2Team ?? "")
        })
        _courts = State(initialValue: (table.courts ?? []).joined(separator: ", "))
        _startTime = State(initialValue: table.startTime ?? "")
    }

    private var groupCount: Int { table.format == "round_robin" ? max(1, table.groupCount ?? 1) : 1 }

    var body: some View {
        NavigationStack {
            Form {
                Section("Chia bảng") {
                    Picker("Phương thức", selection: $manual) {
                        Text("Tự động").tag(false)
                        Text("Thủ công").tag(true)
                    }
                    .pickerStyle(.segmented)
                    .disabled(groupCount == 1)
                }
                Section("Đội · \(entries.count)") {
                    ForEach($entries) { $entry in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(entry.name)
                            HStack {
                                TextField("Tên team", text: $entry.team)
                                TextField("Seed", text: $entry.seed)
                                    .frame(width: 64).keyboardType(.numberPad)
                            }
                            if manual && groupCount > 1 {
                                Picker("Bảng", selection: $entry.groupIndex) {
                                    ForEach(0..<groupCount, id: \.self) {
                                        Text("Bảng \(String(UnicodeScalar(65 + $0)!))").tag($0)
                                    }
                                }
                            }
                        }
                    }
                    .onDelete { entries.remove(atOffsets: $0) }
                }
                Section("Sân & giờ") {
                    TextField("Sân, VD: 1, 2, 3", text: $courts)
                    TextField("Giờ bắt đầu, VD: 08:00", text: $startTime)
                }
                if let errorMessage {
                    Section { Text(errorMessage).font(.footnote).foregroundStyle(.red) }
                }
                Section {
                    Button {
                        Task { await save() }
                    } label: {
                        HStack {
                            if busy { ProgressView() }
                            Text(busy ? "Đang tạo…" : "Tạo bảng đấu")
                        }
                        .frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .disabled(busy || entries.count < 2)
                }
            }
            .navigationTitle("Bắt đầu giải đôi")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Hủy") { dismiss() }
                }
            }
        }
    }

    @MainActor
    private func save() async {
        busy = true
        errorMessage = nil
        defer { busy = false }
        do {
            try await repo.setupRoster(
                tableID: table.id,
                players: entries.map {
                    QuickTableRepository.RosterEntry(
                        name: $0.name,
                        player1Name: $0.player1,
                        player2Name: $0.player2,
                        team: $0.team.nonEmpty,
                        seed: Int($0.seed)
                    )
                },
                groupCount: groupCount,
                assignments: manual && groupCount > 1 ? entries.map(\.groupIndex) : nil,
                courts: courts.split(whereSeparator: { $0 == "," || $0 == " " }).map(String.init),
                startTime: startTime.nonEmpty
            )
            Haptics.success()
            onFinished()
        } catch {
            errorMessage = UserFacingError.message(action: "Tạo bảng đấu", error: error)
            Haptics.error()
        }
    }
}
