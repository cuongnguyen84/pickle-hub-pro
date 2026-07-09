import SwiftUI

/// Creator-only tournament management — port of web TeamMatchSettingsDialog +
/// useTeamMatch.updateTournamentDetails/Status/delete + referee management.
/// Sửa full thông tin giải (tên, link nhóm chat, ngày, địa điểm, thể lệ, lệ phí,
/// bank, DUPR), bắt đầu giải, thêm/xoá trọng tài, xoá giải.
@Observable
final class TMSettingsModel {
    let detail: TMDetail
    // Thông tin sửa được (khởi tạo từ giải hiện tại).
    var name: String
    var chatGroupURL: String
    var hasEventDate: Bool
    var eventDate: Date
    var location: String
    var rules: String
    var feeVnd: Int
    var feeTeamVnd: Int
    var bankCode: String
    var bankNumber: String
    var bankName: String
    var requireDupr: Bool
    var duprMale: Double
    var duprFemale: Double

    var referees: [TMReferee] = []
    var newEmail = ""
    var busy = false
    var message: String?

    private let repo = TeamMatchRepository()
    private var tournamentID: UUID { detail.tournament.id }

    init(detail: TMDetail) {
        self.detail = detail
        let t = detail.tournament
        self.name = t.name
        self.chatGroupURL = t.chatGroupURL ?? ""
        self.hasEventDate = t.eventStartDate != nil
        self.eventDate = t.eventStartDate ?? Date()
        self.location = t.location ?? ""
        self.rules = t.rulesSummary ?? ""
        self.feeVnd = t.entryFeeVnd ?? 0
        self.feeTeamVnd = t.entryFeeTeamVnd ?? 0
        self.bankCode = t.bankCode ?? ""
        self.bankNumber = t.bankAccountNumber ?? ""
        self.bankName = t.bankAccountName ?? ""
        self.requireDupr = t.requireDupr ?? false
        self.duprMale = t.duprMaxMale ?? 5.0
        self.duprFemale = t.duprMaxFemale ?? 4.5
    }

    var canStart: Bool {
        detail.tournament.status == "setup" || detail.tournament.status == "registration"
    }
    var nameValid: Bool { name.trimmingCharacters(in: .whitespaces).count >= 3 }
    var hasFee: Bool { feeVnd > 0 || feeTeamVnd > 0 }

    private static func dateStr(_ d: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: d)
    }

    @MainActor func loadReferees() async {
        referees = await repo.fetchReferees(tournamentID: tournamentID)
    }

    @MainActor func saveInfo(onChanged: () -> Void) async {
        guard nameValid else { return }
        busy = true; message = nil
        let d = TeamMatchRepository.DetailsUpdate(
            name: name.trimmingCharacters(in: .whitespaces),
            chatGroupURL: chatGroupURL.nonEmpty,
            eventDate: hasEventDate ? Self.dateStr(eventDate) : nil,
            location: location.nonEmpty,
            rulesSummary: rules.nonEmpty,
            entryFeeVnd: feeVnd > 0 ? feeVnd : nil,
            entryFeeTeamVnd: feeTeamVnd > 0 ? feeTeamVnd : nil,
            bankCode: hasFee ? bankCode.nonEmpty : nil,
            bankAccountNumber: hasFee ? bankNumber.nonEmpty : nil,
            bankAccountName: hasFee ? bankName.nonEmpty : nil,
            requireDupr: requireDupr,
            duprMaxMale: requireDupr ? duprMale : nil,
            duprMaxFemale: requireDupr ? duprFemale : nil)
        do {
            try await repo.updateDetails(tournamentID: tournamentID, d)
            message = "Đã lưu thông tin"; onChanged()
        } catch { message = error.localizedDescription }
        busy = false
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
                    chatSection
                    infoSection
                    feeSection
                    duprSection
                    saveButton
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

    private func input(_ placeholder: String, _ binding: Binding<String>, keyboard: UIKeyboardType = .default,
                       autocap: TextInputAutocapitalization = .sentences) -> some View {
        TextField(placeholder, text: binding)
            .font(TLFont.sans(15)).foregroundStyle(TLColor.fg)
            .keyboardType(keyboard).textInputAutocapitalization(autocap).autocorrectionDisabled(keyboard == .URL || keyboard == .emailAddress)
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
    }

    // Tính năng chính — link nhóm chat, để trên cùng.
    private var chatSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "bubble.left.and.bubble.right.fill").font(.system(size: 11)).foregroundStyle(TLColor.accentText)
                sectionTitle("Link nhóm chat (Zalo/Telegram…)")
            }
            input("https://zalo.me/g/... · https://t.me/...",
                  Binding(get: { model.chatGroupURL }, set: { model.chatGroupURL = $0 }),
                  keyboard: .URL, autocap: .never)
            Text("Người xem bấm nút “Nhóm chat” trên giải là mở thẳng nhóm.")
                .font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
        }
    }

    private var infoSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle("Thông tin giải")
            VStack(alignment: .leading, spacing: 6) {
                Text("Tên giải").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                input("Tên giải", Binding(get: { model.name }, set: { model.name = $0 }))
                if !model.nameValid {
                    Text("Tên tối thiểu 3 ký tự.").font(TLFont.mono(9.5)).foregroundStyle(TLColor.live)
                }
            }
            HStack {
                Text("Ngày tổ chức").font(TLFont.sans(14, .medium)).foregroundStyle(TLColor.fg)
                Spacer()
                Toggle("", isOn: Binding(get: { model.hasEventDate }, set: { model.hasEventDate = $0 })).labelsHidden().tint(TLColor.accent)
            }
            if model.hasEventDate {
                DatePicker("", selection: Binding(get: { model.eventDate }, set: { model.eventDate = $0 }), displayedComponents: .date)
                    .datePickerStyle(.compact).labelsHidden().tint(TLColor.accent)
                    .environment(\.locale, Locale(identifier: "vi_VN"))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            VStack(alignment: .leading, spacing: 6) {
                Text("Địa điểm").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                input("VD: Sân ABC, Q.7", Binding(get: { model.location }, set: { model.location = $0 }))
            }
            VStack(alignment: .leading, spacing: 6) {
                Text("Tóm tắt thể lệ").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                TextField("VD: MLP, 4 game + DreamBreaker…", text: Binding(get: { model.rules }, set: { model.rules = $0 }), axis: .vertical)
                    .lineLimit(2...5)
                    .font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
                    .padding(.horizontal, 12).padding(.vertical, 10)
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
            }
        }
    }

    private var feeSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle("Lệ phí & tài khoản nhận")
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Phí / VĐV (đ)").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                    TextField("0", value: Binding(get: { model.feeVnd }, set: { model.feeVnd = max(0, $0) }), format: .number)
                        .keyboardType(.numberPad)
                        .font(TLFont.sans(15)).foregroundStyle(TLColor.fg)
                        .padding(.horizontal, 12).padding(.vertical, 10)
                        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                        .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text("Phí / đội (đ)").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                    TextField("0", value: Binding(get: { model.feeTeamVnd }, set: { model.feeTeamVnd = max(0, $0) }), format: .number)
                        .keyboardType(.numberPad)
                        .font(TLFont.sans(15)).foregroundStyle(TLColor.fg)
                        .padding(.horizontal, 12).padding(.vertical, 10)
                        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                        .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
                }
            }
            if model.hasFee {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Ngân hàng").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                    Menu {
                        ForEach(VNBank.all) { b in
                            Button("\(b.shortName) (\(b.code))") { model.bankCode = b.code }
                        }
                    } label: {
                        HStack {
                            Text(bankLabel).font(TLFont.sans(15)).foregroundStyle(model.bankCode.isEmpty ? TLColor.fg3 : TLColor.fg)
                            Spacer()
                            Image(systemName: "chevron.up.chevron.down").font(.system(size: 11)).foregroundStyle(TLColor.fg3)
                        }
                        .padding(.horizontal, 12).padding(.vertical, 11)
                        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
                        .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
                    }
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text("Số tài khoản").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                    input("VD: 0123456789", Binding(get: { model.bankNumber }, set: { model.bankNumber = $0 }), keyboard: .numberPad)
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text("Tên chủ tài khoản").font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                    input("VD: NGUYEN VAN A",
                          Binding(get: { model.bankName }, set: { model.bankName = $0.uppercased() }),
                          autocap: .characters)
                }
            }
        }
    }

    private var bankLabel: String {
        VNBank.all.first(where: { $0.code == model.bankCode }).map { "\($0.shortName) (\($0.code))" } ?? "Chọn ngân hàng"
    }

    private var duprSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle("DUPR")
            HStack {
                Text("Giới hạn điểm DUPR").font(TLFont.sans(14, .medium)).foregroundStyle(TLColor.fg)
                Spacer()
                Toggle("", isOn: Binding(get: { model.requireDupr }, set: { model.requireDupr = $0 })).labelsHidden().tint(TLColor.accent)
            }
            if model.requireDupr {
                HStack(spacing: 10) {
                    duprField("Nam tối đa", Binding(get: { model.duprMale }, set: { model.duprMale = $0 }))
                    duprField("Nữ tối đa", Binding(get: { model.duprFemale }, set: { model.duprFemale = $0 }))
                }
            }
        }
    }

    private func duprField(_ title: String, _ value: Binding<Double>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
            Stepper(value: value, in: 2.0...8.0, step: 0.25) {
                Text(String(format: "%.2f", value.wrappedValue)).font(TLFont.sans(14)).foregroundStyle(TLColor.fg)
            }
            .padding(.horizontal, 10).padding(.vertical, 4)
            .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TLColor.border, lineWidth: 1))
        }
    }

    private var saveButton: some View {
        Button { Haptics.light(); Task { await model.saveInfo { onChanged() } } } label: {
            HStack(spacing: 6) {
                if model.busy { ProgressView().tint(TLColor.accentInk) }
                Text("Lưu thông tin").font(TLFont.sans(14, .bold))
            }
            .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 13)
            .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain).disabled(model.busy || !model.nameValid).opacity(model.nameValid ? 1 : 0.5)
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
}
