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
