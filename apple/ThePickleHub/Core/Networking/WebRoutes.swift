import Foundation
import SwiftUI
import SafariServices

/// Canonical thepicklehub.net URLs the native feed links into. Until each
/// surface has a native detail screen, cards open these in an in-app Safari
/// sheet (also the Phase 3 plan for news/blog article bodies).
enum WebRoutes {
    static let base = URL(string: "https://www.thepicklehub.net")!

    static func match(slug: String) -> URL { base.appending(path: "tran-dau/\(slug)") }
    static func blog(slug: String) -> URL { base.appending(path: "vi/blog/\(slug)") }
    static func video(id: UUID) -> URL { base.appending(path: "watch/\(id.uuidString.lowercased())") }
    static func player(username: String) -> URL { base.appending(path: "nguoi-choi/\(username)") }
    static func news(slug: String, language: String) -> URL {
        base.appending(path: language == "en" ? "news/\(slug)" : "vi/news/\(slug)")
    }
    static func tournament(slug: String) -> URL { base.appending(path: "vi/tournament/\(slug)") }
    static func live(id: UUID) -> URL { base.appending(path: "live/\(id.uuidString.lowercased())") }
    static func social(slug: String) -> URL { base.appending(path: "vi/social/\(slug)") }

    // Bracket Lab (Tools) — created/scored on the web.
    static let toolsQuickTables = base.appending(path: "tools/quick-tables")
    static let toolsDoublesElimination = base.appending(path: "tools/doubles-elimination")
    static let toolsFlexTournament = base.appending(path: "tools/flex-tournament")
    static let toolsTeamMatch = base.appending(path: "tools/team-match")
    static func quickTable(shareID: String) -> URL { base.appending(path: "tools/quick-tables/\(shareID)") }

    /// Resolves an image path that may be relative (e.g. blog covers like
    /// "/images/blog/x.webp") against the site origin; absolute URLs pass through.
    static func asset(_ string: String) -> URL? {
        if string.hasPrefix("http://") || string.hasPrefix("https://") {
            return URL(string: string)
        }
        return URL(string: string, relativeTo: base)
    }
}

/// In-app browser. `SFSafariViewController` keeps the session cookie jar and
/// reader mode without leaving the app.
struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        let config = SFSafariViewController.Configuration()
        config.barCollapsingEnabled = true
        let controller = SFSafariViewController(url: url, configuration: config)
        controller.preferredControlTintColor = UIColor(TLColor.accent)
        controller.dismissButtonStyle = .close
        return controller
    }

    func updateUIViewController(_ controller: SFSafariViewController, context: Context) {}
}

/// `Identifiable` wrapper so a `URL` can drive `.sheet(item:)`.
struct IdentifiedURL: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}
