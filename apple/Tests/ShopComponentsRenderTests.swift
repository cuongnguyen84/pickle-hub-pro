import SwiftUI
import XCTest
@testable import ThePickleHub

@MainActor
final class ShopComponentsRenderTests: XCTestCase {
    private let product = ShopFixtures.products[1]

    private var productSummary: ShopProductCardSummary {
        get async throws {
            try await MockShopRepository().featuredProducts()[1]
        }
    }

    private func assertRenders<V: View>(
        _ view: V,
        width: CGFloat,
        dynamicTypeSize: DynamicTypeSize = .large,
        _ name: String
    ) {
        let host = UIHostingController(
            rootView: view.dynamicTypeSize(dynamicTypeSize)
        )
        host.view.frame = CGRect(x: 0, y: 0, width: width, height: 1_000)
        host.view.layoutIfNeeded()
        let size = host.sizeThatFits(in: CGSize(width: width, height: .greatestFiniteMagnitude))
        XCTAssertGreaterThan(size.height, 0, "\(name) collapsed at width \(width)")
        XCTAssertTrue(size.height.isFinite, "\(name) has unbounded height at width \(width)")
        XCTAssertLessThanOrEqual(size.width, width + 0.5, "\(name) overflows width \(width)")
    }

    func testCommerceComponentsRenderAcrossSupportedWidths() {
        for width in [320.0, 375.0, 414.0, 768.0] {
            assertRenders(ShopProductRow(product: product), width: width, "product row")
            assertRenders(
                ShopStickyCommerceBar(
                    product: product,
                    selectionLabel: "Xanh / 39",
                    actionTitle: "Thêm vào giỏ"
                ) {},
                width: width,
                "sticky commerce bar"
            )
        }
    }

    func testProductSummaryRowRendersAcrossSupportedWidths() async throws {
        let summary = try await productSummary
        for width in [320.0, 375.0, 414.0, 768.0] {
            assertRenders(
                ShopProductSummaryRow(product: summary),
                width: width,
                "product summary row"
            )
        }
    }

    func testCardFirstProductCardFitsTwoColumnPhoneGrid() async throws {
        let summary = try await productSummary
        for width in [140.0, 167.0, 186.0, 360.0] {
            assertRenders(
                ShopProductCard(product: summary),
                width: width,
                "card-first product card"
            )
        }
    }

    func testInteractiveComponentsRenderAtAccessibilitySize() {
        assertRenders(
            ShopVariantOptionGroup(
                option: "Kích cỡ",
                values: ["39", "40", "41"],
                selectedValue: .constant("39"),
                isAvailable: { $0 != "41" }
            ),
            width: 320,
            dynamicTypeSize: .accessibility3,
            "variant options"
        )
        assertRenders(
            ShopQuantityControl(quantity: .constant(2), maximum: 5),
            width: 320,
            dynamicTypeSize: .accessibility3,
            "quantity control"
        )
        assertRenders(
            ShopWishlistButton(productTitle: product.title, isSaved: true) {},
            width: 320,
            dynamicTypeSize: .accessibility3,
            "wishlist button"
        )
    }

    func testFixtureBackedScreensRenderAtAccessibilitySize() {
        // NavigationStack reports zero sizeThatFits in a bare hosting controller;
        // the screen bodies still build their NavigationLink destinations here.
        assertRenders(
            ShopHomeView(repository: ScenarioShopRepository(scenario: .normal)),
            width: 320,
            dynamicTypeSize: .accessibility3,
            "Shop home"
        )
        assertRenders(
            ShopSearchView(repository: ScenarioShopRepository(scenario: .normal)),
            width: 768,
            dynamicTypeSize: .accessibility3,
            "Shop search"
        )
    }


    func testWishlistPresentationStatesRenderHonestly() async throws {
        let summary = try await productSummary
        let states: [(ShopWishlistPresentationState, String)] = [
            (.loading, "wishlist loading"),
            (.empty, "wishlist empty"),
            (.unavailable, "wishlist unavailable"),
            (.loaded([summary]), "wishlist explicitly injected review rows"),
        ]

        for (state, name) in states {
            assertRenders(
                ShopWishlistView(state: state),
                width: 320,
                dynamicTypeSize: .accessibility3,
                name
            )
        }
    }

}
