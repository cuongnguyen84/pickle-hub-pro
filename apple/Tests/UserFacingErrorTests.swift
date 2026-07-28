import Foundation
import Testing
@testable import ThePickleHub

@Suite("User-facing mutation errors")
struct UserFacingErrorTests {
    private struct SampleError: LocalizedError {
        var errorDescription: String? { "Máy chủ từ chối yêu cầu." }
    }

    @Test("Message = localized failure sentence + actionable backend detail")
    func contextualMessage() {
        let failure: String.LocalizationValue = "Không gửi được tin nhắn."
        let message = UserFacingError.message(failure: failure, error: SampleError())
        #expect(message.hasPrefix(String(localized: failure)))
        #expect(message.contains("Máy chủ từ chối yêu cầu."))
    }

    @Test("Network failures get a stable recovery instruction")
    func offlineMessage() {
        let failure: String.LocalizationValue = "Không đánh dấu được thông báo."
        let message = UserFacingError.message(
            failure: failure,
            error: URLError(.notConnectedToInternet)
        )
        #expect(message.hasPrefix(String(localized: failure)))
        #expect(message.contains(String(localized: "Kiểm tra kết nối mạng rồi thử lại.")))
    }
}
