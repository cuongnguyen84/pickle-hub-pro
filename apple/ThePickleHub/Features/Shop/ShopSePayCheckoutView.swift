import SwiftUI
import WebKit

/// Hosted SePay checkout loaded by POST. Merchant secrets never enter the app;
/// the server returns only the signed fields that a browser form must submit.
struct ShopSePayCheckoutView: UIViewRepresentable {
    let checkout: ShopSePayCheckout
    let orderCode: String
    let onReturn: @MainActor () -> Void
    let onError: @MainActor (String) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        context.coordinator.load(checkout: checkout, in: webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        private static let allowedFields: Set<String> = [
            "operation", "payment_method", "order_invoice_number", "order_amount", "currency",
            "order_description", "success_url", "error_url", "cancel_url", "merchant", "signature"
        ]
        private static let requiredFields: Set<String> = [
            "operation", "payment_method", "order_invoice_number", "order_amount", "currency",
            "merchant", "signature"
        ]

        private let parent: ShopSePayCheckoutView
        init(_ parent: ShopSePayCheckoutView) { self.parent = parent }

        func load(checkout: ShopSePayCheckout, in webView: WKWebView) {
            guard let action = URL(string: checkout.checkoutURL),
                  action.scheme == "https",
                  ["pay-sandbox.sepay.vn", "pay.sepay.vn"].contains(action.host ?? ""),
                  action.path == "/v1/checkout/init",
                  !checkout.fields.isEmpty,
                  Set(checkout.fields.keys).isSubset(of: Self.allowedFields),
                  Self.requiredFields.isSubset(of: Set(checkout.fields.keys)) else {
                Task { @MainActor in parent.onError("Địa chỉ thanh toán SePay không hợp lệ.") }
                return
            }
            let controls = checkout.fields.sorted { $0.key < $1.key }.map {
                "<input type=\"hidden\" name=\"\(escape($0.key))\" value=\"\(escape($0.value))\">"
            }.joined()
            let html = """
            <!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; form-action https://pay-sandbox.sepay.vn https://pay.sepay.vn; script-src 'unsafe-inline'">
            </head><body><form id="checkout" method="POST" action="\(escape(action.absoluteString))">\(controls)</form>
            <script>document.getElementById('checkout').submit();</script></body></html>
            """
            webView.loadHTMLString(html, baseURL: nil)
        }

        func webView(_ webView: WKWebView,
                     decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
            guard let url = navigationAction.request.url,
                  ["www.thepicklehub.net", "thepicklehub.net"].contains(url.host ?? ""),
                  url.path == "/shop/order/\(parent.orderCode)",
                  URLComponents(url: url, resolvingAgainstBaseURL: false)?
                    .queryItems?.contains(where: { $0.name == "payment" }) == true else {
                return .allow
            }
            parent.onReturn()
            return .cancel
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            Task { @MainActor in parent.onError(error.localizedDescription) }
        }

        private func escape(_ value: String) -> String {
            value.replacingOccurrences(of: "&", with: "&amp;")
                .replacingOccurrences(of: "<", with: "&lt;")
                .replacingOccurrences(of: ">", with: "&gt;")
                .replacingOccurrences(of: "\"", with: "&quot;")
                .replacingOccurrences(of: "'", with: "&#39;")
        }
    }
}
