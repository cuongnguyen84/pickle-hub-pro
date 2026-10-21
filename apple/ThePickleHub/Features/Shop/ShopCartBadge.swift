import Foundation
import SwiftUI
import Observation

/// Shared cart quantity, so the toolbar icon can say how many items are waiting.
///
/// The cart is otherwise loaded per screen, which is fine for a list and
/// useless for a badge: the number has to survive navigation and move the
/// moment something is added, or every screen shows a stale count.
///
/// Counts QUANTITY, not lines. A cart holding "Kaiwin Diamond × 1" and
/// "Negin shoes × 2" is three items to the person carrying it, not two.
@Observable
@MainActor
final class ShopCartBadge {
    static let shared = ShopCartBadge()

    private(set) var count = 0

    private init() {}

    /// Never throws. A badge is decoration: a signed-out or offline visitor
    /// should get the screen, not an error raised from a toolbar.
    func refresh(using repository: any ShopCartRepository = SupabaseShopCartRepository()) async {
        guard let groups = try? await repository.cart() else { return }
        count = groups.reduce(0) { total, group in
            total + group.lines.reduce(0) { $0 + $1.quantity }
        }
    }

    /// Optimistic bump so the badge moves the instant "Thêm vào giỏ" is tapped
    /// rather than after the round trip. `refresh` reconciles it either way.
    func add(_ quantity: Int) { count += max(0, quantity) }
}

/// The cart button, identical on every shop screen.
///
/// It was only on the marketplace list, so opening a product — the screen where
/// you actually add things — left no way back to the cart.
struct ShopCartToolbarButton: View {
    @State private var badge = ShopCartBadge.shared

    var body: some View {
        NavigationLink(value: ShopRoute.cart) {
            // Count beside the icon, not floating above it. A corner badge
            // overflowed the 44pt tap target and the navigation bar clipped its
            // top edge — the number was there and unreadable, which is worse
            // than absent because it looks like a rendering fault.
            HStack(spacing: 5) {
                Image(systemName: "cart")
                if badge.count > 0 {
                    Text(badge.count > 99 ? "99+" : "\(badge.count)")
                        .font(TLType.titleSans(12))
                        .foregroundStyle(TLColor.accentInk)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(TLColor.accent))
                        .monospacedDigit()
                }
            }
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .accessibilityLabel(badge.count > 0
                            ? "Giỏ hàng, \(badge.count) món"
                            : "Giỏ hàng")
        .task { await badge.refresh() }
    }
}

/// Buyer shortcuts that sit on the marketplace canvas rather than competing
/// with the navigation title. The cart is the primary commerce action; orders
/// stays visually quieter but remains a full-size, always-visible target.
struct ShopFloatingActions: View {
    @State private var badge = ShopCartBadge.shared

    var body: some View {
        HStack(spacing: TLSpacing.sm) {
            NavigationLink(value: ShopRoute.orders) {
                Image(systemName: "shippingbox.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(TLColor.fg)
                    .frame(width: 50, height: 50)
                    .background(TLColor.surface, in: Circle())
                    .overlay(Circle().strokeBorder(TLColor.border2))
            }
            .accessibilityLabel("Đơn mua")

            NavigationLink(value: ShopRoute.cart) {
                HStack(spacing: 7) {
                    Image(systemName: "cart.fill")
                        .font(.system(size: 16, weight: .bold))
                    Text("Giỏ")
                        .font(TLType.titleSans(13))
                    if badge.count > 0 {
                        Text(badge.count > 99 ? "99+" : "\(badge.count)")
                            .font(TLType.dataMono(11))
                            .monospacedDigit()
                            .padding(.horizontal, 7)
                            .frame(minHeight: 26)
                            .background(TLColor.accentInk.opacity(0.12), in: Capsule())
                    }
                }
                .foregroundStyle(TLColor.accentInk)
                .padding(.horizontal, TLSpacing.md)
                .frame(minHeight: 50)
                .background(TLColor.accent, in: Capsule())
            }
            .accessibilityLabel(badge.count > 0
                                ? "Giỏ hàng, \(badge.count) món"
                                : "Giỏ hàng")
        }
        .padding(5)
        .background(.regularMaterial, in: Capsule())
        .overlay(Capsule().strokeBorder(TLColor.border))
        .task { await badge.refresh() }
    }
}
