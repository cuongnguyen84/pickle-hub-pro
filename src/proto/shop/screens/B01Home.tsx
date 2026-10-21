// ============================================================================
// B01 — Shop home /shop
// ----------------------------------------------------------------------------
// Acceptance: no oversized marketing hero; a useful category/product entry
// appears above the fold. So the page opens on search + categories, and the
// only "hero" is one line of text — on a 320px phone the first product card is
// already partly visible.
//
// Nothing on this page claims popularity ("bán chạy", "xu hướng") because the
// catalogue has no sales data. Sections are ordered by facts we do have:
// recently listed, and shops whose identity we verified.
// ============================================================================

import { useLocation, Link } from "react-router-dom";
import { readScenario, readVariant } from "../scenario";
import { BuyerShell } from "../components/Shells";
import { ProductCard, CategoryShortcut, SellerIdentity, VerificationBadge } from "../components/Primitives";
import { ShopSearchField } from "../components/SearchFilters";
import { LoadingGrid, ErrorState, OfflineState, EmptyState } from "../components/States";
import { CATEGORIES, SHOPS, buyableProducts } from "../fixtures";

const Guides = () => (
  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
    {[
      { t: "Chọn độ dày mặt vợt 13mm hay 16mm?", d: "Đọc 3 phút" },
      { t: "Vợt cũ: nhìn vào đâu để biết mặt còn nhám", d: "Đọc 4 phút" },
      { t: "Bóng trong nhà và ngoài trời khác nhau chỗ nào", d: "Đọc 2 phút" },
    ].map((g) => (
      <li key={g.t} className="tl-shop-card" style={{ padding: "12px 14px" }}>
        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>{g.t}</div>
        <div className="tl-shop-hint" style={{ marginTop: 4 }}>
          {g.d}
        </div>
      </li>
    ))}
  </ul>
);

export default function B01Home() {
  const location = useLocation();
  const scenario = readScenario(location.search);
  const variant = readVariant(location.search); // "" | "returning"
  const products = buyableProducts();
  const verified = SHOPS.filter((s) => s.state === "active" && s.verifiedMethod);

  const body = () => {
    if (scenario === "slow") return <LoadingGrid />;
    if (scenario === "error")
      return (
        <ErrorState
          what="Chưa tải được danh sách sản phẩm."
          cause="Máy chủ không trả lời."
          recovery="Anh/chị thử lại sau vài giây giúp."
        />
      );
    if (scenario === "unavailable") return <OfflineState />;
    if (scenario === "empty")
      return (
        <EmptyState
          title="Chưa có sản phẩm nào đang bán"
          action={
            <Link to="/proto/shop/sell" className="tl-shop-btn tl-shop-btn--primary">
              Đăng ký bán hàng
            </Link>
          }
        >
          Shop mới mở. Nếu anh/chị bán đồ pickleball, đây là lúc tốt để là người đầu tiên.
        </EmptyState>
      );

    return (
      <>
        <section aria-labelledby="b01-new">
          <h2 className="tl-shop-h2" id="b01-new" style={{ marginTop: 20 }}>
            Mới đăng bán
          </h2>
          <div className="tl-shop-grid">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} onToggleSave={() => {}} />
            ))}
          </div>
        </section>

        <section aria-labelledby="b01-shops">
          <h2 className="tl-shop-h2" id="b01-shops">
            Shop đã xác minh danh tính
          </h2>
          <p className="tl-shop-hint" style={{ marginTop: -6, marginBottom: 12 }}>
            Đã đối chiếu giấy tờ hoặc gặp trực tiếp người bán. Không phải bảo đảm chất lượng
            hàng hoá.
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            {verified.map((s) => (
              <Link
                key={s.id}
                to={`/proto/shop/store/${s.slug}`}
                className="tl-shop-card"
                style={{ display: "flex", alignItems: "center", gap: 12, color: "inherit", flexWrap: "wrap" }}
              >
                <SellerIdentity shop={s} linked={false} />
                <span className="tl-proto-spacer" />
                <VerificationBadge shop={s} />
                <span className="tl-shop-hint" style={{ marginTop: 0, width: "100%" }}>
                  {s.city} · {s.productCount} sản phẩm đang bán
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="b01-guides">
          <h2 className="tl-shop-h2" id="b01-guides">
            Hướng dẫn chọn đồ
          </h2>
          <Guides />
        </section>

        <section aria-labelledby="b01-sell" style={{ marginTop: 28 }}>
          <h2 className="tl-shop-sr" id="b01-sell">
            Dành cho người bán
          </h2>
          <div className="tl-shop-card" style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 650, marginBottom: 4 }}>Anh/chị bán đồ pickleball?</div>
              <p className="tl-shop-hint" style={{ marginTop: 0 }}>
                Đăng sản phẩm lên ThePickleHub, người chơi tìm thấy qua tìm kiếm và trang giải
                đấu.
              </p>
            </div>
            <Link to="/proto/shop/sell" className="tl-shop-btn">
              Xem điều kiện
            </Link>
          </div>
        </section>
      </>
    );
  };

  return (
    <BuyerShell
      title="Shop"
      cartCount={variant === "returning" ? 2 : 0}
      searchSlot={<span />}
    >
      <main className="tl-shop-page" id="b01">
        <h1 className="tl-shop-h1">Đồ pickleball từ người bán trong nước</h1>
        <p className="tl-shop-sub" style={{ marginBottom: 14 }}>
          Vợt, giày, bóng và phụ kiện. Mỗi shop tự gửi hàng và tự chịu trách nhiệm về hàng
          hoá.
        </p>

        <ShopSearchField value="" onChange={() => {}} id="b01-search" />

        <nav aria-label="Danh mục" style={{ marginTop: 14 }}>
          <div className="tl-shop-cats">
            {CATEGORIES.map((c) => (
              <CategoryShortcut key={c.slug} slug={c.slug} name={c.name} />
            ))}
          </div>
        </nav>

        {variant === "returning" && scenario === "normal" && (
          <div className="tl-shop-notice" style={{ marginTop: 16 }}>
            <div>
              Anh/chị còn <strong>2 sản phẩm trong giỏ</strong> chưa đặt.{" "}
              <Link to="/proto/shop/cart">Xem giỏ hàng</Link>
            </div>
          </div>
        )}

        {body()}
      </main>
    </BuyerShell>
  );
}
