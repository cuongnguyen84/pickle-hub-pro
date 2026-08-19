import Observation
import SwiftUI

@MainActor @Observable
final class ShopCheckoutViewModel {
    let shopSlug: String
    let cartRepository: any ShopCartRepository
    let orderRepository: any ShopOrderRepository
    var group: ShopCartGroup?
    var isLoading = true
    var isSubmitting = false
    var errorMessage: String?
    var recipientName = ""
    var recipientPhone = ""
    var shippingAddress = ""
    var deliveryNote = ""
    var paymentMethod: ShopPaymentMethod = .cod
    private var clientToken = UUID()

    init(shopSlug: String, cartRepository: any ShopCartRepository = SupabaseShopCartRepository(),
         orderRepository: any ShopOrderRepository = SupabaseShopOrderRepository()) {
        self.shopSlug = shopSlug; self.cartRepository = cartRepository; self.orderRepository = orderRepository
    }

    /// Why the order cannot be placed yet, or nil when it can.
    ///
    /// The button used to be wired straight to a Bool, so a form that failed
    /// one rule went grey with nothing on screen explaining which. An address
    /// of "23452345" is eight characters and silently fails the twelve-character
    /// minimum — the person typing it has no way to learn that from the UI.
    var blockingReason: String? {
        if recipientName.trimmingCharacters(in: .whitespacesAndNewlines).count < 2 {
            return "Nhập tên người nhận."
        }
        if recipientPhone.range(of: #"^0[0-9]{9}$"#, options: .regularExpression) == nil {
            return "Số điện thoại phải có 10 số và bắt đầu bằng 0."
        }
        if shippingAddress.trimmingCharacters(in: .whitespacesAndNewlines).count < 12 {
            return "Địa chỉ quá ngắn — nhập đầy đủ số nhà, đường, phường/xã."
        }
        if group?.lines.isEmpty != false { return "Giỏ hàng trống." }
        if group?.lines.allSatisfy({ $0.unavailableReason == nil }) != true {
            return "Có sản phẩm không còn bán — xoá khỏi giỏ trước khi đặt."
        }
        return nil
    }

    var canSubmit: Bool { blockingReason == nil }

    func load() async {
        isLoading = true; defer { isLoading = false }
        do { group = try await cartRepository.cart().first { $0.shop.slug == shopSlug } }
        catch { errorMessage = error.localizedDescription }
    }

    func submit() async -> ShopOrderDetail? {
        guard canSubmit, let group else { return nil }
        isSubmitting = true; errorMessage = nil; defer { isSubmitting = false }
        do {
            return try await orderRepository.create(.init(
                clientToken: clientToken, paymentMethod: paymentMethod,
                recipientName: recipientName.trimmingCharacters(in: .whitespacesAndNewlines),
                recipientPhone: recipientPhone, shippingAddress: shippingAddress.trimmingCharacters(in: .whitespacesAndNewlines),
                deliveryNote: deliveryNote.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : deliveryNote,
                expectedShippingFeeVND: group.shop.shippingFeeVND,
                items: group.lines.map { .init(variantID: $0.variantID, quantity: $0.quantity, expectedUnitPriceVND: $0.unitPriceVND) }
            ))
        } catch { errorMessage = error.localizedDescription; return nil }
    }
}

struct ShopCheckoutView: View {
    @State private var model: ShopCheckoutViewModel
    @State private var pathOrder: ShopRoute?

    init(shopSlug: String, cartRepository: any ShopCartRepository = SupabaseShopCartRepository(),
         orderRepository: any ShopOrderRepository = SupabaseShopOrderRepository()) {
        _model = State(initialValue: ShopCheckoutViewModel(shopSlug: shopSlug, cartRepository: cartRepository, orderRepository: orderRepository))
    }

    var body: some View {
        Group {
            if model.isLoading { TLLoadingView(rows: 5).padding(TLSpacing.lg) }
            else if let group = model.group { form(group) }
            else { TLEmptyState(icon: "cart", title: "Không còn sản phẩm để đặt", subtitle: "Giỏ hàng của shop này có thể đã thay đổi.") }
        }
        .background(TLColor.bg).navigationTitle("Đặt hàng").navigationBarTitleDisplayMode(.inline)
        .task { await model.load() }
        .navigationDestination(item: $pathOrder) { route in
            if case .order(let code) = route { ShopOrderDetailView(code: code, repository: model.orderRepository) }
        }
        .alert("Chưa thể đặt đơn", isPresented: Binding(get: { model.errorMessage != nil }, set: { if !$0 { model.errorMessage = nil } })) {
            Button("Đóng", role: .cancel) { model.errorMessage = nil }
        } message: { Text(model.errorMessage ?? "") }
    }

    private func form(_ group: ShopCartGroup) -> some View {
        Form {
            Section("Người nhận") {
                TextField("Họ tên", text: $model.recipientName).textContentType(.name)
                TextField("Số điện thoại 10 số", text: $model.recipientPhone).keyboardType(.phonePad).textContentType(.telephoneNumber)
                TextField("Số nhà, đường, phường, quận, tỉnh", text: $model.shippingAddress, axis: .vertical).lineLimit(2...4)
                TextField("Ghi chú cho shop (không bắt buộc)", text: $model.deliveryNote, axis: .vertical).lineLimit(2...3)
            }
            Section("Thanh toán") {
                Picker("Phương thức", selection: $model.paymentMethod) {
                    ForEach(ShopPaymentMethod.allCases, id: \.self) { Text($0.title).tag($0) }
                }
                Text(model.paymentMethod == .bankTransfer
                     ? "Sau khi đặt đơn, anh/chị sẽ nhận mã VietQR nếu shop đã khai báo tài khoản. Chuyển khoản được shop đối soát thủ công."
                     : "Thanh toán trực tiếp khi nhận hàng.")
                    .font(TLType.bodySans(11)).foregroundStyle(TLColor.fg3)
            }
            Section("Tổng đơn") {
                ForEach(group.lines) { line in HStack { Text("\(line.productTitle ?? "Sản phẩm") × \(line.quantity)"); Spacer(); Text(ShopMoney.vnd(line.lineTotalVND)) } }
                HStack { Text("Phí vận chuyển"); Spacer(); Text(group.shop.shippingFeeVND == 0 ? "Miễn phí" : ShopMoney.vnd(group.shop.shippingFeeVND)) }
                HStack { Text("Tổng cộng").fontWeight(.bold); Spacer(); Text(ShopMoney.vnd(group.lines.reduce(group.shop.shippingFeeVND) { $0 + $1.lineTotalVND })).fontWeight(.bold) }
            }
        }
        .scrollContentBackground(.hidden)
        // Out of the Form and pinned to the bottom, matching the product
        // screen's commerce bar. As a Form row it was left-aligned tinted text
        // with no fill, at the end of a long scroll — the most important control
        // on the screen looked like the least important.
        .safeAreaInset(edge: .bottom) {
            ShopStickyCheckoutBar(
                totalVND: group.lines.reduce(group.shop.shippingFeeVND) { $0 + $1.lineTotalVND },
                actionTitle: model.isSubmitting ? "Đang gửi đơn…" : "Đặt đơn",
                blockingReason: model.blockingReason,
                isDisabled: !model.canSubmit || model.isSubmitting
            ) {
                Task { if let order = await model.submit() { pathOrder = .order(order.code) } }
            }
        }
    }
}
