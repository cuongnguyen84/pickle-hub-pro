import Foundation
import Testing
@testable import ThePickleHub

@Suite("Article web view hardening")
struct ArticleWebViewTests {
    @Test("The static document has a restrictive CSP")
    func restrictiveCSP() {
        let document = ArticleDocument.document("<p>Hello</p>")
        #expect(document.contains("script-src 'none'"))
        #expect(document.contains("frame-src 'none'"))
        #expect(document.contains("form-action 'none'"))
        #expect(document.contains("base-uri 'none'"))
    }

    @Test("Only trusted initial documents and safe HTTPS links are accepted")
    func navigationAllowlist() throws {
        #expect(ArticleNavigationPolicy.allowsInitialDocument(try #require(URL(string: "about:blank"))))
        #expect(ArticleNavigationPolicy.allowsInitialDocument(try #require(URL(string: "https://www.thepicklehub.net/vi/blog/a"))))
        #expect(!ArticleNavigationPolicy.allowsInitialDocument(try #require(URL(string: "https://evil.example/a"))))
        #expect(ArticleNavigationPolicy.allowsExternalOpen(try #require(URL(string: "https://example.com/story"))))
        #expect(!ArticleNavigationPolicy.allowsExternalOpen(try #require(URL(string: "http://example.com/story"))))
        #expect(!ArticleNavigationPolicy.allowsExternalOpen(try #require(URL(string: "javascript:alert(1)"))))
        #expect(!ArticleNavigationPolicy.allowsExternalOpen(try #require(URL(string: "https://user:pass@example.com"))))
    }

    @Test("Identical SwiftUI updates do not reload the document")
    func unchangedBodyDoesNotReload() {
        var state = ArticleDocumentState()
        let first = state.shouldLoad("one")
        let duplicate = state.shouldLoad("one")
        let changed = state.shouldLoad("two")
        #expect(first)
        #expect(!duplicate)
        #expect(changed)
    }

    @Test("Editorial metadata is HTML escaped")
    func metadataEscaping() {
        #expect(ArticleHTML.escapeText("A < B & \"C\"") == "A &lt; B &amp; &quot;C&quot;")
    }

    @Test("Native news document includes the full body without an origin link")
    func nativeNewsDocument() {
        let detail = NewsArticleDetail(
            title: "A < B",
            summary: "Tóm tắt & mở bài",
            contentHtml: "<h2>Nội dung</h2><p>Toàn bộ bài viết.</p>",
            imageURL: "https://images.example.com/cover.jpg",
            source: "The Kitchen",
            language: "vi",
            category: "tour",
            publishedAt: nil,
            aiTranslated: true
        )

        let html = NewsArticleHTML.body(detail)
        #expect(html.contains("A &lt; B"))
        #expect(html.contains("Tóm tắt &amp; mở bài"))
        #expect(html.contains("<h2>Nội dung</h2><p>Toàn bộ bài viết.</p>"))
        #expect(html.contains("THE KITCHEN"))
        #expect(html.contains(">AI</b>"))
        #expect(!html.contains("source_url"))
        #expect(!html.contains("Đọc toàn bộ"))
    }
}
