import SwiftUI

// ============================================================================
// SocialRosterManageView — BTC quản lý danh sách đăng ký một sự kiện.
// Port web /social/:slug/danh-sach: check-in, đánh dấu đã trả, vắng mặt,
// xoá, ghi chú, thêm tay (edge fn add-registration-direct mode=manual).
// ============================================================================

@Observable
final class SocialRosterModel {
    let event: SocialEvent
    var regs: [EventRegistration] = []
    var orders: [UUID: EventPaymentOrder] = [:]
    var loaded = false
    var busyID: UUID?
    var errorText: String?
    private let repo = SocialOrganizerRepository()

    init(event: SocialEvent) { self.event = event }

    var registered: Int { regs.count }
    var paid: Int { regs.filter { $0.paymentStatus == "paid" }.count }
    var checkedIn: Int { regs.filter { $0.status == "checked_in" }.count }
    var isPaidEvent: Bool { (event.priceVnd ?? 0) > 0 }

    @MainActor func load() async {
        regs = (try? await repo.registrations(eventID: event.id)) ?? []
        if isPaidEvent {
            let list = await repo.paymentOrders(eventID: event.id)
            orders = Dictionary(list.map { ($0.registrationID, $0) }, uniquingKeysWith: { a, _ in a })
        }
        loaded = true
    }

    @MainActor private func run(_ id: UUID, _ op: () async throws -> Void) async {
        busyID = id; errorText = nil
        do { try await op() } catch { errorText = error.localizedDescription }
        await load(); busyID = nil
    }

    @MainActor func toggleCheckIn(_ r: EventRegistration) async {
        await run(r.id) {
            try await repo.setRegistrationStatus(id: r.id, status: r.status == "checked_in" ? "registered" : "checked_in")
        }
    }
    @MainActor func togglePaid(_ r: EventRegistration) async {
        await run(r.id) { try await repo.setRegistrationPaid(id: r.id, paid: r.paymentStatus != "paid") }
    }
    @MainActor func markNoShow(_ r: EventRegistration) async {
        await run(r.id) { try await repo.setRegistrationStatus(id: r.id, status: "no_show") }
    }
    @MainActor func cancel(_ r: EventRegistration) async {
        await run(r.id) { try await repo.setRegistrationStatus(id: r.id, status: "cancelled") }
    }
    @MainActor func saveNotes(_ r: EventRegistration, notes: String) async {
        await run(r.id) {
            try await repo.setRegistrationNotes(id: r.id, notes: notes.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty)
        }
    }
}

struct SocialRosterManageView: View {
    @State private var model: SocialRosterModel
    @State private var confirmCancel: EventRegistration?
    @State private var confirmNoShow: EventRegistration?
    @State private var notesTarget: EventRegistration?
    @State private var showManualAdd = false

    init(event: SocialEvent) { _model = State(initialValue: SocialRosterModel(event: event)) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                statsRow
                if let err = model.errorText {
                    Text(err).font(TLFont.sans(13)).foregroundStyle(.red)
                }
                if model.loaded && model.regs.isEmpty {
                    TLEmptyState(icon: "person.3", title: "Chưa có đăng ký",
                                 subtitle: "Chia sẻ trang sự kiện để nhận đăng ký, hoặc thêm người chơi thủ công.")
                        .frame(maxWidth: .infinity)
                }
                ForEach(model.regs) { r in
                    rosterRow(r)
                }
            }
            .padding(16)
        }
        .background(TLColor.bg)
        .navigationTitle("Danh sách đăng ký")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showManualAdd = true } label: { Image(systemName: "person.badge.plus") }
            }
        }
        .task { await model.load() }
        .refreshable { await model.load() }
        .sheet(isPresented: $showManualAdd) {
            ManualAddRegistrationSheet(event: model.event) {
                Task { await model.load() }
            }
        }
        .sheet(item: $notesTarget) { r in
            RosterNotesSheet(registration: r) { text in
                Task { await model.saveNotes(r, notes: text) }
            }
        }
        .confirmationDialog("Xoá \(confirmCancel?.displayName ?? "") khỏi danh sách?",
                            isPresented: Binding(get: { confirmCancel != nil }, set: { if !$0 { confirmCancel = nil } }),
                            titleVisibility: .visible) {
            Button("Xoá đăng ký", role: .destructive) {
                if let r = confirmCancel { Task { await model.cancel(r) } }
                confirmCancel = nil
            }
        }
        .confirmationDialog("Đánh dấu \(confirmNoShow?.displayName ?? "") vắng mặt?",
                            isPresented: Binding(get: { confirmNoShow != nil }, set: { if !$0 { confirmNoShow = nil } }),
                            titleVisibility: .visible) {
            Button("Vắng mặt", role: .destructive) {
                if let r = confirmNoShow { Task { await model.markNoShow(r) } }
                confirmNoShow = nil
            }
        }
    }

    private var statsRow: some View {
        HStack(spacing: 10) {
            statBox("\(model.registered)", "Đăng ký")
            if model.isPaidEvent { statBox("\(model.paid)", "Đã trả") }
            statBox("\(model.checkedIn)", "Check-in")
        }
    }

    private func statBox(_ value: String, _ label: String) -> some View {
        VStack(spacing: 4) {
            Text(value).font(TLFont.mono(22, .bold)).foregroundStyle(TLColor.fg)
            Text(label).font(TLFont.mono(10, .semibold)).tracking(0.8)
                .textCase(.uppercase).foregroundStyle(TLColor.fg3)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 12)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(TLColor.border, lineWidth: 1))
    }

    private func rosterRow(_ r: EventRegistration) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 8) {
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(r.displayName).font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.fg)
                        if r.registrationSource == "manual" {
                            sourceBadge("BTC thêm")
                        } else if r.registrationSource == "proxy" {
                            sourceBadge("Đăng ký hộ")
                        }
                    }
                    HStack(spacing: 8) {
                        if let phone = r.phone?.nonEmpty {
                            Text(phone).font(TLFont.mono(11)).foregroundStyle(TLColor.fg3)
                        }
                        if let lv = r.selfRatedLevel {
                            Text(String(format: "%.1f", lv)).font(TLFont.mono(11)).foregroundStyle(TLColor.fg3)
                        }
                    }
                }
                Spacer()
                if model.busyID == r.id {
                    ProgressView().controlSize(.small)
                } else {
                    Menu {
                        Button {
                            Task { await model.toggleCheckIn(r) }
                        } label: {
                            Label(r.status == "checked_in" ? "Bỏ check-in" : "Check-in",
                                  systemImage: r.status == "checked_in" ? "arrow.uturn.backward" : "checkmark.circle")
                        }
                        if model.isPaidEvent {
                            Button {
                                Task { await model.togglePaid(r) }
                            } label: {
                                Label(r.paymentStatus == "paid" ? "Đánh dấu chưa trả" : "Đánh dấu đã trả",
                                      systemImage: r.paymentStatus == "paid" ? "xmark.circle" : "banknote")
                            }
                        }
                        Button { notesTarget = r } label: { Label("Ghi chú", systemImage: "note.text") }
                        Divider()
                        Button(role: .destructive) { confirmNoShow = r } label: {
                            Label("Vắng mặt", systemImage: "person.fill.xmark")
                        }
                        Button(role: .destructive) { confirmCancel = r } label: {
                            Label("Xoá đăng ký", systemImage: "trash")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle").font(.system(size: 18))
                            .foregroundStyle(TLColor.fg3).frame(width: 32, height: 32)
                    }
                }
            }

            HStack(spacing: 6) {
                statusChip(r)
                if model.isPaidEvent { paymentChip(r) }
                Spacer()
            }

            if let notes = r.notes?.nonEmpty {
                Text(notes).font(TLFont.sans(12)).foregroundStyle(TLColor.fg3).italic()
            }
        }
        .padding(12)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(TLColor.border, lineWidth: 1))
    }

    private func sourceBadge(_ text: String) -> some View {
        Text(text).font(TLFont.mono(9, .semibold)).tracking(0.5).textCase(.uppercase)
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(TLColor.surface2, in: Capsule())
            .foregroundStyle(TLColor.fg3)
    }

    private func statusChip(_ r: EventRegistration) -> some View {
        let (text, color): (String, Color) = switch r.status {
        case "checked_in": ("Đã check-in", TLColor.accentText)
        case "no_show": ("Vắng mặt", .red)
        default: ("Đã đăng ký", TLColor.fg3)
        }
        return Text(text).font(TLFont.mono(10, .semibold)).tracking(0.5)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(color.opacity(0.12), in: Capsule())
            .foregroundStyle(color)
    }

    private func paymentChip(_ r: EventRegistration) -> some View {
        let claimed = model.orders[r.id]?.playerClaimedPaid == true
        let (text, color): (String, Color) = r.paymentStatus == "paid"
            ? ("Đã trả", TLColor.accentText)
            : claimed ? ("Báo đã CK", .orange) : ("Chưa trả", TLColor.fg3)
        return Text(text).font(TLFont.mono(10, .semibold)).tracking(0.5)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(color.opacity(0.12), in: Capsule())
            .foregroundStyle(color)
    }
}

// MARK: Ghi chú

private struct RosterNotesSheet: View {
    let registration: EventRegistration
    let onSave: (String) -> Void
    @State private var text: String
    @Environment(\.dismiss) private var dismiss

    init(registration: EventRegistration, onSave: @escaping (String) -> Void) {
        self.registration = registration
        self.onSave = onSave
        _text = State(initialValue: registration.notes ?? "")
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                TextField("Ghi chú về \(registration.displayName)…", text: $text, axis: .vertical)
                    .lineLimit(4...8).padding(12)
                    .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 10))
                Spacer()
            }
            .padding(16)
            .background(TLColor.bg)
            .navigationTitle("Ghi chú")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Huỷ") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lưu") { onSave(text); dismiss() }
                }
            }
        }
        .presentationDetents([.medium])
    }
}

// MARK: Thêm tay (walk-in)

private struct ManualAddRegistrationSheet: View {
    let event: SocialEvent
    let onAdded: () -> Void
    @State private var name = ""
    @State private var phone = ""
    @State private var rating = ""
    @State private var paymentStatus = "unpaid"
    @State private var notes = ""
    @State private var busy = false
    @State private var errorText: String?
    @State private var shareLink: String?
    @Environment(\.dismiss) private var dismiss
    private let repo = SocialOrganizerRepository()

    private var isPaidEvent: Bool { (event.priceVnd ?? 0) > 0 }

    var body: some View {
        NavigationStack {
            Form {
                if let link = shareLink {
                    Section("Đã thêm — gửi link này cho người chơi") {
                        Text(link).font(TLFont.mono(12)).foregroundStyle(TLColor.fg2)
                            .textSelection(.enabled)
                        Button {
                            UIPasteboard.general.string = link
                            Haptics.light()
                        } label: { Label("Sao chép link", systemImage: "doc.on.doc") }
                    }
                } else {
                    Section("Người chơi") {
                        TextField("Tên (bắt buộc)", text: $name)
                        TextField("SĐT (tuỳ chọn, +84…)", text: $phone).keyboardType(.phonePad)
                        TextField("Trình độ tự đánh giá (vd 3.5)", text: $rating).keyboardType(.decimalPad)
                    }
                    if isPaidEvent {
                        Section("Thanh toán ban đầu") {
                            Picker("Trạng thái", selection: $paymentStatus) {
                                Text("Chưa trả").tag("unpaid")
                                Text("Đã báo CK").tag("claimed_paid")
                                Text("Miễn phí").tag("waived")
                            }
                        }
                    }
                    Section("Ghi chú nội bộ (chỉ BTC thấy)") {
                        TextField("Ghi chú…", text: $notes, axis: .vertical).lineLimit(2...4)
                    }
                    if let err = errorText {
                        Text(err).font(TLFont.sans(13)).foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Thêm người chơi")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(shareLink == nil ? "Huỷ" : "Đóng") { dismiss() }
                }
                if shareLink == nil {
                    ToolbarItem(placement: .confirmationAction) {
                        if busy { ProgressView() } else {
                            Button("Thêm") { Task { await add() } }
                                .disabled(name.trimmingCharacters(in: .whitespaces).count < 2)
                        }
                    }
                }
            }
        }
    }

    @MainActor private func add() async {
        busy = true; errorText = nil
        do {
            let url = try await repo.manualAddRegistration(
                eventID: event.id,
                name: name.trimmingCharacters(in: .whitespaces),
                phone: phone.trimmingCharacters(in: .whitespaces).nonEmpty,
                selfRating: Double(rating.replacingOccurrences(of: ",", with: ".")),
                initialPaymentStatus: isPaidEvent ? paymentStatus : "unpaid",
                internalNotes: notes.nonEmpty
            )
            shareLink = url
            Haptics.success()
            onAdded()
        } catch {
            errorText = "Không thêm được: \(error.localizedDescription)"
        }
        busy = false
    }
}
