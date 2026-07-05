import Foundation

// ============================================================================
// DeepLink — parse URL mở app thành đích native.
// Nhận cả universal link (https://www.thepicklehub.net/...) lẫn custom
// scheme (thepicklehub://...). AASA hiện chỉ claim /dang-ky/* + /join/*;
// social(slug) dùng được qua custom scheme / mở từ trong app.
// ============================================================================

enum DeepLink: Identifiable, Equatable {
    /// `/dang-ky/:magic_token` — người chơi tự quản lý đăng ký sự kiện.
    case registration(token: String)
    /// `/join/:invite_code` — lời mời ghép đôi QuickTable (redirect vào giải).
    case joinInvite(code: String)
    /// `/social/:slug` — chi tiết sự kiện giao lưu.
    case socialEvent(slug: String)

    var id: String {
        switch self {
        case .registration(let t): "dang-ky/\(t)"
        case .joinInvite(let c): "join/\(c)"
        case .socialEvent(let s): "social/\(s)"
        }
    }

    private static let uuidRe = try! NSRegularExpression(
        pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
        options: [.caseInsensitive])

    static func parse(_ url: URL) -> DeepLink? {
        // Đường dẫn: https → path; custom scheme → host là segment đầu
        // (thepicklehub://dang-ky/<token> có host="dang-ky", path="/<token>").
        var segments: [String]
        if url.scheme == "thepicklehub" {
            segments = [url.host].compactMap { $0 } + url.pathComponents.filter { $0 != "/" }
        } else if let host = url.host,
                  host == "www.thepicklehub.net" || host == "thepicklehub.net" {
            segments = url.pathComponents.filter { $0 != "/" }
        } else {
            return nil
        }
        // Bỏ prefix /vi
        if segments.first == "vi" { segments.removeFirst() }

        switch (segments.first, segments.count) {
        case ("dang-ky", 2):
            let token = segments[1].lowercased()
            let range = NSRange(token.startIndex..., in: token)
            guard uuidRe.firstMatch(in: token, range: range) != nil else { return nil }
            return .registration(token: token)
        case ("join", 2):
            return .joinInvite(code: segments[1])
        case ("social", 2):
            return .socialEvent(slug: segments[1])
        default:
            return nil
        }
    }
}
