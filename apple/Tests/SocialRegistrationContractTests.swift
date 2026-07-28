import Foundation
import Supabase
import Testing
@testable import ThePickleHub

@Suite("Native social registration contract")
struct SocialRegistrationContractTests {
    @Test("Send OTP carries the production Turnstile field")
    func sendBody() throws {
        let body = SocialRepository.SendOTPBody(
            phone: "+84901234567", eventID: "event-id", turnstileToken: "challenge-token")
        let json = try object(body)
        #expect(json["phone"] as? String == "+84901234567")
        #expect(json["event_id"] as? String == "event-id")
        #expect(json["turnstile_token"] as? String == "challenge-token")
    }

    @Test("Verify OTP preserves slot selection and rating")
    func verifyBody() throws {
        let body = SocialRepository.VerifyOTPBody(
            phone: "+84901234567", eventID: "event-id", code: "123456",
            displayName: "An", selfRatedLevel: 3.5, slotID: "beginner-am")
        let json = try object(body)
        #expect(json["slot_id"] as? String == "beginner-am")
        #expect(json["display_name"] as? String == "An")
        #expect(json["self_rated_level"] as? Double == 3.5)
    }

    @Test("OTP response decodes the backend ok contract")
    func responseDecoding() throws {
        let data = Data(#"{"ok":true,"registration_id":"reg","profile_id":"profile","magic_token":"token","registered_at":"2026-07-22T00:00:00Z"}"#.utf8)
        let response = try JSONDecoder().decode(SocialRepository.OTPResponse.self, from: data)
        #expect(response.ok == true)
        #expect(response.registrationID == "reg")
        #expect(response.magicToken == "token")
    }

    @Test("Non-2xx function payload retains its stable backend code")
    func functionErrorCode() {
        let error = FunctionsError.httpError(
            code: 403, data: Data(#"{"error":"captcha_failed","code":"captcha_failed"}"#.utf8))
        #expect(SocialRepository.functionErrorCode(error) == "captcha_failed")
    }

    // Assert qua String(localized:) cùng key thay vì literal VI — test giữ đúng ý
    // (mã backend map vào đúng thông điệp) và chạy được ở mọi -testLanguage.
    @Test("Production OTP error codes stay actionable in native UI")
    func localizedErrors() {
        #expect(SocialFlowError(code: "otp_mismatch").errorDescription == String(localized: "Mã OTP không đúng."))
        #expect(SocialFlowError(code: "otp_too_many_attempts").errorDescription == String(localized: "Sai mã quá nhiều lần. Hãy yêu cầu mã mới."))
        #expect(SocialFlowError(code: "daily_budget_exceeded").errorDescription == String(localized: "Hệ thống đang tạm dừng gửi tin tự động. Hãy liên hệ ban tổ chức."))
    }

    @Test("Remote registration kill switch decodes only a JSON boolean")
    func remoteKillSwitchContract() throws {
        let enabled = try JSONDecoder().decode(
            SocialRepository.BooleanSettingRow.self,
            from: Data(#"{"value":true}"#.utf8))
        #expect(enabled.value)
        #expect(SocialRepository.nativeRegistrationSettingKey == "native_event_registration_enabled")
    }

    @Test("Event model includes guest eligibility and registration slots")
    func eventSlotDecoding() throws {
        let data = Data(#"{"id":"29FBA590-2B19-4EB5-8F9B-CB8E83E551C2","slug":"open-play","title_vi":"Open Play","allow_guests":true,"slots":[{"id":"s1","label":"Nhóm 3.0","kind":"skill","capacity":8,"court_count":2,"skill_level":"3.0","min_play_months":null,"notes":null}]}"#.utf8)
        let event = try JSONDecoder().decode(SocialEvent.self, from: data)
        #expect(event.allowGuests == true)
        #expect(event.slots?.first?.id == "s1")
        #expect(event.slots?.first?.capacity == 8)
    }

    @Test("Turnstile document keeps the public site key in executable config")
    func turnstileDocument() {
        let html = TurnstileHTML.document(siteKey: "0x4AAAA-test-key")
        #expect(html.contains(#"sitekey: "0x4AAAA-test-key""#))
        #expect(html.contains("challenges.cloudflare.com/turnstile/v0/api.js"))
        #expect(html.contains("window.webkit.messageHandlers.turnstile"))
    }

    private func object<T: Encodable>(_ value: T) throws -> [String: Any] {
        let data = try JSONEncoder().encode(value)
        return try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }
}
