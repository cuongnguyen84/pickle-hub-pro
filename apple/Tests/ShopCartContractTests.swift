import Foundation
import Testing
@testable import ThePickleHub

@Suite("Shop Phase 3 cart contract")
struct ShopCartContractTests {
    @Test("shop_cart_view decodes groups, current prices and unavailable reasons")
    func cartViewDecoding() throws {
        let json = #"""
        [{"shop":{"slug":"shop-a","name":"Shop A","state":"active","ordering_enabled":true,"shipping_fee_vnd":30000},"lines":[{"cart_item_id":"10000000-0000-0000-0000-000000000001","variant_id":"20000000-0000-0000-0000-000000000001","qty":2,"product_id":"30000000-0000-0000-0000-000000000001","product_slug":"vot-carbon","product_title":"Vợt carbon","option_values":{"Màu":"Đen"},"sku":"SKU-1","unit_price_vnd":1590000,"line_total_vnd":3180000,"stock_on_hand":1,"cover":{"id":"40000000-0000-0000-0000-000000000001","alt_text":"Vợt đen","public_path":"shop-a/product-a/v1/main.webp","width":1200,"height":900},"unavailable_reason":"out_of_stock"}]}]
        """#
        let groups = try JSONDecoder().decode([ShopCartGroup].self, from: Data(json.utf8))
        #expect(groups.count == 1)
        #expect(groups[0].shop.shippingFeeVND == 30_000)
        #expect(groups[0].lines[0].quantity == 2)
        #expect(groups[0].lines[0].lineTotalVND == 3_180_000)
        #expect(groups[0].lines[0].unavailableReason == .outOfStock)
        #expect(groups[0].lines[0].cover?.publicURL != nil)
    }

    @Test("Cart boundary preserves server quantity ceiling and stable copy")
    func cartBoundary() {
        #expect(SupabaseShopCartRepository.maximumQuantity == 10)
        #expect(ShopCartUnavailableReason.orderingDisabled.message == "Shop chưa nhận đơn")
        #expect(ShopCartError.invalidQuantity.errorDescription?.contains("1 đến 10") == true)
    }
}
