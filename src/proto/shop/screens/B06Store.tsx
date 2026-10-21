// ============================================================================
// B06 — Store detail /shop/store/:slug
// ----------------------------------------------------------------------------
// Acceptance: no private seller document or contact data leaks onto the public
// screen. The screen therefore renders from a whitelist of public fields
// (PUBLIC_FIELDS below) — a future field added to the shop record is invisible
// here until someone deliberately adds it to that list.
// ============================================================================

import { useLocation, useParams, Link } from "react-router-dom";
import { ShieldCheck, MapPin, CalendarDays } from "lucide-react";
import { readScenario } from "../scenario";
import { BuyerShell } from "../components/Shells";
import { ProductCard, VerificationBadge } from "../components/Primitives";
import { EmptyState, LoadingGrid, ErrorState } from "../components/States";
import { SHOPS, PRODUCTS, shopBySlug, dmy, type ProtoShop } from "../fixtures";

/**
 * The ONLY shop fields this public screen may render. Anything the application
 * collected (CCCD number, bank account, personal phone, address line, uploaded
 * documents) is absent by construction, not by remembering to omit it.
 */
const PUBLIC_FIELDS = [
  "name",
  "slug",
  "city",
  "openedAt",
  "verifiedMethod",
  "verifiedAt",
  "state",
  "returnPolicy",
  "shippingNote",
  "productCount",
  "logoInitials",
] as const;

const publicView = (shop: ProtoShop) =>
  Object.fromEntries(PUBLIC_FIELDS.map((k) => [k, shop[k]])) as Pick<
    ProtoShop,
    (typeof PUBLIC_FIELDS)[number]
  >;

const VERIFY_EXPLAIN: Record<string, string> = {
  "giay-phep-kinh-doanh":
    "ThePickleHub đã đối chiếu giấy phép kinh doanh của người bán với tên shop. Điều này xác nhận người bán là ai, không phải là bảo đảm về chất lượng hàng hoá.",
  "gap-truc-tiep":
    "ThePickleHub đã gặp trực tiếp người bán. Điều này xác nhận người bán là ai, không phải là bảo đảm về chất lượng hàng hoá.",
};

export default function B06Store() {
  const { slug } = useParams();
  const location = useLocation();
  const scenario = readScenario(location.search);

  const found = shopBySlug(slug ?? "");
  const shop = publicView(
    scenario === "suspended"
      ? (SHOPS.find((s) => s.state === "suspended") ?? SHOPS[0])
      : scenario === "empty"
        ? (SHOPS.find((s) => s.productCount === 0) ?? SHOPS[0])
        : (found ?? SHOPS[0]),
  );

  const products = PRODUCTS.filter(
    (p) => p.shopId === (found?.id ?? SHOPS[0].id) && p.status === "active",
  );
  const isNew = new Date(shop.openedAt) > new Date("2026-08-01");

  return (
    <BuyerShell title={shop.name} backTo="/proto/shop/home">
      <main className="tl-shop-page">
        <header className="tl-shop-card" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
            <span
              className="tl-shop-seller-mark"
              style={{ width: 52, height: 52, fontSize: 17, borderRadius: 12 }}
              aria-hidden="true"
            >
              {shop.logoInitials}
            </span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <h1 className="tl-shop-h1" style={{ fontSize: "clamp(18px, 4.5vw, 24px)", marginBottom: 8 }}>
                {shop.name}
              </h1>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <VerificationBadge shop={shop as ProtoShop} />
                {shop.state === "suspended" && (
                  <span className="tl-shop-pill tl-shop-pill--warn">Tạm ngưng bán</span>
                )}
                {isNew && shop.state === "active" && (
                  <span className="tl-shop-pill tl-shop-pill--muted">Shop mới</span>
                )}
              </div>
            </div>
            <button type="button" className="tl-shop-btn tl-shop-btn--sm">
              Theo dõi shop
            </button>
          </div>

          {/* Facts we can prove, not metrics we invented. No rating, no response
              rate, no "đã bán N" — none of those exist in the data. */}
          <dl
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              margin: "16px 0 0",
              fontSize: 13.5,
            }}
          >
            <div>
              <dt style={{ color: "var(--tl-fg-3)", display: "flex", gap: 6, alignItems: "center" }}>
                <MapPin size={13} aria-hidden="true" /> Gửi hàng từ
              </dt>
              <dd style={{ margin: "3px 0 0" }}>{shop.city}</dd>
            </div>
            <div>
              <dt style={{ color: "var(--tl-fg-3)", display: "flex", gap: 6, alignItems: "center" }}>
                <CalendarDays size={13} aria-hidden="true" /> Mở shop
              </dt>
              <dd style={{ margin: "3px 0 0" }}>{dmy(shop.openedAt)}</dd>
            </div>
            <div>
              <dt style={{ color: "var(--tl-fg-3)" }}>Đang bán</dt>
              <dd style={{ margin: "3px 0 0" }}>{shop.productCount} sản phẩm</dd>
            </div>
          </dl>
        </header>

        {shop.state === "suspended" && (
          <div className="tl-shop-notice tl-shop-notice--warn">
            <div>
              <strong>Shop này đang tạm ngưng bán.</strong> Sản phẩm vẫn xem được nhưng chưa
              đặt hàng được. Đơn hàng cũ của anh/chị với shop không bị ảnh hưởng — vào{" "}
              <Link to="/proto/shop/orders">Đơn hàng của tôi</Link> để theo dõi.
            </div>
          </div>
        )}

        {shop.verifiedMethod && (
          <section aria-labelledby="b06-verify">
            <h2 className="tl-shop-h2" id="b06-verify">
              &ldquo;Đã xác minh&rdquo; nghĩa là gì
            </h2>
            <div className="tl-shop-notice tl-shop-notice--info">
              <ShieldCheck size={16} aria-hidden="true" />
              <div>
                {VERIFY_EXPLAIN[shop.verifiedMethod]} Xác minh ngày{" "}
                {shop.verifiedAt ? dmy(shop.verifiedAt) : "—"}.
              </div>
            </div>
          </section>
        )}

        <section aria-labelledby="b06-products">
          <h2 className="tl-shop-h2" id="b06-products">
            Sản phẩm của shop
          </h2>
          {scenario === "slow" ? (
            <LoadingGrid count={4} />
          ) : scenario === "error" ? (
            <ErrorState
              what="Chưa tải được sản phẩm của shop."
              recovery="Thông tin shong ở trên vẫn đúng, anh/chị thử tải lại danh sách."
            />
          ) : products.length === 0 || scenario === "empty" ? (
            <EmptyState title="Shop chưa đăng sản phẩm nào">
              Shop vừa được duyệt. Anh/chị theo dõi để được báo khi có hàng.
            </EmptyState>
          ) : (
            <div className="tl-shop-grid">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} showSeller={false} onToggleSave={() => {}} />
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="b06-policy">
          <h2 className="tl-shop-h2" id="b06-policy">
            Chính sách của shop
          </h2>
          <div className="tl-shop-card" style={{ display: "grid", gap: 12, fontSize: 13.5, lineHeight: 1.55 }}>
            <div>
              <div style={{ color: "var(--tl-fg-3)", marginBottom: 3 }}>Đổi trả</div>
              {shop.returnPolicy || (
                <span>
                  <strong>Shop chưa đăng chính sách đổi trả.</strong> Nếu hàng không đúng mô
                  tả, anh/chị vẫn mở được khiếu nại.
                </span>
              )}
            </div>
            <div>
              <div style={{ color: "var(--tl-fg-3)", marginBottom: 3 }}>Vận chuyển</div>
              {shop.shippingNote || "Shop chưa ghi chú về vận chuyển."}
            </div>
          </div>
          <p className="tl-shop-hint">
            Muốn hỏi shop? Nhắn trong trang đơn hàng sau khi đặt. Số điện thoại và địa chỉ
            riêng của người bán không hiển thị công khai.
          </p>
        </section>

        <section aria-labelledby="b06-reviews">
          <h2 className="tl-shop-h2" id="b06-reviews">
            Đánh giá shop
          </h2>
          <EmptyState title="Chưa có đánh giá nào">
            Chỉ người đã mua hàng của shop này mới đánh giá được.
          </EmptyState>
        </section>
      </main>
    </BuyerShell>
  );
}
