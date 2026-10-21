import Foundation
import Testing
@testable import ThePickleHub

@Suite("Shop approved image policy")
struct ShopImagePolicyTests {
    @Test("Approved rendition requests bypass the persistent URL cache")
    func requestPolicy() throws {
        let url = try #require(URL(string: "https://example.com/product-media/versioned.webp"))
        let request = ShopImageRequestPolicy.request(for: url)
        #expect(request.cachePolicy == .reloadIgnoringLocalCacheData)
        #expect(request.value(forHTTPHeaderField: "Accept")?.contains("image/webp") == true)
    }

    @Test("Only successful bounded image responses are accepted")
    func responseValidation() throws {
        let url = try #require(URL(string: "https://example.com/a.webp"))
        let image = try #require(HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: ["Content-Type": "image/webp"]))
        let missing = try #require(HTTPURLResponse(url: url, statusCode: 404, httpVersion: nil, headerFields: ["Content-Type": "image/webp"]))
        let html = try #require(HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: ["Content-Type": "text/html"]))
        #expect(ShopImageRequestPolicy.accepts(response: image, bytes: 1_024))
        #expect(!ShopImageRequestPolicy.accepts(response: missing, bytes: 1_024))
        #expect(!ShopImageRequestPolicy.accepts(response: html, bytes: 1_024))
        #expect(!ShopImageRequestPolicy.accepts(response: image, bytes: ShopImageRequestPolicy.maximumBytes + 1))
    }
}
