import Foundation
import Testing
@testable import ThePickleHub

// ============================================================================
// Gates T4 (proposal web-native-parity-port §9) — chặn đúng hai lớp lỗi mà
// panel đo được bằng swift thật:
//   1. Encodable BỎ key khi Optional nil nhưng GỬI `[]` khi mảng rỗng →
//      EventPatch thiếu hydrate sẽ xoá trắng free_perks của event web tạo.
//   2. Slug lặp-tuần sinh bằng timestamp → retry đẻ bản sao; phải tất định.
// ============================================================================

@MainActor
struct SocialEventFormGateTests {

    private func fixtureEvent(perks: [String]?) -> SocialEvent {
        let json = """
        {
          "id": "11111111-2222-3333-4444-555555555555",
          "slug": "giao-luu-thu-7",
          "title_vi": "Giao lưu thứ 7",
          "title_en": null,
          "description_vi": "Vui là chính",
          "start_at": "2026-08-01T18:00:00+07:00",
          "end_at": "2026-08-01T21:00:00+07:00",
          "location_text": "Sân Cầu Giấy",
          "court_count": 3,
          "max_players": 24,
          "level_min": null,
          "level_max": null,
          "price_vnd": 50000,
          "zalo_group_url": "https://zalo.me/g/abc",
          "ball_type": "Franklin X-40",
          "free_perks": \(perks.map { p in "[" + p.map { "\"\($0)\"" }.joined(separator: ",") + "]" } ?? "null"),
          "status": "published",
          "allow_guests": null,
          "slots": null,
          "created_by": null,
          "club_id": "99999999-8888-7777-6666-555555555555",
          "visibility": "public",
          "requires_prepayment": true,
          "prepayment_deadline_hours": 12
        }
        """
        // SocialEvent map snake_case bằng CodingKeys tường minh — decoder thường
        return try! JSONDecoder().decode(SocialEvent.self, from: Data(json.utf8))
    }

    private func patchJSON(_ model: SocialEventFormModel, _ e: SocialEvent) throws -> [String: Any] {
        let data = try JSONEncoder().encode(model.buildPatch(for: e))
        return try JSONSerialization.jsonObject(with: data) as! [String: Any]
    }

    /// Gate T4b lõi: sửa một event WEB tạo CÓ perks, không chạm gì, Save →
    /// patch phải mang đủ perks — không phải `[]`, không phải vắng key.
    @Test func editingUntouchedEventKeepsItsPerks() throws {
        let e = fixtureEvent(perks: ["Nước", "Khăn"])
        let model = SocialEventFormModel(existing: e, clubID: nil)
        model.applyExisting(e)
        let json = try patchJSON(model, e)
        #expect(json["free_perks"] as? [String] == ["Nước", "Khăn"])
        #expect(json["ball_type"] as? String == "Franklin X-40")
        #expect(json["title_vi"] as? String == "Giao lưu thứ 7")
    }

    /// Event không có perks → patch gửi [] là ĐÚNG (không có gì để mất).
    @Test func eventWithoutPerksPatchesEmptyArray() throws {
        let e = fixtureEvent(perks: nil)
        let model = SocialEventFormModel(existing: e, clubID: nil)
        model.applyExisting(e)
        let json = try patchJSON(model, e)
        #expect(json["free_perks"] as? [String] == [])
    }

    /// Khoá danh sách key của EventPatch: thêm key mới mà không qua luật
    /// hydrate (comment trong SocialOrganizerRepository.EventPatch) thì test
    /// này đỏ và dẫn người sửa tới đúng chỗ đọc luật.
    @Test func eventPatchKeySetIsLocked() throws {
        let e = fixtureEvent(perks: ["Nước"])
        let model = SocialEventFormModel(existing: e, clubID: nil)
        model.applyExisting(e)
        let keys = Set(try patchJSON(model, e).keys)
        #expect(keys == [
            "title_vi", "description_vi", "start_at", "end_at", "location_text",
            "court_count", "max_players", "zalo_group_url", "ball_type",
            "visibility", "price_vnd", "requires_prepayment",
            "prepayment_deadline_hours", "free_perks",
        ])
        #expect(!keys.contains("slots"), "slots không bao giờ được vào EventPatch — xoá nhóm đăng ký của web")
    }

    /// Gate T4c: slug lặp-tuần tất định, khớp web `${slug}-tuan${i+1}` —
    /// retry sinh lại đúng slug cũ (đụng UNIQUE thay vì đẻ bản sao mới).
    @Test func weeklySlugIsDeterministicAndMatchesWeb() {
        #expect(SocialEventFormModel.iterSlug("giao-luu", week: 0) == "giao-luu")
        #expect(SocialEventFormModel.iterSlug("giao-luu", week: 1) == "giao-luu-tuan2")
        #expect(SocialEventFormModel.iterSlug("giao-luu", week: 11) == "giao-luu-tuan12")
        // Gọi lại cùng tham số ra cùng kết quả — không phụ thuộc đồng hồ
        #expect(SocialEventFormModel.iterSlug("giao-luu", week: 3)
                == SocialEventFormModel.iterSlug("giao-luu", week: 3))
    }
}
