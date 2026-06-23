import SwiftUI
import UIKit
import WebKit

/// In-app article renderer: a chrome-less WKWebView that renders blog
/// `content_html` with The Line dark CSS injected. No Safari, no URL bar — it
/// sits inside a native screen. Relative image paths resolve against the site
/// origin via the base URL.
struct ArticleWebView: UIViewRepresentable {
    let bodyHTML: String

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        webView.isOpaque = false
        webView.backgroundColor = UIColor(TLColor.bg)
        webView.scrollView.backgroundColor = UIColor(TLColor.bg)
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        webView.loadHTMLString(Self.document(bodyHTML), baseURL: WebRoutes.base)
    }

    private static func document(_ body: String) -> String {
        """
        <!doctype html><html><head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
        <style>
          :root { color-scheme: dark; }
          body { margin: 0; padding: 16px 16px 48px; background: #08090a; color: #c7c3bb;
                 font: 17px/1.66 -apple-system, system-ui, sans-serif; -webkit-text-size-adjust: 100%; }
          h1, h2, h3, h4 { color: #f5f3ee; line-height: 1.25; margin: 1.4em 0 0.5em; }
          h1 { font-size: 28px; } h2 { font-size: 22px; } h3 { font-size: 19px; }
          p { margin: 0 0 1em; }
          a { color: #bdee5c; text-decoration: none; }
          img, video, iframe { max-width: 100%; height: auto; border-radius: 10px; margin: 14px 0; display: block; }
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
        </style></head>
        <body>\(body)</body></html>
        """
    }
}
