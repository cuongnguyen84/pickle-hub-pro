import SwiftUI

struct ShopProductMediaView: View {
    let product: ShopProduct
    var mediaIndex = 0
    var cornerRadius = ShopTokens.controlRadius
    var symbolSize: CGFloat = 42

    private var safeIndex: Int {
        min(max(mediaIndex, 0), max(product.media.count - 1, 0))
    }

    private var media: ShopProductMedia? {
        product.media.indices.contains(safeIndex) ? product.media[safeIndex] : nil
    }

    var body: some View {
        ZStack {
            ShopTokens.mediaBackground
            Circle().fill(ShopTokens.primaryAction.opacity(0.12)).padding(24)
            Image(systemName: product.category.symbol)
                .font(.system(size: symbolSize, weight: .light))
                .foregroundStyle(TLColor.fg2)
                .rotationEffect(.degrees(Double(safeIndex) * -6))
            ShopRemoteImage(url: media?.publicURL, contentMode: .fill) { Color.clear }
        }
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
        .accessibilityLabel(media?.label ?? product.title)
    }
}

struct ShopPriceText: View {
    let product: ShopProduct
    var variant: ShopVariant?
    var showsFromPrefix = false
    var size: CGFloat = 13

    var body: some View {
        Text(label)
            .font(TLType.dataMono(size))
            .foregroundStyle(TLColor.fg)
    }

    var label: String {
        if let variant { return ShopMoney.vnd(variant.priceVND) }
        if product.hasPriceRange {
            return showsFromPrefix
                ? "Từ \(ShopMoney.vnd(product.minimumPriceVND))"
                : "\(ShopMoney.vnd(product.minimumPriceVND)) – \(ShopMoney.vnd(product.maximumPriceVND))"
        }
        return ShopMoney.vnd(product.minimumPriceVND)
    }
}

struct ShopVerificationBadge: View {
    var label = "Đã xác minh"

    var body: some View {
        Image(systemName: "checkmark.seal.fill")
            .foregroundStyle(ShopTokens.verified)
            .accessibilityLabel(label)
    }
}

struct ShopAvailabilityText: View {
    let isAvailable: Bool
    var availableLabel = "Còn hàng"
    var unavailableLabel = "Không còn khả dụng"

    var body: some View {
        Text(isAvailable ? availableLabel : unavailableLabel)
            .font(TLType.bodySans(10))
            .foregroundStyle(isAvailable ? TLColor.fg3 : ShopTokens.unavailable)
    }
}

struct ShopProductRow: View {
    let product: ShopProduct
    var mediaSize: CGFloat = 82
    var showsChevron = true

    var body: some View {
        HStack(spacing: TLSpacing.md) {
            ShopProductMediaView(product: product, symbolSize: 28)
                .frame(width: mediaSize, height: mediaSize)
            VStack(alignment: .leading, spacing: 5) {
                Text(product.title)
                    .font(TLType.titleSans(14))
                    .foregroundStyle(TLColor.fg)
                    .lineLimit(2)
                ShopPriceText(product: product, showsFromPrefix: true, size: 11)
                ShopAvailabilityText(isAvailable: product.isAvailable)
            }
            Spacer(minLength: 0)
            if showsChevron {
                Image(systemName: "chevron.right").foregroundStyle(TLColor.fg4)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// Compact row for catalogue and intent surfaces that only receive the public
/// card contract. Keeping this separate from `ShopProductRow` prevents a list
/// from inventing PDP-only variants, inventory or seller identifiers.
struct ShopProductSummaryRow: View {
    let product: ShopProductCardSummary
    var mediaSize: CGFloat = 82
    var showsChevron = true

    var body: some View {
        HStack(spacing: TLSpacing.md) {
            ShopRemoteImage(url: product.coverURL, contentMode: .fill) {
                Image(systemName: product.category.symbol)
                    .foregroundStyle(TLColor.fg3)
            }
            .frame(width: mediaSize, height: mediaSize)
            .background(ShopTokens.mediaBackground)
            .clipShape(RoundedRectangle(cornerRadius: ShopTokens.controlRadius, style: .continuous))
            .accessibilityLabel(product.coverLabel)

            VStack(alignment: .leading, spacing: 5) {
                Text(product.title)
                    .font(TLType.titleSans(14))
                    .foregroundStyle(TLColor.fg)
                    .lineLimit(2)
                ShopCardPriceText(product: product, showsFromPrefix: true, size: 11)
                Text(product.availability.label)
                    .font(TLType.bodySans(10))
                    .foregroundStyle(product.availability == .outOfStock ? ShopTokens.unavailable : TLColor.fg3)
            }
            Spacer(minLength: 0)
            if showsChevron {
                Image(systemName: "chevron.right")
                    .foregroundStyle(TLColor.fg4)
                    .accessibilityHidden(true)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

struct ShopWishlistButton: View {
    let productTitle: String
    var isSaved = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: isSaved ? "heart.fill" : "heart")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(isSaved ? ShopTokens.verified : TLColor.fg2)
                .frame(
                    minWidth: ShopTokens.minimumTouchTarget,
                    minHeight: ShopTokens.minimumTouchTarget
                )
                .background(TLColor.bgElev.opacity(0.92), in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isSaved ? "Bỏ lưu \(productTitle)" : "Lưu \(productTitle)")
        .accessibilityValue(isSaved ? "Đã lưu" : "Chưa lưu")
    }
}

struct ShopVariantOptionGroup: View {
    let option: String
    let values: [String]
    @Binding var selectedValue: String?
    let isAvailable: (String) -> Bool

    var body: some View {
        VStack(alignment: .leading, spacing: TLSpacing.sm) {
            Text(option).font(TLType.titleSans(14))
            FlowLayout(spacing: TLSpacing.sm) {
                ForEach(values, id: \.self) { value in
                    let selected = selectedValue == value
                    let available = isAvailable(value)
                    Button { selectedValue = value } label: {
                        Text(value).strikethrough(!available)
                    }
                    .font(TLType.bodySans(12))
                    .foregroundStyle(selected ? ShopTokens.primaryActionText : TLColor.fg)
                    .padding(.horizontal, TLSpacing.md)
                    .frame(minHeight: ShopTokens.minimumTouchTarget)
                    .background(selected ? ShopTokens.primaryAction : ShopTokens.mediaBackground, in: Capsule())
                    .overlay(Capsule().strokeBorder(selected ? Color.clear : TLColor.border))
                    .opacity(available ? 1 : 0.45)
                    .disabled(!available)
                    .accessibilityLabel(available ? value : "\(value), hết hàng")
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
            }
        }
    }
}

struct ShopQuantityControl: View {
    @Binding var quantity: Int
    let maximum: Int

    var body: some View {
        Stepper(value: $quantity, in: 1...max(1, maximum)) {
            Text("Số lượng: \(quantity)").font(TLType.titleSans(13))
        }
        .accessibilityLabel("Số lượng")
        .accessibilityValue("\(quantity)")
    }
}

struct ShopStickyCommerceBar: View {
    let product: ShopProduct
    var variant: ShopVariant?
    let selectionLabel: String
    let actionTitle: String
    var isDisabled = false
    let action: () -> Void

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: TLSpacing.md) {
                priceSummary
                actionButton
            }
            VStack(alignment: .leading, spacing: TLSpacing.sm) {
                priceSummary
                actionButton
            }
        }
        .padding(.horizontal, TLSpacing.lg)
        .padding(.vertical, TLSpacing.sm)
        .background(.ultraThinMaterial)
    }

    private var priceSummary: some View {
        VStack(alignment: .leading, spacing: 2) {
            ShopPriceText(product: product, variant: variant, size: 13)
            Text(selectionLabel)
                .font(TLType.bodySans(9))
                .foregroundStyle(TLColor.fg3)
                .lineLimit(2)
        }
        .accessibilityElement(children: .combine)
    }

    private var actionButton: some View {
        Button(actionTitle, action: action)
            .font(TLType.titleSans(13))
            .foregroundStyle(ShopTokens.primaryActionText)
            .frame(maxWidth: .infinity, minHeight: 50)
            .background(isDisabled ? TLColor.border2 : ShopTokens.primaryAction, in: Capsule())
            .disabled(isDisabled)
    }
}


/// Checkout's primary action, in the same visual language as
/// `ShopStickyCommerceBar` on the product screen.
///
/// It used to be a plain row inside the Form: left-aligned tinted text with no
/// fill, indistinguishable from a list item, at the bottom of a long scroll.
/// The single most important control on the screen read as the least important
/// thing on it.
///
/// The blocking reason sits above the button rather than beside it, because the
/// button is what the eye lands on and the reason is what it needs next.
struct ShopStickyCheckoutBar: View {
    let totalVND: Int
    let actionTitle: String
    var blockingReason: String?
    var isDisabled = false
    let action: () -> Void

    var body: some View {
        VStack(spacing: TLSpacing.sm) {
            HStack {
                Text("Tổng cộng")
                    .font(TLType.bodySans(12))
                    .foregroundStyle(TLColor.fg3)
                Spacer()
                Text(ShopMoney.vnd(totalVND))
                    .font(TLType.titleSans(16))
                    .foregroundStyle(TLColor.fg)
            }
            if let blockingReason {
                Text(blockingReason)
                    .font(TLType.bodySans(12))
                    .foregroundStyle(TLColor.fg3)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            Button(actionTitle, action: action)
                .font(TLType.titleSans(15))
                .foregroundStyle(ShopTokens.primaryActionText)
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(isDisabled ? TLColor.border2 : ShopTokens.primaryAction, in: Capsule())
                .disabled(isDisabled)
                .accessibilityHint(blockingReason ?? "")
        }
        .padding(.horizontal, TLSpacing.lg)
        .padding(.vertical, TLSpacing.sm)
        .background(.ultraThinMaterial)
    }
}
