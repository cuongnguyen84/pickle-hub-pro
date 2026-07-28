import SwiftUI

/// Đội trưởng nộp lệ phí đội: hiện QR VietQR + số tài khoản BTC. Sau khi chuyển
/// khoản, bấm "Đã chuyển khoản" → team về trạng thái "claimed" (đỏ), chờ BTC xác
/// nhận. QR dựng client-side từ thông tin bank đã lưu (img.vietqr.io).
struct TeamMatchPaymentSheet: View {
    let tournament: TMTournament
    let rosterCount: Int
    let teamName: String
    let status: TMPaymentStatus
    /// Slot đăng ký của đội (0-based) — để áp bậc giảm giá slot sớm. Nil = không giảm.
    let slotIndex: Int?
    /// Gọi khi bấm "Đã chuyển khoản" (parent chạy claim RPC + reload). Trả false nếu RPC fail.
    let onConfirmTransfer: () async -> Bool

    @Environment(\.dismiss) private var dismiss
    @State private var working = false
    @State private var confirmClaim = false
    @State private var copied = false
    @State private var claimError: String?

    /// Lệ phí gốc của đội: ưu tiên phí/đội; nếu không có thì phí/VĐV × sĩ số đội.
    private var baseAmount: Int {
        if let f = tournament.entryFeeTeamVnd, f > 0 { return f }
        return (tournament.entryFeeVnd ?? 0) * max(rosterCount, 0)
    }

    /// % giảm theo slot đăng ký — QR tự tạo số tiền sau giảm.
    private var discountPercent: Int {
        guard let slotIndex else { return 0 }
        return tournament.discountPercent(forSlot: slotIndex)
    }

    private var teamAmount: Int { baseAmount * (100 - discountPercent) / 100 }

    private var bankLabel: String {
        let code = tournament.bankCode ?? ""
        return VNBank.all.first(where: { $0.code == code })?.shortName ?? code
    }

    private var qrURL: URL? {
        VietQR.imageURL(bankCode: tournament.bankCode ?? "",
                        accountNumber: tournament.bankAccountNumber ?? "",
                        accountName: tournament.bankAccountName ?? "",
                        amountVnd: teamAmount,
                        memo: "Le phi \(teamName)")
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    Text("Chuyển khoản lệ phí đội để được BTC xác nhận tham gia giải.")
                        .font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
                        .multilineTextAlignment(.center).lineSpacing(2)
                        .frame(maxWidth: .infinity)

                    if let url = qrURL {
                        AsyncImage(url: url) { phase in
                            switch phase {
                            case .success(let img): img.resizable().scaledToFit()
                            case .failure: Image(systemName: "qrcode").font(.system(size: 48)).foregroundStyle(TLColor.fg4)
                            default: ProgressView().tint(TLColor.accentText)
                            }
                        }
                        .frame(width: 240, height: 290)
                        .background(Color.white, in: RoundedRectangle(cornerRadius: 14))
                        .accessibilityLabel("Mã QR chuyển khoản \(teamAmount.formatted()) đồng tới \(bankLabel)")
                    }

                    bankCard

                    if status == .confirmed {
                        statusLine(String(localized: "Đội đã được BTC xác nhận — chính thức tham gia."), color: TLColor.accentText)
                    } else if status == .claimed {
                        statusLine(String(localized: "Đã báo chuyển khoản — đang chờ BTC xác nhận."), color: TLColor.live)
                    } else {
                        Button {
                            Haptics.light(); confirmClaim = true
                        } label: {
                            HStack(spacing: 6) {
                                if working { ProgressView().tint(TLColor.accentInk) }
                                Image(systemName: "checkmark.circle.fill").font(.system(size: 14))
                                Text("Đã chuyển khoản").font(TLFont.sans(15, .bold))
                            }
                            .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 14)
                            .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
                        }.buttonStyle(.plain).disabled(working)
                        if let claimError {
                            Text(claimError)
                                .font(TLFont.mono(11)).foregroundStyle(TLColor.live)
                                .multilineTextAlignment(.center)
                        }
                        Text("Chỉ bấm sau khi đã chuyển khoản thành công.")
                            .font(TLFont.mono(11)).foregroundStyle(TLColor.fg4)
                    }
                }
                .padding(16)
            }
            .background(TLColor.bg)
            .navigationTitle("Nộp lệ phí")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Đóng") { dismiss() }.foregroundStyle(TLColor.fg3) } }
            .confirmationDialog("Xác nhận đã chuyển khoản \(teamAmount.formatted()) đ?",
                                isPresented: $confirmClaim, titleVisibility: .visible) {
                Button("Đã chuyển khoản") {
                    working = true
                    claimError = nil
                    Task {
                        let ok = await onConfirmTransfer()
                        working = false
                        if ok {
                            Haptics.success()
                            dismiss()
                        } else {
                            Haptics.error()
                            claimError = String(localized: "Không gửi được xác nhận. Kiểm tra mạng rồi thử lại.")
                        }
                    }
                }
                Button("Chưa", role: .cancel) {}
            }
        }
    }

    private var bankCard: some View {
        VStack(spacing: 0) {
            infoRow("Ngân hàng", bankLabel)
            divider
            infoRow("Số tài khoản", tournament.bankAccountNumber ?? "—", mono: true, copyable: tournament.bankAccountNumber != nil)
            divider
            infoRow(String(localized: "Chủ tài khoản"), tournament.bankAccountName ?? "—")
            divider
            if discountPercent > 0, let slotIndex {
                infoRow(String(localized: "Slot #\(slotIndex + 1) — giảm giá"), "−\(discountPercent)%")
                divider
            }
            infoRow(String(localized: "Số tiền"), "\(teamAmount.formatted()) đ", accent: true)
        }
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private var divider: some View { Rectangle().fill(TLColor.border).frame(height: 1) }

    private func infoRow(_ label: String, _ value: String, mono: Bool = false, accent: Bool = false, copyable: Bool = false) -> some View {
        HStack {
            Text(label).font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
            Spacer()
            Text(value)
                .font(mono ? TLFont.mono(14, .semibold) : TLFont.sans(14, .semibold))
                .foregroundStyle(accent ? TLColor.accentText : TLColor.fg)
                .textSelection(.enabled)
            if copyable {
                Button {
                    UIPasteboard.general.string = value
                    Haptics.light()
                    copied = true
                    Task { try? await Task.sleep(for: .seconds(2)); copied = false }
                } label: {
                    Image(systemName: copied ? "checkmark" : "doc.on.doc")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(copied ? TLColor.accentText : TLColor.fg3)
                        .frame(width: 32, height: 32).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Sao chép số tài khoản")
            }
        }
        .padding(.horizontal, 14).padding(.vertical, mono && copyable ? 6 : 12)
    }

    private func statusLine(_ text: String, color: Color) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "info.circle.fill").foregroundStyle(color)
            Text(text).font(TLFont.sans(13, .medium)).foregroundStyle(color)
        }
        .frame(maxWidth: .infinity).padding(14)
        .background(color.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
    }
}
