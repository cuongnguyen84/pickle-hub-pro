import SwiftUI

// ============================================================================
// Tạo + Sửa sự kiện giao lưu (BTC). Port web CreateSocialEvent (RPC atomic
// create_social_event_with_payment) + EditSocialEvent (patch, KHÔNG đụng
// slots) + huỷ (RPC cancel_social_event, gõ tên xác nhận).
// ponytail: chưa có SlotManager (nhóm đăng ký) + free_perks + lặp hàng tuần
// — thêm khi Cuong cần; web vẫn đầy đủ.
// ============================================================================

// MARK: Form state chung

@Observable
final class SocialEventFormModel {
    // nil = tạo mới; non-nil = sửa
    let existing: SocialEvent?
    let clubID: UUID?

    var title = ""
    var descriptionText = ""
    var date = Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date()
    var startTime = Calendar.current.date(bySettingHour: 18, minute: 0, second: 0, of: Date()) ?? Date()
    var endTime = Calendar.current.date(bySettingHour: 21, minute: 0, second: 0, of: Date()) ?? Date()
    var locationText = ""
    var courtCount = 2
    var maxPlayers = 16
    var priceText = ""
    var zaloURL = ""
    var ballType = ""
    var visibility = "public"
    var requiresPrepayment = false
    var deadlineHours = 24
    var bankCode = ""
    var bankAccountNumber = ""
    var bankAccountName = ""

    var busy = false
    var errorText: String?
    var activeRegCount = 0
    var paidClaimCount = 0
    var loadedPrefill = false

    private let repo = SocialOrganizerRepository()

    init(existing: SocialEvent?, clubID: UUID?) {
        self.existing = existing
        self.clubID = clubID ?? existing?.clubID
    }

    var isEdit: Bool { existing != nil }
    var priceVnd: Int { Int(priceText.replacingOccurrences(of: ".", with: "").replacingOccurrences(of: ",", with: "")) ?? 0 }
    /// Web khoá form khi sự kiện đã bắt đầu hoặc đã huỷ.
    var locked: Bool {
        guard let e = existing else { return false }
        if e.status == "cancelled" { return true }
        if let start = e.startDate, start <= Date() { return true }
        return false
    }
    /// Giá bị khoá khi đã có người báo chuyển khoản (khớp web).
    var priceLocked: Bool { isEdit && paidClaimCount > 0 }

    var valid: Bool {
        title.trimmingCharacters(in: .whitespaces).count >= 3
            && courtCount >= 1 && maxPlayers >= 4
            && endTime > startTime
            && (priceVnd == 0 || (!bankCode.isEmpty && bankAccountNumber.count >= 4 && bankAccountName.count >= 2))
            && (!isEdit ? clubID != nil : true)
            && maxPlayers >= activeRegCount
    }

    @MainActor func prefill() async {
        guard let e = existing, !loadedPrefill else { return }
        title = e.titleVi
        descriptionText = e.descriptionVi ?? ""
        if let start = e.startDate {
            date = start; startTime = start
            if let endStr = e.endAt, let end = SocialDate.parse(endStr) { endTime = end }
        }
        locationText = e.locationText ?? ""
        courtCount = e.courtCount ?? 2
        maxPlayers = e.maxPlayers ?? 16
        priceText = (e.priceVnd ?? 0) > 0 ? "\(e.priceVnd!)" : ""
        zaloURL = e.zaloGroupURL ?? ""
        ballType = e.ballType ?? ""
        visibility = e.visibility ?? "public"
        requiresPrepayment = e.requiresPrepayment ?? false
        deadlineHours = e.prepaymentDeadlineHours ?? 24
        if (e.priceVnd ?? 0) > 0, let cfg = await repo.paymentConfig(eventID: e.id) {
            bankCode = cfg.bankCode ?? ""
            bankAccountNumber = cfg.bankAccountNumber ?? ""
            bankAccountName = cfg.bankAccountName ?? ""
        }
        let regs = (try? await repo.registrations(eventID: e.id)) ?? []
        activeRegCount = regs.count
        paidClaimCount = await repo.paymentOrders(eventID: e.id).filter { $0.playerClaimedPaid == true }.count
        loadedPrefill = true
    }

    private func composeIso(_ day: Date, _ time: Date) -> String {
        let cal = Calendar.current
        let t = cal.dateComponents([.hour, .minute], from: time)
        let combined = cal.date(bySettingHour: t.hour ?? 0, minute: t.minute ?? 0, second: 0, of: day) ?? day
        return ISO8601DateFormatter().string(from: combined)
    }

    private var paymentPayload: SocialOrganizerRepository.PaymentPayload? {
        guard priceVnd > 0 else { return nil }
        return .init(bank_code: bankCode,
                     bank_account_number: bankAccountNumber.trimmingCharacters(in: .whitespaces),
                     bank_account_name: bankAccountName.trimmingCharacters(in: .whitespaces))
    }

    /// Tạo mới qua RPC atomic. Trả về true khi thành công.
    @MainActor func create(publish: Bool) async -> Bool {
        guard let clubID else { errorText = "Thiếu CLB."; return false }
        busy = true; errorText = nil
        defer { busy = false }
        var slug = clubSlugify(title)
        if slug.count < 3 { slug = clubSlugify("\(title)-\(Int(Date().timeIntervalSince1970))") }
        if await repo.slugTaken(slug) {
            slug = "\(slug)-\(Int(Date().timeIntervalSince1970) % 100000)"
        }
        let payload = SocialOrganizerRepository.EventPayload(
            club_id: clubID.uuidString.lowercased(),
            slug: slug,
            title_vi: title.trimmingCharacters(in: .whitespaces),
            description_vi: descriptionText.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty,
            start_at: composeIso(date, startTime),
            end_at: composeIso(date, endTime),
            location_text: locationText.trimmingCharacters(in: .whitespaces).nonEmpty,
            court_count: courtCount,
            max_players: maxPlayers,
            price_vnd: priceVnd,
            zalo_group_url: zaloURL.trimmingCharacters(in: .whitespaces).nonEmpty,
            ball_type: ballType.trimmingCharacters(in: .whitespaces).nonEmpty,
            free_perks: nil,
            status: publish ? "published" : "draft",
            visibility: visibility,
            requires_prepayment: priceVnd > 0 ? requiresPrepayment : false,
            prepayment_deadline_hours: deadlineHours,
            slots: [])
        do {
            try await repo.createEvent(payload, payment: paymentPayload)
            Haptics.success()
            return true
        } catch {
            errorText = "Không tạo được: \(error.localizedDescription)"
            return false
        }
    }

    @MainActor func save() async -> Bool {
        guard let e = existing else { return false }
        busy = true; errorText = nil
        defer { busy = false }
        let patch = SocialOrganizerRepository.EventPatch(
            title_vi: title.trimmingCharacters(in: .whitespaces),
            description_vi: descriptionText.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty,
            start_at: composeIso(date, startTime),
            end_at: composeIso(date, endTime),
            location_text: locationText.trimmingCharacters(in: .whitespaces).nonEmpty,
            court_count: courtCount,
            max_players: maxPlayers,
            zalo_group_url: zaloURL.trimmingCharacters(in: .whitespaces).nonEmpty,
            visibility: visibility,
            price_vnd: priceLocked ? (e.priceVnd ?? 0) : priceVnd,
            requires_prepayment: priceVnd > 0 ? requiresPrepayment : false,
            prepayment_deadline_hours: deadlineHours)
        do {
            try await repo.updateEvent(id: e.id, patch: patch, payment: paymentPayload)
            Haptics.success()
            return true
        } catch {
            errorText = "Không lưu được: \(error.localizedDescription)"
            return false
        }
    }

    @MainActor func cancelEvent(reason: String) async -> Bool {
        guard let e = existing else { return false }
        busy = true; errorText = nil
        defer { busy = false }
        do {
            try await repo.cancelEvent(id: e.id, reason: reason.nonEmpty)
            Haptics.success()
            return true
        } catch {
            errorText = "Không huỷ được: \(error.localizedDescription)"
            return false
        }
    }
}

// MARK: Form fields (dùng chung tạo + sửa)

private struct SocialEventFormFields: View {
    @Bindable var model: SocialEventFormModel

    var body: some View {
        Section("Thông tin") {
            TextField("Tên sự kiện", text: $model.title)
            TextField("Mô tả (tuỳ chọn)", text: $model.descriptionText, axis: .vertical).lineLimit(2...5)
            DatePicker("Ngày", selection: $model.date, displayedComponents: .date)
            DatePicker("Bắt đầu", selection: $model.startTime, displayedComponents: .hourAndMinute)
            DatePicker("Kết thúc", selection: $model.endTime, displayedComponents: .hourAndMinute)
            TextField("Địa điểm", text: $model.locationText)
        }
        Section("Quy mô") {
            Stepper("Số sân: \(model.courtCount)", value: $model.courtCount, in: 1...30)
            Stepper("Tối đa: \(model.maxPlayers) người", value: $model.maxPlayers, in: 4...200, step: 2)
            if model.isEdit && model.activeRegCount > 0 {
                Text("Đang có \(model.activeRegCount) đăng ký — không giảm dưới số này.")
                    .font(TLFont.sans(12)).foregroundStyle(TLColor.fg3)
            }
            Picker("Hiển thị", selection: $model.visibility) {
                Text("Công khai").tag("public")
                Text("Chỉ CLB").tag("club_only")
            }
        }
        Section("Khác") {
            TextField("Link nhóm Zalo (tuỳ chọn)", text: $model.zaloURL).keyboardType(.URL).autocapitalization(.none)
            TextField("Loại bóng (tuỳ chọn)", text: $model.ballType)
        }
        Section("Phí tham gia") {
            TextField("Giá vé (VNĐ, 0 = miễn phí)", text: $model.priceText)
                .keyboardType(.numberPad)
                .disabled(model.priceLocked)
            if model.priceLocked {
                Text("Đã có người báo chuyển khoản — không đổi được giá.")
                    .font(TLFont.sans(12)).foregroundStyle(.orange)
            }
            if model.priceVnd > 0 {
                Picker("Ngân hàng", selection: $model.bankCode) {
                    Text("Chọn ngân hàng").tag("")
                    ForEach(VNBank.all) { b in Text(b.shortName).tag(b.code) }
                }
                TextField("Số tài khoản", text: $model.bankAccountNumber).keyboardType(.numberPad)
                TextField("Tên chủ tài khoản", text: $model.bankAccountName).autocapitalization(.allCharacters)
                Toggle("Bắt buộc trả trước", isOn: $model.requiresPrepayment)
                if model.requiresPrepayment {
                    Stepper("Hạn trả: \(model.deadlineHours)h sau đăng ký", value: $model.deadlineHours, in: 1...168)
                }
            }
        }
        if let err = model.errorText {
            Section { Text(err).font(TLFont.sans(13)).foregroundStyle(.red) }
        }
    }
}

// MARK: Tạo mới

struct CreateSocialEventView: View {
    @State private var model: SocialEventFormModel
    @Environment(\.dismiss) private var dismiss
    var onCreated: (() -> Void)? = nil

    init(clubID: UUID, onCreated: (() -> Void)? = nil) {
        _model = State(initialValue: SocialEventFormModel(existing: nil, clubID: clubID))
        self.onCreated = onCreated
    }

    var body: some View {
        NavigationStack {
            Form {
                SocialEventFormFields(model: model)
                Section {
                    Button {
                        Task { if await model.create(publish: true) { onCreated?(); dismiss() } }
                    } label: {
                        HStack {
                            if model.busy { ProgressView().controlSize(.small) }
                            Text("Đăng sự kiện").frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(!model.valid || model.busy)
                    Button("Lưu nháp") {
                        Task { if await model.create(publish: false) { onCreated?(); dismiss() } }
                    }
                    .disabled(!model.valid || model.busy)
                }
            }
            .navigationTitle("Mở buổi chơi")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Huỷ") { dismiss() } }
            }
        }
    }
}

// MARK: Sửa + huỷ

struct EditSocialEventView: View {
    @State private var model: SocialEventFormModel
    @State private var showCancelSheet = false
    @State private var saved = false
    @Environment(\.dismiss) private var dismiss

    init(event: SocialEvent) {
        _model = State(initialValue: SocialEventFormModel(existing: event, clubID: nil))
    }

    var body: some View {
        Form {
            if model.locked {
                Section {
                    Text(model.existing?.status == "cancelled"
                         ? "Sự kiện đã huỷ — chỉ xem."
                         : "Sự kiện đã bắt đầu — chỉ xem.")
                        .font(TLFont.sans(13)).foregroundStyle(.orange)
                }
            }
            SocialEventFormFields(model: model)
                .disabled(model.locked)
            if saved {
                Section { Text("Đã lưu thay đổi.").font(TLFont.sans(13)).foregroundStyle(TLColor.accentText) }
            }
            if !model.locked {
                Section {
                    Button {
                        Task {
                            if await model.save() {
                                saved = true
                                try? await Task.sleep(for: .seconds(1.5))
                                saved = false
                            }
                        }
                    } label: {
                        HStack {
                            if model.busy { ProgressView().controlSize(.small) }
                            Text("Lưu thay đổi").frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(!model.valid || model.busy)
                }
                Section {
                    Button("Huỷ sự kiện…", role: .destructive) { showCancelSheet = true }
                }
            }
        }
        .navigationTitle("Sửa sự kiện")
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.prefill() }
        .sheet(isPresented: $showCancelSheet) {
            CancelEventSheet(model: model) { dismiss() }
        }
    }
}

/// Huỷ sự kiện — gõ đúng tên để xác nhận (khớp web).
private struct CancelEventSheet: View {
    let model: SocialEventFormModel
    let onCancelled: () -> Void
    @State private var typed = ""
    @State private var reason = ""
    @Environment(\.dismiss) private var dismiss

    private var match: Bool {
        typed.trimmingCharacters(in: .whitespaces) == (model.existing?.titleVi ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Huỷ sự kiện sẽ huỷ toàn bộ đăng ký và không hoàn tác được.")
                        .font(TLFont.sans(13)).foregroundStyle(.red)
                }
                Section("Gõ đúng tên sự kiện để xác nhận") {
                    Text(model.existing?.titleVi ?? "").font(TLFont.sans(13, .semibold))
                    TextField("Tên sự kiện", text: $typed)
                }
                Section("Lý do (tuỳ chọn, gửi tới người đăng ký)") {
                    TextField("Lý do huỷ…", text: $reason, axis: .vertical).lineLimit(2...4)
                }
                if let err = model.errorText {
                    Text(err).font(TLFont.sans(13)).foregroundStyle(.red)
                }
                Section {
                    Button("Huỷ sự kiện", role: .destructive) {
                        Task {
                            if await model.cancelEvent(reason: reason) { dismiss(); onCancelled() }
                        }
                    }
                    .disabled(!match || model.busy)
                }
            }
            .navigationTitle("Huỷ sự kiện")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Đóng") { dismiss() } }
            }
        }
    }
}
