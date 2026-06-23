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
