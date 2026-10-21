// ============================================================================
// The cart badge, and the one toast the Shop has.
// ----------------------------------------------------------------------------
// Both live here rather than in ShopShell.tsx, and that is a bundle decision:
// ShopShell carries SellerShell and AdminShopFrame, so importing the badge
// from a buyer page would drag the seller nav and the moderation frame into
// the shopper's chunk.
//
// Where the badge goes matters as much as what it does. `TheLineLayout`'s
// `tl-nav` is shared with /live, /feed and /blog — a badge there is a cart
// icon on a livestream. It goes in `.tl-shop-topline`, the breadcrumb row of
// each buying page, and nowhere else. No sixth item in the bottom nav (R6).
// ============================================================================

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, ShoppingBag, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCartCount } from "@/hooks/shop/useCart";

// EN: "My orders" / "Cart" / "Cart, {n} item(s)"
const ORDERS_LABEL = "Đơn của tôi";
const CART_LABEL = "Giỏ hàng";
const CART_ARIA = (count: number | null) =>
  count && count > 0 ? `Giỏ hàng, ${count} món` : "Giỏ hàng";

/**
 * Signed out renders nothing at all: orders and the cart are the buyer's own
 * data, and links to screens that immediately bounce to /login are noise.
 *
 * A null count (loading, or the query failed) renders the link WITHOUT the
 * number. A wrong badge is worse than no badge.
 */
export function ShopCartLink({ floating = false }: { floating?: boolean } = {}) {
  const { user } = useAuth();
  const count = useCartCount();
  if (!user) return null;
  const hasItems = count !== null && count > 0;
  // `is-lit` là hook cho hiệu ứng "2 light" — chỉ trên FAB mobile, chỉ khi có hàng.
  const cartClass = [
    "tl-shop-iconbtn",
    floating && "tl-shop-fab-cart",
    floating && hasItems && "is-lit",
  ].filter(Boolean).join(" ");
  const links = (
    <>
      {floating ? (
        // FAB mobile: icon-only (PO 29/08: chữ làm cụm rộng). Desktop ≥900px:
        // cùng markup nhưng CSS mở nhãn ra thành nút pill — hai icon trần trên
        // web "thiếu nổi bật, quá bé" (PO chiều 29/08).
        <Link to="/shop/orders" className="tl-shop-iconbtn" aria-label={ORDERS_LABEL}>
          <ClipboardList size={24} aria-hidden="true" />
          <span className="tl-shop-fab-label" aria-hidden="true">{ORDERS_LABEL}</span>
        </Link>
      ) : (
        <Link to="/shop/orders" className="tl-shop-btn tl-shop-btn--sm">
          <ClipboardList size={17} aria-hidden="true" />
          {ORDERS_LABEL}
        </Link>
      )}
      <Link to="/shop/cart" className={cartClass} aria-label={CART_ARIA(count)}>
        <ShoppingBag size={floating ? 26 : 20} aria-hidden="true" />
        {floating && <span className="tl-shop-fab-label" aria-hidden="true">{CART_LABEL}</span>}
        {hasItems && (
          <span className="tl-shop-cart-count" aria-hidden="true">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Link>
    </>
  );
  // Mobile (<900px): cụm nổi cố định trên BottomNav. Desktop: wrapper flex trong topline.
  return floating ? <div className="tl-shop-fab">{links}</div> : links;
}

// EN: "Added to cart" / "View cart" / "Dismiss"
const TOAST_COPY = {
  added: "Đã thêm vào giỏ",
  viewCart: "Xem giỏ",
  close: "Đóng thông báo",
};

const TOAST_MS = 6000;

/**
 * "Đã thêm vào giỏ" — fixed, so it never pushes the page under the thumb that
 * just tapped.
 *
 * The `role="status"` wrapper is ALWAYS in the DOM. Mounting it with the
 * message means most screen readers announce nothing: a live region has to
 * exist before its content changes.
 *
 * `nonce` is what makes a second add reset the six seconds instead of
 * inheriting the first timer — same toast, new clock, no stacking.
 */
export function CartAddedToast({
  open,
  nonce = 0,
  onClose,
}: {
  open: boolean;
  nonce?: number;
  onClose: () => void;
}) {
  // A keyboard user reading the toast must not have it vanish mid-tab.
  const [held, setHeld] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open || held) return;
    const t = window.setTimeout(() => closeRef.current(), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [open, held, nonce]);

  return (
    <div role="status" aria-live="polite">
      {open && (
        <div
          className="tl-shop-toast"
          onFocus={() => setHeld(true)}
          onBlur={() => setHeld(false)}
        >
          <span>{TOAST_COPY.added}</span>
          <Link to="/shop/cart" className="tl-shop-btn tl-shop-btn--sm">
            {TOAST_COPY.viewCart}
          </Link>
          <button
            type="button"
            className="tl-shop-iconbtn"
            aria-label={TOAST_COPY.close}
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
