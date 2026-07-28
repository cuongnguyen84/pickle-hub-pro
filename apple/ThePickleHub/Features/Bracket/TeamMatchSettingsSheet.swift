import SwiftUI

/// Creator-only tournament management — port of web TeamMatchSettingsDialog +
/// useTeamMatch.updateTournamentStatus/delete + referee management. All soft
/// metadata editable on web is editable here too.
@Observable
final class TMSettingsModel {
    let detail: TMDetail
    var name: String
    var chatGroupURL: String
    var hasEventDate: Bool
    var eventDate: Date
    var location: String
    var rulesSummary: String
    var entryFeeVnd: Int
    var entryFeeTeamVnd: Int
    var bankCode: String
    var bankAccountNumber: String
    var bankAccountName: String
    var requireDupr: Bool
    var duprMaxMale: Double
    var duprMaxFemale: Double
    var referees: [TMReferee] = []
    var newEmail = ""
    var busy = false
    var message: String?

    private let repo = TeamMatchRepository()
    private var tournamentID: UUID { detail.tournament.id }

    init(detail: TMDetail) {
        self.detail = detail
        self.name = detail.tournament.name
        self.chatGroupURL = detail.tournament.chatGroupURL ?? ""
        self.hasEventDate = detail.tournament.eventDate?.nonEmpty != nil
        self.eventDate = Self.parseDate(detail.tournament.eventDate) ?? Date()
        self.location = detail.tournament.location ?? ""
        self.rulesSummary = detail.tournament.rulesSummary ?? ""
        self.entryFeeVnd = detail.tournament.entryFeeVnd ?? 0
        self.entryFeeTeamVnd = detail.tournament.entryFeeTeamVnd ?? 0
        self.bankCode = detail.tournament.bankCode ?? ""
        self.bankAccountNumber = detail.tournament.bankAccountNumber ?? ""
        self.bankAccountName = detail.tournament.bankAccountName ?? ""
        self.requireDupr = detail.tournament.requireDupr ?? false
        self.duprMaxMale = detail.tournament.duprMaxMale ?? 5
        self.duprMaxFemale = detail.tournament.duprMaxFemale ?? 4.5
    }

    var canStart: Bool {
        detail.tournament.status == "setup" || detail.tournament.status == "registration"
    }

    @MainActor func loadReferees() async {
        referees = await repo.fetchReferees(tournamentID: tournamentID)
    }

    @MainActor func saveDetails(onChanged: () -> Void) async {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 3 else {
            message = "Tên giải cần ít nhất 3 ký tự."
            return
        }
        let hasFee = entryFeeVnd > 0 || entryFeeTeamVnd > 0
        if hasFee && (bankCode.isEmpty || bankAccountNumber.trimmingCharacters(in: .whitespaces).isEmpty) {
            message = "Vui lòng chọn ngân hàng và nhập số tài khoản khi giải có lệ phí."
            return
        }
        busy = true; message = nil
        do {
            try await repo.updateDetails(
                tournamentID: tournamentID,
                details: .init(
                    name: trimmed,
                    eventDate: hasEventDate ? Self.databaseDate(eventDate) : nil,
                    location: location.clean,
                    chatGroupURL: chatGroupURL.clean,
                    rulesSummary: rulesSummary.clean,
                    entryFeeVnd: entryFeeVnd > 0 ? entryFeeVnd : nil,
                    entryFeeTeamVnd: entryFeeTeamVnd > 0 ? entryFeeTeamVnd : nil,
                    bankCode: hasFee ? bankCode.clean : nil,
                    bankAccountNumber: hasFee ? bankAccountNumber.clean : nil,
                    bankAccountName: hasFee ? bankAccountName.clean : nil,
                    requireDupr: requireDupr,
                    duprMaxMale: requireDupr ? duprMaxMale : nil,
                    duprMaxFemale: requireDupr ? duprMaxFemale : nil
                )
            )
            message = "Đã lưu thay đổi"
            onChanged()
        } catch {
            message = error.localizedDescription
        }
        busy = false
    }

    // canonical — KHÔNG theo locale: fixed-format "yyyy-MM-dd" parse/serialize với server
    private static func parseDate(_ raw: String?) -> Date? {
        guard let raw else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: raw)
    }

    private static func databaseDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    @MainActor func start(onChanged: () -> Void) async {
        busy = true; message = nil
        do { try await repo.updateStatus(tournamentID: tournamentID, status: "ongoing"); onChanged() }
        catch { message = error.localizedDescription }
        busy = false
    }

    @MainActor func addReferee() async {
        let email = newEmail
        guard !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        busy = true; message = nil
        switch await repo.addReferee(tournamentID: tournamentID, email: email) {
        case .ok(let name): message = "Đã thêm trọng tài \(name ?? email)"; newEmail = ""; await loadReferees()
        case .notFound: message = "Không tìm thấy người dùng với email này"
        case .alreadyExists: message = "Người này đã là trọng tài"
        case .error: message = "Không thể thêm trọng tài"
        }
        busy = false
    }

    @MainActor func remove(_ ref: TMReferee) async {
        busy = true; message = nil
        do { try await repo.removeReferee(refereeID: ref.id); await loadReferees() }
        catch { message = error.localizedDescription }
        busy = false
    }

    @MainActor func delete() async -> Bool {
        busy = true; message = nil
        do { try await repo.deleteTournament(tournamentID: tournamentID); return true }
        catch { message = error.localizedDescription; busy = false; return false }
    }
}

struct TeamMatchSettingsSheet: View {
    let detail: TMDetail
    let onChanged: () -> Void   // reload parent
    let onDeleted: () -> Void   // pop the detail view

    @Environment(\.dismiss) private var dismiss
    @State private var model: TMSettingsModel
    @State private var confirmDelete = false

    init(detail: TMDetail, onChanged: @escaping () -> Void, onDeleted: @escaping () -> Void) {
        self.detail = detail; self.onChanged = onChanged; self.onDeleted = onDeleted
        _model = State(initialValue: TMSettingsModel(detail: detail))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    detailsSection
                    feesSection
                    duprSection
                    saveSection
                    if model.canStart { startSection }
                    refereeSection
                    deleteSection
                    if let msg = model.message {
                        Text(msg).font(TLFont.sans(12)).foregroundStyle(TLColor.fg2)
                    }
                }
                .padding(16)
            }
            .background(TLColor.bg)
            .navigationTitle("Cài đặt giải")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Xong") { dismiss() }.foregroundStyle(TLColor.accentText) } }
            .task { await model.loadReferees() }
            .alert("Xóa giải đấu?", isPresented: $confirmDelete) {
                Button("Hủy", role: .cancel) {}
                Button("Xóa", role: .destructive) {
                    Task { if await model.delete() { onDeleted(); dismiss() } }
                }
            } message: {
                Text("\"\(detail.tournament.name)\" và toàn bộ dữ liệu liên quan sẽ bị xóa vĩnh viễn.")
            }
        }
    }

    private func sectionTitle(_ t: String) -> some View {
        Text(t.uppercased()).font(TLFont.mono(10.5, .semibold)).tracking(1).foregroundStyle(TLColor.fg3)
    }

    private var detailsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Thông tin giải")
            settingsField("Tên giải", text: bind(\.name))
            settingsField(
                "Link nhóm chat",
                placeholder: "https://zalo.me/... hoặc https://t.me/...",
                text: bind(\.chatGroupURL),
                keyboard: .URL
            )
            Toggle("Có ngày tổ chức", isOn: bind(\.hasEventDate))
                .font(TLFont.sans(14, .medium))
                .tint(TLColor.accent)
            if model.hasEventDate {
                DatePicker(
                    "Ngày tổ chức",
                    selection: bind(\.eventDate),
                    displayedComponents: .date
                )
                .font(TLFont.sans(14))
            }
            settingsField("Địa điểm", placeholder: "VD: Sân ABC, Q.7", text: bind(\.location))
            VStack(alignment: .leading, spacing: 6) {
                Text("TÓM TẮT THỂ LỆ")
                    .font(TLFont.mono(9.5, .semibold))
                    .foregroundStyle(TLColor.fg3)
                TextField(
                    "Thể thức, check-in và lưu ý cho VĐV…",
                    text: bind(\.rulesSummary),
                    axis: .vertical
                )
                .lineLimit(3...7)
                .settingsInput()
            }
        }
    }

    private var feesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Lệ phí & tài khoản nhận")
            HStack(spacing: 10) {
                numberField("Phí / VĐV", value: bind(\.entryFeeVnd))
                numberField("Phí / đội", value: bind(\.entryFeeTeamVnd))
            }
            if model.entryFeeVnd > 0 || model.entryFeeTeamVnd > 0 {
                Picker("Ngân hàng", selection: bind(\.bankCode)) {
                    Text("Chọn ngân hàng").tag("")
                    ForEach(VNBank.all) { bank in
                        Text("\(bank.shortName) (\(bank.code))").tag(bank.code)
                    }
                }
                .pickerStyle(.menu)
                .tint(TLColor.accentText)
                settingsField(
                    "Số tài khoản",
                    text: bind(\.bankAccountNumber),
                    keyboard: .numberPad
                )
                settingsField("Tên chủ tài khoản", text: bind(\.bankAccountName))
                    .textCase(.uppercase)
            }
        }
    }

    private var duprSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("DUPR")
            Toggle("Giới hạn điểm DUPR", isOn: bind(\.requireDupr))
                .font(TLFont.sans(14, .medium))
                .tint(TLColor.accent)
            if model.requireDupr {
                HStack(spacing: 10) {
                    decimalField("Nam tối đa", value: bind(\.duprMaxMale))
                    decimalField("Nữ tối đa", value: bind(\.duprMaxFemale))
                }
            }
        }
    }

    private var saveSection: some View {
        Button {
            Haptics.light()
            Task { await model.saveDetails { onChanged() } }
        } label: {
            HStack(spacing: 7) {
                if model.busy { ProgressView().tint(TLColor.accentInk) }
                Text(model.busy ? "Đang lưu…" : "Lưu thay đổi")
                    .font(TLFont.sans(14, .semibold))
            }
            .foregroundStyle(TLColor.accentInk)
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
        .disabled(model.busy || model.name.trimmingCharacters(in: .whitespacesAndNewlines).count < 3)
    }

    private var startSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Trạng thái")
            Button { Haptics.success(); Task { await model.start { onChanged() } } } label: {
                HStack(spacing: 6) {
                    Image(systemName: "play.fill").font(.system(size: 12))
                    Text("Bắt đầu giải đấu").font(TLFont.sans(14, .semibold))
                }
                .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 13)
                .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain).disabled(model.busy)
            Text("Chuyển sang “Đang diễn ra”; không thêm/xóa đội được nữa.")
                .font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
        }
    }

    private var refereeSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Trọng tài")
            if model.referees.isEmpty {
                Text("Chưa có trọng tài.").font(TLFont.sans(12.5)).foregroundStyle(TLColor.fg3)
            } else {
                ForEach(model.referees) { ref in
                    HStack(spacing: 10) {
                        Image(systemName: "whistle").font(.system(size: 12)).foregroundStyle(TLColor.fg3)
                        Text(ref.displayName ?? ref.userID.uuidString.prefix(8).description)
                            .font(TLFont.sans(13.5)).foregroundStyle(TLColor.fg).lineLimit(1)
                        Spacer()
                        Button { Haptics.light(); Task { await model.remove(ref) } } label: {
                            Image(systemName: "xmark.circle.fill").font(.system(size: 15)).foregroundStyle(TLColor.fg4)
                        }.buttonStyle(.plain)
                    }
                    .padding(.horizontal, 12).padding(.vertical, 10)
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                }
            }
            HStack(spacing: 10) {
                TextField("Email trọng tài", text: Binding(get: { model.newEmail }, set: { model.newEmail = $0 }))
                    .font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
                    .textInputAutocapitalization(.never).keyboardType(.emailAddress).autocorrectionDisabled()
                    .padding(.horizontal, 12).padding(.vertical, 10)
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
                Button { Haptics.light(); Task { await model.addReferee() } } label: {
                    Text("Thêm").font(TLFont.mono(11, .bold)).foregroundStyle(TLColor.accentInk)
                        .padding(.horizontal, 14).padding(.vertical, 11)
                        .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 11))
                }
                .buttonStyle(.plain).disabled(model.busy)
            }
            Text("Trọng tài có thể chấm điểm mọi trận. Người dùng phải đã có tài khoản.")
                .font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
            RefereePinSettingsView(format: .teamMatch, parentID: detail.tournament.id)
        }
    }

    private var deleteSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Rectangle().fill(TLColor.border).frame(height: 1)
            Button(role: .destructive) { Haptics.light(); confirmDelete = true } label: {
                HStack(spacing: 6) {
                    Image(systemName: "trash").font(.system(size: 12))
                    Text("Xóa giải đấu").font(TLFont.sans(14, .semibold))
                }
                .foregroundStyle(TLColor.live).frame(maxWidth: .infinity).padding(.vertical, 12)
                .background(TLColor.live.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain).disabled(model.busy)
        }
    }

    private func bind<Value>(
        _ keyPath: ReferenceWritableKeyPath<TMSettingsModel, Value>
    ) -> Binding<Value> {
        Binding(
            get: { model[keyPath: keyPath] },
            set: { model[keyPath: keyPath] = $0 }
        )
    }

    private func settingsField(
        _ label: String,
        placeholder: String = "",
        text: Binding<String>,
        keyboard: UIKeyboardType = .default
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label.uppercased())
                .font(TLFont.mono(9.5, .semibold))
                .foregroundStyle(TLColor.fg3)
            TextField(placeholder.isEmpty ? label : placeholder, text: text)
                .keyboardType(keyboard)
                .textInputAutocapitalization(keyboard == .URL ? .never : .sentences)
                .autocorrectionDisabled(keyboard == .URL)
                .settingsInput()
        }
    }

    private func numberField(_ label: String, value: Binding<Int>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label.uppercased())
                .font(TLFont.mono(9.5, .semibold))
                .foregroundStyle(TLColor.fg3)
            TextField("0", value: value, format: .number)
                .keyboardType(.numberPad)
                .settingsInput()
        }
    }

    private func decimalField(_ label: String, value: Binding<Double>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label.uppercased())
                .font(TLFont.mono(9.5, .semibold))
                .foregroundStyle(TLColor.fg3)
            TextField("0.00", value: value, format: .number.precision(.fractionLength(1...2)))
                .keyboardType(.decimalPad)
                .settingsInput()
        }
    }
}

private extension String {
    var clean: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}

private extension View {
    func settingsInput() -> some View {
        font(TLFont.sans(14))
            .foregroundStyle(TLColor.fg)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
            .overlay(
                RoundedRectangle(cornerRadius: 11)
                    .strokeBorder(TLColor.border, lineWidth: 1)
            )
    }
}
