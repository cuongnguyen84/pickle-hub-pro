import Foundation

enum ShopPublicAvailability: String, Codable, Sendable {
    case inStock = "in_stock"
    case outOfStock = "out_of_stock"
    case unknown

    var label: String {
        switch self {
        case .inStock: "Còn hàng"
        case .outOfStock: "Hết hàng"
        case .unknown: "Liên hệ shop để hỏi số lượng"
        }
    }
}

struct ShopPublicCategoryDTO: Codable, Equatable, Sendable {
    let slug: String
    let name: String
    let sortOrder: Int
    let productCount: Int

    enum CodingKeys: String, CodingKey {
        case slug, name
        case sortOrder = "sort_order"
        case productCount = "product_count"
    }
}

struct ShopPublicMediaDTO: Codable, Equatable, Sendable {
    let publicPath: String
    let altText: String?
    let width: Int?
    let height: Int?

    enum CodingKeys: String, CodingKey {
        case publicPath = "public_path"
        case altText = "alt_text"
        case width, height
    }

    func publicURL(supabaseURL: URL) throws -> URL {
        guard Self.isApprovedPublicPath(publicPath) else {
            throw ShopRepositoryError.invalidResponse
        }
        return supabaseURL
            .appending(path: "storage/v1/object/public/shop-product-media")
            .appending(path: publicPath)
    }

    static func isApprovedPublicPath(_ path: String) -> Bool {
        let lower = path.lowercased()
        return !path.isEmpty
            && !path.hasPrefix("/")
            && !path.contains("..")
            && !lower.hasPrefix("http:")
            && !lower.hasPrefix("https:")
            && !lower.contains("token=")
            && !lower.contains("/object/sign/")
            && !lower.contains("/original")
            && !lower.contains("draft")
    }
}

struct ShopPublicProductCardDTO: Codable, Equatable, Identifiable, Sendable {
    struct Category: Codable, Equatable, Sendable { let slug: String; let name: String }
    struct Shop: Codable, Equatable, Sendable {
        let slug: String
        let name: String
        let verified: Bool
    }

    let id: UUID
    let slug: String
    let title: String
    let condition: ShopProductCondition
    let createdAt: Date
    let category: Category
    let shop: Shop
    let priceMin: Int?
    let priceMax: Int?
    let discountPercentMax: Int?
    let compareAtMin: Int?
    let availability: ShopPublicAvailability?
    let cover: ShopPublicMediaDTO?

    enum CodingKeys: String, CodingKey {
        case id, slug, title, condition, category, shop, availability, cover
        case createdAt = "created_at"
        case priceMin = "price_min"
        case priceMax = "price_max"
        case discountPercentMax = "discount_pct_max"
        case compareAtMin = "compare_at_min"
    }
}

struct ShopPublicSearchPageDTO: Codable, Equatable, Sendable {
    let rows: [ShopPublicProductCardDTO]
    let total: Int
    let hasMore: Bool

    enum CodingKeys: String, CodingKey {
        case rows, total
        case hasMore = "has_more"
    }
}

struct ShopPublicContactDTO: Codable, Equatable, Identifiable, Sendable {
    let id: UUID
    let type: String
    let href: URL
    let label: String?
}

struct ShopPublicProductResultDTO: Codable, Equatable, Sendable {
    let found: Bool
    let redirectTo: String?
    let product: ShopPublicProductDTO?
    let contacts: [ShopPublicContactDTO]?

    enum CodingKeys: String, CodingKey {
        case found, product, contacts
        case redirectTo = "redirect_to"
    }
}

struct ShopPublicProductDTO: Codable, Equatable, Identifiable, Sendable {
    struct Category: Codable, Equatable, Sendable { let slug: String; let name: String }
    struct Shop: Codable, Equatable, Sendable {
        let slug: String
        let name: String
        let region: String?
        let verified: Bool
        let shippingNote: String?
        let returnNote: String?
        enum CodingKeys: String, CodingKey {
            case slug, name, region, verified
            case shippingNote = "shipping_note"
            case returnNote = "return_note"
        }
    }
    struct OptionGroup: Codable, Equatable, Sendable {
        let name: String
        let values: [String]
    }
    struct Variant: Codable, Equatable, Identifiable, Sendable {
        let id: UUID
        let optionValues: [String: String]?
        let optionKey: String?
        let sku: String?
        let priceVND: Int
        let compareAtPriceVND: Int?
        let availability: ShopPublicAvailability
        let stockOnHand: Int?
        let mediaID: UUID?
        enum CodingKeys: String, CodingKey {
            case id, sku, availability
            case optionValues = "option_values"
            case optionKey = "option_key"
            case priceVND = "price_vnd"
            case compareAtPriceVND = "compare_at_price_vnd"
            case stockOnHand = "stock_on_hand"
            case mediaID = "media_id"
        }
    }
    struct Media: Codable, Equatable, Identifiable, Sendable {
        let id: UUID
        let altText: String?
        let position: Int
        let path: String?
        let publicPath: String?
        let width: Int?
        let height: Int?
        enum CodingKeys: String, CodingKey {
            case id, position, path, width, height
            case altText = "alt_text"
            case publicPath = "public_path"
        }
    }

    let id: UUID
    let slug: String
    let title: String
    let description: String?
    let specs: [String: String]?
    let condition: ShopProductCondition
    let category: Category?
    let shop: Shop
    let optionGroups: [OptionGroup]
    let variants: [Variant]
    let media: [Media]
    let primaryMediaID: UUID?
    let isPublished: Bool
    let isPreview: Bool

    enum CodingKeys: String, CodingKey {
        case id, slug, title, description, specs, condition, category, shop, variants, media
        case optionGroups = "option_groups"
        case primaryMediaID = "primary_media_id"
        case isPublished = "is_published"
        case isPreview = "is_preview"
    }

    var respectsPublicBoundary: Bool {
        !isPreview
            && isPublished
            && variants.allSatisfy { $0.stockOnHand == nil }
            && media.allSatisfy {
                $0.path == nil
                    && $0.publicPath.map(ShopPublicMediaDTO.isApprovedPublicPath) == true
            }
    }
}

struct ShopPublicShopResultDTO: Codable, Equatable, Sendable {
    struct Shop: Codable, Equatable, Sendable {
        let slug: String
        let name: String
        let intro: String?
        let region: String?
        let verified: Bool
        let verifiedAt: Date?
        let shippingNote: String?
        let returnNote: String?
        let primaryCategorySlug: String?
        let productCount: Int
        enum CodingKeys: String, CodingKey {
            case slug, name, intro, region, verified
            case verifiedAt = "verified_at"
            case shippingNote = "shipping_note"
            case returnNote = "return_note"
            case primaryCategorySlug = "primary_category_slug"
            case productCount = "product_count"
        }
    }

    let found: Bool
    let redirectTo: String?
    let shop: Shop?
    let contacts: [ShopPublicContactDTO]?

    enum CodingKeys: String, CodingKey {
        case found, shop, contacts
        case redirectTo = "redirect_to"
    }
}

extension JSONDecoder {
    static var shopPublic: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}
