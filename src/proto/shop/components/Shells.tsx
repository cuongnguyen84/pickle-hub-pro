// ============================================================================
// F03 — Shop shells (buyer / seller / admin)
// ----------------------------------------------------------------------------
// Reused by every screen in the prototype so chrome bugs get fixed once.
//
// Bottom-nav rule: the app's BottomNav has exactly 5 slots and the board
// forbids a sixth. Buyer Shop screens therefore live UNDER the existing nav
// (and reserve clearance for it); Seller Center and Shop Admin hide it the
// same way /creator and /admin already do.
// ============================================================================

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  Search,
  ShoppingCart,
  LayoutDashboard,
  Package,
  ClipboardList,
  Settings,
} from "lucide-react";

// ─── Buyer ──────────────────────────────────────────────────────────────────

export interface BuyerShellProps {
  title: string;
  /** Where the in-page back affordance goes. Omit to hide it. */
  backTo?: string;
  /** null hides the cart button entirely (e.g. on the cart screen itself). */
  cartCount?: number | null;
  searchSlot?: ReactNode;
  children: ReactNode;
  /** Rendered fixed above the bottom nav. */
  stickyBar?: ReactNode;
}

export const BuyerShell = ({
  title,
  backTo,
  cartCount = 3,
  searchSlot,
  children,
  stickyBar,
}: BuyerShellProps) => (
  <div>
    <header className="tl-shop-header">
      {backTo ? (
        <Link to={backTo} className="tl-shop-iconbtn" aria-label="Quay lại">
          <ChevronLeft size={20} aria-hidden="true" />
        </Link>
      ) : null}
      {/* Not an <h1>: the page below owns the single document heading. */}
      <p className="tl-shop-header-title">{title}</p>
      <span className="tl-proto-spacer" />
      {searchSlot ?? (
        <Link to="/proto/shop/search" className="tl-shop-iconbtn" aria-label="Tìm sản phẩm">
          <Search size={20} aria-hidden="true" />
        </Link>
      )}
      {cartCount !== null && (
        <Link to="/proto/shop/cart" className="tl-shop-iconbtn" aria-label={`Giỏ hàng, ${cartCount} sản phẩm`}>
          <ShoppingCart size={20} aria-hidden="true" />
          {cartCount > 0 && (
            <span className="tl-shop-cart-count" aria-hidden="true">
              {cartCount}
            </span>
          )}
        </Link>
      )}
    </header>
    {children}
    {stickyBar}
  </div>
);

// ─── Seller Center ──────────────────────────────────────────────────────────

export type SellerNavKey = "dashboard" | "products" | "orders" | "settings";

const SELLER_NAV: { key: SellerNavKey; label: string; short: string; to: string; Icon: typeof Package }[] = [
  { key: "dashboard", label: "Tổng quan", short: "Tổng quan", to: "/proto/shop/seller", Icon: LayoutDashboard },
  { key: "products", label: "Sản phẩm", short: "Sản phẩm", to: "/proto/shop/seller/products", Icon: Package },
  { key: "orders", label: "Đơn hàng", short: "Đơn", to: "/proto/shop/seller/orders", Icon: ClipboardList },
  { key: "settings", label: "Cài đặt", short: "Cài đặt", to: "/proto/shop/seller/settings", Icon: Settings },
];

export interface SellerShellProps {
  active: SellerNavKey;
  title: string;
  /** Count badges on the sidebar, e.g. { orders: 3 }. Only shown when > 0. */
  badges?: Partial<Record<SellerNavKey, number>>;
  actions?: ReactNode;
  children: ReactNode;
}

export const SellerShell = ({ active, title, badges = {}, actions, children }: SellerShellProps) => (
  <div className="tl-seller">
    <nav className="tl-seller-side" aria-label="Điều hướng Kênh người bán">
      <p className="tl-shop-eyebrow" style={{ padding: "0 12px 10px" }}>
        Kênh người bán
      </p>
      {SELLER_NAV.map(({ key, label, to, Icon }) => (
        <Link key={key} to={to} className="tl-seller-nav-item" aria-current={key === active ? "page" : undefined}>
          <Icon size={17} aria-hidden="true" />
          {label}
          {(badges[key] ?? 0) > 0 && (
            <span className="tl-shop-pill tl-shop-pill--warn">{badges[key]}</span>
          )}
        </Link>
      ))}
      <span style={{ flex: 1 }} />
      <Link to="/proto/shop" className="tl-seller-nav-item">
        <ChevronLeft size={17} aria-hidden="true" />
        Về trang mua hàng
      </Link>
    </nav>

    <div className="tl-seller-main">
      <header className="tl-shop-header">
        {/* Not an <h1>: the page below owns the single document heading. */}
      <p className="tl-shop-header-title">{title}</p>
        <span className="tl-proto-spacer" />
        {actions}
      </header>
      <main>{children}</main>
      <nav className="tl-seller-tabs" aria-label="Điều hướng Kênh người bán">
        {SELLER_NAV.map(({ key, short, to, Icon }) => (
          <Link key={key} to={to} className="tl-seller-tab" aria-current={key === active ? "page" : undefined}>
            <span style={{ position: "relative", display: "inline-flex" }}>
              <Icon size={20} aria-hidden="true" />
              {(badges[key] ?? 0) > 0 && (
                <span className="tl-shop-cart-count" style={{ top: -6, right: -8 }} aria-hidden="true">
                  {badges[key]}
                </span>
              )}
            </span>
            {short}
          </Link>
        ))}
      </nav>
    </div>
  </div>
);

// ─── Shop inside the existing AdminLayout ───────────────────────────────────

/**
 * The admin side is a proposal, not a new shell: AdminLayout's sidebar already
 * carries 18 items, so Shop enters as ONE item with children rather than four
 * top-level rows.
 */
export const AdminShopFrame = ({ crumb, children }: { crumb: string; children: ReactNode }) => (
  <div className="tl-admin-frame">
    <div className="tl-admin-side">
      <p className="tl-shop-eyebrow" style={{ padding: "0 10px 8px" }}>
        AdminLayout
      </p>
      <ul>
        <li>Tổng quan</li>
        <li>Tổ chức</li>
        <li>Users</li>
        <li>Giải đấu</li>
        <li style={{ color: "var(--tl-fg-3)" }}>… 12 mục khác</li>
        <li className="is-new">Shop</li>
        <li className="is-new is-child">Hồ sơ đăng ký</li>
        <li className="is-new is-child">Sản phẩm</li>
        <li className="is-new is-child">Khiếu nại</li>
        <li>Nhật ký</li>
      </ul>
    </div>
    <div className="tl-admin-body">
      <p className="tl-shop-eyebrow" style={{ marginBottom: 8 }}>
        Admin · {crumb}
      </p>
      {children}
    </div>
  </div>
);
