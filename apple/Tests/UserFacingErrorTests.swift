import Foundation
import Testing
@testable import ThePickleHub

@Suite("User-facing mutation errors")
struct UserFacingErrorTests {
    private struct SampleError: LocalizedError {
        var errorDescription: String? { "Máy chủ từ chối yêu cầu." }
    }

    @Test("Mutation context and actionable backend detail are retained")
    func contextualMessage() {
        #expect(UserFacingError.message(action: "Gửi tin nhắn", error: SampleError())
                == "Gửi tin nhắn không thành công. Máy chủ từ chối yêu cầu.")
    }

    @Test("Network failures get a stable recovery instruction")
    func offlineMessage() {
        let message = UserFacingError.message(
            action: "Đánh dấu thông báo",
            error: URLError(.notConnectedToInternet)
        )
        #expect(message.contains("Kiểm tra kết nối mạng rồi thử lại."))
    }
}
