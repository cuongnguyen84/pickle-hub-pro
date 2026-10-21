// ============================================================================
// B08 — Cart /shop/cart
// ----------------------------------------------------------------------------
// Acceptance: the user understands each shop is checked out and delivered
// separately. So there is no global "Đặt hàng" button anywhere on this page —
// only per-shop ones, and a line above the groups says why.
// ============================================================================

import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Trash2, AlertTriangle } from "lucide-react";
import { readScenario } from "../scenario";
import { BuyerShell } from "../components/Shells";
import { ProductMedia } from "../components/Primitives";
import { CartSellerGroup, QuantityControl } from "../components/Commerce";
import { EmptyState, ErrorState, LoadingLines } from "../components/States";
import { CART_BY_SCENARIO, productById, shopById, vnd, type ProtoCartLine } from "../fixtures";

export default function B08Cart() {
  const location = useLocation();
  const scenario = readScenario(location.search);
  const [lines, setLines] = useState<ProtoCartLine[]>(CART_BY_SCENARIO[scenario]);
  const [undo, setUndo] = useState<{ line: ProtoCartLine; index: number } | null>(null);

  const byShop = new Map<string, ProtoCartLine[]>();
  for (const l of lines) {
    const shopId = productById(l.productId).shopId;
    byShop.set(shopId, [...(byShop.get(shopId) ?? []), l]);
  }

  const setQty = (i: number, q: number) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, qty: q } : l)));

  const remove = (i: number) => {
    setUndo({ line: lines[i], index: i });
    setLines((ls) => ls.filter((_, idx) => idx !== i));
  };

  if (scenario === "slow")
    return (
      <BuyerShell title="Giỏ hàng" backTo="/proto/shop/home" cartCount={null}>
        <main className="tl-shop-page tl-shop-page--narrow">
          <LoadingLines rows={3} />
        </main>
      </BuyerShell>
    );

  if (scenario === "error")
    return (
      <BuyerShell title="Giỏ hàng" backTo="/proto/shop/home" cartCount={null}>
        <main className="tl-shop-page tl-shop-page--narrow">
          <ErrorState
            what="Chưa tải được giỏ hàng."
            recovery="Sản phẩm anh/chị đã thêm vẫn còn, thử tải lại giúp."
          />
        </main>
      </BuyerShell>
    );

  return (
    <BuyerShell title="Giỏ hàng" backTo="/proto/shop/home" cartCount={null}>
      <main className="tl-shop-page tl-shop-page--narrow">
        <h1 className="tl-shop-h1">Giỏ hàng</h1>

        {lines.length === 0 ? (
          <EmptyState
            title="Giỏ hàng đang trống"
            action={
              <Link to="/proto/shop/home" className="tl-shop-btn tl-shop-btn--primary">
                Xem sản phẩm đang bán
              </Link>
            }
          >
            Sản phẩm anh/chị lưu vẫn nằm trong mục{" "}
            <Link to="/proto/shop/wishlist">Đã lưu</Link>.
          </EmptyState>
        ) : (
          <>
            <p className="tl-shop-sub">
              Giỏ có sản phẩm của <strong>{byShop.size} shop</strong>. Mỗi shop tự gửi hàng nên
              anh/chị đặt và nhận hàng <strong>riêng từng shop</strong> — phí vận chuyển cũng
              tính riêng.
            </p>

            <div role="status" aria-live="polite">
              {undo && (
                <div className="tl-shop-notice">
                  <div>
                    Đã bỏ &ldquo;{productById(undo.line.productId).title}&rdquo; khỏi giỏ.{" "}
                    <button
                      type="button"
                      className="tl-shop-btn tl-shop-btn--sm tl-shop-btn--ghost"
                      onClick={() => {
                        setLines((ls) => {
                          const next = ls.slice();
                          next.splice(undo.index, 0, undo.line);
                          return next;
                        });
                        setUndo(null);
                      }}
                    >
                      Hoàn tác
                    </button>
                  </div>
                </div>
              )}
            </div>

            {[...byShop.entries()].map(([shopId, group]) => {
              const shop = shopById(shopId);
              const subtotal = group.reduce(
                (n, l) => n + productById(l.productId).priceVnd * l.qty,
                0,
              );
              const blocked =
                shop.state !== "active" || group.some((l) => l.issue === "out-of-stock");

              return (
                <CartSellerGroup
                  key={shopId}
                  shop={shop}
                  subtotal={subtotal}
                  footNote={
                    <p className="tl-shop-hint" style={{ marginTop: 4 }}>
                      Chưa gồm phí vận chuyển ({vnd(35_000)}), tính ở bước đặt hàng.
                    </p>
                  }
                  action={
                    blocked ? (
                      <button type="button" className="tl-shop-btn" disabled>
                        {shop.state !== "active" ? "Shop tạm ngưng" : "Cần sửa giỏ"}
                      </button>
                    ) : (
                      <Link
                        to={`/proto/shop/checkout/${shopId}`}
                        className="tl-shop-btn tl-shop-btn--primary"
                      >
                        Đặt hàng shop này
                      </Link>
                    )
                  }
                >
                  {shop.state !== "active" && (
                    <div className="tl-shop-notice tl-shop-notice--warn" style={{ margin: "12px 0" }}>
                      <AlertTriangle size={16} aria-hidden="true" />
                      <div>
                        <strong>{shop.name} đang tạm ngưng bán.</strong> Sản phẩm vẫn nằm trong
                        giỏ, anh/chị đặt được khi shop mở lại. Các shop khác trong giỏ không bị
                        ảnh hưởng.
                      </div>
                    </div>
                  )}

                  {group.map((l) => {
                    const p = productById(l.productId);
                    const v = p.variants.find((x) => x.id === l.variantId);
                    const i = lines.indexOf(l);
                    return (
                      <div key={`${l.productId}-${l.variantId}`} className="tl-shop-line">
                        <div className="tl-shop-line-media">
                          <ProductMedia tone={p.media[0]?.tone ?? "a"} label="" />
                        </div>
                        <div className="tl-shop-line-body">
                          <p className="tl-shop-line-title">
                            <Link to={`/proto/shop/product/${p.slug}`} style={{ color: "inherit" }}>
                              {p.title}
                            </Link>
                          </p>
                          {v?.values.length ? (
                            <span className="tl-shop-hint" style={{ marginTop: 0 }}>
                              {v.values.join(" · ")}
                            </span>
                          ) : null}

                          <span className="tl-shop-price">{vnd(p.priceVnd * l.qty)}</span>

                          {l.issue === "price-changed" && l.priceWhenAddedVnd && (
                            <p className="tl-shop-hint" style={{ marginTop: 0, color: "var(--shop-warning)" }}>
                              Giá đã đổi: lúc anh/chị thêm vào giỏ là {vnd(l.priceWhenAddedVnd)}.
                              Giỏ đang tính theo giá mới.
                            </p>
                          )}
                          {l.issue === "out-of-stock" && (
                            <p className="tl-shop-error" style={{ marginTop: 0 }}>
                              <AlertTriangle size={13} aria-hidden="true" />
                              Phiên bản này vừa hết hàng. Bỏ ra để đặt phần còn lại, hoặc chọn
                              phiên bản khác.
                            </p>
                          )}

                          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <QuantityControl
                              value={l.qty}
                              onChange={(q) => setQty(i, q)}
                              max={v?.stock ?? null}
                            />
                            <button
                              type="button"
                              className="tl-shop-btn tl-shop-btn--sm tl-shop-btn--ghost"
                              aria-label={`Bỏ ${p.title} khỏi giỏ`}
                              onClick={() => remove(i)}
                            >
                              <Trash2 size={14} aria-hidden="true" />
                              Bỏ
                            </button>
                            {l.issue === "out-of-stock" && (
                              <Link
                                to={`/proto/shop/product/${p.slug}`}
                                className="tl-shop-btn tl-shop-btn--sm"
                              >
                                Chọn phiên bản khác
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CartSellerGroup>
              );
            })}

            <div className="tl-shop-notice">
              <div>
                Không có nút &ldquo;đặt tất cả&rdquo; vì mỗi shop là một đơn riêng: gửi riêng,
                phí riêng, đổi trả theo chính sách riêng của từng shop.
              </div>
            </div>
          </>
        )}
      </main>
    </BuyerShell>
  );
}
