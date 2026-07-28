import SwiftUI

/// Organizer registration manager — port of web RegistrationManager. Pending rows
/// get approve/reject; bulk-approve all pending; approved/rejected listed below.
struct QuickTableRegistrationsSheet: View {
    let model: QuickTableViewModel
    let onStarted: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var showSetup = false
    @State private var selectedPending: Set<UUID> = []
    @State private var editingRegistration: QTRegistration?

    private var pending: [QTRegistration] { model.registrations.filter { $0.status == "pending" } }
    private var approved: [QTRegistration] { model.registrations.filter { $0.status == "approved" } }
    private var rejected: [QTRegistration] { model.registrations.filter { $0.status == "rejected" } }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let err = model.regError { Text(err).font(TLFont.sans(12)).foregroundStyle(TLColor.live) }
                    if model.registrations.isEmpty {
                        Text("Chưa có ai đăng ký.").font(TLFont.sans(13)).foregroundStyle(TLColor.fg3).padding(.top, 8)
                    }
                    if !pending.isEmpty {
                        sectionHeader("Chờ duyệt · \(pending.count)") {
                            Button {
                                let ids = selectedPending.isEmpty ? pending.map(\.id) : Array(selectedPending)
                                Haptics.success()
                                Task {
                                    await model.bulkApprove(ids: ids)
                                    selectedPending.subtract(ids)
                                }
                            } label: {
                                Text(selectedPending.isEmpty ? "Duyệt tất cả" : "Duyệt \(selectedPending.count)")
                                    .font(TLFont.mono(10.5, .bold)).foregroundStyle(TLColor.accentInk)
                                    .padding(.horizontal, 12).padding(.vertical, 7)
                                    .background(TLColor.accent, in: Capsule())
                            }.buttonStyle(.plain).disabled(model.regBusy)
                        }
                        Button {
                            let ids = Set(pending.map(\.id))
                            selectedPending = selectedPending == ids ? [] : ids
                        } label: {
                            Label(
                                selectedPending.count == pending.count ? "Bỏ chọn tất cả" : "Chọn nhiều đăng ký",
                                systemImage: selectedPending.count == pending.count ? "checkmark.circle.fill" : "circle"
                            )
                            .font(TLFont.sans(12, .medium))
                            .frame(minHeight: 44)
                        }
                        .buttonStyle(.plain)
                        ForEach(pending) { r in pendingRow(r) }
                    }
                    if !approved.isEmpty {
                        sectionHeader("Đã duyệt · \(approved.count)") { EmptyView() }
                        ForEach(approved) { r in plainRow(r, color: TLColor.accentText, editable: true) }
                    }
                    if !rejected.isEmpty {
                        sectionHeader("Từ chối · \(rejected.count)") { EmptyView() }
                        ForEach(rejected) { r in plainRow(r, color: TLColor.live, editable: true) }
                    }
                    if model.detail?.table.status == "setup" {
                        Button {
                            showSetup = true
                        } label: {
                            Label(
                                approved.count >= 6 ? "Tạo bảng đấu từ danh sách đã duyệt" : "Cần ít nhất 6 VĐV đã duyệt",
                                systemImage: "tablecells"
                            )
                            .font(TLFont.sans(14, .semibold))
                            .foregroundStyle(TLColor.accentInk)
                            .frame(maxWidth: .infinity, minHeight: 48)
                            .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
                        }
                        .buttonStyle(.plain)
                        .disabled(approved.count < 6 || model.regBusy)
                        .opacity(approved.count >= 6 ? 1 : 0.45)
                    }
                }
                .padding(16)
            }
            .background(TLColor.bg)
            .navigationTitle("Đăng ký")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Xong") { dismiss() }.foregroundStyle(TLColor.accentText) } }
        }
        .sheet(isPresented: $showSetup) {
            if let detail = model.detail {
                QuickTableApprovedSetupSheet(
                    table: detail.table,
                    registrations: approved
                ) {
                    showSetup = false
                    dismiss()
                    onStarted()
                }
                .presentationDetents([.large])
            }
        }
        .sheet(item: $editingRegistration) { registration in
            QuickTableBTCRegistrationEditSheet(
                registration: registration,
                busy: model.regBusy,
                error: model.regError
            ) { overrideSkill, notes in
                Task {
                    await model.updateRegistrationBTC(
                        registration,
                        overrideSkill: overrideSkill,
                        notes: notes
                    )
                    if model.regError == nil { editingRegistration = nil }
                }
            }
        }
    }

    private func sectionHeader<Trailing: View>(_ title: String, @ViewBuilder trailing: () -> Trailing) -> some View {
        HStack {
            Text(title.uppercased()).font(TLFont.mono(10.5, .semibold)).tracking(1).foregroundStyle(TLColor.fg3)
            Spacer()
            trailing()
        }
    }

    private func regMeta(_ r: QTRegistration) -> String {
        var parts: [String] = []
        if let t = r.team, !t.isEmpty { parts.append(t) }
        if let s = r.skillLevel { parts.append("\(r.ratingSystem ?? "") \(s)".trimmingCharacters(in: .whitespaces)) }
        return parts.joined(separator: " · ")
    }

    private func pendingRow(_ r: QTRegistration) -> some View {
        HStack(spacing: 10) {
            Button {
                if selectedPending.contains(r.id) {
                    selectedPending.remove(r.id)
                } else {
                    selectedPending.insert(r.id)
                }
            } label: {
                Image(systemName: selectedPending.contains(r.id) ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 21))
                    .foregroundStyle(selectedPending.contains(r.id) ? TLColor.accentText : TLColor.fg4)
                    .frame(width: 32, height: 44)
            }
            .buttonStyle(.plain)
            VStack(alignment: .leading, spacing: 2) {
                Text(r.displayName).font(TLFont.sans(14, .semibold)).foregroundStyle(TLColor.fg).lineLimit(1)
                if !regMeta(r).isEmpty { Text(regMeta(r)).font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg3) }
            }
            Spacer()
            Button { Haptics.success(); Task { await model.approve(r.id) } } label: {
                Image(systemName: "checkmark.circle.fill").font(.system(size: 22)).foregroundStyle(TLColor.accentText)
            }.buttonStyle(.plain).disabled(model.regBusy)
            Button { Haptics.light(); Task { await model.reject(r.id) } } label: {
                Image(systemName: "xmark.circle.fill").font(.system(size: 22)).foregroundStyle(TLColor.fg4)
            }.buttonStyle(.plain).disabled(model.regBusy)
        }
        .padding(14)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private func plainRow(_ r: QTRegistration, color: Color, editable: Bool) -> some View {
        HStack(spacing: 10) {
            Circle().fill(color).frame(width: 7, height: 7)
            VStack(alignment: .leading, spacing: 2) {
                Text(r.displayName).font(TLFont.sans(13.5)).foregroundStyle(TLColor.fg2).lineLimit(1)
                if let note = r.btcNotes?.nonEmpty {
                    Text(note).font(TLFont.sans(11)).foregroundStyle(TLColor.fg3).lineLimit(2)
                }
            }
            Spacer()
            if let skill = r.btcOverrideSkill ?? r.skillLevel {
                Text(String(format: "%.2f", skill))
                    .font(TLFont.mono(9.5, r.btcOverrideSkill == nil ? .medium : .bold))
                    .foregroundStyle(r.btcOverrideSkill == nil ? TLColor.fg4 : TLColor.gold)
            }
            if r.status == "rejected" {
                Button { Haptics.light(); Task { await model.approve(r.id) } } label: {
                    Text("Duyệt lại").font(TLFont.mono(9.5, .semibold)).foregroundStyle(TLColor.accentText)
                }.buttonStyle(.plain)
            }
            if editable {
                Button {
                    editingRegistration = r
                } label: {
                    Image(systemName: "slider.horizontal.3")
                        .foregroundStyle(TLColor.accentText)
                        .frame(width: 36, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Điều chỉnh đăng ký \(r.displayName)")
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
    }
}

private struct QuickTableBTCRegistrationEditSheet: View {
    let registration: QTRegistration
    let busy: Bool
    let error: String?
    let onSave: (_ overrideSkill: Double?, _ notes: String?) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var overrideSkill: String
    @State private var notes: String

    init(registration: QTRegistration, busy: Bool, error: String?,
         onSave: @escaping (_ overrideSkill: Double?, _ notes: String?) -> Void) {
        self.registration = registration
        self.busy = busy
        self.error = error
        self.onSave = onSave
        _overrideSkill = State(initialValue: registration.btcOverrideSkill.map { String($0) } ?? "")
        _notes = State(initialValue: registration.btcNotes ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("VĐV") {
                    LabeledContent("Tên", value: registration.displayName)
                    if let skill = registration.skillLevel {
                        LabeledContent("Tự khai", value: String(format: "%.2f", skill))
                    }
                }
                Section("Điều chỉnh của BTC") {
                    TextField("Điểm BTC (để trống nếu không ghi đè)", text: $overrideSkill)
                        .keyboardType(.decimalPad)
                    TextField("Ghi chú nội bộ", text: $notes, axis: .vertical)
                        .lineLimit(3...6)
                }
                if let error {
                    Section { Text(error).font(.footnote).foregroundStyle(.red) }
                }
            }
            .navigationTitle("Điều chỉnh đăng ký")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Hủy") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(busy ? "Đang lưu…" : "Lưu") {
                        onSave(
                            Double(overrideSkill.replacingOccurrences(of: ",", with: ".")),
                            notes.nonEmpty
                        )
                    }
                    .disabled(busy)
                }
            }
        }
    }
}

/// Converts approved registrations into the real native roster, including
/// seeds, manual grouping and court scheduling.
private struct QuickTableApprovedSetupSheet: View {
    struct Entry: Identifiable {
        let id: UUID
        var name: String
        var team: String
        var seed: String
        var groupIndex: Int
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

    init(table: QTTable, registrations: [QTRegistration], onFinished: @escaping () -> Void) {
        self.table = table
        self.onFinished = onFinished
        _entries = State(initialValue: registrations.map {
            Entry(id: $0.id, name: $0.displayName, team: $0.team ?? "", seed: "", groupIndex: 0)
        })
        _courts = State(initialValue: (table.courts ?? []).joined(separator: ", "))
        _startTime = State(initialValue: table.startTime ?? "")
    }

    private var groupCount: Int { table.format == "round_robin" ? max(1, table.groupCount ?? 1) : 1 }
    private var manualAvailable: Bool { table.format == "round_robin" && groupCount > 1 }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Danh sách đã duyệt sẽ trở thành roster chính thức. Anh có thể sửa tên, seed và bảng trước khi bắt đầu.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                Section("Phương thức chia bảng") {
                    Picker("Chia bảng", selection: $manual) {
                        Text("Tự động").tag(false)
                        Text("Thủ công").tag(true)
                    }
                    .pickerStyle(.segmented)
                    .disabled(!manualAvailable)
                }
                Section("VĐV · \(entries.count)") {
                    ForEach($entries) { $entry in
                        VStack(alignment: .leading, spacing: 8) {
                            TextField("Tên VĐV", text: $entry.name)
                            HStack {
                                TextField("Team", text: $entry.team)
                                TextField("Seed", text: $entry.seed)
                                    .keyboardType(.numberPad)
                                    .multilineTextAlignment(.trailing)
                                    .frame(width: 72)
                            }
                            if manual && manualAvailable {
                                Picker("Bảng", selection: $entry.groupIndex) {
                                    ForEach(0..<groupCount, id: \.self) {
                                        Text("Bảng \(groupName($0))").tag($0)
                                    }
                                }
                            }
                        }
                        .padding(.vertical, 4)
                    }
                    .onDelete { entries.remove(atOffsets: $0) }
                }
                Section("Sân & giờ") {
                    TextField("Sân, VD: 1, 2, 3", text: $courts)
                        .keyboardType(.numbersAndPunctuation)
                    TextField("Giờ bắt đầu, VD: 08:00", text: $startTime)
                        .keyboardType(.numbersAndPunctuation)
                }
                if let errorMessage {
                    Section { Text(errorMessage).foregroundStyle(.red).font(.footnote) }
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
                    .disabled(busy || entries.filter { !$0.name.trimmingCharacters(in: .whitespaces).isEmpty }.count < 2)
                }
            }
            .navigationTitle("Bắt đầu giải")
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
        let valid = entries.filter { !$0.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        busy = true
        errorMessage = nil
        defer { busy = false }
        do {
            let courtList = courts.split(whereSeparator: { $0 == "," || $0 == " " }).map(String.init)
            try await repo.setupRoster(
                tableID: table.id,
                players: valid.map {
                    QuickTableRepository.RosterEntry(
                        name: $0.name,
                        player1Name: $0.name,
                        team: $0.team.nonEmpty,
                        seed: Int($0.seed)
                    )
                },
                groupCount: groupCount,
                assignments: manual && manualAvailable ? valid.map(\.groupIndex) : nil,
                courts: courtList,
                startTime: startTime.nonEmpty
            )
            Haptics.success()
            onFinished()
        } catch {
            errorMessage = UserFacingError.message(failure: "Không tạo được bảng đấu.", error: error)
            Haptics.error()
        }
    }

    private func groupName(_ index: Int) -> String {
        String(UnicodeScalar(65 + index)!)
    }
}

/// Self-registration form — port of web RegistrationForm.
struct QuickTableSelfRegisterSheet: View {
    let isDoubles: Bool
    let busy: Bool
    let error: String?
    let initial: QTRegistration?
    let table: QTTable?
    let duprIdentity: TournamentService.DuprIdentity
    let onDuprRefresh: () -> Void
    let onSubmit: (_ name: String, _ team: String, _ rating: String, _ skill: Double?,
                   _ skillSystem: String, _ skillDescription: String, _ link: String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var team: String
    @State private var rating: String   // DUPR | other | none
    @State private var skill: String
    @State private var skillSystem: String
    @State private var skillDescription: String
    @State private var link: String
    @State private var showDuprConnect = false

    init(
        isDoubles: Bool,
        busy: Bool,
        error: String?,
        initial: QTRegistration? = nil,
        table: QTTable? = nil,
        duprIdentity: TournamentService.DuprIdentity = .init(connected: false, rating: nil),
        onDuprRefresh: @escaping () -> Void = {},
        onSubmit: @escaping (_ name: String, _ team: String, _ rating: String, _ skill: Double?,
                             _ skillSystem: String, _ skillDescription: String, _ link: String) -> Void
    ) {
        self.isDoubles = isDoubles
        self.busy = busy
        self.error = error
        self.initial = initial
        self.table = table
        self.duprIdentity = duprIdentity
        self.onDuprRefresh = onDuprRefresh
        self.onSubmit = onSubmit
        let verifiedRating = duprIdentity.connected ? duprIdentity.rating : nil
        _name = State(initialValue: initial?.displayName ?? "")
        _team = State(initialValue: initial?.team ?? "")
        _rating = State(initialValue: initial?.ratingSystem
            ?? ((table?.ratingSource == "dupr" || table?.ratingSource == "either") && verifiedRating != nil
                ? "DUPR" : table?.ratingSource == "dupr" ? "DUPR" : "none"))
        _skill = State(initialValue: initial?.skillLevel.map { String($0) }
            ?? verifiedRating.map { String($0) } ?? "")
        _skillSystem = State(initialValue: initial?.skillSystemName ?? "")
        _skillDescription = State(initialValue: initial?.skillDescription ?? "")
        _link = State(initialValue: initial?.profileLink ?? "")
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let message = table?.registrationMessage?.nonEmpty {
                        Text(message)
                            .font(TLFont.sans(13))
                            .foregroundStyle(TLColor.fg2)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 10))
                    }
                    if table?.ratingSource == "dupr" {
                        duprRequirementCard
                    }
                    field("Tên hiển thị *") {
                        tf($name, "Tên của bạn")
                    }
                    if isDoubles {
                        field("Đội / Cặp (tùy chọn)") { tf($team, "Tên đội") }
                    }
                    field("Hệ trình độ") {
                        Picker("", selection: $rating) {
                            Text("Không").tag("none"); Text("DUPR").tag("DUPR"); Text("Khác").tag("other")
                        }
                        .pickerStyle(.segmented)
                        .disabled(table?.ratingSource == "dupr" || verifiedDuprLocked)
                    }
                    if rating != "none" {
                        field("Điểm trình độ (tùy chọn)") {
                            tf($skill, "VD: 3.5").keyboardType(.decimalPad)
                                .disabled(verifiedDuprLocked)
                        }
                    }
                    if rating == "other" {
                        field("Tên hệ trình độ (tùy chọn)") {
                            tf($skillSystem, "VD: UTPR, APP, điểm CLB")
                        }
                    }
                    if rating == "none" {
                        field("Mô tả trình độ (tùy chọn)") {
                            tf($skillDescription, "VD: Trung bình khá, chơi 2 năm")
                        }
                    }
                    field("Link hồ sơ (tùy chọn)") { tf($link, "DUPR / Facebook…").keyboardType(.URL).textInputAutocapitalization(.never) }
                    if let error { Text(error).font(TLFont.sans(12)).foregroundStyle(TLColor.live) }
                }
                .padding(16)
            }
            .background(TLColor.bg)
            .navigationTitle(initial == nil ? "Đăng ký tham gia" : "Sửa đăng ký")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Hủy") { dismiss() }.foregroundStyle(TLColor.fg3) }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Haptics.success()
                        onSubmit(
                            name,
                            team,
                            rating,
                            Double(skill.replacingOccurrences(of: ",", with: ".")),
                            skillSystem,
                            skillDescription,
                            link
                        )
                    } label: {
                        if busy { ProgressView().tint(TLColor.accentText) }
                        else { Text("Gửi").font(TLFont.sans(15, .semibold)) }
                    }
                    .foregroundStyle(canSubmit ? TLColor.accentText : TLColor.fg4)
                    .disabled(!canSubmit || busy)
                }
            }
        }
        .sheet(isPresented: $showDuprConnect, onDismiss: onDuprRefresh) {
            SafariView(url: WebRoutes.dupr).ignoresSafeArea()
        }
        .onChange(of: duprIdentity) { _, identity in
            guard identity.connected, let value = identity.rating,
                  table?.ratingSource == "dupr" || table?.ratingSource == "either" else { return }
            rating = "DUPR"
            skill = String(value)
        }
    }

    private var verifiedDuprLocked: Bool {
        duprIdentity.connected && rating == "DUPR"
            && (table?.ratingSource == "dupr" || table?.ratingSource == "either")
    }

    private var parsedSkill: Double? {
        Double(skill.replacingOccurrences(of: ",", with: "."))
    }

    private var duprInRange: Bool {
        guard let rating = parsedSkill else { return false }
        if let min = table?.minSkillLevel, rating < min { return false }
        if let max = table?.maxSkillLevel, rating > max { return false }
        return true
    }

    private var canSubmit: Bool {
        guard !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return false }
        if table?.ratingSource == "dupr" {
            return duprIdentity.connected && duprInRange
        }
        if table?.requiresSkillLevel == true {
            return rating != "none" && parsedSkill != nil
        }
        if rating == "DUPR", parsedSkill != nil,
           (table?.minSkillLevel != nil || table?.maxSkillLevel != nil) {
            return duprInRange
        }
        return true
    }

    private var duprRequirementCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(
                duprIdentity.connected ? "DUPR đã xác minh" : "Giải yêu cầu DUPR đã liên kết",
                systemImage: duprIdentity.connected ? "checkmark.seal.fill" : "exclamationmark.triangle.fill"
            )
            .font(TLFont.sans(13, .semibold))
            .foregroundStyle(duprIdentity.connected ? TLColor.accentText : TLColor.gold)
            if let value = duprIdentity.rating {
                Text("Điểm hiện tại: \(String(format: "%.2f", value))\(duprRangeText)")
                    .font(TLFont.mono(10.5))
                    .foregroundStyle(duprInRange ? TLColor.fg3 : TLColor.live)
            } else {
                Text("Kết nối tài khoản DUPR rồi quay lại màn này để đăng ký.")
                    .font(TLFont.sans(12))
                    .foregroundStyle(TLColor.fg3)
                Button("Kết nối DUPR") {
                    showDuprConnect = true
                }
                .font(TLFont.sans(13, .semibold))
                .frame(minHeight: 44)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private var duprRangeText: String {
        switch (table?.minSkillLevel, table?.maxSkillLevel) {
        case let (min?, max?): return " · yêu cầu \(min)–\(max)"
        case let (min?, nil): return " · tối thiểu \(min)"
        case let (nil, max?): return " · tối đa \(max)"
        default: return ""
        }
    }

    private func field<C: View>(_ label: String, @ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(label.uppercased()).font(TLFont.mono(10, .semibold)).tracking(0.6).foregroundStyle(TLColor.fg3)
            content()
        }
    }

    private func tf(_ binding: Binding<String>, _ placeholder: String) -> some View {
        TextField(placeholder, text: binding)
            .font(TLFont.sans(15)).foregroundStyle(TLColor.fg)
            .padding(.horizontal, 12).padding(.vertical, 11)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
    }
}
