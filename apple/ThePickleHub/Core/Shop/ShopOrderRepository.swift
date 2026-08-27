import Foundation
import Supabase

struct ShopOrderCreateInput: Sendable {
    struct Item: Encodable, Sendable {
        let variantID: UUID; let quantity: Int; let expectedUnitPriceVND: Int
        enum CodingKeys: String, CodingKey { case variantID = "variant_id"; case quantity = "qty"; case expectedUnitPriceVND = "expected_unit_price_vnd" }
    }
    let clientToken: UUID
    let paymentMethod: ShopPaymentMethod
    let recipientName: String
    let recipientPhone: String
    let shippingAddress: String
    let deliveryNote: String?
    let expectedShippingFeeVND: Int
    let items: [Item]
}

protocol ShopOrderRepository: Sendable {
    func create(_ input: ShopOrderCreateInput) async throws -> ShopOrderDetail
    func order(code: String) async throws -> ShopOrderDetail?
    func paymentInfo(code: String) async throws -> ShopOrderPaymentInfo
    func claimPayment(code: String) async throws -> ShopOrderPaymentInfo
    func confirmPayment(code: String) async throws -> ShopOrderPaymentInfo
}

struct SupabaseShopOrderRepository: ShopOrderRepository {
    private let client: SupabaseClient
    init(client: SupabaseClient = SupabaseManager.shared.client) { self.client = client }

    func create(_ input: ShopOrderCreateInput) async throws -> ShopOrderDetail {
        try await client.rpc("shop_order_create", params: CreateParams(input)).execute().value
    }

    func order(code: String) async throws -> ShopOrderDetail? {
        let select = "id,code,status,payment_method,recipient_name,recipient_phone,shipping_address,delivery_note,items_total_vnd,shipping_fee_vnd,total_vnd,tracking_code,cancel_reason,payment_claimed_at,payment_confirmed_at,shop:shops(slug,name,state),items:shop_order_items(id,product_id,variant_id,qty,product_title,variant_label,sku,unit_price_vnd,line_total_vnd)"
        let rows: [ShopOrderDetail] = try await client.from("shop_orders").select(select)
            .eq("code", value: code).limit(1).execute().value
        return rows.first
    }

    func paymentInfo(code: String) async throws -> ShopOrderPaymentInfo {
        try await client.rpc("shop_order_payment_info", params: ["_code": code]).execute().value
    }

    func claimPayment(code: String) async throws -> ShopOrderPaymentInfo {
        let marks: PaymentMarks = try await client.rpc("shop_order_claim_payment", params: ["_code": code]).execute().value
        return try await mergedInfo(code: code, marks: marks)
    }

    func confirmPayment(code: String) async throws -> ShopOrderPaymentInfo {
        let marks: PaymentMarks = try await client.rpc("shop_order_confirm_payment", params: ["_code": code]).execute().value
        return try await mergedInfo(code: code, marks: marks)
    }

    private func mergedInfo(code: String, marks: PaymentMarks) async throws -> ShopOrderPaymentInfo {
        let info = try await paymentInfo(code: code)
        return ShopOrderPaymentInfo(found: info.found, method: info.method, amountVND: info.amountVND,
                                    memo: info.memo, claimedAt: marks.claimedAt,
                                    confirmedAt: marks.confirmedAt, bank: info.bank)
    }

    private struct PaymentMarks: Decodable {
        let claimedAt: String?; let confirmedAt: String?
        enum CodingKeys: String, CodingKey { case claimedAt = "claimed_at"; case confirmedAt = "confirmed_at" }
    }

    private struct CreateParams: Encodable {
        let clientToken: String; let paymentMethod: String; let recipientName: String
        let recipientPhone: String; let shippingAddress: String; let deliveryNote: String?
        let expectedShippingFeeVND: Int; let items: [ShopOrderCreateInput.Item]
        init(_ input: ShopOrderCreateInput) {
            clientToken = input.clientToken.uuidString.lowercased(); paymentMethod = input.paymentMethod.rawValue
            recipientName = input.recipientName; recipientPhone = input.recipientPhone
            shippingAddress = input.shippingAddress; deliveryNote = input.deliveryNote
            expectedShippingFeeVND = input.expectedShippingFeeVND; items = input.items
        }
        enum CodingKeys: String, CodingKey {
            case clientToken = "_client_token"; case paymentMethod = "_payment_method"
            case recipientName = "_recipient_name"; case recipientPhone = "_recipient_phone"
            case shippingAddress = "_shipping_address"; case deliveryNote = "_delivery_note"
            case expectedShippingFeeVND = "_expected_shipping_fee_vnd"; case items = "_items"
        }
    }
}
