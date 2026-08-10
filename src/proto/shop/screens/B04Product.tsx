// ============================================================================
// B04 — Product detail /shop/product/:slug
// ----------------------------------------------------------------------------
// Acceptance: seller, selected variant, total price context, delivery origin
// and return summary are all clear BEFORE "Thêm vào giỏ". So the buy block
// carries all five, and the sticky bar on mobile repeats seller + variant
// rather than showing a lone price and a green button.
//
// There is no review data in this system, so the reviews section says so
// instead of showing a fabricated 4.8★ (board Rule 4).
// ============================================================================

import { useState } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { readScenario } from "../scenario";
import { BuyerShell } from "../components/Shells";
import {
  ProductMedia,
  ProductPrice,
  SellerIdentity,
  VerificationBadge,
  StockStatus,
  DeliverySummary,
  ProductCard,
  WishlistButton,
} from "../components/Primitives";
import {
  VariantSelector,
  useVariantSelection,
  QuantityControl,
  StickyCommerceBar,
  PolicySummary,
} from "../components/Commerce";
import { LoadingLines, ErrorState, EmptyState, OfflineState } from "../components/States";
import { productBySlug, shopById, buyableProducts, vnd, PRODUCTS } from "../fixtures";

export default function B04Product() {
  const { slug } = useParams();
  const location = useLocation();
  const scenario = readScenario(location.search);

  const product = productBySlug(slug ?? "") ?? PRODUCTS[0];
  const shop = shopById(product.shopId);
  const sel = useVariantSelection(product);
  const [qty, setQty] = useState(1);
  const [media, setMedia] = useState(0);
  const [saved, setSaved] = useState(false);

  const suspended = scenario === "suspended" || shop.state !== "active";
  const soldOut =
    scenario === "unavailable" ||
    product.variants.every((v) => v.stock !== null && v.stock <= 0);
  const unpublished = product.status !== "active";

  // ── Whole-page states ────────────────────────────────────────────────────
  if (scenario === "slow")
    return (
      <BuyerShell title="Đang tải" backTo="/proto/shop/home">
        <main className="tl-shop-page">
          <div className="tl-shop-sk" style={{ aspectRatio: "1 / 1", marginBottom: 16 }} />
          <LoadingLines rows={4} />
        </main>
      </BuyerShell>
    );

  if (scenario === "error")
    return (
      <BuyerShell title="Sản phẩm" backTo="/proto/shop/home">
        <main className="tl-shop-page">
          <ErrorState
            what="Chưa tải được sản phẩm này."
            cause="Máy chủ không trả lời."
            recovery="Anh/chị thử lại giúp. Nếu vẫn không được, sản phẩm có thể vừa bị gỡ."
          />
        </main>
      </BuyerShell>
    );

  if (scenario === "denied")
    return (
      <BuyerShell title="Sản phẩm" backTo="/proto/shop/home">
        <main className="tl-shop-page">
          <EmptyState
            title="Sản phẩm này không còn hiển thị"
            action={
              <Link to="/proto/shop/home" className="tl-shop-btn">
                Về trang Shop
              </Link>
            }
          >
            Người bán đã gỡ hoặc chuyển sang nháp. Đường dẫn cũ vẫn mở được nhưng không có gì
            để xem.
          </EmptyState>
        </main>
      </BuyerShell>
    );

  const activeVariant = sel.variant;
  const price = activeVariant?.priceVnd ?? product.priceVnd;
  const canBuy = !suspended && !soldOut && !unpublished && !sel.partial;

  const variantLabel = product.optionNames.length
    ? product.optionNames.map((n, i) => `${n} ${sel.selected[i] ?? "—"}`).join(" · ")
    : "Chỉ một phiên bản";

  return (
    <BuyerShell title={shop.name} backTo="/proto/shop/home">
      <main className="tl-shop-page">
        {scenario === "empty" && <OfflineState what="Đang xem bản đã tải trước đó." />}

        <div className="tl-shop-pdp">
          {/* ── Media ───────────────────────────────────────────────────── */}
          <div className="tl-shop-pdp-media">
            <div className="tl-shop-gallery">
              <div style={{ position: "relative" }}>
                <ProductMedia
                  tone={product.media[media]?.tone ?? "a"}
                  label={product.media[media]?.label ?? "Chưa có ảnh"}
                />
                <WishlistButton
                  saved={saved}
                  onToggle={() => setSaved((s) => !s)}
                  productTitle={product.title}
                />
              </div>
              {product.media.length > 1 && (
                <div className="tl-shop-gallery-thumbs" role="tablist" aria-label="Ảnh sản phẩm">
                  {product.media.map((m, i) => (
                    <button
                      key={m.label}
                      type="button"
                      role="tab"
                      className="tl-shop-gallery-thumb"
                      aria-current={i === media}
                      aria-label={`Xem ảnh: ${m.label}`}
                      onClick={() => setMedia(i)}
                    >
                      <ProductMedia tone={m.tone} label="" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Buy block ───────────────────────────────────────────────── */}
          <div>
            {unpublished && (
              <div className="tl-shop-notice tl-shop-notice--warn">
                <div>
                  <strong>Sản phẩm chưa được đăng bán.</strong> Anh/chị đang xem bản xem trước.
                  Người mua khác chưa nhìn thấy trang này.
                </div>
              </div>
            )}
            {suspended && (
              <div className="tl-shop-notice tl-shop-notice--warn">
                <div>
                  <strong>Shop đang tạm ngưng bán.</strong> Anh/chị vẫn xem được thông tin
                  nhưng chưa đặt hàng được. Nếu đã có đơn với shop này, đơn cũ không bị ảnh
                  hưởng.
                </div>
              </div>
            )}

            <h1 className="tl-shop-h1" style={{ fontSize: "clamp(18px, 4.5vw, 24px)", lineHeight: 1.3 }}>
              {product.title}
            </h1>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0 14px" }}>
              {product.condition === "da-qua-su-dung" && (
                <span className="tl-shop-pill tl-shop-pill--used">Đã qua sử dụng</span>
              )}
              <StockStatus stock={soldOut ? 0 : (activeVariant?.stock ?? null)} />
            </div>

            <ProductPrice
              vndAmount={price}
              maxVnd={sel.partial ? product.priceMaxVnd : null}
              size="lg"
            />

            {/* Seller comes BEFORE the variant picker — the buyer should know who
                they are dealing with before they start configuring an order. */}
            <div className="tl-shop-card" style={{ margin: "16px 0", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <SellerIdentity shop={shop} />
              <span className="tl-proto-spacer" />
              <VerificationBadge shop={shop} />
            </div>

            {product.optionNames.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <VariantSelector product={product} selected={sel.selected} onPick={sel.pick} />
                {sel.partial && (
                  <p className="tl-shop-hint">
                    Chọn đủ {product.optionNames.join(" và ").toLowerCase()} để biết giá và tồn
                    kho chính xác.
                  </p>
                )}
                {activeVariant && (
                  <p className="tl-shop-hint">
                    Mã hàng {activeVariant.sku} ·{" "}
                    {activeVariant.stock === null
                      ? "người bán không theo dõi tồn kho"
                      : `còn ${activeVariant.stock}`}
                  </p>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 16 }}>
              <div>
                <span className="tl-shop-label">Số lượng</span>
                <QuantityControl value={qty} onChange={setQty} max={activeVariant?.stock ?? null} />
              </div>
              <div>
                <div className="tl-shop-label">Tạm tính</div>
                <div className="tl-shop-price tl-shop-price--lg">{vnd(price * qty)}</div>
                <p className="tl-shop-hint" style={{ marginTop: 2 }}>
                  Chưa gồm phí vận chuyển. Phí hiện ở bước đặt hàng.
                </p>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <DeliverySummary product={product} />
            </div>

            <button
              type="button"
              className="tl-shop-btn tl-shop-btn--primary tl-shop-btn--block"
              disabled={!canBuy}
              style={{ marginBottom: 10 }}
            >
              {suspended
                ? "Shop đang tạm ngưng"
                : soldOut
                  ? "Hết hàng"
                  : sel.partial
                    ? "Chọn phiên bản"
                    : "Thêm vào giỏ"}
            </button>

            <details className="tl-shop-facet" style={{ borderTop: "1px solid var(--tl-border)" }}>
              <summary>Chính sách của shop và của nền tảng</summary>
              <div style={{ paddingTop: 12 }}>
                <PolicySummary shop={shop} product={product} />
              </div>
            </details>
          </div>
        </div>

        {/* ── Specifications ───────────────────────────────────────────── */}
        {product.attributes.length > 0 && (
          <section aria-labelledby="b04-specs">
            <h2 className="tl-shop-h2" id="b04-specs">
              Thông số
            </h2>
            <div style={{ maxWidth: 560 }}>
              <table className="tl-shop-specs">
                <tbody>
                  {product.attributes.map((a) => (
                    <tr key={a.label}>
                      <th scope="row">{a.label}</th>
                      <td>{a.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="tl-shop-hint">
                Thông số do người bán tự khai. ThePickleHub không kiểm định từng sản phẩm.
              </p>
            </div>
          </section>
        )}

        {/* ── Description ──────────────────────────────────────────────── */}
        <section aria-labelledby="b04-desc">
          <h2 className="tl-shop-h2" id="b04-desc">
            Mô tả của người bán
          </h2>
          <p style={{ maxWidth: "68ch", lineHeight: 1.65, fontSize: 14.5, color: "var(--tl-fg-2)" }}>
            {product.description || "Người bán chưa viết mô tả."}
          </p>
        </section>

        {/* ── Store card ───────────────────────────────────────────────── */}
        <section aria-labelledby="b04-store">
          <h2 className="tl-shop-h2" id="b04-store">
            Về shop
          </h2>
          <div className="tl-shop-storecard">
            <div style={{ flex: 1, minWidth: 200 }}>
              <SellerIdentity shop={shop} linked={false} />
              <p className="tl-shop-hint">
                {shop.city} · Mở shop từ {shop.openedAt.split("-").reverse().join("/")} ·{" "}
                {shop.productCount} sản phẩm đang bán
              </p>
            </div>
            <Link to={`/proto/shop/store/${shop.slug}`} className="tl-shop-btn tl-shop-btn--sm">
              Xem tất cả sản phẩm
            </Link>
          </div>
        </section>

        {/* ── Reviews ──────────────────────────────────────────────────── */}
        <section aria-labelledby="b04-reviews">
          <h2 className="tl-shop-h2" id="b04-reviews">
            Đánh giá
          </h2>
          <EmptyState title="Chưa có đánh giá nào cho sản phẩm này">
            Chỉ người đã mua sản phẩm này trên ThePickleHub mới đánh giá được, nên số đánh giá
            sẽ ít nhưng thật.
          </EmptyState>
        </section>

        {/* ── Related ──────────────────────────────────────────────────── */}
        <section aria-labelledby="b04-related">
          <h2 className="tl-shop-h2" id="b04-related">
            Sản phẩm cùng loại
          </h2>
          <div className="tl-shop-grid">
            {buyableProducts()
              .filter((p) => p.category === product.category && p.id !== product.id)
              .slice(0, 4)
              .map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
          </div>
        </section>
      </main>

      <StickyCommerceBar
        priceLabel={sel.partial ? "Chọn phiên bản" : vnd(price * qty)}
        subLabel={`${shop.name} · ${variantLabel}`}
        action={suspended ? "Tạm ngưng" : soldOut ? "Hết hàng" : "Thêm vào giỏ"}
        disabled={!canBuy}
      />
    </BuyerShell>
  );
}
