import Foundation

enum UserFacingError {
    static func message(action: String, error: Error) -> String {
        let detail: String
        if let urlError = error as? URLError {
            switch urlError.code {
            case .notConnectedToInternet, .networkConnectionLost, .cannotConnectToHost,
                 .cannotFindHost, .dnsLookupFailed:
                detail = "Kiểm tra kết nối mạng rồi thử lại."
            case .timedOut:
                detail = "Kết nối đã hết thời gian chờ. Vui lòng thử lại."
            case .cancelled:
                detail = "Yêu cầu đã bị hủy."
            default:
                detail = urlError.localizedDescription
            }
        } else {
            let candidate = (error as? LocalizedError)?.errorDescription?.nonEmpty
                ?? error.localizedDescription.nonEmpty
                ?? "Vui lòng thử lại."
            detail = String(candidate.prefix(240))
        }
        return "\(action) không thành công. \(detail)"
    }
}
