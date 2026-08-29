import Foundation

/// Presentation-only state for choosing a public product variant.
///
/// This type deliberately owns no persistence or checkout behavior. In
/// particular, `quantity` is only a buyer-entered preference: inventory must
/// still be revalidated by the server when a future commerce contract commits
/// a cart or order.
struct ShopVariantSelection: Equatable, Sendable {
    private(set) var values: [String: String]
    private(set) var quantity: Int

    init(values: [String: String] = [:], quantity: Int = 1) {
        self.values = values
        self.quantity = max(1, quantity)
    }

    mutating func select(_ value: String, for option: String, in product: ShopProduct) {
        guard product.optionOrder.contains(option),
              product.variants.contains(where: { $0.optionValues[option] == value }) else {
            return
        }

        // The newest choice wins. Rebuild the remaining selection around it so
        // an old, now-incompatible choice cannot leave the UI in a stale state.
        var compatibleValues = [option: value]
        for otherOption in product.optionOrder where otherOption != option {
            guard let otherValue = values[otherOption] else { continue }
            let candidate = compatibleValues.merging([otherOption: otherValue]) { _, new in new }
            if product.variants.contains(where: { variant in
                candidate.allSatisfy { variant.optionValues[$0.key] == $0.value }
            }) {
                compatibleValues[otherOption] = otherValue
            }
        }

        values = compatibleValues
        quantity = max(1, quantity)
    }

    mutating func reset() {
        values = [:]
        quantity = 1
    }

    mutating func setQuantity(_ quantity: Int) {
        self.quantity = max(1, quantity)
    }

    func selectedVariant(in product: ShopProduct) -> ShopVariant? {
        product.matchingVariant(selection: values)
    }

    func availableVariant(in product: ShopProduct) -> ShopVariant? {
        selectedVariant(in: product).flatMap { $0.isAvailable ? $0 : nil }
    }

    func label(for product: ShopProduct) -> String {
        guard !product.optionOrder.isEmpty else { return "Một phiên bản" }
        let selectedValues = product.optionOrder.compactMap { values[$0] }
        return selectedValues.isEmpty ? "Chưa chọn" : selectedValues.joined(separator: " / ")
    }
}
