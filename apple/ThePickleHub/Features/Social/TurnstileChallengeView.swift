import SwiftUI
import WebKit

/// Cloudflare Turnstile runs in a small WKWebView and returns only the
/// short-lived challenge token to Swift. Server-side Siteverify remains the
/// authority; this view never receives the Turnstile secret.
struct TurnstileChallengeView: UIViewRepresentable {
    let siteKey: String
    let onVerify: (String) -> Void
    let onError: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onVerify: onVerify, onError: onError)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.userContentController.add(context.coordinator, name: "turnstile")

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.navigationDelegate = context.coordinator
        webView.loadHTMLString(TurnstileHTML.document(siteKey: siteKey), baseURL: WebRoutes.base)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.onVerify = onVerify
        context.coordinator.onError = onError
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.stopLoading()
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "turnstile")
        webView.navigationDelegate = nil
    }

    @MainActor
    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        var onVerify: (String) -> Void
        var onError: () -> Void

        init(onVerify: @escaping (String) -> Void, onError: @escaping () -> Void) {
            self.onVerify = onVerify
            self.onError = onError
        }

        func userContentController(_ userContentController: WKUserContentController,
                                   didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any],
                  let type = body["type"] as? String else { return }
            if type == "verified", let token = body["token"] as? String, !token.isEmpty {
                onVerify(token)
            } else if type == "error" || type == "expired" {
                onError()
            }
        }

        func webView(_ webView: WKWebView,
                     decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
            guard navigationAction.targetFrame?.isMainFrame == true,
                  let url = navigationAction.request.url else {
                return .allow
            }
            let allowed = url.scheme == "about" ||
                (url.scheme == "https" && ["thepicklehub.net", "www.thepicklehub.net",
                                            "challenges.cloudflare.com"].contains(url.host ?? ""))
            return allowed ? .allow : .cancel
        }
    }
}

enum TurnstileHTML {
    static func document(siteKey: String) -> String {
        let keyLiteral = jsonString(siteKey)
        return """
        <!doctype html>
        <html><head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src https://challenges.cloudflare.com 'unsafe-inline'; frame-src https://challenges.cloudflare.com; connect-src https://challenges.cloudflare.com; style-src 'unsafe-inline'">
          <style>html,body{margin:0;background:transparent}#challenge{display:flex;justify-content:center;min-height:70px}</style>
          <script>
            function send(type, token) { window.webkit.messageHandlers.turnstile.postMessage({type:type, token:token || ''}); }
            function ready() {
              turnstile.render('#challenge', {
                sitekey: \(keyLiteral), theme: 'auto', size: 'flexible',
                callback: function(token) { send('verified', token); },
                'error-callback': function() { send('error'); },
                'expired-callback': function() { send('expired'); }
              });
            }
          </script>
          <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=ready" async defer></script>
        </head><body><div id="challenge"></div></body></html>
        """
    }

    private static func jsonString(_ value: String) -> String {
        let data = try? JSONEncoder().encode(value)
        return data.flatMap { String(data: $0, encoding: .utf8) } ?? "\"\""
    }
}
