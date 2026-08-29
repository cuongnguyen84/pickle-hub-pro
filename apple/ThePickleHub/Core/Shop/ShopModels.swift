import Foundation

enum ShopCategory: String, CaseIterable, Codable, Hashable, Sendable, Identifiable {
    case paddles = "vot"
    case shoes = "giay"
    case balls = "bong"
    case bags = "tui-balo"
    case accessories = "grip-phu-kien"
    case apparel = "trang-phuc"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .paddles: "Vợt"
        case .shoes: "Giày"
        case .balls: "Bóng"
        case .bags: "Túi & balo"
        case .accessories: "Phụ kiện"
        case .apparel: "Trang phục"
        }
    }

    var symbol: String {
        switch self {
        case .paddles: "circle.grid.cross"
        case .shoes: "shoe.2.fill"
        case .balls: "circle.hexagongrid.fill"
        case .bags: "backpack.fill"
        case .accessories: "circle.dashed"
        case .apparel: "tshirt.fill"
        }
    }
}

enum ShopProductCondition: String, Codable, Hashable, Sendable {
    case new
    case used

    var title: String { self == .new ? "Mới" : "Đã qua sử dụng" }
}

struct ShopSeller: Identifiable, Codable, Hashable, Sendable {
    let slug: String
    let name: String
    let city: String
    let isVerified: Bool
    let isActive: Bool
    let logoURL: URL?
    let coverURL: URL?
    let coverFocalY: Double
    let shippingNote: String
    let returnPolicy: String?

    var id: String { slug }
}

struct ShopSellerSummary: Codable, Hashable, Sendable {
    let slug: String
    let name: String
    let isVerified: Bool
}

struct ShopProductCardSummary: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let slug: String
    let title: String
    let category: ShopCategory
    let condition: ShopProductCondition
    let seller: ShopSellerSummary
    let priceMinVND: Int?
    let priceMaxVND: Int?
    var discountPercentMax: Int? = nil
    var compareAtMinVND: Int? = nil
    let availability: ShopPublicAvailability
    let coverURL: URL?
    let coverLabel: String
    let createdAt: Date

    var hasPriceRange: Bool {
        guard let minimum = priceMinVND, let maximum = priceMaxVND else { return false }
        return minimum != maximum
    }
}

struct ShopProductPage: Codable, Equatable, Sendable {
    let products: [ShopProductCardSummary]
    let total: Int
    let hasMore: Bool
    let nextCursorAt: Date?
    let nextCursorID: UUID?
    var isOfflineFallback = false
}

struct ShopContact: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let type: String
    let href: URL
    let label: String?
}

struct ShopStorefront: Identifiable, Hashable, Sendable {
    let slug: String
    let name: String
    let intro: String?
    let region: String?
    let isVerified: Bool
    let shippingNote: String?
    let returnPolicy: String?
    let primaryCategory: ShopCategory?
    let productCount: Int
    let contacts: [ShopContact]

    var id: String { slug }
}

struct ShopProductMedia: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let label: String
    let publicURL: URL?
    let position: Int
    let accentSeed: Int
}

struct ShopVariant: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let sku: String?
    let optionValues: [String: String]
    let priceVND: Int
    var compareAtPriceVND: Int? = nil
    let stockOnHand: Int?
    let mediaID: UUID?
    var publicAvailability: ShopPublicAvailability? = nil

    var isAvailable: Bool {
        if let publicAvailability { return publicAvailability != .outOfStock }
        return stockOnHand.map { $0 > 0 } ?? true
    }

    var discountPercent: Int? {
        guard let compareAtPriceVND, compareAtPriceVND > priceVND else { return nil }
        let percent = (compareAtPriceVND - priceVND) * 100 / compareAtPriceVND
        return percent >= 1 ? percent : nil
    }
}

struct ShopProduct: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let slug: String
    let title: String
    let description: String
    let category: ShopCategory
    let condition: ShopProductCondition
    let seller: ShopSeller
    let media: [ShopProductMedia]
    let optionOrder: [String]
    let variants: [ShopVariant]
    let attributes: [String: String]
    var contacts: [ShopContact] = []

    var minimumPriceVND: Int { variants.map(\.priceVND).min() ?? 0 }
    var maximumPriceVND: Int { variants.map(\.priceVND).max() ?? minimumPriceVND }
    var hasPriceRange: Bool { minimumPriceVND != maximumPriceVND }
    var isAvailable: Bool { seller.isActive && variants.contains(where: \.isAvailable) }
    var maximumDiscountPercent: Int? { variants.compactMap(\.discountPercent).max() }

    func mediaIndex(for variant: ShopVariant?) -> Int {
        guard let mediaID = variant?.mediaID,
              let index = media.firstIndex(where: { $0.id == mediaID }) else { return 0 }
        return index
    }

    func matchingVariant(selection: [String: String]) -> ShopVariant? {
        guard optionOrder.allSatisfy({ selection[$0] != nil }) else { return nil }
        return variants.first { variant in
            optionOrder.allSatisfy { variant.optionValues[$0] == selection[$0] }
        }
    }

    func values(for option: String, compatibleWith selection: [String: String]) -> [String] {
        let otherSelections = selection.filter { $0.key != option }
        return variants
            .filter { variant in
                otherSelections.allSatisfy { variant.optionValues[$0.key] == $0.value }
            }
            .compactMap { $0.optionValues[option] }
            .reduce(into: [String]()) { values, value in
                if !values.contains(value) { values.append(value) }
            }
    }
}

struct ShopProductSpecRow: Identifiable, Equatable, Sendable {
    let key: String
    let label: String
    let value: String
    var id: String { key }
}

enum ShopProductSpecs {
    private struct Field {
        let key: String
        let label: String
        let unit: String?
    }

    // Mirrors production web's canonical paddle-spec dictionary and order.
    private static let paddleFields: [Field] = [
        Field(key: "brand", label: "Thương hiệu", unit: nil),
        Field(key: "weight_g", label: "Trọng lượng", unit: "g"),
        Field(key: "core_mm", label: "Độ dày lõi", unit: "mm"),
        Field(key: "face", label: "Chất liệu mặt", unit: nil),
        Field(key: "shape", label: "Hình dáng", unit: nil),
        Field(key: "handle_mm", label: "Chiều dài cán", unit: "mm"),
        Field(key: "grip_mm", label: "Chu vi cán", unit: "mm"),
        Field(key: "usap", label: "Chứng nhận USA Pickleball", unit: nil),
    ]

    static func rows(category: ShopCategory, attributes: [String: String]) -> [ShopProductSpecRow] {
        let cleaned = attributes.compactMapValues { raw -> String? in
            let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            return value.isEmpty ? nil : value
        }
        guard category == .paddles else {
            return cleaned.keys.sorted().map {
                ShopProductSpecRow(key: $0, label: readableFallback($0), value: cleaned[$0]!)
            }
        }

        let knownKeys = Set(paddleFields.map(\.key))
        let knownRows = paddleFields.compactMap { field -> ShopProductSpecRow? in
            guard let rawValue = cleaned[field.key] else { return nil }
            let value: String
            if let unit = field.unit, !rawValue.lowercased().hasSuffix(" \(unit)") {
                value = "\(rawValue) \(unit)"
            } else {
                value = rawValue
            }
            return ShopProductSpecRow(key: field.key, label: field.label, value: value)
        }
        let otherRows = cleaned.keys.filter { !knownKeys.contains($0) }.sorted().map {
            ShopProductSpecRow(key: $0, label: readableFallback($0), value: cleaned[$0]!)
        }
        return knownRows + otherRows
    }

    private static func readableFallback(_ key: String) -> String {
        guard key.contains("_") else { return key }
        return key.replacingOccurrences(of: "_", with: " ").localizedCapitalized
    }
}

enum ShopMoney {
    static func vnd(_ amount: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.groupingSeparator = "."
        formatter.maximumFractionDigits = 0
        return "\(formatter.string(from: NSNumber(value: amount)) ?? String(amount)) ₫"
    }
}

enum ShopRoute: Hashable {
    case search
    case category(ShopCategory)
    case product(String)
    case store(String)
    case wishlist
    case cart
    case orders
    case checkout(String)
    case order(String)
}

enum ShopPaymentMethod: String, Codable, CaseIterable, Sendable {
    case cod
    case bankTransfer = "bank_transfer"
    var title: String { self == .cod ? "Thanh toán khi nhận hàng" : "Chuyển khoản tự động" }
}

enum ShopOrderStatus: String, Codable, Sendable {
    case pending, confirmed, shipped, delivered, cancelled
    var message: String {
        switch self {
        case .pending: "Đang chờ shop xác nhận"
        case .confirmed: "Shop đang chuẩn bị hàng"
        case .shipped: "Đơn đang được giao"
        case .delivered: "Đơn đã giao"
        case .cancelled: "Đơn đã huỷ"
        }
    }
}

struct ShopOrderItem: Codable, Hashable, Sendable, Identifiable {
    let id: UUID
    let productID: UUID
    let variantID: UUID
    let quantity: Int
    let productTitle: String
    let variantLabel: String?
    let sku: String?
    let unitPriceVND: Int
    let lineTotalVND: Int
    enum CodingKeys: String, CodingKey {
        case id, sku
        case productID = "product_id"; case variantID = "variant_id"; case quantity = "qty"
        case productTitle = "product_title"; case variantLabel = "variant_label"
        case unitPriceVND = "unit_price_vnd"; case lineTotalVND = "line_total_vnd"
    }
}

struct ShopOrderDetail: Codable, Hashable, Sendable, Identifiable {
    struct Shop: Codable, Hashable, Sendable { let slug: String; let name: String; let state: String }
    let id: UUID
    let code: String
    let status: ShopOrderStatus
    let paymentMethod: ShopPaymentMethod
    let recipientName: String
    let recipientPhone: String
    let shippingAddress: String
    let deliveryNote: String?
    let itemsTotalVND: Int
    let shippingFeeVND: Int
    let totalVND: Int
    let trackingCode: String?
    let cancelReason: String?
    let paymentClaimedAt: String?
    let paymentConfirmedAt: String?
    let shop: Shop
    let items: [ShopOrderItem]

    enum CodingKeys: String, CodingKey {
        case id, code, status, shop, items
        case paymentMethod = "payment_method"; case recipientName = "recipient_name"
        case recipientPhone = "recipient_phone"; case shippingAddress = "shipping_address"
        case deliveryNote = "delivery_note"; case itemsTotalVND = "items_total_vnd"
        case shippingFeeVND = "shipping_fee_vnd"; case totalVND = "total_vnd"
        case trackingCode = "tracking_code"; case cancelReason = "cancel_reason"
        case paymentClaimedAt = "payment_claimed_at"; case paymentConfirmedAt = "payment_confirmed_at"
    }
}

struct ShopOrderPaymentInfo: Codable, Equatable, Sendable {
    struct Bank: Codable, Equatable, Sendable {
        let code: String
        let accountNumber: String
        let accountName: String
        enum CodingKeys: String, CodingKey { case code; case accountNumber = "account_number"; case accountName = "account_name" }
    }
    struct Gateway: Codable, Equatable, Sendable {
        let enabled: Bool
        let provider: String
        let status: String
    }
    let found: Bool
    let method: ShopPaymentMethod?
    let amountVND: Int?
    let memo: String?
    let claimedAt: String?
    let confirmedAt: String?
    let bank: Bank?
    let gateway: Gateway?
    enum CodingKeys: String, CodingKey {
        case found, method, memo, bank, gateway
        case amountVND = "amount_vnd"; case claimedAt = "claimed_at"; case confirmedAt = "confirmed_at"
    }
}

struct ShopSePayCheckout: Codable, Equatable, Sendable, Identifiable {
    var id: String { memo }
    let qrURL: String
    let bankCode: String
    let accountNumber: String
    let accountName: String
    let amountVND: Int
    let memo: String
    let status: String

    enum CodingKeys: String, CodingKey {
        case memo, status
        case qrURL = "qr_url"
        case bankCode = "bank_code"
        case accountNumber = "account_number"
        case accountName = "account_name"
        case amountVND = "amount_vnd"
    }
}

enum ShopCartUnavailableReason: String, Codable, Sendable {
    case productUnavailable = "product_unavailable"
    case variantRetired = "variant_retired"
    case outOfStock = "out_of_stock"
    case shopInactive = "shop_inactive"
    case orderingDisabled = "ordering_disabled"

    var message: String {
        switch self {
        case .productUnavailable: "Sản phẩm không còn bán"
        case .variantRetired: "Phiên bản không còn bán"
        case .outOfStock: "Không đủ hàng"
        case .shopInactive: "Shop đang tạm ngưng"
        case .orderingDisabled: "Shop chưa nhận đơn"
        }
    }
}

struct ShopCartCover: Codable, Hashable, Sendable {
    let id: UUID
    let altText: String?
    let publicPath: String?
    let width: Int?
    let height: Int?

    enum CodingKeys: String, CodingKey {
        case id, width, height
        case altText = "alt_text"
        case publicPath = "public_path"
    }

    var publicURL: URL? {
        guard let publicPath, ShopPublicMediaDTO.isApprovedPublicPath(publicPath) else { return nil }
        return AppConfig.supabaseURL
            .appending(path: "storage/v1/object/public/shop-product-media")
            .appending(path: publicPath)
    }
}

struct ShopCartLine: Identifiable, Codable, Hashable, Sendable {
    let cartItemID: UUID
    let variantID: UUID
    let quantity: Int
    let productID: UUID
    let productSlug: String?
    let productTitle: String?
    let optionValues: [String: String]?
    let sku: String?
    let unitPriceVND: Int
    let lineTotalVND: Int
    let stockOnHand: Int?
    let cover: ShopCartCover?
    let unavailableReason: ShopCartUnavailableReason?

    var id: UUID { cartItemID }

    enum CodingKeys: String, CodingKey {
        case sku, cover
        case cartItemID = "cart_item_id"
        case variantID = "variant_id"
        case quantity = "qty"
        case productID = "product_id"
        case productSlug = "product_slug"
        case productTitle = "product_title"
        case optionValues = "option_values"
        case unitPriceVND = "unit_price_vnd"
        case lineTotalVND = "line_total_vnd"
        case stockOnHand = "stock_on_hand"
        case unavailableReason = "unavailable_reason"
    }
}

struct ShopCartGroup: Codable, Hashable, Sendable {
    struct Shop: Codable, Hashable, Sendable {
        let slug: String
        let name: String
        let state: String
        let orderingEnabled: Bool
        let shippingFeeVND: Int

        enum CodingKeys: String, CodingKey {
            case slug, name, state
            case orderingEnabled = "ordering_enabled"
            case shippingFeeVND = "shipping_fee_vnd"
        }
    }

    let shop: Shop
    let lines: [ShopCartLine]
}
