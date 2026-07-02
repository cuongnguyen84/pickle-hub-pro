import SwiftUI

/// Đội trưởng nộp lệ phí đội: hiện QR VietQR + số tài khoản BTC. Sau khi chuyển
/// khoản, bấm "Đã chuyển khoản" → team về trạng thái "claimed" (đỏ), chờ BTC xác
/// nhận. QR dựng client-side từ thông tin bank đã lưu (img.vietqr.io).
struct TeamMatchPaymentSheet: View {
    let tournament: TMTournament
    let rosterCount: Int
    let teamName: String
    let status: TMPaymentStatus
    /// Gọi khi bấm "Đã chuyển khoản" (parent chạy claim RPC + reload).
    let onConfirmTransfer: () async -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var working = false

    /// Lệ phí đội: ưu tiên phí/đội; nếu không có thì phí/VĐV × sĩ số đội.
    private var teamAmount: Int {
        if let f = tournament.entryFeeTeamVnd, f > 0 { return f }
        return (tournament.entryFeeVnd ?? 0) * max(rosterCount, 0)
    }

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
                    }

                    bankCard

                    if status == .confirmed {
                        statusLine("Đội đã được BTC xác nhận — chính thức tham gia.", color: TLColor.accentText)
                    } else if status == .claimed {
                        statusLine("Đã báo chuyển khoản — đang chờ BTC xác nhận.", color: TLColor.live)
                    } else {
                        Button {
                            Haptics.success(); working = true
                            Task { await onConfirmTransfer(); working = false; dismiss() }
                        } label: {
                            HStack(spacing: 6) {
                                if working { ProgressView().tint(TLColor.accentInk) }
                                Image(systemName: "checkmark.circle.fill").font(.system(size: 14))
                                Text("Đã chuyển khoản").font(TLFont.sans(15, .bold))
                            }
                            .foregroundStyle(TLColor.accentInk).frame(maxWidth: .infinity).padding(.vertical, 14)
                            .background(TLColor.accent, in: RoundedRectangle(cornerRadius: 12))
                        }.buttonStyle(.plain).disabled(working)
                        Text("Chỉ bấm sau khi đã chuyển khoản thành công.")
                            .font(TLFont.mono(9.5)).foregroundStyle(TLColor.fg4)
                    }
                }
                .padding(16)
            }
            .background(TLColor.bg)
            .navigationTitle("Nộp lệ phí")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Đóng") { dismiss() }.foregroundStyle(TLColor.fg3) } }
        }
    }

    private var bankCard: some View {
        VStack(spacing: 0) {
            infoRow("Ngân hàng", bankLabel)
            divider
            infoRow("Số tài khoản", tournament.bankAccountNumber ?? "—", mono: true)
            divider
            infoRow("Chủ tài khoản", tournament.bankAccountName ?? "—")
            divider
            infoRow("Số tiền", "\(teamAmount.formatted()) đ", accent: true)
        }
        .background(TLColor.surface, in: RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TLRadius.lg, style: .continuous).strokeBorder(TLColor.border, lineWidth: 1))
    }

    private var divider: some View { Rectangle().fill(TLColor.border).frame(height: 1) }

    private func infoRow(_ label: String, _ value: String, mono: Bool = false, accent: Bool = false) -> some View {
        HStack {
            Text(label).font(TLFont.sans(13)).foregroundStyle(TLColor.fg3)
            Spacer()
            Text(value)
                .font(mono ? TLFont.mono(14, .semibold) : TLFont.sans(14, .semibold))
                .foregroundStyle(accent ? TLColor.accentText : TLColor.fg)
                .textSelection(.enabled)
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
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
