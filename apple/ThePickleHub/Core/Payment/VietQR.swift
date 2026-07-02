import Foundation

/// Render-only VietQR helper — mirrors web `src/lib/payment/vietqr.ts`.
/// VietQR.io serves a dynamic Napas QR PNG from a plain image URL (no API key):
///   https://img.vietqr.io/image/{BANK}-{ACCOUNT}-compact2.png?amount=&addInfo=&accountName=
/// Caller drops the URL into an `AsyncImage`.
enum VietQR {
    /// Build the PNG URL. Amount < 0 or non-finite → 0. Returns nil if the bank
    /// code or account number is blank (nothing to render).
    static func imageURL(bankCode: String, accountNumber: String, accountName: String,
                         amountVnd: Int, memo: String) -> URL? {
        let bank = bankCode.trimmingCharacters(in: .whitespaces)
        let account = accountNumber.trimmingCharacters(in: .whitespaces)
        guard !bank.isEmpty, !account.isEmpty else { return nil }

        var comps = URLComponents()
        comps.scheme = "https"
        comps.host = "img.vietqr.io"
        comps.path = "/image/\(bank)-\(account)-compact2.png"
        comps.queryItems = [
            .init(name: "amount", value: String(max(0, amountVnd))),
            .init(name: "addInfo", value: memo),
            .init(name: "accountName", value: accountName),
        ]
        return comps.url
    }
}

/// VN banks supported by VietQR.io — `code` is the identifier in the QR URL path,
/// `shortName` the label shown to the organizer. Major retail banks (>95% of
/// users); add more as needed. Full list: https://api.vietqr.io/v2/banks
struct VNBank: Identifiable, Hashable {
    let code: String
    let shortName: String
    var id: String { code }

    static let all: [VNBank] = [
        .init(code: "VCB", shortName: "Vietcombank"),
        .init(code: "TCB", shortName: "Techcombank"),
        .init(code: "MB", shortName: "MB Bank"),
        .init(code: "VPB", shortName: "VPBank"),
        .init(code: "ACB", shortName: "ACB"),
        .init(code: "BIDV", shortName: "BIDV"),
        .init(code: "CTG", shortName: "VietinBank"),
        .init(code: "AGRIBANK", shortName: "Agribank"),
        .init(code: "STB", shortName: "Sacombank"),
        .init(code: "TPB", shortName: "TPBank"),
        .init(code: "VIB", shortName: "VIB"),
        .init(code: "SHB", shortName: "SHB"),
        .init(code: "MSB", shortName: "MSB"),
        .init(code: "OCB", shortName: "OCB"),
        .init(code: "EIB", shortName: "Eximbank"),
        .init(code: "HDB", shortName: "HDBank"),
        .init(code: "LPB", shortName: "LPBank"),
        .init(code: "SEAB", shortName: "SeABank"),
        .init(code: "NAB", shortName: "Nam A Bank"),
        .init(code: "VARB", shortName: "Agribank (VARB)"),
    ]
}
