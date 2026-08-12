// ============================================================================
// Production Shop shells.
// ----------------------------------------------------------------------------
// Promoted from the approved prototype (F03) with the visual contract intact:
//   * html/body/#root are overflow:hidden — every page owns its scroller, so
//     the shell provides .tl-shop + .tl-shop-scroll (prototype finding P9).
//   * Seller Center and Shop Admin carry their own bottom navigation; the
//     app's 5-slot BottomNav and the ChatFAB are hidden on these routes
//     (findings P10/P11, already wired in BottomNav.tsx / ChatFAB.tsx).
//   * No sixth item is ever added to the global bottom nav.
//
// No fixture is imported here. Everything the shells render comes from props.
// ============================================================================

import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronLeft,
  LayoutDashboard,
  Package,
  ClipboardList,
  Settings,
  Menu,
} from "lucide-react";
import "@/styles/the-line.css";
import "@/styles/shop.css";

/** Pins The Line + owns the scroll container. Every Shop page wraps in this. */
export const ShopScrollShell = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    const root = document.documentElement;
    const prevTheme = root.getAttribute("data-theme");
    const prevMode = root.getAttribute("data-mode");
    root.setAttribute("data-theme", "the-line");
    const stored = typeof window !== "undefined" ? localStorage.getItem("tl-theme-mode") : null;
    if (stored === "light") root.setAttribute("data-mode", "light");
    else root.removeAttribute("data-mode");
    return () => {
      if (prevTheme) root.setAttribute("data-theme", prevTheme);
      else root.removeAttribute("data-theme");
      if (prevMode) root.setAttribute("data-mode", prevMode);
      else root.removeAttribute("data-mode");
    };
  }, []);

  return (
    <div className="tl-shop">
      <div className="tl-shop-scroll">{children}</div>
    </div>
  );
};

// ─── Buyer / applicant header ───────────────────────────────────────────────

export const ShopHeader = ({ title, backTo }: { title: string; backTo?: string }) => (
  <header className="tl-shop-header">
    {backTo && (
      <Link to={backTo} className="tl-shop-iconbtn" aria-label="Quay lại">
        <ChevronLeft size={20} aria-hidden="true" />
      </Link>
    )}
    {/* Not an <h1>: the page below owns the single document heading. */}
    <p className="tl-shop-header-title">{title}</p>
  </header>
);

// ─── Seller Center ──────────────────────────────────────────────────────────

export type SellerNavKey = "dashboard" | "products" | "orders" | "settings";

const SELLER_NAV: {
  key: SellerNavKey;
  label: string;
  short: string;
  to: string;
  Icon: typeof Package;
  /** Phase 1 ships only the dashboard; the rest arrive with their phase. */
  ready: boolean;
}[] = [
  { key: "dashboard", label: "Tổng quan", short: "Tổng quan", to: "/seller", Icon: LayoutDashboard, ready: true },
  { key: "products", label: "Sản phẩm", short: "Sản phẩm", to: "/seller/products", Icon: Package, ready: true },
  { key: "orders", label: "Đơn hàng", short: "Đơn", to: "/seller/orders", Icon: ClipboardList, ready: false },
  { key: "settings", label: "Cài đặt", short: "Cài đặt", to: "/seller/settings", Icon: Settings, ready: true },
];

export const SellerShell = ({
  active,
  title,
  actions,
  children,
}: {
  active: SellerNavKey;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <div className="tl-seller">
    <nav className="tl-seller-side" aria-label="Điều hướng Kênh người bán">
      <p className="tl-shop-eyebrow" style={{ padding: "0 12px 10px" }}>
        Kênh người bán
      </p>
      {SELLER_NAV.map(({ key, label, to, Icon, ready }) =>
        ready ? (
          <Link key={key} to={to} className="tl-seller-nav-item" aria-current={key === active ? "page" : undefined}>
            <Icon size={17} aria-hidden="true" />
            {label}
          </Link>
        ) : (
          <span key={key} className="tl-seller-nav-item" aria-disabled="true" style={{ opacity: 0.45 }}>
            <Icon size={17} aria-hidden="true" />
            {label}
            <span className="tl-shop-pill tl-shop-pill--muted">Sắp có</span>
          </span>
        ),
      )}
      <span style={{ flex: 1 }} />
      <Link to="/" className="tl-seller-nav-item">
        <ChevronLeft size={17} aria-hidden="true" />
        Về ThePickleHub
      </Link>
    </nav>

    <div className="tl-seller-main">
      <header className="tl-shop-header">
        <p className="tl-shop-header-title">{title}</p>
        <span className="tl-proto-spacer" />
        {actions}
      </header>
      <main>{children}</main>
      <nav className="tl-seller-tabs" aria-label="Điều hướng Kênh người bán">
        {SELLER_NAV.map(({ key, short, to, Icon, ready }) =>
          ready ? (
            <Link key={key} to={to} className="tl-seller-tab" aria-current={key === active ? "page" : undefined}>
              <Icon size={20} aria-hidden="true" />
              {short}
            </Link>
          ) : (
            <span key={key} className="tl-seller-tab" aria-disabled="true" style={{ opacity: 0.4 }}>
              <Icon size={20} aria-hidden="true" />
              {short}
            </span>
          ),
        )}
      </nav>
    </div>
  </div>
);

// ─── Shop inside AdminLayout ────────────────────────────────────────────────
// AdminLayout's sidebar already carries 18 items, so Shop enters as one parent
// with children rather than four top-level rows. On a phone the nav collapses
// to a single disclosure row (prototype finding: a 10-item list stacked above
// the work pushes the actual task off the first two screens).

const ADMIN_SHOP_NAV = [
  { to: "/admin/shop/applications", label: "Hồ sơ đăng ký", ready: true },
  { to: "/admin/shop/products", label: "Sản phẩm", ready: true },
  { to: "/admin/shop/contacts", label: "Kênh liên hệ", ready: true },
  { to: "/admin/shop/disputes", label: "Khiếu nại", ready: false },
];

const AdminShopNav = ({ pathname }: { pathname: string }) => (
  <ul>
    {ADMIN_SHOP_NAV.map((item) =>
      item.ready ? (
        <li key={item.to} className={pathname.startsWith(item.to) ? "is-new" : ""}>
          <Link to={item.to} style={{ color: "inherit" }}>
            {item.label}
          </Link>
        </li>
      ) : (
        <li key={item.to} style={{ color: "var(--tl-fg-4)" }}>
          {item.label} · sắp có
        </li>
      ),
    )}
  </ul>
);

export const AdminShopFrame = ({ crumb, children }: { crumb: string; children: ReactNode }) => {
  const { pathname } = useLocation();
  return (
    <div className="tl-admin-frame">
      <div className="tl-admin-side" data-desktop-only>
        <p className="tl-shop-eyebrow" style={{ padding: "0 10px 8px" }}>
          Shop
        </p>
        <AdminShopNav pathname={pathname} />
      </div>

      <details className="tl-admin-drawer" data-mobile-only>
        <summary>
          <Menu size={15} aria-hidden="true" />
          Điều hướng Shop
          <span className="tl-proto-spacer" />
          <span className="tl-shop-eyebrow">{crumb}</span>
        </summary>
        <div className="tl-admin-side">
          <AdminShopNav pathname={pathname} />
        </div>
      </details>

      <div className="tl-admin-body">
        <p className="tl-shop-eyebrow" style={{ marginBottom: 8 }}>
          Admin · {crumb}
        </p>
        {children}
      </div>
    </div>
  );
};

/** Label/value pairs that stack under their label below 560px. */
export const DefList = ({ rows }: { rows: [string, ReactNode][] }) => (
  <dl className="tl-shop-deflist">
    {rows.map(([k, v]) => (
      <div key={k}>
        <dt>{k}</dt>
        <dd>{v}</dd>
      </div>
    ))}
  </dl>
);
