// ============================================================================
// /seller — Seller Center home.
// ----------------------------------------------------------------------------
// Phase 1 scope: what state the shop is in and what to do next. Products and
// orders arrive with their phases; the nav marks them "sắp có" rather than
// linking to a route that would 404.
//
// No vanity chart. With a handful of orders a list says more than a line.
// ============================================================================

import { Link } from "react-router-dom";
import { AlertTriangle, Check, Store } from "lucide-react";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { ShopScrollShell, SellerShell, DefList } from "@/components/shop/ShopShell";
import { ShopErrorNotice } from "@/components/shop/ShopNotice";
import { LoadingState } from "@/components/states/PageStates";
import { useMyApplication, useMyShop } from "@/hooks/shop/useSellerApplication";
import { useProductStatusCounts } from "@/hooks/shop/useSellerProducts";
import { useShopOrders } from "@/hooks/shop/useOrders";
import { SHOP_STATE_LABEL } from "@/lib/shop/applicationState";
import { inSellerTab } from "@/lib/shop/sellerOrders";

/** The four numbers a seller acts on. "Cần sửa" pools needs_changes with
 *  rejected: both mean the ball is in the seller's court. */
function ProductStats({
  counts,
  shopState,
}: {
  counts: ReturnType<typeof useProductStatusCounts>;
  shopState: string;
}) {
  if (counts.isLoading) {
    return (
      <div className="tl-shop-stats" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="tl-shop-sk" style={{ height: 76 }} />
        ))}
      </div>
    );
  }

  if (counts.isError) {
    return (
      <p className="tl-shop-hint" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        Chưa tải được số liệu sản phẩm.
        <button
          type="button"
          className="tl-shop-btn tl-shop-btn--sm"
          onClick={() => void counts.refetch()}
        >
          Thử lại
        </button>
      </p>
    );
  }

  const c = counts.data;
  if (!c) return null;

  const needsFix = (c.needs_changes ?? 0) + (c.rejected ?? 0);
  // Only the four displayed groups count — archived (and DB-only suspended)
  // are "đã cất đi" and must not keep the dashboard out of its empty state.
  const total = (c.approved ?? 0) + (c.pending_review ?? 0) + needsFix + (c.draft ?? 0);
  if (total === 0) {
    return (
      <div className="tl-shop-empty" style={{ padding: "24px 16px" }}>
        <p className="tl-shop-empty-title">Chưa có sản phẩm nào</p>
        {shopState === "active" && (
          <Link to="/seller/products/new" className="tl-shop-btn tl-shop-btn--primary">
            Đăng sản phẩm đầu tiên
          </Link>
        )}
      </div>
    );
  }
  const stats: Array<[label: string, n: number, attn?: boolean]> = [
    ["Đã duyệt", c.approved ?? 0],
    ["Chờ duyệt", c.pending_review ?? 0],
    ["Cần sửa", needsFix, needsFix > 0],
    ["Nháp", c.draft ?? 0],
  ];

  return (
    <div className="tl-shop-stats">
      {stats.map(([label, n, attn]) => (
        <Link
          key={label}
          to="/seller/products"
          className={`tl-shop-stat${attn ? " tl-shop-stat--attn" : ""}`}
        >
          <span className="tl-shop-stat-n">{n}</span>
          <span className="tl-shop-stat-l">{label}</span>
        </Link>
      ))}
    </div>
  );
}

/** R5 #16 — the only number on this page about TODAY's work. Orders are the
 *  seller's daily job since Phase 3, and the dashboard had four counters about
 *  products and none about orders. Emphasised only when it is > 0: a red 0 is
 *  an alarm about nothing. */
function OrdersToDo({ shopId }: { shopId: string | null }) {
  const list = useShopOrders(shopId);
  if (list.isLoading || list.isError) return null;
  const n = (list.data ?? []).filter((o) => inSellerTab(o.status, "todo")).length;
  return (
    <Link
      to="/seller/orders"
      className={`tl-shop-stat${n > 0 ? " tl-shop-stat--attn" : ""}`}
      style={{ marginBottom: 16 }}
    >
      <span className="tl-shop-stat-n">{n}</span>
      <span className="tl-shop-stat-l">
        {n > 0 ? "Đơn cần xử lý — mở ngay" : "Đơn cần xử lý"}
      </span>
    </Link>
  );
}

export default function SellerHome() {
  const shop = useMyShop();
  const app = useMyApplication();
  const counts = useProductStatusCounts(shop.data?.id ?? null);

  if (shop.isLoading || app.isLoading) return <LoadingState fullScreen />;

  if (shop.isError) {
    return (
      <ShopScrollShell>
        <SellerShell active="dashboard" title="Tổng quan">
          <div className="tl-shop-page">
            <ShopErrorNotice
              title="Chưa tải được shop của anh/chị."
              onRetry={() => void shop.refetch()}
            />
          </div>
        </SellerShell>
      </ShopScrollShell>
    );
  }

  if (!shop.data) {
    return (
      <ShopScrollShell>
        <DynamicMeta title="Kênh người bán" noindex />
        <SellerShell active="dashboard" title="Kênh người bán">
          <div className="tl-shop-page">
            <h1 className="tl-shop-h1">Anh/chị chưa có shop</h1>
            <p className="tl-shop-sub">
              {app.data
                ? "Hồ sơ đăng ký của anh/chị chưa được duyệt xong."
                : "Chưa có hồ sơ đăng ký nào."}
            </p>
            <Link
              to={app.data ? "/seller/application/status" : "/shop/sell"}
              className="tl-shop-btn tl-shop-btn--primary"
            >
              {app.data ? "Xem trạng thái hồ sơ" : "Đăng ký bán hàng"}
            </Link>
          </div>
        </SellerShell>
      </ShopScrollShell>
    );
  }

  const s = shop.data;

  return (
    <ShopScrollShell>
      <DynamicMeta title={`Kênh người bán · ${s.name}`} noindex />
      <SellerShell active="dashboard" title={s.name}>
        <div className="tl-shop-page">
          <h1 className="tl-shop-sr">Tổng quan shop</h1>

          {s.state === "pending_activation" && (
            <div className="tl-shop-notice tl-shop-notice--warn">
              <AlertTriangle size={16} aria-hidden="true" />
              <div>
                <strong>Shop đã mở nhưng chưa hoạt động.</strong> Quản trị viên sẽ kích hoạt sau
                khi xác minh với anh/chị — khi shop lên công khai, chúng tôi báo trực tiếp qua Zalo.
              </div>
            </div>
          )}

          {s.state === "active" && (
            <div className="tl-shop-notice tl-shop-notice--info">
              <Check size={16} aria-hidden="true" />
              <div>
                <strong>Shop đang hoạt động</strong> — ai cũng xem được tại{" "}
                <a href={`/shop/store/${s.slug}`} target="_blank" rel="noopener noreferrer">
                  trang shop của anh/chị (mở tab mới)
                </a>
                . Bước tiếp theo: <Link to="/seller/products/new">đăng sản phẩm đầu tiên</Link>.
              </div>
            </div>
          )}

          {s.state === "active" && (
            <div className="tl-shop-cta-row">
              <a
                href={`/shop/store/${s.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="tl-shop-btn tl-shop-btn--primary"
              >
                <Store size={16} aria-hidden="true" />
                Xem shop của tôi
              </a>
              <Link to="/seller/products/new" className="tl-shop-btn">
                Đăng sản phẩm
              </Link>
            </div>
          )}

          {s.state === "active" && <OrdersToDo shopId={s.id} />}

          <ProductStats counts={counts} shopState={s.state} />

          <section aria-labelledby="s04-shop" className="tl-shop-section">
            <h2 className="tl-shop-h2" id="s04-shop">Shop của anh/chị</h2>
            <div className="tl-shop-card">
              <DefList
                rows={[
                  ["Tên shop", s.name],
                  ["Trạng thái", SHOP_STATE_LABEL[s.state] ?? s.state],
                  ["Đường dẫn", `/shop/store/${s.slug}`],
                  ["Gửi hàng từ", s.city ?? "—"],
                  ["Mở shop", new Date(s.created_at).toLocaleDateString("vi-VN")],
                ]}
              />
            </div>
          </section>

          {/* R5 #4 — the old "Bước tiếp theo" block said order management was
              not part of the closed pilot. It has been open since Phase 3, and
              the number above is the honest version of the same sentence. */}
          <section aria-labelledby="s04-next" className="tl-shop-section">
            <h2 className="tl-shop-h2" id="s04-next">Bước tiếp theo</h2>
            <div className="tl-shop-card" style={{ fontSize: 14, lineHeight: 1.6 }}>
              Đăng sản phẩm, nhận đơn và cài đặt shop đều đã mở. Người mua đặt hàng ngay trên
              ThePickleHub, và vẫn nhắn được thẳng cho anh/chị qua kênh liên hệ của shop.
            </div>
          </section>
        </div>
      </SellerShell>
    </ShopScrollShell>
  );
}
