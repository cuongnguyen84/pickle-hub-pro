import Foundation
import Testing
@testable import ThePickleHub

@Suite("Shop P2b public contract")
struct ShopPublicContractTests {
    @Test("Search card decodes server-derived price and tri-state availability")
    func searchPageDecoding() throws {
        let json = #"""
        {"rows":[{"id":"20000000-0000-0000-0000-000000000001","slug":"vot-carbon","title":"Vợt carbon","condition":"new","created_at":"2026-08-12T01:02:03Z","category":{"slug":"vot","name":"Vợt"},"shop":{"slug":"shop-a","name":"Shop A","verified":true},"price_min":1590000,"price_max":1690000,"discount_pct_max":20,"compare_at_min":1990000,"availability":"unknown","cover":{"public_path":"shop-a/product-a/v1/cover.webp","alt_text":"Vợt màu đen","width":1200,"height":900}}],"total":1,"has_more":false}
        """#
        let page = try JSONDecoder.shopPublic.decode(ShopPublicSearchPageDTO.self, from: Data(json.utf8))
        #expect(page.total == 1)
        #expect(page.rows[0].priceMin == 1_590_000)
        #expect(page.rows[0].discountPercentMax == 20)
        #expect(page.rows[0].compareAtMin == 1_990_000)
        #expect(page.rows[0].availability == .unknown)
        #expect(page.rows[0].availability?.label == "Liên hệ shop để hỏi số lượng")
    }

    @Test("PDP accepts only the public projection boundary")
    func productBoundary() throws {
        let product = try decodeProduct(stock: "null", path: "null", publicPath: "\"shop-a/product-a/v1/main.webp\"")
        #expect(product.product?.respectsPublicBoundary == true)
        #expect(product.product?.variants[0].mediaID == product.product?.media[0].id)
        #expect(product.product?.variants[0].compareAtPriceVND == 1_990_000)
        #expect(product.product?.specs?["Độ dày"] == "16 mm")

        let leakedStock = try decodeProduct(stock: "4", path: "null", publicPath: "\"shop-a/product-a/v1/main.webp\"")
        #expect(leakedStock.product?.respectsPublicBoundary == false)

        let leakedDraft = try decodeProduct(stock: "null", path: "\"draft/source.webp\"", publicPath: "\"shop-a/product-a/v1/main.webp\"")
        #expect(leakedDraft.product?.respectsPublicBoundary == false)
    }

    @Test("Discount percent floors exactly like production search")
    func discountPercentContract() {
        let variant = ShopVariant(
            id: UUID(), sku: nil, optionValues: [:], priceVND: 780_000,
            compareAtPriceVND: 1_000_000, stockOnHand: nil, mediaID: nil
        )
        #expect(variant.discountPercent == 22)

        let belowOnePercent = ShopVariant(
            id: UUID(), sku: nil, optionValues: [:], priceVND: 1_999_999,
            compareAtPriceVND: 2_000_000, stockOnHand: nil, mediaID: nil
        )
        #expect(belowOnePercent.discountPercent == nil)
    }

    @Test("Approved media URL rejects signed, absolute, draft and traversal paths")
    func mediaPathPolicy() throws {
        let accepted = ShopPublicMediaDTO(publicPath: "shop/product/v1/photo.webp", altText: nil, width: nil, height: nil)
        #expect(try accepted.publicURL(supabaseURL: URL(string: "https://example.supabase.co")!).absoluteString ==
                "https://example.supabase.co/storage/v1/object/public/shop-product-media/shop/product/v1/photo.webp")

        for path in [
            "https://evil.example/photo.webp",
            "shop/product.webp?token=secret",
            "../private/original.webp",
            "draft/product.webp",
            "/shop/product.webp",
        ] {
            #expect(!ShopPublicMediaDTO.isApprovedPublicPath(path))
        }
    }

    @Test("Not-found and redirects decode without an existence oracle")
    func redirectResults() throws {
        let product = try JSONDecoder.shopPublic.decode(
            ShopPublicProductResultDTO.self,
            from: Data(#"{"found":false,"redirect_to":"new-slug"}"#.utf8)
        )
        #expect(!product.found)
        #expect(product.redirectTo == "new-slug")

        let shop = try JSONDecoder.shopPublic.decode(
            ShopPublicShopResultDTO.self,
            from: Data(#"{"found":false}"#.utf8)
        )
        #expect(!shop.found)
        #expect(shop.redirectTo == nil)
    }

    private func decodeProduct(stock: String, path: String, publicPath: String) throws -> ShopPublicProductResultDTO {
        let json = """
        {"found":true,"redirect_to":null,"contacts":[],"product":{"id":"20000000-0000-0000-0000-000000000001","slug":"vot-carbon","title":"Vợt carbon","description":"Mô tả","specs":{"Độ dày":"16 mm"},"condition":"new","category":{"slug":"vot","name":"Vợt"},"shop":{"slug":"shop-a","name":"Shop A","region":"HCM","verified":true,"shipping_note":null,"return_note":null},"option_groups":[{"name":"Màu","values":["Đen"]}],"variants":[{"id":"30000000-0000-0000-0000-000000000001","option_values":{"Màu":"Đen"},"option_key":"Màu=Đen","sku":"SKU-1","price_vnd":1590000,"compare_at_price_vnd":1990000,"availability":"unknown","stock_on_hand":\(stock),"media_id":"40000000-0000-0000-0000-000000000001"}],"media":[{"id":"40000000-0000-0000-0000-000000000001","alt_text":"Vợt đen","position":0,"path":\(path),"public_path":\(publicPath),"width":1200,"height":900}],"primary_media_id":"40000000-0000-0000-0000-000000000001","is_published":true,"is_preview":false}}
        """
        return try JSONDecoder.shopPublic.decode(ShopPublicProductResultDTO.self, from: Data(json.utf8))
    }
}
