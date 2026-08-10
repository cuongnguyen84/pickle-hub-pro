// ============================================================================
// Shop prototype — screen registry (F01)
// ----------------------------------------------------------------------------
// Single source of truth for three consumers:
//   1. ProtoShopApp     — builds <Route> entries
//   2. ProtoIndex       — the prototype navigation the product owner browses
//   3. scripts/proto-shop-shots.mjs — the screenshot harness (reads `shots`)
//
// Adding a screen means adding one entry here. Nothing else needs to change.
// ============================================================================

import { lazy, type LazyExoticComponent, type ComponentType } from "react";

export type Batch = "F" | "B1" | "B2" | "S1" | "S2" | "A" | "Q";

export interface Shot {
  /** Short label used in the screenshot filename. */
  label: string;
  /** URL relative to /proto/shop, including any ?scenario= / ?variant=. */
  url: string;
  /** Viewport widths this shot must be captured at (board-specified). */
  widths: number[];
}

export interface ProtoScreen {
  /** Task id from the board, e.g. "B04". */
  id: string;
  title: string;
  batch: Batch;
  /** React Router path relative to /proto/shop. */
  route: string;
  Component: LazyExoticComponent<ComponentType>;
  shots: Shot[];
}

const s = (label: string, url: string, widths: number[]): Shot => ({ label, url, widths });

export const SCREENS: ProtoScreen[] = [
  // ── F — shared foundation ────────────────────────────────────────────────
  {
    id: "F02",
    title: "Token specimen",
    batch: "F",
    route: "tokens",
    Component: lazy(() => import("./screens/F02Tokens")),
    shots: [s("specimen", "/tokens", [375, 1440])],
  },
  {
    id: "F03",
    title: "Shell — buyer / seller / admin",
    batch: "F",
    route: "shells",
    Component: lazy(() => import("./screens/F03Shells")),
    shots: [
      s("buyer", "/shells?variant=buyer", [375, 768, 1440]),
      s("seller", "/shells?variant=seller", [375, 768, 1440]),
      s("admin", "/shells?variant=admin", [375, 768, 1440]),
    ],
  },
  {
    id: "F04",
    title: "Discovery primitives",
    batch: "F",
    route: "primitives/discovery",
    Component: lazy(() => import("./screens/F04Discovery")),
    shots: [s("matrix", "/primitives/discovery", [320, 1440])],
  },
  {
    id: "F05",
    title: "Search + filter primitives",
    batch: "F",
    route: "primitives/search",
    Component: lazy(() => import("./screens/F05Search")),
    shots: [
      s("matrix", "/primitives/search", [375, 1440]),
      s("sheet-open", "/primitives/search?variant=sheet", [375]),
    ],
  },
  {
    id: "F06",
    title: "Commerce action primitives",
    batch: "F",
    route: "primitives/commerce",
    Component: lazy(() => import("./screens/F06Commerce")),
    shots: [s("matrix", "/primitives/commerce", [375, 1440])],
  },
  {
    id: "F07",
    title: "Seller / admin form primitives",
    batch: "F",
    route: "primitives/forms",
    Component: lazy(() => import("./screens/F07Forms")),
    shots: [s("matrix", "/primitives/forms", [375, 1024])],
  },
  {
    id: "F08",
    title: "Copy + accessibility contract",
    batch: "F",
    route: "contract",
    Component: lazy(() => import("./screens/F08Contract")),
    shots: [s("contract", "/contract", [375, 1024])],
  },

  // ── B1 — buyer discovery ────────────────────────────────────────────────
  {
    id: "B01",
    title: "Trang chủ Shop /shop",
    batch: "B1",
    route: "home",
    Component: lazy(() => import("./screens/B01Home")),
    shots: [
      s("first-visit", "/home", [375, 768, 1440]),
      s("returning", "/home?variant=returning", [375]),
      s("empty", "/home?scenario=empty", [375, 1440]),
      s("loading", "/home?scenario=slow", [375]),
      s("offline", "/home?scenario=unavailable", [375]),
      s("error", "/home?scenario=error", [375]),
    ],
  },
  {
    id: "B02",
    title: "Tìm kiếm /shop/search",
    batch: "B1",
    route: "search",
    Component: lazy(() => import("./screens/B02Search")),
    shots: [
      s("results", "/search?q=v%E1%BB%A3t", [320, 375, 1440]),
      s("zero", "/search?q=xxxx", [375]),
      s("suggestion", "/search?q=pickelball", [375]),
      s("network-fail", "/search?scenario=error", [375]),
      s("filtered", "/search?do-day=16&chat-lieu=carbon", [1440]),
    ],
  },
  {
    id: "B03",
    title: "Danh mục /shop/category/:slug",
    batch: "B1",
    route: "category/:slug",
    Component: lazy(() => import("./screens/B03Category")),
    shots: [
      s("paddles", "/category/vot", [375, 1440]),
      s("filtered3", "/category/vot?do-day=16&chat-lieu=carbon&loi-choi=control", [375, 1440]),
      s("coverage", "/category/vot?variant=coverage", [1440]),
      s("shoes", "/category/giay", [375]),
    ],
  },
  {
    id: "B04",
    title: "Chi tiết sản phẩm /shop/product/:slug",
    batch: "B1",
    route: "product/:slug",
    Component: lazy(() => import("./screens/B04Product")),
    shots: [
      s("simple", "/product/vot-carbon-16mm-control", [320, 375, 768, 1440]),
      s("multi-variant", "/product/giay-pickleball-court-pro", [375, 1440]),
      s("used", "/product/vot-da-qua-su-dung-6-thang", [375]),
      s("sold-out", "/product/giay-pickleball-court-pro?scenario=unavailable", [375]),
      s("shop-suspended", "/product/vot-da-qua-su-dung-6-thang?scenario=suspended", [375]),
      s("unpublished", "/product/vot-nhap-khau-cho-duyet", [375]),
      s("loading", "/product/vot-carbon-16mm-control?scenario=slow", [375]),
    ],
  },
  {
    id: "B05",
    title: "Bảng chọn phiên bản",
    batch: "B1",
    route: "variant-sheet",
    Component: lazy(() => import("./screens/B05VariantSheet")),
    shots: [
      s("none", "/variant-sheet?variant=none", [375]),
      s("partial", "/variant-sheet?variant=partial", [375]),
      s("valid", "/variant-sheet?variant=valid", [375]),
      s("soldout", "/variant-sheet?variant=soldout", [375]),
      s("price-change", "/variant-sheet?variant=price", [375]),
      s("failed", "/variant-sheet?variant=failed", [375]),
      s("inline-desktop", "/variant-sheet?variant=valid", [1440]),
    ],
  },
  {
    id: "B06",
    title: "Trang shop /shop/store/:slug",
    batch: "B1",
    route: "store/:slug",
    Component: lazy(() => import("./screens/B06Store")),
    shots: [
      s("established", "/store/pickle-gear-sai-gon", [375, 1440]),
      s("new-shop", "/store/shop-moi-duyet?scenario=empty", [375]),
      s("suspended", "/store/vot-cu-da-nang?scenario=suspended", [375]),
    ],
  },
  {
    id: "B07",
    title: "Sản phẩm đã lưu",
    batch: "B1",
    route: "wishlist",
    Component: lazy(() => import("./screens/B07Wishlist")),
    shots: [
      s("normal", "/wishlist", [375, 1440]),
      s("empty", "/wishlist?scenario=empty", [375]),
      s("price-changed", "/wishlist?scenario=unavailable", [375]),
      s("seller-suspended", "/wishlist?scenario=suspended", [375]),
    ],
  },

  // ── S1 — seller onboarding ──────────────────────────────────────────────
  {
    id: "S01",
    title: "Trang giới thiệu bán hàng /shop/sell",
    batch: "S1",
    route: "sell",
    Component: lazy(() => import("./screens/S01SellLanding")),
    shots: [
      s("anonymous", "/sell", [375, 1440]),
      s("eligible", "/sell?variant=eligible", [375]),
      s("draft", "/sell?variant=draft", [375]),
      s("under-review", "/sell?variant=review", [375]),
      s("approved", "/sell?variant=approved", [375]),
    ],
  },
  {
    id: "S02",
    title: "Hồ sơ đăng ký /seller/application",
    batch: "S1",
    route: "seller/application",
    Component: lazy(() => import("./screens/S02Application")),
    shots: [
      s("step1", "/seller/application?step=0&variant=pristine", [375]),
      s("step2", "/seller/application?step=1&variant=partial", [375, 1024]),
      s("step3", "/seller/application?step=2&variant=partial", [375]),
      s("step4", "/seller/application?step=3&variant=partial", [375]),
      s("step5-docs", "/seller/application?step=4&variant=saved", [375, 1024]),
      s("step6-review", "/seller/application?step=5&variant=saved", [375, 1024]),
      s("saving", "/seller/application?step=1&variant=saving", [375]),
      s("save-failed", "/seller/application?step=1&variant=failed", [375]),
      s("validation-error", "/seller/application?step=1&variant=invalid", [375]),
      s("restored-draft", "/seller/application?step=0&variant=restored", [375]),
    ],
  },
  {
    id: "S03",
    title: "Trạng thái hồ sơ",
    batch: "S1",
    route: "seller/status",
    Component: lazy(() => import("./screens/S03Status")),
    shots: [
      s("draft", "/seller/status?variant=draft", [375]),
      s("submitted", "/seller/status?variant=submitted", [375]),
      s("under-review", "/seller/status?variant=under_review", [375]),
      s("needs-changes", "/seller/status?variant=needs_changes", [375, 1024]),
      s("approved", "/seller/status?variant=approved", [375, 1024]),
      s("rejected", "/seller/status?variant=rejected", [375, 1024]),
      s("withdrawn", "/seller/status?variant=withdrawn", [375]),
    ],
  },
  {
    id: "S04",
    title: "Bảng điều khiển người bán /seller",
    batch: "S1",
    route: "seller",
    Component: lazy(() => import("./screens/S04Dashboard")),
    shots: [
      s("active", "/seller", [375, 1440]),
      s("new-shop", "/seller?scenario=empty", [375, 1440]),
      s("loading", "/seller?scenario=slow", [375]),
      s("error", "/seller?scenario=error", [375]),
    ],
  },

  // ── S2 — seller operations ──────────────────────────────────────────────
  {
    id: "S05",
    title: "Sản phẩm của shop /seller/products",
    batch: "S2",
    route: "seller/products",
    Component: lazy(() => import("./screens/S05Products")),
    shots: [
      s("mixed", "/seller/products", [375, 1440]),
      s("empty", "/seller/products?scenario=empty", [375]),
      s("error", "/seller/products?scenario=error", [375]),
    ],
  },
  {
    id: "S06",
    title: "Thêm sản phẩm /seller/products/new",
    batch: "S2",
    route: "seller/products/new",
    Component: lazy(() => import("./screens/S06ProductNew")),
    shots: [
      s("paddle", "/seller/products/new", [375, 1440]),
      s("shoes-variants", "/seller/products/new?variant=shoes", [375, 1440]),
      s("used", "/seller/products/new?variant=used", [375]),
      s("category-change", "/seller/products/new?variant=category-change", [375]),
      s("media-error", "/seller/products/new?variant=media-error", [375]),
      s("invalid-attrs", "/seller/products/new?variant=invalid-attrs", [375]),
      s("duplicate-sku", "/seller/products/new?variant=duplicate-sku", [375]),
      s("bulk-edit", "/seller/products/new?variant=bulk", [1440]),
      s("preview-errors", "/seller/products/new?variant=preview-errors", [375]),
      s("submitted", "/seller/products/new?variant=submitted", [375]),
    ],
  },
  {
    id: "S07",
    title: "Sửa sản phẩm /seller/products/:id/edit",
    batch: "S2",
    route: "seller/products/:id/edit",
    Component: lazy(() => import("./screens/S07ProductEdit")),
    shots: [
      s("active", "/seller/products/p-2/edit", [375, 1440]),
      s("pending", "/seller/products/p-7/edit?variant=pending", [375]),
      s("requested-changes", "/seller/products/p-8/edit?variant=requested", [375, 1440]),
      s("conflict", "/seller/products/p-2/edit?variant=conflict", [375, 1440]),
      s("open-orders", "/seller/products/p-2/edit?variant=open-orders", [375]),
    ],
  },
  {
    id: "S08",
    title: "Đơn hàng shop /seller/orders",
    batch: "S2",
    route: "seller/orders",
    Component: lazy(() => import("./screens/S08Orders")),
    shots: [
      s("queue", "/seller/orders", [375, 1440]),
      s("empty", "/seller/orders?scenario=empty", [375]),
      s("error", "/seller/orders?scenario=error", [375]),
    ],
  },
  {
    id: "S09",
    title: "Chi tiết đơn /seller/orders/:id",
    batch: "S2",
    route: "seller/orders/:id",
    Component: lazy(() => import("./screens/S09OrderDetail")),
    shots: [
      s("new-order", "/seller/orders/PH-2608-0039?variant=new", [375, 1440]),
      s("awaiting-payment", "/seller/orders/PH-2608-0041?variant=awaiting", [375]),
      s("shipped", "/seller/orders/PH-2608-0031?variant=shipped", [375]),
      s("return-request", "/seller/orders/PH-2607-0022?variant=ret", [375, 1440]),
      s("dispute", "/seller/orders/PH-2607-0025?variant=dispute", [375]),
      s("cancelled", "/seller/orders/PH-2607-0009?variant=cancel", [375]),
    ],
  },
  {
    id: "S10",
    title: "Cài đặt shop /seller/settings",
    batch: "S2",
    route: "seller/settings",
    Component: lazy(() => import("./screens/S10Settings")),
    shots: [
      s("normal", "/seller/settings", [375, 1440]),
      s("reverify", "/seller/settings?variant=reverify", [375]),
      s("bank-reauth", "/seller/settings?variant=bank-reauth", [375]),
      s("no-permission", "/seller/settings?variant=no-permission", [375]),
    ],
  },
];

export const screensByBatch =(): Record<Batch, ProtoScreen[]> => {
  const out = { F: [], B1: [], B2: [], S1: [], S2: [], A: [], Q: [] } as Record<Batch, ProtoScreen[]>;
  for (const sc of SCREENS) out[sc.batch].push(sc);
  return out;
};

export const BATCH_LABEL: Record<Batch, string> = {
  F: "F — Nền tảng dùng chung",
  B1: "B1 — Người mua: khám phá",
  B2: "B2 — Người mua: giao dịch & hỗ trợ",
  S1: "S1 — Người bán: đăng ký",
  S2: "S2 — Người bán: vận hành",
  A: "A — Quản trị",
  Q: "Q — Kiểm tra chéo",
};
