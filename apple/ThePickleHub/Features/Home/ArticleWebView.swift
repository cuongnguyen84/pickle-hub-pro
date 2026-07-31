import SwiftUI
import UIKit
import WebKit

/// In-app article renderer for trusted editorial HTML. The web view is a static
/// document surface: JavaScript, forms, frames and in-view top-level navigation
/// are disabled. Safe HTTPS links leave the renderer and open in the system.
struct ArticleWebView: UIViewRepresentable {
    let bodyHTML: String

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = false
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        configuration.websiteDataStore = .nonPersistent()
        configuration.mediaTypesRequiringUserActionForPlayback = .all

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = UIColor(TLColor.bg)
        webView.scrollView.backgroundColor = UIColor(TLColor.bg)
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = false
        webView.allowsLinkPreview = false
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.load(bodyHTML, in: webView)
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate {
        private var documentState = ArticleDocumentState()
        private var loadingInitialDocument = false

        func load(_ bodyHTML: String, in webView: WKWebView) {
            guard documentState.shouldLoad(bodyHTML) else { return }
            loadingInitialDocument = true
            webView.loadHTMLString(ArticleDocument.document(bodyHTML), baseURL: WebRoutes.base)
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction
        ) async -> WKNavigationActionPolicy {
            guard navigationAction.targetFrame?.isMainFrame != false,
                  let url = navigationAction.request.url else {
                return .cancel
            }

            if loadingInitialDocument,
               navigationAction.navigationType == .other,
               ArticleNavigationPolicy.allowsInitialDocument(url) {
                return .allow
            }

            if navigationAction.navigationType == .linkActivated,
               ArticleNavigationPolicy.allowsExternalOpen(url) {
                await UIApplication.shared.open(url)
            }
            return .cancel
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            loadingInitialDocument = false
        }

        func webView(
            _ webView: WKWebView,
            didFail navigation: WKNavigation!,
            withError error: Error
        ) {
            loadingInitialDocument = false
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            loadingInitialDocument = false
        }
    }
}

struct ArticleDocumentState {
    private var lastBodyHTML: String?

    mutating func shouldLoad(_ bodyHTML: String) -> Bool {
        guard bodyHTML != lastBodyHTML else { return false }
        lastBodyHTML = bodyHTML
        return true
    }
}

enum ArticleNavigationPolicy {
    static func allowsInitialDocument(_ url: URL) -> Bool {
        if url.scheme?.lowercased() == "about" { return url.absoluteString == "about:blank" }
        guard url.scheme?.lowercased() == "https",
              let host = url.host?.lowercased() else { return false }
        return host == "thepicklehub.net" || host == "www.thepicklehub.net"
    }

    static func allowsExternalOpen(_ url: URL) -> Bool {
        guard url.scheme?.lowercased() == "https",
              url.host?.isEmpty == false,
              url.user == nil,
              url.password == nil else { return false }
        return true
    }
}

enum ArticleHTML {
    static func escapeText(_ value: String) -> String {
        value
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "'", with: "&#39;")
    }
}

enum ArticleDocument {
    static func document(_ body: String) -> String {
        """
        <!doctype html><html><head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; media-src https:; script-src 'none'; frame-src 'none'; connect-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'">
        <style>
          :root { color-scheme: dark; }
          body { margin: 0; padding: 16px 16px 48px; background: #08090a; color: #c7c3bb;
                 font: 17px/1.66 -apple-system, system-ui, sans-serif; -webkit-text-size-adjust: 100%; }
          h1, h2, h3, h4 { color: #f5f3ee; line-height: 1.25; margin: 1.4em 0 0.5em; }
          h1 { font-size: 28px; } h2 { font-size: 22px; } h3 { font-size: 19px; }
          p { margin: 0 0 1em; }
          a { color: #bdee5c; text-decoration: none; }
          img, video { max-width: 100%; height: auto; border-radius: 10px; margin: 14px 0; display: block; }
          iframe, object, embed, form { display: none !important; }
          ul, ol { padding-left: 1.2em; }
          li { margin: 0.3em 0; }
          blockquote { border-left: 3px solid #b5e853; margin: 16px 0; padding: 2px 0 2px 14px;
                       color: #86837d; font-style: italic; }
          code, pre { background: #131416; border-radius: 6px; padding: 2px 6px;
                      font-family: ui-monospace, monospace; font-size: 14px; }
          pre { padding: 12px; overflow-x: auto; }
          hr { border: none; border-top: 1px solid #22252a; margin: 22px 0; }
          table { width: 100%; border-collapse: collapse; }
          td, th { border: 1px solid #22252a; padding: 6px 8px; }
          .news-article .hero { width: 100%; aspect-ratio: 16 / 9; object-fit: cover;
                                border-radius: 14px; margin: 4px 0 18px; }
          .news-article .eyebrow { margin: 0 0 18px; color: #8c897f;
                                   font: 600 12px/1.4 ui-monospace, SFMono-Regular, monospace;
                                   letter-spacing: .08em; }
          .news-article .eyebrow span { color: #bdee5c; }
          .news-article .eyebrow b { color: #eab64b; }
          .news-article .headline { margin: 0 0 18px; color: #f5f3ee;
                                    font: italic 42px/1.12 Georgia, 'Times New Roman', serif;
                                    letter-spacing: -.015em; }
          .news-article .dek { margin: 0 0 24px; color: #c7c3bb; font-size: 18px; line-height: 1.58; }
          .news-article .article-body { border-top: 1px solid #22252a; padding-top: 22px; }
        </style></head>
        <body>\(body)</body></html>
        """
    }
}
