import SwiftUI

// ============================================================================
// PlayerRegistrationView — người chơi tự quản lý đăng ký qua magic token.
// Port web /dang-ky/:magic_token (PR58/67/69): xem trạng thái, VietQR +
// báo đã chuyển khoản (2 bước), huỷ (kèm điều kiện hoàn tiền), đăng ký lại.
// Mở từ deep link (universal link / thepicklehub://dang-ky/<token>).
// ============================================================================

@Observable
final class PlayerRegistrationModel {
    let token: String
    var info: PlayerRegistrationInfo?
    var loaded = false
    var busy = false
    var errorText: String?
    private let repo = SocialRepository()

    init(token: String) { self.token = token }

    @MainActor func load() async {
        info = try? await repo.registrationByToken(token)
        loaded = true
    }

    @MainActor private func run(_ op: () async throws -> Void) async {
        busy = true; errorText = nil
        do { try await op(); Haptics.success() } catch { errorText = error.localizedDescription }
        await load(); busy = false
    }

    @MainActor func cancel(reason: String) async {
        await run { try await repo.cancelRegistration(token: token, reason: reason.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty) }
    }
    @MainActor func reactivate() async {
        await run { try await repo.reactivateRegistration(token: token) }
    }
    @MainActor func claimPaid() async {
        guard let orderID = info?.paymentOrderID else { return }
        await run { try await repo.markPaymentClaimed(orderID: orderID, token: token) }
    }
}

struct PlayerRegistrationView: View {
    @State private var model: PlayerRegistrationModel
    @State private var showCancelDialog = false
    @State private var cancelReason = ""
    @State private var confirmingClaim = false

    init(token: String) { _model = State(initialValue: PlayerRegistrationModel(token: token)) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if !model.loaded {
                    ProgressView().tint(TLColor.accentText).frame(maxWidth: .infinity).padding(.top, 60)
                } else if let info = model.info {
                    eventCard(info)
                    statusCard(info)
                    if info.eventPriceVnd > 0 { paymentCard(info) }
                    if let err = model.errorText {
                        Text(err).font(TLFont.sans(13)).foregroundStyle(.red)
                    }
                    actions(info)
                } else {
                    TLEmptyState(icon: "ticket", title: "Không tìm thấy đăng ký",
                                 subtitle: "Link không hợp lệ hoặc đã hết hạn. Dùng trang khôi phục đăng ký trên web nếu bạn mất link.")
                        .frame(maxWidth: .infinity).padding(.top, 40)
                }
            }
            .padding(16)
        }
        .background(TLColor.bg)
        .navigationTitle("Đăng ký của tôi")
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.load() }
        .refreshable { await model.load() }
        .sheet(isPresented: $showCancelDialog) {
            cancelSheet
        }
    }

    // MARK: Sự kiện

    private func eventCard(_ info: PlayerRegistrationInfo) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if let start = info.startDate {
                Text(SocialDate.display(start))
                    .font(TLFont.mono(11, .semibold)).tracking(0.6).textCase(.uppercase)
                    .foregroundStyle(TLColor.accentText)
            }
            Text(info.eventTitleVi).font(TLFont.serif(24)).foregroundStyle(TLColor.fg)
                .fixedSize(horizontal: false, vertical: true)
            if let loc = info.eventLocationText?.nonEmpty {
                Label(loc, systemImage: "mappin.and.ellipse")
                    .font(TLFont.sans(13)).foregroundStyle(TLColor.fg2)
            }
            if info.eventStatus == "cancelled" {
                Text("SỰ KIỆN ĐÃ BỊ HUỶ").font(TLFont.mono(11, .bold)).foregroundStyle(TLColor.live)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(TLColor.border, lineWidth: 1))
    }

    // MARK: Trạng thái đăng ký

    private func statusCard(_ info: PlayerRegistrationInfo) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: info.isCancelled ? "xmark.circle.fill" : "checkmark.circle.fill")
                    .foregroundStyle(info.isCancelled ? TLColor.live : TLColor.accentText)
                Text(info.isCancelled ? "Đã huỷ đăng ký"
                     : info.status == "checked_in" ? "Đã check-in" : "Đăng ký thành công")
                    .font(TLFont.sans(16, .semibold)).foregroundStyle(TLColor.fg)
            }
            row("Người chơi", info.displayName)
            if let phone = info.phone?.nonEmpty { row("SĐT", phone) }
            if info.isCancelled, let reason = info.cancelledReason?.nonEmpty {
                row("Lý do huỷ", reason)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(TLColor.border, lineWidth: 1))
    }

    private func row(_ label: String, _ value: String) -> some View {
        HStack(alignment: .top) {
            Text(label).font(TLFont.sans(13)).foregroundStyle(TLColor.fg3).frame(width: 90, alignment: .leading)
            Text(value).font(TLFont.sans(13, .medium)).foregroundStyle(TLColor.fg)
        }
    }

    // MARK: Thanh toán (VietQR + báo đã CK)

    private func paymentCard(_ info: PlayerRegistrationInfo) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("THANH TOÁN").font(TLFont.mono(11, .semibold)).tracking(1).foregroundStyle(TLColor.fg2)
            row("Phí tham gia", "\(info.eventPriceVnd.formatted(.number.grouping(.automatic)))đ")

            switch info.paymentStatus {
            case "paid":
                Label("BTC đã xác nhận thanh toán", systemImage: "checkmark.seal.fill")
                    .font(TLFont.sans(13, .medium)).foregroundStyle(TLColor.accentText)
            case "refunded":
                Label("Đã hoàn tiền", systemImage: "arrow.uturn.backward.circle")
                    .font(TLFont.sans(13, .medium)).foregroundStyle(TLColor.fg2)
            default:
                if info.playerClaimedPaid == true {
                    Label("Đã báo chuyển khoản — chờ BTC xác nhận", systemImage: "clock")
                        .font(TLFont.sans(13, .medium)).foregroundStyle(.orange)
                } else if !info.isCancelled {
                    payNow(info)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(TLColor.border, lineWidth: 1))
    }

    @ViewBuilder
    private func payNow(_ info: PlayerRegistrationInfo) -> some View {
        if let bank = info.eventBankCode?.nonEmpty,
           let account = info.eventBankAccountNumber?.nonEmpty,
           let qr = VietQR.imageURL(bankCode: bank, accountNumber: account,
                                    accountName: info.eventBankAccountName ?? "",
                                    amountVnd: info.eventPriceVnd,
                                    memo: info.paymentReferenceCode ?? info.displayName) {
            AsyncImage(url: qr) { img in
                img.resizable().scaledToFit()
            } placeholder: {
                ProgressView().frame(height: 200)
            }
            .frame(maxWidth: 260).frame(maxWidth: .infinity)
            .background(Color.white, in: RoundedRectangle(cornerRadius: 10))

            if let ref = info.paymentReferenceCode?.nonEmpty {
                HStack {
                    Text("Nội dung CK:").font(TLFont.sans(12)).foregroundStyle(TLColor.fg3)
                    Text(ref).font(TLFont.mono(13, .semibold)).foregroundStyle(TLColor.fg)
                    Button {
                        UIPasteboard.general.string = ref
                        Haptics.light()
                    } label: { Image(systemName: "doc.on.doc").font(.system(size: 12)) }
                }
            }
        }
        if info.paymentOrderID != nil {
            if !confirmingClaim {
                Button("Tôi đã chuyển khoản") { confirmingClaim = true }
                    .font(TLFont.sans(14, .semibold))
                    .buttonStyle(.bordered)
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Xác nhận bạn ĐÃ chuyển khoản? BTC sẽ đối chiếu.")
                        .font(TLFont.sans(12)).foregroundStyle(.orange)
                    HStack {
                        Button {
                            Task { await model.claimPaid(); confirmingClaim = false }
                        } label: {
                            HStack {
                                if model.busy { ProgressView().controlSize(.small) }
                                Text("Xác nhận")
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(model.busy)
                        Button("Thôi") { confirmingClaim = false }.buttonStyle(.bordered)
                    }
                    .font(TLFont.sans(13, .semibold))
                }
                .padding(10)
                .background(Color.orange.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
            }
        }
    }

    // MARK: Huỷ / đăng ký lại

    @ViewBuilder
    private func actions(_ info: PlayerRegistrationInfo) -> some View {
        let eventOver = (info.startDate ?? .distantFuture) <= Date() || info.eventStatus == "cancelled"
        if !eventOver {
            if info.isCancelled {
                Button {
                    Task { await model.reactivate() }
                } label: {
                    HStack {
                        if model.busy { ProgressView().controlSize(.small) }
                        Text("Đăng ký lại")
                    }
                    .font(TLFont.sans(15, .semibold)).foregroundStyle(TLColor.accentInk)
                    .frame(maxWidth: .infinity).padding(.vertical, 13)
                    .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.plain)
                .disabled(model.busy)
            } else {
                VStack(spacing: 8) {
                    Text(info.refundEligible
                         ? "Huỷ trước \(info.eventCancellationHours)h — đủ điều kiện hoàn phí (nếu đã trả)."
                         : "Đã quá hạn huỷ \(info.eventCancellationHours)h — huỷ bây giờ sẽ không được hoàn phí.")
                        .font(TLFont.sans(12)).foregroundStyle(info.refundEligible ? TLColor.fg3 : .orange)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Button("Huỷ đăng ký", role: .destructive) { showCancelDialog = true }
                        .font(TLFont.sans(14, .semibold))
                        .frame(maxWidth: .infinity).padding(.vertical, 12)
                        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(TLColor.live.opacity(0.5), lineWidth: 1))
                }
            }
        }
    }

    private var cancelSheet: some View {
        NavigationStack {
            Form {
                Section("Lý do huỷ (tuỳ chọn)") {
                    TextField("Vd: bận việc đột xuất…", text: $cancelReason, axis: .vertical).lineLimit(2...4)
                }
                Section {
                    Button("Xác nhận huỷ đăng ký", role: .destructive) {
                        Task {
                            await model.cancel(reason: cancelReason)
                            showCancelDialog = false
                        }
                    }
                    .disabled(model.busy)
                }
            }
            .navigationTitle("Huỷ đăng ký")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Đóng") { showCancelDialog = false } }
            }
        }
        .presentationDetents([.medium])
    }
}
