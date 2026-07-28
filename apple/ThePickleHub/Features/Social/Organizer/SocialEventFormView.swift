import SwiftUI

// ============================================================================
// Tạo + Sửa sự kiện giao lưu (BTC). Port web CreateSocialEvent (RPC atomic
// create_social_event_with_payment) + EditSocialEvent (patch, KHÔNG đụng
// slots) + hủy (RPC cancel_social_event, gõ tên xác nhận).
// ponytail: chưa có SlotManager (nhóm đăng ký) — thêm khi Cuong cần; web vẫn đầy đủ.
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
    var freePerks: [String] = []
    var repeatWeeks = 0
    var customPerkText = ""

    // Resume lô lặp-tuần (parity web UX-05 O4): fail giữa chừng thì lần bấm
    // sau tiếp tục từ tuần thiếu với CÙNG slug gốc — không re-dedup slug,
    // không tạo lại các tuần đã có.
    private var batchResumeIndex = 0
    private var resumeSlugBase: String?

    static let perkPresets = ["Nước", "Hoa quả", "Khăn", "Ăn nhẹ"]

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
    /// Web khoá form khi sự kiện đã bắt đầu hoặc đã hủy.
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

    /// Toàn bộ phần gán ĐỒNG BỘ của prefill — tách riêng để test được offline.
    /// Gate T4b: mọi key của EventPatch phải có dòng gán ở đây, vì save() ghi
    /// nguyên form state — field không hydrate sẽ ghi đè giá trị thật bằng default.
    func applyExisting(_ e: SocialEvent) {
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
        freePerks = e.freePerks ?? []
    }

    @MainActor func prefill() async {
        guard let e = existing, !loadedPrefill else { return }
        applyExisting(e)
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

    /// Slug tất định cho lô lặp-tuần — parity web `${finalSlug}-tuan${i+1}`
    /// (CreateSocialEvent.tsx). KHÔNG dùng timestamp: retry phải sinh lại đúng
    /// slug cũ để resume thay vì đẻ bản sao (pre-mortem T4c).
    static func iterSlug(_ base: String, week i: Int) -> String {
        i == 0 ? base : "\(base)-tuan\(i + 1)"
    }

    private func payload(slug: String, weekOffset: Int, publish: Bool, clubID: UUID) -> SocialOrganizerRepository.EventPayload {
        let day = Calendar.current.date(byAdding: .day, value: 7 * weekOffset, to: date) ?? date
        return SocialOrganizerRepository.EventPayload(
            club_id: clubID.uuidString.lowercased(),
            slug: slug,
            title_vi: title.trimmingCharacters(in: .whitespaces),
            description_vi: descriptionText.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty,
            start_at: composeIso(day, startTime),
            end_at: composeIso(day, endTime),
            location_text: locationText.trimmingCharacters(in: .whitespaces).nonEmpty,
            court_count: courtCount,
            max_players: maxPlayers,
            price_vnd: priceVnd,
            zalo_group_url: zaloURL.trimmingCharacters(in: .whitespaces).nonEmpty,
            ball_type: ballType.trimmingCharacters(in: .whitespaces).nonEmpty,
            free_perks: freePerks.isEmpty ? nil : freePerks,
            status: publish ? "published" : "draft",
            visibility: visibility,
            requires_prepayment: priceVnd > 0 ? requiresPrepayment : false,
            prepayment_deadline_hours: deadlineHours,
            slots: [])
    }

    /// Tạo mới qua RPC atomic; `repeatWeeks` > 0 thì tạo thêm N bản sao +7
    /// ngày/tuần. Fail giữa lô → giữ form, lần bấm sau resume từ tuần thiếu.
    @MainActor func create(publish: Bool) async -> Bool {
        guard let clubID else { errorText = String(localized: "Thiếu CLB."); return false }
        busy = true; errorText = nil
        defer { busy = false }

        let base: String
        if let resume = resumeSlugBase {
            base = resume
        } else {
            var slug = clubSlugify(title)
            if slug.count < 3 { slug = clubSlugify("\(title)-\(Int(Date().timeIntervalSince1970))") }
            if await repo.slugTaken(slug) {
                slug = "\(slug)-\(Int(Date().timeIntervalSince1970) % 100000)"
            }
            base = slug
        }

        let repeatCount = max(0, min(12, repeatWeeks))
        for i in batchResumeIndex...repeatCount {
            let slug = Self.iterSlug(base, week: i)
            do {
                try await repo.createEvent(payload(slug: slug, weekOffset: i, publish: publish, clubID: clubID),
                                           payment: paymentPayload)
            } catch {
                resumeSlugBase = base
                batchResumeIndex = i
                errorText = String(localized: "Đã tạo \(i)/\(repeatCount + 1) sự kiện — lỗi ở tuần \(i + 1): \(error.localizedDescription). Bấm lại để tiếp tục từ chỗ dở.")
                return false
            }
        }
        resumeSlugBase = nil
        batchResumeIndex = 0
        Haptics.success()
        return true
    }

    /// Patch dựng từ form state — tách riêng cho SocialEventFormGateTests.
    func buildPatch(for e: SocialEvent) -> SocialOrganizerRepository.EventPatch {
        SocialOrganizerRepository.EventPatch(
            title_vi: title.trimmingCharacters(in: .whitespaces),
            description_vi: descriptionText.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty,
            start_at: composeIso(date, startTime),
            end_at: composeIso(date, endTime),
            location_text: locationText.trimmingCharacters(in: .whitespaces).nonEmpty,
            court_count: courtCount,
            max_players: maxPlayers,
            zalo_group_url: zaloURL.trimmingCharacters(in: .whitespaces).nonEmpty,
            ball_type: ballType.trimmingCharacters(in: .whitespaces).nonEmpty,
            visibility: visibility,
            price_vnd: priceLocked ? (e.priceVnd ?? 0) : priceVnd,
            requires_prepayment: priceVnd > 0 ? requiresPrepayment : false,
            prepayment_deadline_hours: deadlineHours,
            free_perks: freePerks)
    }

    @MainActor func save() async -> Bool {
        guard let e = existing else { return false }
        busy = true; errorText = nil
        defer { busy = false }
        let patch = buildPatch(for: e)
        do {
            try await repo.updateEvent(id: e.id, patch: patch, payment: paymentPayload)
            Haptics.success()
            return true
        } catch {
            errorText = String(localized: "Không lưu được: \(error.localizedDescription)")
            return false
        }
    }

    // ── UX-04 autosave snapshot (parity web draft:social:<slug>; native scope
    // theo clubID). Chỉ dùng cho flow TẠO MỚI — edit đã có dữ liệu trên DB.
    // Ranh giới D3/CodeQL: bankCode / bankAccountNumber / bankAccountName
    // KHÔNG có trong snapshot — nhập lại sau khi khôi phục, giống web.
    struct Draft: Codable, Equatable {
        var title: String
        var descriptionText: String
        var date: Date
        var startTime: Date
        var endTime: Date
        var locationText: String
        var courtCount: Int
        var maxPlayers: Int
        var priceText: String
        var zaloURL: String
        var ballType: String
        var visibility: String
        var requiresPrepayment: Bool
        var deadlineHours: Int
        // Optional: draft đã lưu từ bản cũ thiếu key vẫn decode được
        var freePerks: [String]?
        var repeatWeeks: Int?
    }

    var draftSnapshot: Draft {
        .init(title: title, descriptionText: descriptionText, date: date,
              startTime: startTime, endTime: endTime, locationText: locationText,
              courtCount: courtCount, maxPlayers: maxPlayers, priceText: priceText,
              zaloURL: zaloURL, ballType: ballType, visibility: visibility,
              requiresPrepayment: requiresPrepayment, deadlineHours: deadlineHours,
              freePerks: freePerks, repeatWeeks: repeatWeeks)
    }

    func apply(_ d: Draft) {
        title = d.title
        descriptionText = d.descriptionText
        date = d.date
        startTime = d.startTime
        endTime = d.endTime
        locationText = d.locationText
        courtCount = max(1, d.courtCount)
        maxPlayers = max(4, d.maxPlayers)
        priceText = d.priceText
        zaloURL = d.zaloURL
        ballType = d.ballType
        if ["public", "club_only"].contains(d.visibility) { visibility = d.visibility }
        requiresPrepayment = d.requiresPrepayment
        deadlineHours = min(max(1, d.deadlineHours), 168)
        freePerks = d.freePerks ?? []
        repeatWeeks = min(max(0, d.repeatWeeks ?? 0), 12)
    }

    func resetForm() {
        title = ""; descriptionText = ""
        date = Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date()
        startTime = Calendar.current.date(bySettingHour: 18, minute: 0, second: 0, of: Date()) ?? Date()
        endTime = Calendar.current.date(bySettingHour: 21, minute: 0, second: 0, of: Date()) ?? Date()
        locationText = ""; courtCount = 2; maxPlayers = 16; priceText = ""
        zaloURL = ""; ballType = ""; visibility = "public"
        requiresPrepayment = false; deadlineHours = 24
        bankCode = ""; bankAccountNumber = ""; bankAccountName = ""
        freePerks = []; repeatWeeks = 0
        resumeSlugBase = nil; batchResumeIndex = 0
        errorText = nil
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
            errorText = String(localized: "Không hủy được: \(error.localizedDescription)")
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
        Section("Quyền lợi miễn phí") {
            ForEach(SocialEventFormModel.perkPresets, id: \.self) { perk in
                Toggle(perk, isOn: Binding(
                    get: { model.freePerks.contains(perk) },
                    set: { on in
                        if on { if !model.freePerks.contains(perk) { model.freePerks.append(perk) } }
                        else { model.freePerks.removeAll { $0 == perk } }
                    }
                ))
            }
            // Perk tự nhập (ngoài preset) — hàng có nút xóa, không phải chuỗi phẩy
            ForEach(model.freePerks.filter { !SocialEventFormModel.perkPresets.contains($0) }, id: \.self) { perk in
                HStack {
                    Text(perk)
                    Spacer()
                    Button {
                        model.freePerks.removeAll { $0 == perk }
                    } label: {
                        Image(systemName: "xmark.circle.fill").foregroundStyle(TLColor.fg3)
                    }
                    .accessibilityLabel("Xóa \(perk)")
                }
            }
            HStack {
                TextField("Thêm quyền lợi khác", text: $model.customPerkText)
                Button("Thêm") {
                    let v = model.customPerkText.trimmingCharacters(in: .whitespaces)
                    guard !v.isEmpty, !model.freePerks.contains(v) else { return }
                    model.freePerks.append(v)
                    model.customPerkText = ""
                }
                .disabled(model.customPerkText.trimmingCharacters(in: .whitespaces).isEmpty)
            }
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
    @Environment(\.scenePhase) private var scenePhase
    var onCreated: (() -> Void)? = nil

    // UX-04 — draft device-local theo CLB (web scope theo slug, native theo id).
    @State private var draft: DraftStore<SocialEventFormModel.Draft>
    @State private var restoredDraft = false
    @State private var restoreApplied = false

    init(clubID: UUID, onCreated: (() -> Void)? = nil) {
        _model = State(initialValue: SocialEventFormModel(existing: nil, clubID: clubID))
        _draft = State(initialValue: DraftStore(flow: "social", scope: clubID.uuidString.lowercased()))
        self.onCreated = onCreated
    }

    var body: some View {
        NavigationStack {
            Form {
                if restoredDraft {
                    Section {
                        DraftRestoredBanner {
                            model.resetForm()
                            draft.clear(current: model.draftSnapshot)
                        }
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                    }
                }
                SocialEventFormFields(model: model)
                Section("Lặp lại hằng tuần") {
                    Stepper(model.repeatWeeks == 0 ? "Không lặp" : "Lặp thêm \(model.repeatWeeks) tuần",
                            value: $model.repeatWeeks, in: 0...12)
                    if model.repeatWeeks > 0 {
                        Text("Sẽ tạo \(model.repeatWeeks + 1) sự kiện — mỗi tuần một buổi, cùng giờ, cùng thông tin.")
                            .font(TLFont.sans(12)).foregroundStyle(TLColor.fg3)
                    }
                }
                Section {
                    Button {
                        Task {
                            if await model.create(publish: true) {
                                draft.clear(current: model.draftSnapshot)
                                onCreated?(); dismiss()
                            }
                        }
                    } label: {
                        HStack {
                            if model.busy { ProgressView().controlSize(.small) }
                            Text("Đăng sự kiện").frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(!model.valid || model.busy)
                    Button("Lưu nháp") {
                        Task {
                            if await model.create(publish: false) {
                                draft.clear(current: model.draftSnapshot)
                                onCreated?(); dismiss()
                            }
                        }
                    }
                    .disabled(!model.valid || model.busy)
                } footer: {
                    DraftSaveStatusLine(savedAt: draft.lastSavedAt)
                }
            }
            .navigationTitle("Mở buổi chơi")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Hủy") { dismiss() } }
            }
            .onAppear {
                guard !restoreApplied else { return }
                restoreApplied = true
                if let d = draft.restore() {
                    model.apply(d)
                    restoredDraft = true
                }
            }
            .onChange(of: model.draftSnapshot) { _, snap in draft.save(snap) }
            .onChange(of: scenePhase) { _, phase in
                if phase == .background { draft.flush(model.draftSnapshot) }
            }
        }
    }
}

// MARK: Sửa + hủy

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
                         ? "Sự kiện đã hủy — chỉ xem."
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
                    Button("Hủy sự kiện…", role: .destructive) { showCancelSheet = true }
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

/// Hủy sự kiện — gõ đúng tên để xác nhận (khớp web).
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
                    Text("Hủy sự kiện sẽ hủy toàn bộ đăng ký và không hoàn tác được.")
                        .font(TLFont.sans(13)).foregroundStyle(.red)
                }
                Section("Gõ đúng tên sự kiện để xác nhận") {
                    Text(model.existing?.titleVi ?? "").font(TLFont.sans(13, .semibold))
                    TextField("Tên sự kiện", text: $typed)
                }
                Section("Lý do (tuỳ chọn, gửi tới người đăng ký)") {
                    TextField("Lý do hủy…", text: $reason, axis: .vertical).lineLimit(2...4)
                }
                if let err = model.errorText {
                    Text(err).font(TLFont.sans(13)).foregroundStyle(.red)
                }
                Section {
                    Button("Hủy sự kiện", role: .destructive) {
                        Task {
                            if await model.cancelEvent(reason: reason) { dismiss(); onCancelled() }
                        }
                    }
                    .disabled(!match || model.busy)
                }
            }
            .navigationTitle("Hủy sự kiện")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Đóng") { dismiss() } }
            }
        }
    }
}
