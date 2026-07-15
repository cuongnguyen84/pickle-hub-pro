import Foundation

/// A row from `social_events` (public pickup-game / meetup events).
struct SocialEvent: Decodable, Identifiable, Equatable {
    let id: UUID
    let slug: String
    let titleVi: String
    let titleEn: String?
    let descriptionVi: String?
    let startAt: String?
    let endAt: String?
    let locationText: String?
    let courtCount: Int?
    let maxPlayers: Int?
    let levelMin: Double?
    let levelMax: Double?
    let priceVnd: Int?
    let zaloGroupURL: String?
    let ballType: String?
    let freePerks: [String]?
    let status: String?
    // Organizer-side (nullable để list công khai cũ không vỡ khi thiếu cột)
    let createdBy: UUID?
    let clubID: UUID?
    let visibility: String?
    let requiresPrepayment: Bool?
    let prepaymentDeadlineHours: Int?

    var title: String { titleVi.nonEmpty ?? titleEn?.nonEmpty ?? "Sự kiện" }

    var startDate: Date? { startAt.flatMap(SocialDate.parse) }

    /// "T7, 24/05 · 10:00" style label for the start time.
    var whenLabel: String? {
        guard let date = startDate else { return nil }
        return SocialDate.display(date)
    }

    var priceLabel: String {
        guard let price = priceVnd, price > 0 else { return "Miễn phí" }
        return "\(SocialEvent.grouped(price))đ"
    }

    var levelLabel: String? {
        switch (levelMin, levelMax) {
        case let (min?, max?): return String(format: "DUPR %.1f–%.1f", min, max)
        case let (min?, nil): return String(format: "DUPR %.1f+", min)
        case let (nil, max?): return String(format: "≤ DUPR %.1f", max)
        default: return nil
        }
    }

    private static func grouped(_ value: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.groupingSeparator = "."
        return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }

    enum CodingKeys: String, CodingKey {
        case id, slug, status
        case titleVi = "title_vi"
        case titleEn = "title_en"
        case descriptionVi = "description_vi"
        case startAt = "start_at"
        case endAt = "end_at"
        case locationText = "location_text"
        case courtCount = "court_count"
        case maxPlayers = "max_players"
        case levelMin = "level_min"
        case levelMax = "level_max"
        case priceVnd = "price_vnd"
        case zaloGroupURL = "zalo_group_url"
        case ballType = "ball_type"
        case freePerks = "free_perks"
        case createdBy = "created_by"
        case clubID = "club_id"
        case visibility
        case requiresPrepayment = "requires_prepayment"
        case prepaymentDeadlineHours = "prepayment_deadline_hours"
    }
}

/// One registered player (event_registrations), masked for the public roster.
struct SocialRosterEntry: Decodable, Identifiable, Equatable {
    let id: UUID
    let displayName: String?
    let selfRatedLevel: Double?

    var maskedName: String { SocialName.mask(displayName) }
    var levelText: String? { selfRatedLevel.map { String(format: "Tự đánh giá %.1f", $0) } }

    enum CodingKeys: String, CodingKey {
        case id
        case displayName = "display_name"
        case selfRatedLevel = "self_rated_level"
    }
}

/// Lỗi có mã từ edge fn (cancel/reactivate registration).
struct SocialFlowError: LocalizedError {
    let code: String
    var errorDescription: String? {
        switch code {
        case "already_cancelled": "Đăng ký đã huỷ trước đó."
        case "event_started": "Sự kiện đã bắt đầu — không thao tác được."
        case "event_cancelled": "Sự kiện đã bị huỷ."
        case "event_full": "Sự kiện đã đủ người — không đăng ký lại được."
        case "not_cancelled": "Đăng ký đang hoạt động."
        default: "Có lỗi xảy ra (\(code)). Thử lại sau."
        }
    }
}

/// Một dòng từ RPC `get_registration_by_token` — đăng ký + sự kiện + thanh toán.
struct PlayerRegistrationInfo: Decodable, Equatable {
    let registrationID: UUID
    let eventSlug: String
    let eventTitleVi: String
    let eventStatus: String
    let eventStartAt: String
    let eventEndAt: String?
    let eventLocationText: String?
    let eventPriceVnd: Int
    let eventCancellationHours: Int
    let eventRequiresPrepayment: Bool?
    let eventPrepaymentDeadlineHours: Int?
    let eventBankCode: String?
    let eventBankAccountNumber: String?
    let eventBankAccountName: String?
    let displayName: String
    let phone: String?
    let status: String            // registered | checked_in | cancelled | no_show
    let cancelledAt: String?
    let cancelledReason: String?
    let paymentStatus: String     // unpaid | pending_payment | paid | refunded
    let paymentOrderID: UUID?
    let paymentReferenceCode: String?
    let playerClaimedPaid: Bool?
    let registeredAt: String

    var isCancelled: Bool { status == "cancelled" }
    var startDate: Date? { SocialDate.parse(eventStartAt) }
    /// Còn đủ sớm để hoàn tiền (khớp web refundEligible).
    var refundEligible: Bool {
        guard let start = startDate else { return false }
        return start.timeIntervalSinceNow / 3600 >= Double(eventCancellationHours)
    }

    enum CodingKeys: String, CodingKey {
        case registrationID = "registration_id"
        case eventSlug = "event_slug"
        case eventTitleVi = "event_title_vi"
        case eventStatus = "event_status"
        case eventStartAt = "event_start_at"
        case eventEndAt = "event_end_at"
        case eventLocationText = "event_location_text"
        case eventPriceVnd = "event_price_vnd"
        case eventCancellationHours = "event_cancellation_hours"
        case eventRequiresPrepayment = "event_requires_prepayment"
        case eventPrepaymentDeadlineHours = "event_prepayment_deadline_hours"
        case eventBankCode = "event_bank_code"
        case eventBankAccountNumber = "event_bank_account_number"
        case eventBankAccountName = "event_bank_account_name"
        case displayName = "display_name"
        case phone, status
        case cancelledAt = "cancelled_at"
        case cancelledReason = "cancelled_reason"
        case paymentStatus = "payment_status"
        case paymentOrderID = "payment_order_id"
        case paymentReferenceCode = "payment_reference_code"
        case playerClaimedPaid = "player_claimed_paid"
        case registeredAt = "registered_at"
    }
}

/// Public name masking — port of web `maskName.ts`: first word full, rest →
/// initials. "Nguyễn Văn An" → "Nguyễn V.".
enum SocialName {
    static func mask(_ name: String?) -> String {
        guard let trimmed = name?.trimmingCharacters(in: .whitespaces), !trimmed.isEmpty else { return "Khách" }
        let parts = trimmed.split(separator: " ").map(String.init)
        guard parts.count > 1 else { return parts[0] }
        let initials = parts.dropFirst().compactMap { $0.first.map { String($0).uppercased() } }.joined()
        return initials.isEmpty ? parts[0] : "\(parts[0]) \(initials)."
    }
}

/// ISO-8601 parsing + Vietnamese display formatting for social events.
enum SocialDate {
    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let isoPlain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static func parse(_ string: String) -> Date? {
        iso.date(from: string) ?? isoPlain.date(from: string)
    }

    private static let displayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "vi_VN")
        f.dateFormat = "EEE, dd/MM · HH:mm"
        return f
    }()

    static func display(_ date: Date) -> String {
        displayFormatter.string(from: date)
    }
}
