import Testing
@testable import ThePickleHub

@Suite("Shop product specs")
struct ShopProductSpecsTests {
    @Test("Paddle specs follow the web dictionary order, labels and units")
    func paddlePresentation() {
        let rows = ShopProductSpecs.rows(category: .paddles, attributes: [
            "grip_mm": "107", "brand": "Joola", "weight_g": "220",
            "core_mm": "16 mm", "legacy_key": "Giữ nguyên",
        ])
        #expect(rows.map(\.label) == [
            "Thương hiệu", "Trọng lượng", "Độ dày lõi", "Chu vi cán", "legacy_key",
        ])
        #expect(rows.map(\.value) == ["Joola", "220 g", "16 mm", "107 mm", "Giữ nguyên"])
    }

    @Test("Specs retained after a category change stay hidden")
    func unrelatedCategory() {
        #expect(ShopProductSpecs.rows(category: .shoes, attributes: ["weight_g": "220"]).isEmpty)
    }
}
