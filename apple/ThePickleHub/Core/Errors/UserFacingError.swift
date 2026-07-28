import Foundation

enum UserFacingError {
    /// `failure` is a complete localized sentence ("Không lưu được tỉ số.") —
    /// VI grammar cannot compose "\(action) không thành công." per-fragment.
    static func message(failure: String.LocalizationValue, error: Error) -> String {
        let detail: String
        if let urlError = error as? URLError {
            switch urlError.code {
            case .notConnectedToInternet, .networkConnectionLost, .cannotConnectToHost,
                 .cannotFindHost, .dnsLookupFailed:
                detail = String(localized: "Kiểm tra kết nối mạng rồi thử lại.")
            case .timedOut:
                detail = String(localized: "Kết nối đã hết thời gian chờ. Vui lòng thử lại.")
            case .cancelled:
                detail = String(localized: "Yêu cầu đã bị hủy.")
            default:
                detail = urlError.localizedDescription
            }
        } else {
            let candidate = (error as? LocalizedError)?.errorDescription?.nonEmpty
                ?? error.localizedDescription.nonEmpty
                ?? String(localized: "Vui lòng thử lại.")
            detail = String(candidate.prefix(240))
        }
        return "\(String(localized: failure)) \(detail)"
    }
}
