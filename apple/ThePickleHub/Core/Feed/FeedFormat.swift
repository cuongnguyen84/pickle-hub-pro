import Foundation

/// Vietnamese-first formatting for the feed surface. Mirrors the web
/// `src/lib/social/feed-formatters.ts` label maps so the native feed reads
/// identically to thepicklehub.net. The app audience is ~95% Vietnamese, so
/// only the VI register is ported here (EN can follow when a toggle ships).
enum FeedFormat {

    /// Singles / Doubles / Mixed chip.
    static func format(_ format: String) -> String {
        switch format {
        case "singles": return "ĐƠN"
        case "doubles": return "ĐÔI"
        case "mixed":   return String(localized: "ĐÔI NAM-NỮ")
        default:        return format.uppercased()
        }
    }

    /// Match-type chip.
    static func matchType(_ type: String) -> String {
        switch type {
        case "rec":        return String(localized: "GIAO LƯU")
        case "open_play":  return "OPEN PLAY"
        case "tournament": return String(localized: "GIẢI ĐẤU")
        case "league":     return String(localized: "GIẢI LEAGUE")
        case "practice":   return String(localized: "TẬP LUYỆN")
        default:           return type.uppercased()
        }
    }

    struct StatusBadge {
        let label: String
        let isVerified: Bool
        let isDisputed: Bool
    }

    static func status(_ status: String) -> StatusBadge {
        switch status {
        case "verified": return .init(label: String(localized: "ĐÃ XÁC THỰC"), isVerified: true, isDisputed: false)
        case "pending":  return .init(label: String(localized: "CHỜ XÁC THỰC"), isVerified: false, isDisputed: false)
        case "disputed": return .init(label: String(localized: "TRANH CHẤP"), isVerified: false, isDisputed: true)
        default:         return .init(label: status.uppercased(), isVerified: false, isDisputed: false)
        }
    }

    /// "VIDEO NGẮN" / "VIDEO" eyebrow.
    static func videoKind(isShort: Bool) -> String { isShort ? String(localized: "VIDEO NGẮN") : "VIDEO" }

    /// mm:ss / h:mm:ss duration.
    static func duration(_ seconds: Int?) -> String? {
        guard let seconds, seconds > 0 else { return nil }
        let h = seconds / 3600
        let m = (seconds % 3600) / 60
        let s = seconds % 60
        if h > 0 { return String(format: "%d:%02d:%02d", h, m, s) }
        return String(format: "%d:%02d", m, s)
    }

    /// Group participants into teams A/B, each ordered by position.
    static func groupTeams(_ participants: [FeedParticipant]) -> (teamA: [FeedParticipant], teamB: [FeedParticipant]) {
        let a = participants.filter { $0.team == "a" }.sorted { ($0.position ?? 0) < ($1.position ?? 0) }
        let b = participants.filter { $0.team == "b" }.sorted { ($0.position ?? 0) < ($1.position ?? 0) }
        return (a, b)
    }
}

/// Tolerant ISO-8601 parsing for Postgres `timestamptz` values, which arrive
/// with variable fractional-second precision (often 6 digits) that
/// `ISO8601DateFormatter` rejects unless the fraction is normalized.
enum FeedDate {
    private static func formatter(fractionalSeconds: Bool) -> ISO8601DateFormatter {
        let f = ISO8601DateFormatter()
        f.formatOptions = fractionalSeconds
            ? [.withInternetDateTime, .withFractionalSeconds]
            : [.withInternetDateTime]
        return f
    }

    static func parse(_ string: String) -> Date? {
        // ISO8601DateFormatter is mutable and not Sendable. Creating these two
        // short-lived instances avoids sharing formatter state across tasks.
        let withFraction = formatter(fractionalSeconds: true)
        let noFraction = formatter(fractionalSeconds: false)
        if let d = withFraction.date(from: string) { return d }
        if let d = noFraction.date(from: string) { return d }
        // Strip the fractional component ("…:ss.123456+00:00" → "…:ss+00:00")
        // and retry, covering precisions the formatters above won't accept.
        if let dot = string.firstIndex(of: ".") {
            var end = string.index(after: dot)
            while end < string.endIndex, string[end].isNumber { end = string.index(after: end) }
            let stripped = string[..<dot] + string[end...]
            return noFraction.date(from: String(stripped))
        }
        return nil
    }

    /// Locale-aware relative time — "vừa xong" / "2 giờ trước" / "2 hours ago".
    static func relative(_ date: Date?, now: Date = Date()) -> String {
        guard let date else { return "" }
        if now.timeIntervalSince(date) < 60 { return String(localized: "vừa xong") }
        return date.formatted(.relative(presentation: .named))
    }
}
