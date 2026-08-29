import SwiftUI
import UIKit

/// Inline bank-transfer request. SePay reconciles the exact amount and memo
/// through its signed bank webhook; no merchant secret is shipped in the app.
struct ShopSePayCheckoutView: View {
    let checkout: ShopSePayCheckout

    var body: some View {
        VStack(alignment: .leading, spacing: TLSpacing.md) {
            Label("Thanh toán ngay", systemImage: "qrcode")
                .font(TLType.titleSans(13))
            Text("Quét mã bằng ứng dụng ngân hàng. Số tiền và nội dung chuyển khoản đã được điền sẵn.")
                .font(TLType.bodySans(11)).foregroundStyle(TLColor.fg3)
            if let url = validatedQRURL {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFit()
                } placeholder: {
                    ProgressView().frame(maxWidth: .infinity, minHeight: 220)
                }
                .frame(maxWidth: 320).frame(maxWidth: .infinity)
                .accessibilityLabel("Mã QR thanh toán SePay")
            }
            copyRow("Số tiền", ShopMoney.vnd(checkout.amountVND))
            copyRow("Ngân hàng", checkout.bankCode)
            copyRow("Số tài khoản", checkout.accountNumber)
            copyRow("Chủ tài khoản", checkout.accountName)
            copyRow("Nội dung", checkout.memo)
            Text("Giữ nguyên số tiền và nội dung để SePay tự động xác nhận đúng đơn.")
                .font(TLType.bodySans(10)).foregroundStyle(TLColor.fg3)
        }
    }

    private var validatedQRURL: URL? {
        guard let url = URL(string: checkout.qrURL), url.scheme == "https",
              url.host == "vietqr.app", url.path == "/img" else { return nil }
        return url
    }

    private func copyRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).foregroundStyle(TLColor.fg3)
            Spacer()
            Text(value).font(TLType.dataMono(11))
            Button { UIPasteboard.general.string = value } label: {
                Image(systemName: "doc.on.doc")
            }
            .accessibilityLabel("Sao chép \(label)")
        }
        .font(TLType.bodySans(11))
    }
}
