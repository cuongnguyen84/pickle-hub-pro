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

    @Test("Results board styles ship in the document template")
    func resultsBoardStyles() {
        let document = ArticleDocument.document("<div class=\"tl-rb-summary\"></div>")
        // Khuôn tổng quát cho bài kết quả (web PR #917/#918): summary, chip neo,
        // thẻ trận, thắng/thua, cột tỉ số, vòng thu gọn — thiếu một là bài kết
        // quả trong app hiển thị mất thiết kế.
        for marker in [".tl-rb-summary", ".tl-rb-chips", ".tl-rb-chip", ".tl-rb-sticky",
                       ".tl-rb-match", ".tl-rb-win", ".tl-rb-lose", ".tl-rb-sets",
                       ".tl-rb-round", ".tl-rb-details", ".tl-rb-status"] {
            #expect(document.contains(marker), "\(marker)")
        }
        // Sticky của app bám đỉnh trang bài (web dùng top 64px cho header cố định).
        #expect(document.contains(".tl-rb-sticky {position: sticky; top: 0;"))
    }
}
