// ============================================================================
// P2b.7.1 — the Shop route inventory.
// ----------------------------------------------------------------------------
// One table, three consumers: the acceptance QA drives it, the Product Owner
// test pack is written from it, and `route-inventory.test.mjs` compares it to
// the route table in src/App.tsx so a route added later cannot quietly escape
// coverage.
//
// A route is only "covered" here if it has BOTH its own heading and a marker
// that only exists once its body rendered. That distinction is not academic:
// on this branch a gate checking headings alone passed on an MFA error screen,
// and a gate checking neither passed on an empty catalogue.
//
// `noindex` is what the EDGE must answer for the path during the pilot, not
// what the SPA writes into <head> after hydration.
// ============================================================================

/**
 * @typedef {Object} RouteSpec
 * @property {string} key
 * @property {"seller"|"admin"|"buyer"|"control"} audience
 * @property {(s: any) => string} path      built from the seeded fixture
 * @property {"anon"|"auth"|"admin"} auth
 * @property {"none"|"aal1"|"aal2"} aal
 * @property {boolean} noindex             expected X-Robots-Tag during the pilot
 * @property {RegExp} h1                   the route's OWN heading
 * @property {RegExp} marker               proof its body rendered, not a shell
 * @property {RegExp} [data]               proof real fixture data reached it
 * @property {string[]} rpcs               the read model behind it
 * @property {string[]} states             the states it has to be right about
 * @property {boolean} [mirrored]          has a /vi twin
 */

/** @type {RouteSpec[]} */
export const SHOP_ROUTES = [
  // ── Control ──────────────────────────────────────────────────────────────
  // /tools, not /clubs. Both use TheLineLayout; only /tools renders a BACK
  // BUTTON, and the back button is what makes the header too wide at 320px.
  // A control that does not exercise the same shell configuration is not a
  // control — it blamed the Shop for a header bug in P2b.4.
  {
    key: "control", pattern: "/tools", audience: "control", path: () => "/tools",
    auth: "anon", aal: "none", noindex: false,
    h1: /.+/, marker: /.+/, rpcs: [], states: ["shipped long before the Shop"],
  },
  // A SECOND control, for the admin shell. /tools carries TheLineLayout and
  // says nothing about AdminLayout's sidebar, whose links are 15px tall — so
  // without this every admin route reported seven small targets that belong to
  // a console that shipped long before the Shop. One control per shell, or the
  // comparison is not a comparison.
  {
    key: "control-admin", pattern: "/admin/users", audience: "control-admin", path: () => "/admin/users",
    auth: "admin", aal: "aal2", noindex: true,
    h1: /.+/, marker: /.+/, rpcs: [], states: ["Phase 0 admin console"],
  },

  // ── Seller ───────────────────────────────────────────────────────────────
  {
    key: "sell-landing", pattern: "/shop/sell", audience: "seller", path: () => "/shop/sell",
    auth: "anon", aal: "none", noindex: true,
    h1: /Bán đồ pickleball trên ThePickleHub/, marker: /Đăng ký bán hàng|thử nghiệm/,
    rpcs: ["shop_pilot_has_access"], states: ["anonymous", "signed in", "already a seller"],
  },
  {
    key: "seller-home", pattern: "/seller", audience: "seller", path: () => "/seller",
    auth: "auth", aal: "aal1", noindex: true,
    h1: /Tổng quan shop|Anh\/chị chưa có shop/, marker: /Sản phẩm|Cài đặt shop|chưa có shop/,
    data: /Shop QA Nghiệm Thu|Sản phẩm/,
    rpcs: ["shops select", "product_status_counts"], states: ["no shop", "active shop"],
  },
  {
    key: "seller-application", pattern: "/seller/application", audience: "seller", path: () => "/seller/application",
    auth: "auth", aal: "aal1", noindex: true,
    h1: /Bước \d+\/\d+|Shop đang chạy thử nghiệm kín|Hồ sơ đang được xử lý/,
    // Step 1 is "Loại người bán" and asks for none of the shop fields, so a
    // marker built from the later steps read the working form as a shell.
    marker: /Hồ sơ đăng ký bán hàng|Loại người bán|thử nghiệm kín|đang được xử lý/,
    rpcs: ["shop_pilot_has_access", "shop_applications select", "shop_application_submit"],
    states: ["non-pilot", "draft", "pending", "needs_changes", "approved"],
  },
  {
    key: "seller-application-status", pattern: "/seller/application/status", audience: "seller", path: () => "/seller/application/status",
    auth: "auth", aal: "aal1", noindex: true,
    h1: /Anh\/chị chưa có hồ sơ nào|Hồ sơ|Đã gửi hồ sơ|Đang được xem|Cần sửa vài chỗ/,
    marker: /hồ sơ/i,
    rpcs: ["shop_applications select", "shop_application_events select"],
    states: ["none", "draft", "submitted", "in_review", "needs_changes", "approved", "rejected", "withdrawn"],
  },
  {
    key: "seller-settings", pattern: "/seller/settings", audience: "seller", path: () => "/seller/settings",
    auth: "auth", aal: "aal1", noindex: true,
    h1: /Cài đặt shop|Chưa có shop/, marker: /Kênh liên hệ|Đường dẫn|Tên shop/,
    data: /Shop QA Nghiệm Thu/,
    rpcs: ["shop_profile_update", "shop_contact_upsert", "shop_slug_update"],
    states: ["contact draft/pending/approved/rejected", "slug rename"],
  },
  {
    key: "seller-products", pattern: "/seller/products", audience: "seller", path: () => "/seller/products",
    auth: "auth", aal: "aal1", noindex: true,
    h1: /Sản phẩm|Chưa có shop/, marker: /Nháp|Chờ duyệt|Thêm sản phẩm/,
    data: /Vợt QA/,
    rpcs: ["products select", "product_status_counts"],
    states: ["draft", "pending_review", "needs_changes", "approved", "suspended", "no results"],
  },
  {
    key: "seller-product-new", pattern: "/seller/products/new", audience: "seller", path: () => "/seller/products/new",
    auth: "auth", aal: "aal1", noindex: true,
    h1: /Thêm sản phẩm|Chưa có shop/, marker: /Tên sản phẩm|Ngành hàng/,
    rpcs: ["product_create"], states: ["empty form", "validation"],
  },
  {
    key: "seller-product-import", pattern: "/seller/products/import", audience: "seller", path: () => "/seller/products/import",
    auth: "auth", aal: "aal1", noindex: true,
    h1: /Nhập sản phẩm hàng loạt|Chưa có shop/, marker: /\.xlsx|Tải|Chọn file/,
    rpcs: ["product-import-enrich (edge)"], states: ["empty upload", "parsed rows", "enriched", "published"],
  },
  {
    key: "seller-product-edit", pattern: "/seller/products/:id/edit", audience: "seller",
    path: (s) => `/seller/products/${s.products.needsChanges.id}/edit`,
    auth: "auth", aal: "aal1", noindex: true,
    h1: /Vợt QA Cần Sửa|Không tìm thấy sản phẩm/, marker: /Ảnh|Phiên bản|Gửi duyệt|cần sửa/i,
    data: /Vợt QA Cần Sửa/,
    rpcs: ["products select", "product_update", "product_submit", "product_variants_reconcile"],
    states: ["draft", "needs_changes deep-link", "pending (read-only)"],
  },

  // ── Admin ────────────────────────────────────────────────────────────────
  {
    key: "admin-applications", pattern: "/admin/shop/applications", audience: "admin", path: () => "/admin/shop/applications",
    auth: "admin", aal: "aal2", noindex: true,
    h1: /Hàng đợi hồ sơ đăng ký/, marker: /Chờ duyệt|Không có hồ sơ nào|Đang xem/,
    rpcs: ["shop_application_queue"], states: ["empty", "pending rows"],
  },
  {
    key: "admin-application-review", pattern: "/admin/shop/applications/:id", audience: "admin",
    path: (s) => `/admin/shop/applications/${s.application.id}`,
    auth: "admin", aal: "aal2", noindex: true,
    h1: /Xét hồ sơ/, marker: /Quyết định|Hồ sơ|Người nộp/i,
    data: /Shop Hồ Sơ QA/,
    rpcs: ["shop_applications select (admin)", "shop_application_decide"],
    states: ["submitted", "under_review", "needs_changes", "approved", "rejected"],
  },
  {
    key: "admin-products", pattern: "/admin/shop/products", audience: "admin", path: () => "/admin/shop/products",
    auth: "admin", aal: "aal2", noindex: true,
    h1: /Hàng đợi duyệt sản phẩm/, marker: /Chờ duyệt|Không có sản phẩm nào/,
    data: /Vợt QA Chờ Duyệt/,
    rpcs: ["product_moderation_queue"],
    states: ["pending_review", "needs_changes", "approved", "suspended"],
  },
  {
    key: "admin-product-review", pattern: "/admin/shop/products/:id", audience: "admin",
    path: (s) => `/admin/shop/products/${s.products.pending.id}`,
    auth: "admin", aal: "aal2", noindex: true,
    h1: /Vợt QA Chờ Duyệt/, marker: /Người mua sẽ thấy gì/,
    data: /Vợt QA Chờ Duyệt/,
    rpcs: ["product_moderation_detail", "product_decide", "product_moderation_history"],
    states: ["pending_review", "approved+published", "suspended (one decision)"],
  },
  {
    key: "admin-contacts", pattern: "/admin/shop/contacts", audience: "admin", path: () => "/admin/shop/contacts",
    auth: "admin", aal: "aal2", noindex: true,
    h1: /Kênh liên hệ của shop/, marker: /Chờ duyệt|Không có kênh nào/,
    // The default tab is `pending_review`, and a NEW channel starts in
    // `draft` — the guard pins it there and there is no seller-side submit.
    // The fixture therefore approves a channel and edits it, which is the
    // only road into this queue. Asserting on the draft's label showed an
    // empty screen on a fully seeded run.
    data: /Gọi ngoài giờ|0938/,
    rpcs: ["shop_contact_moderation_queue", "shop_contact_decide", "shop_contact_moderation_history"],
    states: ["pending_review", "approved", "rejected", "resubmitted"],
  },

  // ── Buyer ────────────────────────────────────────────────────────────────
  {
    key: "shop-home", pattern: "/shop", audience: "buyer", path: () => "/shop", mirrored: true,
    auth: "anon", aal: "none", noindex: true,
    h1: /Chợ đồ pickleball/, marker: /Ngành hàng|Mới đăng/, data: /Vợt QA/,
    rpcs: ["shop_public_search", "shop_public_categories"],
    states: ["populated", "sparse", "empty", "error"],
  },
  {
    key: "shop-search", pattern: "/shop/search", audience: "buyer", path: () => "/shop/search?q=vot", mirrored: true,
    auth: "anon", aal: "none", noindex: true,
    h1: /Tìm sản phẩm/, marker: /sản phẩm|Không tìm thấy/, data: /Vợt QA/,
    rpcs: ["shop_public_search"],
    states: ["hits", "no hits", "filters applied", "error"],
  },
  {
    key: "shop-category", pattern: "/shop/category/:slug", audience: "buyer", path: () => "/shop/category/vot", mirrored: true,
    auth: "anon", aal: "none", noindex: true,
    h1: /Vợt|Ngành hàng/, marker: /sản phẩm|chưa có sản phẩm/, data: /Vợt QA/,
    rpcs: ["shop_public_search", "shop_public_categories"],
    states: ["populated", "empty category", "unknown slug"],
  },
  {
    key: "shop-pdp", pattern: "/shop/product/:slug", audience: "buyer",
    path: (s) => `/shop/product/${s.products.matrix.slug}`, mirrored: true,
    auth: "anon", aal: "none", noindex: true,
    h1: /Vợt QA Nhiều Phiên Bản/,
    marker: /Nhắn Zalo|Nhắn Messenger|Gọi điện|chưa cung cấp kênh liên hệ/,
    data: /Màu|Cỡ cán/,
    rpcs: ["shop_public_product", "shop_public_contacts_for_product"],
    states: ["single variant", "matrix", "sold out combination", "unknown stock", "no contact", "not found", "retired slug"],
  },
  {
    key: "shop-store", pattern: "/shop/store/:slug", audience: "buyer",
    path: (s) => `/shop/store/${s.shops.a.slug}`, mirrored: true,
    auth: "anon", aal: "none", noindex: true,
    h1: /Shop QA Nghiệm Thu/, marker: /Sản phẩm của shop/, data: /Vợt QA/,
    rpcs: ["shop_public_shop", "shop_public_search", "shop_public_contacts"],
    states: ["active", "suspended", "never existed", "retired slug"],
  },

  // ── Buyer, Phase 3 ───────────────────────────────────────────────────────
  // Signed-in only, and noindex for good: these three carry a name, a phone
  // number and a home address.
  {
    key: "shop-cart", pattern: "/shop/cart", audience: "buyer", path: () => "/shop/cart",
    mirrored: true, auth: "auth", aal: "aal1", noindex: true,
    h1: /Giỏ hàng/,
    marker: /Tạm tính|Giỏ hàng đang trống|Đặt hàng shop này/,
    rpcs: ["shop_cart_view", "shop_cart_items insert/update/delete"],
    states: ["empty", "one shop", "two shops", "line unavailable", "shop paused", "load error"],
  },
  {
    key: "shop-checkout", pattern: "/shop/checkout/:shopSlug", audience: "buyer",
    path: (s) => `/shop/checkout/${s.shops.a.slug}`,
    mirrored: true, auth: "auth", aal: "aal1", noindex: true,
    h1: /Đặt hàng/,
    marker: /Địa chỉ nhận hàng|Trả khi nhận hàng|Đặt đơn/,
    rpcs: ["shop_cart_view", "shop_public_shop", "shop_order_create"],
    states: ["form", "validation", "price changed", "shipping changed", "sold out", "shop paused", "empty group"],
  },
  {
    key: "shop-order", pattern: "/shop/order/:code", audience: "buyer",
    path: () => "/shop/order/PH-2608-0000",
    mirrored: true, auth: "auth", aal: "aal1", noindex: true,
    h1: /Shop chưa xác nhận đơn|Người bán đang chuẩn bị hàng|Hàng đang trên đường|Đơn đã xong|Đơn đã huỷ|Không tìm thấy đơn này/,
    marker: /Mã đơn|Diễn biến|Không tìm thấy đơn này/,
    rpcs: ["shop_orders select", "shop_order_items select", "shop_order_events select", "shop_order_transition"],
    states: ["just placed", "pending", "confirmed", "shipped", "delivered", "cancelled", "not found"],
  },
  {
    key: "shop-orders", pattern: "/shop/orders", audience: "buyer", path: () => "/shop/orders",
    mirrored: true, auth: "auth", aal: "aal1", noindex: true,
    h1: /Đơn của tôi/,
    marker: /Đang tới|Anh\/chị chưa có đơn hàng nào|Đã xong/,
    // my_shop_orders, not shop_orders: the table's policy admits every party
    // to an order, so a seller reading it here would be handed their own
    // customers' addresses under the heading "Đơn của tôi".
    rpcs: ["my_shop_orders select"],
    states: ["loading", "never ordered", "no match for search", "one page", "more than ten", "load error"],
  },

  // ── Seller, Phase 3 ──────────────────────────────────────────────────────
  {
    key: "seller-orders", pattern: "/seller/orders", audience: "seller", path: () => "/seller/orders",
    auth: "auth", aal: "aal1", noindex: true,
    h1: /Đơn hàng/,
    marker: /Cần xử lý|Shop chưa có đơn hàng nào|Việc cần làm/,
    rpcs: ["shop_orders select", "shop_order_items select", "shop_order_events select", "shops select"],
    states: ["never sold", "todo empty", "other tab empty", "overdue first", "ordering disabled", "support read-only", "load error"],
  },
  {
    key: "seller-order", pattern: "/seller/orders/:code", audience: "seller",
    path: () => "/seller/orders/PH-2608-0000",
    auth: "auth", aal: "aal1", noindex: true,
    h1: /Đơn PH-|Không tìm thấy đơn này/,
    marker: /Việc cần làm|Không tìm thấy đơn này/,
    rpcs: ["shop_orders select", "shop_order_items select", "shop_order_events select", "shop_order_transition"],
    states: ["pending", "confirmed", "shipped", "delivered", "cancelled", "stale status", "support read-only", "not found"],
  },
];

/** Viewports every route is measured at. 390 is the iPhone 14/15 default. */
export const VIEWPORTS = [320, 375, 390, 414, 768, 1440];

/** Buyer-only surfaces, in both languages, for the SEO acceptance. */
export const BUYER_PATHS = SHOP_ROUTES.filter((r) => r.audience === "buyer").map((r) => r.key);
