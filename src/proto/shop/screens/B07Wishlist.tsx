// ============================================================================
// B07 — Wishlist / saved products
// ----------------------------------------------------------------------------
// A saved list is only useful if it tells the truth about what changed since
// you saved. Each row therefore carries its own disclosure: price moved, seller
// paused, item gone. Silently showing a new price is how a buyer feels cheated.
// ============================================================================

import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { readScenario } from "../scenario";
import { BuyerShell } from "../components/Shells";
import { ProductMedia, SellerIdentity, StockStatus } from "../components/Primitives";
import { EmptyState, LoadingLines, ErrorState } from "../components/States";
import { WISHLIST_BY_SCENARIO, productById, shopById, vnd } from "../fixtures";

export default function B07Wishlist() {
  const location = useLocation();
  const scenario = readScenario(location.search);
  const [removed, setRemoved] = useState<string[]>([]);
  const [lastRemoved, setLastRemoved] = useState<string | null>(null);

  const items = WISHLIST_BY_SCENARIO[scenario].filter((i) => !removed.includes(i.productId));

  const body = () => {
    if (scenario === "slow") return <LoadingLines rows={3} />;
    if (scenario === "error")
      return (
        <ErrorState
          what="Chưa tải được danh sách đã lưu."
          recovery="Danh sách vẫn còn trên tài khoản của anh/chị, thử tải lại giúp."
        />
      );
    if (items.length === 0)
      return (
        <EmptyState
          title="Chưa lưu sản phẩm nào"
          action={
            <Link to="/proto/shop/home" className="tl-shop-btn tl-shop-btn--primary">
              Xem sản phẩm đang bán
            </Link>
          }
        >
          Bấm hình trái tim trên sản phẩm để lưu lại xem sau. Chúng tôi sẽ báo khi giá đổi hoặc
          hàng về.
        </EmptyState>
      );

    return (
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((i) => {
          const p = productById(i.productId);
          const shop = shopById(p.shopId);
          const gone = p.status !== "active";
          const shopDown = shop.state !== "active" || i.issue === "seller-unavailable";
          const priceChanged = i.priceWhenAddedVnd && i.priceWhenAddedVnd !== p.priceVnd;
          const soldOut = i.issue === "out-of-stock" || gone;

          return (
            <li key={i.productId} className="tl-shop-line">
              <div className="tl-shop-line-media">
                <ProductMedia tone={p.media[0]?.tone ?? "a"} label="" />
              </div>
              <div className="tl-shop-line-body">
                <p className="tl-shop-line-title">
                  <Link to={`/proto/shop/product/${p.slug}`} style={{ color: "inherit" }}>
                    {p.title}
                  </Link>
                </p>
                <SellerIdentity shop={shop} />

                <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span className="tl-shop-price">{vnd(p.priceVnd)}</span>
                  {priceChanged && (
                    <span className="tl-shop-price-note">
                      lúc anh/chị lưu là {vnd(i.priceWhenAddedVnd!)}
                    </span>
                  )}
                </div>

                {/* Disclosures — one line each, always explicit about what to do. */}
                {gone && (
                  <p className="tl-shop-hint" style={{ marginTop: 0 }}>
                    Người bán đã gỡ sản phẩm này. Không mua được nữa.
                  </p>
                )}
                {!gone && shopDown && (
                  <p className="tl-shop-hint" style={{ marginTop: 0 }}>
                    Shop đang tạm ngưng bán. Sản phẩm vẫn được giữ trong danh sách của anh/chị.
                  </p>
                )}
                {!gone && !shopDown && <StockStatus stock={soldOut ? 0 : null} />}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                  <button
                    type="button"
                    className="tl-shop-btn tl-shop-btn--sm tl-shop-btn--primary"
                    disabled={gone || shopDown || soldOut}
                  >
                    {gone ? "Đã gỡ" : shopDown ? "Shop tạm ngưng" : soldOut ? "Hết hàng" : "Thêm vào giỏ"}
                  </button>
                  <button
                    type="button"
                    className="tl-shop-btn tl-shop-btn--sm tl-shop-btn--ghost"
                    aria-label={`Bỏ lưu ${p.title}`}
                    onClick={() => {
                      setRemoved((r) => [...r, i.productId]);
                      setLastRemoved(p.title);
                    }}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    Bỏ lưu
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <BuyerShell title="Đã lưu" backTo="/proto/shop/home">
      <main className="tl-shop-page tl-shop-page--narrow">
        <h1 className="tl-shop-h1">Sản phẩm đã lưu</h1>
        <p className="tl-shop-sub">
          {items.length > 0
            ? `${items.length} sản phẩm. Nếu giá đổi hoặc shop tạm ngưng, dòng đó sẽ ghi rõ.`
            : "Lưu sản phẩm để so sánh trước khi mua."}
        </p>

        <div role="status" aria-live="polite">
          {lastRemoved && (
            <div className="tl-shop-notice">
              <div>
                Đã bỏ lưu &ldquo;{lastRemoved}&rdquo;.{" "}
                <button
                  type="button"
                  className="tl-shop-btn tl-shop-btn--sm tl-shop-btn--ghost"
                  onClick={() => {
                    setRemoved((r) => r.slice(0, -1));
                    setLastRemoved(null);
                  }}
                >
                  Hoàn tác
                </button>
              </div>
            </div>
          )}
        </div>

        {body()}
      </main>
    </BuyerShell>
  );
}
