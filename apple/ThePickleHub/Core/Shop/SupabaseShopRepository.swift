import Foundation

struct SupabaseShopRepository: ShopRepository {
    private let api: any ShopPublicAPI
    private let supabaseURL: URL
    private let cache: ShopCatalogueCache

    init(api: any ShopPublicAPI = SupabaseShopPublicAPI(), supabaseURL: URL = AppConfig.supabaseURL,
         cache: ShopCatalogueCache = ShopCatalogueCache()) {
        self.api = api
        self.supabaseURL = supabaseURL
        self.cache = cache
    }

    func categories() async throws -> [ShopCategory] {
        do { return try await api.categories(onlyStocked: false).compactMap { ShopCategory(rawValue: $0.slug) } }
        catch is CancellationError { throw CancellationError() }
        catch { return ShopCategory.allCases }
    }

    func featuredProducts() async throws -> [ShopProductCardSummary] {
        try await products(category: nil, query: "", condition: nil,
                           verifiedOnly: false, availableOnly: false, sort: .recent)
    }

    func products(category: ShopCategory?, query: String, condition: ShopProductCondition?,
                  verifiedOnly: Bool, availableOnly: Bool,
                  sort: ShopPublicSearchRequest.Sort) async throws -> [ShopProductCardSummary] {
        let page = try await productPage(ShopPublicSearchRequest(
            query: query, categorySlug: category?.rawValue, condition: condition,
            inStockOnly: availableOnly, sort: sort
        ))
        return verifiedOnly ? page.products.filter(\.seller.isVerified) : page.products
    }

    func productPage(_ request: ShopPublicSearchRequest) async throws -> ShopProductPage {
        let key = cacheKey(request)
        if request.cachePolicy == .useCache, let fresh = await cache.freshPage(for: key) { return fresh }
        do {
            let dto = try await api.search(request)
            let products = try dto.rows.map(mapCard)
            let last = products.last
            let page = ShopProductPage(
                products: products, total: dto.total, hasMore: dto.hasMore,
                nextCursorAt: dto.hasMore ? last?.createdAt : nil,
                nextCursorID: dto.hasMore ? last?.id : nil
            )
            await cache.store(page, for: key)
            return page
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            if let stale = await cache.stalePage(for: key) { return stale }
            if let repositoryError = error as? ShopRepositoryError { throw repositoryError }
            throw ShopRepositoryError.unavailable
        }
    }

    func product(slug: String) async throws -> ShopProduct? {
        try await translateErrors {
            let first = try await api.product(slug: try validSlug(slug))
            let result: ShopPublicProductResultDTO
            if !first.found, let redirect = first.redirectTo {
                result = try await api.product(slug: try validSlug(redirect))
            } else {
                result = first
            }
            guard result.found, let dto = result.product else { return nil }
            guard dto.respectsPublicBoundary else { throw ShopRepositoryError.invalidResponse }
            return try mapProduct(dto, contacts: result.contacts ?? [])
        }
    }

    func store(slug: String) async throws -> ShopStorefront? {
        try await translateErrors {
            let first = try await api.shop(slug: try validSlug(slug))
            let result: ShopPublicShopResultDTO
            if !first.found, let redirect = first.redirectTo {
                result = try await api.shop(slug: try validSlug(redirect))
            } else {
                result = first
            }
            guard result.found, let dto = result.shop else { return nil }
            return try mapStore(dto, contacts: result.contacts ?? [])
        }
    }

    func products(storeSlug: String) async throws -> [ShopProductCardSummary] {
        try await productPage(ShopPublicSearchRequest(shopSlug: try validSlug(storeSlug))).products
    }

    private func mapCard(_ dto: ShopPublicProductCardDTO) throws -> ShopProductCardSummary {
        guard let category = ShopCategory(rawValue: dto.category.slug), dto.priceMin.map({ $0 >= 0 }) != false,
              dto.priceMax.map({ $0 >= 0 }) != false else { throw ShopRepositoryError.invalidResponse }
        return ShopProductCardSummary(
            id: dto.id, slug: try validSlug(dto.slug), title: dto.title,
            category: category, condition: dto.condition,
            seller: ShopSellerSummary(slug: try validSlug(dto.shop.slug), name: dto.shop.name,
                                      isVerified: dto.shop.verified),
            priceMinVND: dto.priceMin, priceMaxVND: dto.priceMax,
            availability: dto.availability ?? .unknown,
            coverURL: try dto.cover?.publicURL(supabaseURL: supabaseURL),
            coverLabel: dto.cover?.altText ?? dto.title,
            createdAt: dto.createdAt
        )
    }

    private func mapProduct(_ dto: ShopPublicProductDTO, contacts: [ShopPublicContactDTO]) throws -> ShopProduct {
        guard let categoryDTO = dto.category,
              let category = ShopCategory(rawValue: categoryDTO.slug),
              !dto.variants.isEmpty else { throw ShopRepositoryError.invalidResponse }
        let media = try dto.media.sorted { lhs, rhs in
            if lhs.id == dto.primaryMediaID { return true }
            if rhs.id == dto.primaryMediaID { return false }
            return lhs.position < rhs.position
        }.map { item in
            guard let path = item.publicPath else { throw ShopRepositoryError.invalidResponse }
            return ShopProductMedia(
                id: item.id,
                label: item.altText ?? dto.title,
                publicURL: try ShopPublicMediaDTO(publicPath: path, altText: item.altText,
                                                  width: item.width, height: item.height)
                    .publicURL(supabaseURL: supabaseURL),
                position: item.position,
                accentSeed: 0
            )
        }
        let variants = dto.variants.map {
            ShopVariant(id: $0.id, sku: $0.sku, optionValues: $0.optionValues ?? [:],
                        priceVND: $0.priceVND, stockOnHand: nil, mediaID: $0.mediaID,
                        publicAvailability: $0.availability)
        }
        return ShopProduct(
            id: dto.id, slug: try validSlug(dto.slug), title: dto.title,
            description: dto.description ?? "", category: category, condition: dto.condition,
            seller: ShopSeller(
                slug: try validSlug(dto.shop.slug), name: dto.shop.name,
                city: dto.shop.region ?? "Khu vực chưa công bố",
                isVerified: dto.shop.verified, isActive: true,
                logoURL: nil, coverURL: nil, coverFocalY: 0.5,
                shippingNote: dto.shop.shippingNote ?? "Shop chưa công bố thông tin giao hàng.",
                returnPolicy: dto.shop.returnNote
            ),
            media: media, optionOrder: dto.optionGroups.map(\.name), variants: variants,
            attributes: dto.specs ?? [:], contacts: try contacts.map(mapContact)
        )
    }

    private func mapStore(_ dto: ShopPublicShopResultDTO.Shop,
                          contacts: [ShopPublicContactDTO]) throws -> ShopStorefront {
        ShopStorefront(
            slug: try validSlug(dto.slug), name: dto.name, intro: dto.intro, region: dto.region,
            isVerified: dto.verified, shippingNote: dto.shippingNote, returnPolicy: dto.returnNote,
            primaryCategory: dto.primaryCategorySlug.flatMap(ShopCategory.init(rawValue:)),
            productCount: dto.productCount, contacts: try contacts.map(mapContact)
        )
    }

    private func mapContact(_ dto: ShopPublicContactDTO) throws -> ShopContact {
        guard dto.href.scheme?.lowercased() == "https", dto.href.user == nil,
              dto.href.password == nil, dto.href.query == nil, dto.href.fragment == nil
        else { throw ShopRepositoryError.invalidResponse }
        return ShopContact(id: dto.id, type: dto.type, href: dto.href, label: dto.label)
    }

    private func validSlug(_ slug: String) throws -> String {
        guard slug.range(of: #"^[a-z0-9]+(?:-[a-z0-9]+)*$"#, options: .regularExpression) != nil
        else { throw ShopRepositoryError.invalidResponse }
        return slug
    }

    private func cacheKey(_ request: ShopPublicSearchRequest) -> String {
        [
            request.query?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? "",
            request.categorySlug ?? "", request.shopSlug ?? "", request.condition?.rawValue ?? "",
            request.inStockOnly ? "1" : "0", request.sort.rawValue,
            request.cursorAt.map { ISO8601DateFormatter().string(from: $0) } ?? "",
            request.cursorID?.uuidString.lowercased() ?? "", String(request.limit),
        ].joined(separator: "|")
    }

    private func translateErrors<T>(_ operation: () async throws -> T) async throws -> T {
        do { return try await operation() }
        catch let error as ShopRepositoryError { throw error }
        catch is CancellationError { throw CancellationError() }
        catch { throw ShopRepositoryError.unavailable }
    }
}
