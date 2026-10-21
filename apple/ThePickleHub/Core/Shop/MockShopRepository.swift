import Foundation

struct MockShopRepository: ShopRepository {
    let catalogue: [ShopProduct]

    init(catalogue: [ShopProduct] = ShopFixtures.products) {
        self.catalogue = catalogue
    }

    func categories() async throws -> [ShopCategory] { ShopCategory.allCases }
    func featuredProducts() async throws -> [ShopProductCardSummary] { catalogue.map(\.cardSummary) }

    func products(category: ShopCategory?, query: String, condition: ShopProductCondition? = nil,
                  verifiedOnly: Bool = false, availableOnly: Bool = false,
                  sort: ShopPublicSearchRequest.Sort = .recent) async throws -> [ShopProductCardSummary] {
        let normalized = query.trimmingCharacters(in: .whitespacesAndNewlines)
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
        var results = catalogue.filter { product in
            let categoryMatches = category == nil || product.category == category
            let conditionMatches = condition == nil || product.condition == condition
            let verifiedMatches = !verifiedOnly || product.seller.isVerified
            let availabilityMatches = !availableOnly || product.isAvailable
            guard categoryMatches, conditionMatches, verifiedMatches, availabilityMatches,
                  !normalized.isEmpty else {
                return categoryMatches && conditionMatches && verifiedMatches && availabilityMatches
            }
            let haystack = [product.title, product.seller.name, product.description]
                .joined(separator: " ")
                .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            return haystack.contains(normalized)
        }
        switch sort {
        case .recent: break
        case .priceAscending: results.sort { $0.minimumPriceVND < $1.minimumPriceVND }
        case .priceDescending: results.sort { $0.minimumPriceVND > $1.minimumPriceVND }
        }
        return results.map(\.cardSummary)
    }

    func product(slug: String) async throws -> ShopProduct? { catalogue.first { $0.slug == slug } }
    func store(slug: String) async throws -> ShopStorefront? {
        catalogue.lazy.map(\.seller).first { $0.slug == slug }.map(\.storefront)
    }
    func products(storeSlug: String) async throws -> [ShopProductCardSummary] {
        catalogue.filter { $0.seller.slug == storeSlug }.map(\.cardSummary)
    }
}

/// Deterministic repository states used by previews, UI tests and failure-state
/// review without coupling production Views to debug flags.
struct ScenarioShopRepository: ShopRepository {
    enum Scenario: Sendable { case normal, empty, unavailable }
    let scenario: Scenario
    private let base = MockShopRepository()

    func categories() async throws -> [ShopCategory] {
        if scenario == .unavailable { throw ShopRepositoryError.unavailable }
        return scenario == .empty ? [] : ShopCategory.allCases
    }
    func featuredProducts() async throws -> [ShopProductCardSummary] {
        if scenario == .unavailable { throw ShopRepositoryError.unavailable }
        return scenario == .empty ? [] : ShopFixtures.products.map(\.cardSummary)
    }
    func products(category: ShopCategory?, query: String, condition: ShopProductCondition? = nil,
                  verifiedOnly: Bool = false, availableOnly: Bool = false,
                  sort: ShopPublicSearchRequest.Sort = .recent) async throws -> [ShopProductCardSummary] {
        if scenario == .unavailable { throw ShopRepositoryError.unavailable }
        if scenario == .empty { return [] }
        return try await base.products(category: category, query: query, condition: condition,
                                       verifiedOnly: verifiedOnly, availableOnly: availableOnly, sort: sort)
    }
    func product(slug: String) async throws -> ShopProduct? {
        if scenario == .unavailable { throw ShopRepositoryError.unavailable }
        return scenario == .empty ? nil : try await base.product(slug: slug)
    }
    func store(slug: String) async throws -> ShopStorefront? {
        if scenario == .unavailable { throw ShopRepositoryError.unavailable }
        return scenario == .empty ? nil : try await base.store(slug: slug)
    }
    func products(storeSlug: String) async throws -> [ShopProductCardSummary] {
        if scenario == .unavailable { throw ShopRepositoryError.unavailable }
        if scenario == .empty { return [] }
        return try await base.products(storeSlug: storeSlug)
    }

}

private extension ShopProduct {
    var cardSummary: ShopProductCardSummary {
        ShopProductCardSummary(
            id: id,
            slug: slug,
            title: title,
            category: category,
            condition: condition,
            seller: ShopSellerSummary(slug: seller.slug, name: seller.name, isVerified: seller.isVerified),
            priceMinVND: minimumPriceVND,
            priceMaxVND: maximumPriceVND,
            availability: isAvailable ? .inStock : .outOfStock,
            coverURL: media.sorted { $0.position < $1.position }.first?.publicURL,
            coverLabel: media.sorted { $0.position < $1.position }.first?.label ?? title,
            createdAt: Date(timeIntervalSince1970: 0)
        )
    }
}

private extension ShopSeller {
    var storefront: ShopStorefront {
        ShopStorefront(
            slug: slug,
            name: name,
            intro: nil,
            region: city,
            isVerified: isVerified,
            shippingNote: shippingNote,
            returnPolicy: returnPolicy,
            primaryCategory: nil,
            productCount: ShopFixtures.products.filter { $0.seller.slug == slug }.count,
            contacts: []
        )
    }
}

enum ShopFixtures {
    static let gearSeller = ShopSeller(
        slug: "pickle-gear-sai-gon",
        name: "Pickle Gear Sài Gòn",
        city: "TP. Hồ Chí Minh",
        isVerified: true,
        isActive: true,
        logoURL: nil,
        coverURL: nil,
        coverFocalY: 0.5,
        shippingNote: "Gửi từ Quận 7, TP.HCM. Shop tự đóng gói và giao hàng.",
        returnPolicy: "Đổi trả trong 7 ngày nếu sản phẩm còn nguyên tem, chưa qua sử dụng."
    )

    static let courtSeller = ShopSeller(
        slug: "san-nha-pickleball-ha-noi",
        name: "Sân Nhà Pickleball Hà Nội",
        city: "Hà Nội",
        isVerified: true,
        isActive: true,
        logoURL: nil,
        coverURL: nil,
        coverFocalY: 0.5,
        shippingNote: "Gửi từ Cầu Giấy, Hà Nội.",
        returnPolicy: nil
    )

    static let products: [ShopProduct] = [
        ShopProduct(
            id: UUID(uuidString: "20000000-0000-0000-0000-000000000001")!,
            slug: "vot-carbon-16mm-control",
            title: "Vợt carbon 16mm Control",
            description: "Mặt carbon nhám, lõi 16mm thiên về kiểm soát. Thông số do người bán cung cấp.",
            category: .paddles,
            condition: .new,
            seller: gearSeller,
            media: media("Vợt carbon đen", 1, count: 3),
            optionOrder: ["Màu"],
            variants: [
                variant("PG-C16-BLK", ["Màu": "Đen"], 2_390_000, 6, 1, 0, 1),
                variant("PG-C16-WHT", ["Màu": "Trắng"], 2_390_000, 3, 1, 1, 2)
            ],
            attributes: ["Độ dày": "16 mm", "Bề mặt": "Carbon", "Lối chơi": "Kiểm soát"]
        ),
        ShopProduct(
            id: UUID(uuidString: "20000000-0000-0000-0000-000000000002")!,
            slug: "giay-pickleball-court-pro",
            title: "Giày Pickleball Court Pro",
            description: "Giày sân cứng với phần mũi rộng và đế bám đa hướng.",
            category: .shoes,
            condition: .new,
            seller: gearSeller,
            media: media("Giày Court Pro", 4, count: 3),
            optionOrder: ["Màu", "Kích cỡ"],
            variants: [
                variant("CP-W-39", ["Màu": "Trắng", "Kích cỡ": "39"], 1_590_000, 4, 4, 0, 3),
                variant("CP-W-40", ["Màu": "Trắng", "Kích cỡ": "40"], 1_590_000, 0, 4, 0, 4),
                variant("CP-B-39", ["Màu": "Xanh", "Kích cỡ": "39"], 1_690_000, 2, 4, 1, 5),
                variant("CP-B-40", ["Màu": "Xanh", "Kích cỡ": "40"], 1_690_000, nil, 4, 1, 6)
            ],
            attributes: ["Mặt sân": "Sân cứng", "Form": "Mũi rộng"]
        ),
        ShopProduct(
            id: UUID(uuidString: "20000000-0000-0000-0000-000000000003")!,
            slug: "bong-ngoai-troi-40-lo",
            title: "Bóng ngoài trời 40 lỗ — hộp 6 quả",
            description: "Bóng dành cho sân ngoài trời. Màu và số lượng theo phiên bản đã chọn.",
            category: .balls,
            condition: .new,
            seller: courtSeller,
            media: media("Bóng ngoài trời", 7, count: 2),
            optionOrder: [],
            variants: [variant("BALL-OUT-6", [:], 289_000, nil, 7, 0, 7)],
            attributes: ["Loại sân": "Ngoài trời", "Quy cách": "6 quả"]
        ),
        ShopProduct(
            id: UUID(uuidString: "20000000-0000-0000-0000-000000000004")!,
            slug: "tui-vot-court-day",
            title: "Túi vợt Court Day",
            description: "Túi gọn nhẹ cho hai vợt và phụ kiện cá nhân.",
            category: .bags,
            condition: .new,
            seller: courtSeller,
            media: media("Túi Court Day", 9, count: 2),
            optionOrder: [],
            variants: [variant("BAG-CD", [:], 790_000, 5, 9, 0, 8)],
            attributes: ["Sức chứa": "2 vợt", "Chất liệu": "Polyester"]
        )
    ]

    private static func media(_ label: String, _ seed: Int, count: Int) -> [ShopProductMedia] {
        (0..<count).map { index in
            ShopProductMedia(
                id: UUID(uuidString: String(format: "30000000-0000-0000-0000-%012d", seed * 10 + index))!,
                label: "\(label) — ảnh \(index + 1)", publicURL: nil,
                position: index, accentSeed: seed + index
            )
        }
    }

    private static func variant(
        _ sku: String, _ options: [String: String], _ price: Int, _ stock: Int?,
        _ mediaSeed: Int, _ mediaIndex: Int, _ seed: Int
    ) -> ShopVariant {
        ShopVariant(
            id: UUID(uuidString: String(format: "40000000-0000-0000-0000-%012d", seed))!,
            sku: sku, optionValues: options, priceVND: price,
            stockOnHand: stock, mediaID: mediaID(seed: mediaSeed, index: mediaIndex)
        )
    }

    private static func mediaID(seed: Int, index: Int) -> UUID {
        UUID(uuidString: String(format: "30000000-0000-0000-0000-%012d", seed * 10 + index))!
    }
}
