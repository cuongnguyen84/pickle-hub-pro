import SwiftUI

// Native models for the unified notifications inbox. Faithful port of web
// `src/hooks/social/useUnifiedNotifications.ts` — merges two tables:
//   • `notifications`        (legacy: livestream scheduled/live)
//   • `social_notifications` (follow, match kudo/comment, mentions, match status)
// Title is Vietnamese-canonical in the DB (app audience is VN) → used as-is.

enum NotificationSource: String, Equatable { case legacy, social }

struct AppNotification: Identifiable, Equatable {
    let id: UUID
    let source: NotificationSource
    let type: String
    let title: String
    let body: String?
    let linkURL: String?   // social link_url, or legacy "/live/<related_id>"
    let isRead: Bool
    let createdAt: Date?

    /// Where tapping should go. Native handles player profiles; everything else
    /// opens the web page in an in-app Safari sheet.
    enum Target: Equatable {
        case profile(username: String)
        case web(URL)
        case none
    }

    var target: Target {
        guard let link = linkURL?.nonEmpty else { return .none }
        if link.hasPrefix("/nguoi-choi/") {
            let username = String(link.dropFirst("/nguoi-choi/".count)).split(separator: "/").first.map(String.init) ?? ""
            if !username.isEmpty { return .profile(username: username) }
        }
        // Build an absolute URL against the site origin for everything else.
        let path = link.hasPrefix("/") ? String(link.dropFirst()) : link
        return .web(WebRoutes.base.appending(path: path))
    }

    /// SF Symbol + tint per type — port of NotificationItem.tsx icon map.
    var icon: (name: String, tint: Color) {
        switch type {
        case "livestream_scheduled": return ("calendar", TLColor.accentText)
        case "livestream_live": return ("dot.radiowaves.up.forward", TLColor.live)
        case "forum_reply": return ("bubble.left.fill", TLColor.accentText)
        case "follow": return ("person.badge.plus.fill", TLColor.accentText)
        case "match_kudo", "kudos_received": return ("heart.fill", .pink)
        case "match_comment", "comment_received": return ("bubble.left.fill", TLColor.accentText)
        case "comment_reply": return ("arrowshape.turn.up.left.fill", TLColor.accentText)
        case "comment_mention": return ("at", TLColor.accentText)
        case "match_confirm_needed", "match_approval_needed": return ("bell.fill", TLColor.gold)
        case "match_submitted": return ("trophy.fill", TLColor.accentText)
        case "match_verified": return ("checkmark.seal.fill", .blue)
        case "match_disputed": return ("exclamationmark.triangle.fill", TLColor.live)
        case "match_expired": return ("trophy", TLColor.fg3)
        default: return ("bell.fill", TLColor.fg3)
        }
    }
}

// MARK: Raw rows

/// `notifications` (legacy livestream) row.
struct LegacyNotificationRow: Decodable {
    let id: UUID
    let type: String
    let title: String
    let message: String?
    let relatedID: UUID?
    let isRead: Bool
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, type, title, message
        case relatedID = "related_id"
        case isRead = "is_read"
        case createdAt = "created_at"
    }

    func unified() -> AppNotification {
        AppNotification(id: id, source: .legacy, type: type, title: title, body: message,
                        linkURL: relatedID.map { "/live/\($0.uuidString.lowercased())" },
                        isRead: isRead, createdAt: FeedDate.parse(createdAt))
    }
}

/// `social_notifications` row.
struct SocialNotificationRow: Decodable {
    let id: UUID
    let type: String
    let title: String
    let body: String?
    let linkURL: String?
    let isRead: Bool
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, type, title, body
        case linkURL = "link_url"
        case isRead = "is_read"
        case createdAt = "created_at"
    }

    func unified() -> AppNotification {
        AppNotification(id: id, source: .social, type: type, title: title, body: body,
                        linkURL: linkURL, isRead: isRead, createdAt: FeedDate.parse(createdAt))
    }
}
