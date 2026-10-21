import Foundation
import Testing
@testable import ThePickleHub

struct WprSnapshotTests {
    @Test func bundledSnapshotDecodesAndMatchesWebShape() {
        let data = WprSnapshot.data
        #expect(data != nil)
        #expect(data?.men.count == 25 && data?.women.count == 25)
        #expect(data?.men.map(\.rank) == Array(1...25))          // top 25, ordered
        #expect(!(data?.vietHighlights.isEmpty ?? true))
        #expect(data?.vietHighlights.contains { $0.countryCode == "vn" } == true)
        #expect(WprSnapshot.sourceURL.host == "www.ppatour.com")
        let label = WprSnapshot.fetchedLabel(locale: Locale(identifier: "vi_VN"))
        #expect(!label.isEmpty && !label.hasPrefix("ngày"))   // copy already says "lấy ngày …"
    }

    @Test func formattingMatchesWeb() {
        #expect(WprSnapshot.points(12212.5, locale: Locale(identifier: "vi_VN")) == "12.212,5")
        #expect(WprSnapshot.points(19287.5, locale: Locale(identifier: "en_GB")) == "19,287.5")
        #expect(WprSnapshot.points(2754.375, locale: Locale(identifier: "vi_VN")) == "2.754,4")  // maximumFractionDigits 1
        #expect(WprSnapshot.flag("vn") == "🇻🇳")
        #expect(WprSnapshot.flag("us") == "🇺🇸")
        #expect(WprSnapshot.countryName("vn", fallback: "Vietnam", locale: Locale(identifier: "vi_VN")) == "Việt Nam")
    }
}
