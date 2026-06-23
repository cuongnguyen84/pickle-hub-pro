import Foundation

/// The organizing body embedded on a tournament row.
struct TournamentOrg: Decodable, Equatable {
    let name: String
    let slug: String
    let logoURL: String?

    enum CodingKeys: String, CodingKey {
        case name, slug
        case logoURL = "logo_url"
    }
}

/// A row from the `tournaments` table (pro / "Watch" tournaments). Mirrors
/// `useTournaments()` — all rows are public.
struct Tournament: Decodable, Identifiable, Equatable {
    let id: UUID
    let name: String
    let slug: String
    let startDate: String?    // DATE "yyyy-MM-dd"
    let endDate: String?
    let status: String        // upcoming | ongoing | ended
    let description: String?
    let organization: TournamentOrg?

    var kind: TournamentStatus { TournamentStatus(rawValue: status) ?? .ended }
    var dateRange: String? { TournamentDate.range(startDate, endDate) }

    enum CodingKeys: String, CodingKey {
        case id, name, slug, status, description, organization
        case startDate = "start_date"
        case endDate = "end_date"
    }
}

enum TournamentStatus: String {
    case upcoming, ongoing, ended

    var label: String {
        switch self {
        case .upcoming: return "Sắp diễn ra"
        case .ongoing:  return "Đang diễn ra"
        case .ended:    return "Đã kết thúc"
        }
    }

    /// Watch-tab ordering: ongoing first, then upcoming, then ended.
    var priority: Int {
        switch self {
        case .ongoing:  return 0
        case .upcoming: return 1
        case .ended:    return 2
        }
    }

    var isLive: Bool { self == .ongoing }
}

/// Formats the `DATE` strings into a compact Vietnamese range.
enum TournamentDate {
    private static let parser: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private static func parse(_ string: String?) -> DateComponents? {
        guard let string, let date = parser.date(from: string) else { return nil }
        return Calendar(identifier: .gregorian).dateComponents([.day, .month, .year], from: date)
    }

    private static func dm(_ c: DateComponents) -> String { "\(c.day ?? 0)/\(c.month ?? 0)" }
    private static func dmy(_ c: DateComponents) -> String { "\(c.day ?? 0)/\(c.month ?? 0)/\(c.year ?? 0)" }

    static func range(_ start: String?, _ end: String?) -> String? {
        let s = parse(start)
        let e = parse(end)
        switch (s, e) {
        case let (s?, e?): return "\(dm(s)) – \(dmy(e))"
        case let (s?, nil): return dmy(s)
        case let (nil, e?): return dmy(e)
        default:            return nil
        }
    }
}
