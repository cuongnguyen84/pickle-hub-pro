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
          /* Results board (bài kết quả giải): port nguyên khối .tl-rb-* của web
             (src/styles/the-line.css), biến --tl-* đã quy về literal theo palette trên.
             Khuôn TỔNG QUÁT cho mọi bài kết quả do generator xuất bản — markup nằm
             sẵn trong content_html, chỉ cần CSS này để hiển thị đúng thiết kế. */
          .tl-rb-summary {background: #131416; border: 1px solid #22252a;
            border-radius: 14px; padding: 14px 16px; margin: 18px 0 6px; }
          .tl-rb-summary h3 {margin: 0 0 6px; font-size: 12px; letter-spacing: 0.08em;
            text-transform: uppercase; color: #93908a; }
          .tl-rb-srow {display: flex; justify-content: space-between; gap: 12px;
            padding: 7px 0; border-top: 1px solid #22252a; }
          .tl-rb-srow:first-of-type {border-top: none; }
          .tl-rb-sdiv {color: #c7c3bb; }
          .tl-rb-sval {font-weight: 600; text-align: right; }
          .tl-rb-sval small {display: block; color: #93908a; font-weight: 400; font-size: 12px; }
          .tl-rb-sticky {position: sticky; top: 0; z-index: 30;
            background: color-mix(in oklab, #08090a 88%, transparent);
            -webkit-backdrop-filter: blur(14px) saturate(1.1);
            backdrop-filter: blur(14px) saturate(1.1);
            padding: 8px 0 10px; margin-top: 10px; }
          .tl-rb-chips {display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none;
            padding-bottom: 8px; }
          .tl-rb-chips::-webkit-scrollbar {display: none; }
          .tl-rb-chip {white-space: nowrap; border: 1px solid #22252a;
            background: #131416; color: #f5f3ee;
            border-radius: 999px; padding: 7px 13px; font-size: 13.5px;
            text-decoration: none; }
          .tl-rb-search {width: 100%; background: #131416;
            border: 1px solid #22252a; border-radius: 10px;
            color: #f5f3ee; padding: 10px 12px; font-size: 14.5px; }
          .tl-rb-search::placeholder {color: #93908a; }
          .tl-rb-drawsub {color: #93908a; font-size: 13px; margin-top: -6px; }
          .tl-rb-round {font-size: 12.5px; letter-spacing: 0.07em; text-transform: uppercase;
            color: #b5e853; margin: 18px 0 8px; }
          .tl-rb-match {background: #131416; border: 1px solid #22252a;
            border-radius: 14px; padding: 9px 12px; margin-bottom: 8px;
            display: flex; justify-content: space-between; gap: 12px; }
          .tl-rb-teams {min-width: 0; }
          .tl-rb-win {font-weight: 700; color: #f5f3ee; }
          .tl-rb-win::after {content: " ✓"; color: #b5e853; font-weight: 400; }
          .tl-rb-lose {color: #c7c3bb; }
          .tl-rb-team {color: #f5f3ee; }
          .tl-rb-status {color: #93908a; font-size: 12px; text-transform: capitalize; }
          .tl-rb-sets {font-family: "Geist Mono", ui-monospace, monospace; font-size: 13px;
            text-align: right; white-space: nowrap; color: #c7c3bb;
            font-variant-numeric: tabular-nums; }
          .tl-rb-sets strong {color: #f5f3ee; }
          .tl-rb-details {background: #1a1c1f; border: 1px solid #22252a;
            border-radius: 14px; padding: 4px 12px; margin: 10px 0; }
          .tl-rb-details summary {cursor: pointer; padding: 8px 0; font-weight: 600;
            color: #c7c3bb; font-size: 14px; }
          .tl-rb-details .tl-rb-match {background: #131416; }
        </style></head>
        <body>\(body)</body></html>
        """
    }
}
