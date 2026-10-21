import Foundation
import Supabase

protocol ShopCartRepository: Sendable {
    func cart() async throws -> [ShopCartGroup]
    func add(variantID: UUID, quantity: Int) async throws
    func setQuantity(itemID: UUID, quantity: Int) async throws
    func remove(itemID: UUID) async throws
}

enum ShopCartError: LocalizedError, Equatable {
    case authenticationRequired
    case invalidQuantity

    var errorDescription: String? {
        switch self {
        case .authenticationRequired: "Anh/chị cần đăng nhập để dùng giỏ hàng."
        case .invalidQuantity: "Mỗi phiên bản chỉ được chọn từ 1 đến 10 sản phẩm."
        }
    }
}

struct SupabaseShopCartRepository: ShopCartRepository {
    static let maximumQuantity = 10
    private let client: SupabaseClient

    init(client: SupabaseClient = SupabaseManager.shared.client) { self.client = client }

    func cart() async throws -> [ShopCartGroup] {
        try await requireAuthentication()
        return try await client.rpc("shop_cart_view").execute().value
    }

    func add(variantID: UUID, quantity: Int = 1) async throws {
        try validate(quantity)
        try await requireAuthentication()
        let existing: [CartRow] = try await client.from("shop_cart_items")
            .select("id,qty").eq("variant_id", value: variantID).limit(1).execute().value
        if let row = existing.first {
            let next = min(Self.maximumQuantity, row.quantity + quantity)
            try await client.from("shop_cart_items").update(["qty": next]).eq("id", value: row.id).execute()
        } else {
            try await client.from("shop_cart_items")
                .insert(CartInsert(variantID: variantID, quantity: quantity)).execute()
        }
    }

    func setQuantity(itemID: UUID, quantity: Int) async throws {
        try validate(quantity)
        try await requireAuthentication()
        try await client.from("shop_cart_items").update(["qty": quantity]).eq("id", value: itemID).execute()
    }

    func remove(itemID: UUID) async throws {
        try await requireAuthentication()
        try await client.from("shop_cart_items").delete().eq("id", value: itemID).execute()
    }

    private func requireAuthentication() async throws {
        guard (try? await client.auth.session.user.id) != nil else { throw ShopCartError.authenticationRequired }
    }

    private func validate(_ quantity: Int) throws {
        guard (1...Self.maximumQuantity).contains(quantity) else { throw ShopCartError.invalidQuantity }
    }

    private struct CartRow: Decodable {
        let id: UUID
        let quantity: Int
        enum CodingKeys: String, CodingKey { case id; case quantity = "qty" }
    }

    private struct CartInsert: Encodable {
        let variantID: UUID
        let quantity: Int
        enum CodingKeys: String, CodingKey { case variantID = "variant_id"; case quantity = "qty" }
    }
}
