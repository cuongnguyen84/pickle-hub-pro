import Testing
@testable import ThePickleHub

@Suite("Shop variant selection")
struct ShopVariantSelectionTests {
    private var product: ShopProduct { ShopFixtures.products[1] }

    private var productWithDependentOptions: ShopProduct {
        let source = product
        return ShopProduct(
            id: source.id,
            slug: source.slug,
            title: source.title,
            description: source.description,
            category: source.category,
            condition: source.condition,
            seller: source.seller,
            media: source.media,
            optionOrder: source.optionOrder,
            variants: source.variants.filter { $0.sku != "CP-W-39" },
            attributes: source.attributes,
            contacts: source.contacts
        )
    }

    @Test("Selection resolves only after every option is chosen")
    func incompleteThenComplete() {
        var selection = ShopVariantSelection()

        selection.select("Xanh", for: "Màu", in: product)
        #expect(selection.selectedVariant(in: product) == nil)

        selection.select("39", for: "Kích cỡ", in: product)
        #expect(selection.selectedVariant(in: product)?.sku == "CP-B-39")
        #expect(selection.label(for: product) == "Xanh / 39")
    }

    @Test("Newest choice clears an incompatible older choice")
    func incompatibleChoiceIsCleared() {
        var selection = ShopVariantSelection()
        let dependentProduct = productWithDependentOptions
        selection.select("Xanh", for: "Màu", in: dependentProduct)
        selection.select("39", for: "Kích cỡ", in: dependentProduct)

        selection.select("Trắng", for: "Màu", in: dependentProduct)

        #expect(selection.values["Màu"] == "Trắng")
        #expect(selection.values["Kích cỡ"] == nil)
        #expect(selection.selectedVariant(in: dependentProduct) == nil)
    }

    @Test("Impossible and unknown option values do not corrupt selection")
    func unknownChoiceIsIgnored() {
        var selection = ShopVariantSelection(values: ["Màu": "Xanh"])

        selection.select("99", for: "Kích cỡ", in: product)
        selection.select("Đỏ", for: "Không tồn tại", in: product)

        #expect(selection.values == ["Màu": "Xanh"])
    }

    @Test("Out of stock variant resolves but is not an available variant")
    func unavailableVariant() {
        var selection = ShopVariantSelection()
        selection.select("Trắng", for: "Màu", in: product)
        selection.select("40", for: "Kích cỡ", in: product)

        #expect(selection.selectedVariant(in: product) != nil)
        #expect(selection.availableVariant(in: product) == nil)
    }

    @Test("Unknown stock remains an honest public availability state")
    func unknownStock() {
        var selection = ShopVariantSelection()
        selection.select("Xanh", for: "Màu", in: product)
        selection.select("40", for: "Kích cỡ", in: product)

        #expect(selection.selectedVariant(in: product)?.stockOnHand == nil)
        #expect(selection.availableVariant(in: product) != nil)
    }

    @Test("Variant and media mapping resolve from the same selection")
    func mediaMapping() {
        var selection = ShopVariantSelection()
        selection.select("Xanh", for: "Màu", in: product)
        selection.select("39", for: "Kích cỡ", in: product)

        let variant = selection.selectedVariant(in: product)
        #expect(variant?.mediaID == product.media[1].id)
        #expect(product.mediaIndex(for: variant) == 1)
    }

    @Test("Quantity is always at least one and is not capped by public stock")
    func quantityIsPresentationOnly() {
        var selection = ShopVariantSelection(quantity: 0)
        #expect(selection.quantity == 1)

        selection.setQuantity(-3)
        #expect(selection.quantity == 1)

        selection.setQuantity(50)
        #expect(selection.quantity == 50)

        selection.reset()
        #expect(selection.quantity == 1)
        #expect(selection.values.isEmpty)
    }
}
