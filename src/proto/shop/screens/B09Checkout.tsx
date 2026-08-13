// ============================================================================
// B09 — Checkout /shop/checkout/:shopId
// ----------------------------------------------------------------------------
// Acceptance:
//   • no hidden mandatory charge — every line of the total is listed before the
//     final button, and the button itself repeats the amount;
//   • double-tap cannot create a second visual submission — the submit button
//     goes disabled + "Đang gửi…" on the first press and never comes back on
//     its own;
//   • VietQR is never presented as automatically verified. The copy says a
//     person checks the bank statement, and says what happens if they do not.
// ============================================================================

import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { AlertTriangle, Loader2, Wallet, Truck } from "lucide-react";
import { readVariant } from "../scenario";
import { BuyerShell } from "../components/Shells";
import { ProductMedia, Row } from "../components/Primitives";
import { PolicySummary } from "../components/Commerce";
import { ADDRESSES, CART_BY_SCENARIO, productById, shopById, vnd } from "../fixtures";

type State =
  | "new-address"
  | "saved-address"
  | "address-error"
  | "no-shipping"
  | "cod"
  | "vietqr"
  | "stock-changed"
  | "submitting"
  | "payment-failed";

const SHIPPING = 35_000;

export default function B09Checkout() {
  const { shopId } = useParams();
  const location = useLocation();
  const state = (readVariant(location.search) || "saved-address") as State;

  const shop = shopById(shopId ?? "shop-1");
  const lines = CART_BY_SCENARIO.normal.filter((l) => productById(l.productId).shopId === shop.id);
  const items = lines.reduce((n, l) => n + productById(l.productId).priceVnd * l.qty, 0);
  const shipping = state === "no-shipping" ? 0 : SHIPPING;
  const total = items + shipping;

  const [pay, setPay] = useState<"cod" | "vietqr">(state === "vietqr" ? "vietqr" : "cod");
  const [submitting, setSubmitting] = useState(state === "submitting");
  const [useNew, setUseNew] = useState(state === "new-address");
  const addr = ADDRESSES[0];

  return (
    <BuyerShell title={`Đặt hàng · ${shop.name}`} backTo="/proto/shop/cart" cartCount={null}>
      <main className="tl-shop-page tl-shop-page--narrow">
        <h1 className="tl-shop-h1">Đặt hàng</h1>
        <p className="tl-shop-sub">
          Đơn này chỉ gồm sản phẩm của <strong>{shop.name}</strong>. Sản phẩm của shop khác
          trong giỏ vẫn nằm nguyên ở đó.
        </p>

        {state === "stock-changed" && (
          <div className="tl-shop-notice tl-shop-notice--warn" role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <div>
              <strong>Một sản phẩm vừa đổi trong lúc anh/chị điền form.</strong> Bóng thi đấu
              tăng từ {vnd(290_000)} lên {vnd(320_000)}. Tổng bên dưới đã tính theo giá mới —
              xem lại trước khi đặt.
            </div>
          </div>
        )}

        {/* ── 1. Address ─────────────────────────────────────────────── */}
        <section aria-labelledby="b09-addr">
          <h2 className="tl-shop-h2" id="b09-addr" style={{ marginTop: 20 }}>
            1. Địa chỉ nhận hàng
          </h2>

          {!useNew ? (
            <div className="tl-shop-card" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: 180, fontSize: 13.5, lineHeight: 1.6 }}>
                <div style={{ fontWeight: 650 }}>
                  {addr.name} · {addr.phone}
                </div>
                <div style={{ color: "var(--tl-fg-2)" }}>
                  {addr.line}, {addr.ward}, {addr.district}, {addr.city}
                </div>
              </div>
              <button type="button" className="tl-shop-btn tl-shop-btn--sm" onClick={() => setUseNew(true)}>
                Đổi địa chỉ
              </button>
            </div>
          ) : (
            <div>
              {(
                [
                  ["Họ tên người nhận", "name", addr.name],
                  ["Số điện thoại", "phone", ""],
                  ["Địa chỉ", "line", ""],
                ] as const
              ).map(([label, key, val]) => (
                <label key={key} className="tl-shop-field">
                  <span className="tl-shop-label">{label}</span>
                  <input
                    className="tl-shop-input"
                    defaultValue={val}
                    aria-invalid={state === "address-error" && key === "phone" ? true : undefined}
                  />
                  {state === "address-error" && key === "phone" && (
                    <span className="tl-shop-error">
                      <AlertTriangle size={13} aria-hidden="true" />
                      Số điện thoại phải có 10 chữ số, bắt đầu bằng 0. Người bán cần số này để
                      gọi khi giao hàng.
                    </span>
                  )}
                </label>
              ))}
              <button type="button" className="tl-shop-btn tl-shop-btn--sm" onClick={() => setUseNew(false)}>
                Dùng địa chỉ đã lưu
              </button>
            </div>
          )}
        </section>

        {/* ── 2. Shipping ────────────────────────────────────────────── */}
        <section aria-labelledby="b09-ship">
          <h2 className="tl-shop-h2" id="b09-ship">
            2. Vận chuyển
          </h2>
          {state === "no-shipping" ? (
            <div className="tl-shop-notice tl-shop-notice--danger" role="alert">
              <Truck size={16} aria-hidden="true" />
              <div>
                <strong>Shop này chưa gửi hàng tới {addr.city}.</strong> Người bán chỉ giao
                trong Hà Nội. Đổi địa chỉ khác, hoặc nhắn shop sau khi đặt để hỏi.
              </div>
            </div>
          ) : (
            <div className="tl-shop-card" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
              <div style={{ fontWeight: 650 }}>Người bán tự gửi · {vnd(SHIPPING)}</div>
              <p className="tl-shop-hint" style={{ marginTop: 4 }}>
                Gửi từ {shop.city}. ThePickleHub chưa nối với đơn vị vận chuyển nên{" "}
                <strong>không hứa ngày giao</strong>. Người bán sẽ đưa mã vận đơn để anh/chị tự
                tra.
              </p>
            </div>
          )}
        </section>

        {/* ── 3. Payment ─────────────────────────────────────────────── */}
        <section aria-labelledby="b09-pay">
          <h2 className="tl-shop-h2" id="b09-pay">
            3. Thanh toán
          </h2>
          <div style={{ display: "grid", gap: 10 }}>
            <label className="tl-shop-check" style={{ alignItems: "flex-start" }}>
              <input type="radio" name="pay" checked={pay === "cod"} onChange={() => setPay("cod")} style={{ marginTop: 3 }} />
              <span>
                <span style={{ display: "block", color: "var(--tl-fg)", fontWeight: 600 }}>
                  Thanh toán khi nhận hàng (COD)
                </span>
                <span className="tl-shop-hint">
                  Trả tiền trực tiếp cho người giao. ThePickleHub không giữ tiền của anh/chị.
                </span>
              </span>
            </label>
            <label className="tl-shop-check" style={{ alignItems: "flex-start" }}>
              <input type="radio" name="pay" checked={pay === "vietqr"} onChange={() => setPay("vietqr")} style={{ marginTop: 3 }} />
              <span>
                <span style={{ display: "block", color: "var(--tl-fg)", fontWeight: 600 }}>
                  Chuyển khoản VietQR
                </span>
                <span className="tl-shop-hint">
                  Sau khi đặt, anh/chị quét mã và chuyển khoản.
                </span>
              </span>
            </label>
          </div>

          {pay === "vietqr" && (
            <div className="tl-shop-notice tl-shop-notice--warn" style={{ marginTop: 12 }}>
              <Wallet size={16} aria-hidden="true" />
              <div>
                <strong>Chuyển khoản được đối soát bằng tay, không tự động.</strong> Một quản
                trị viên kiểm tra sao kê rồi mới xác nhận, nên đơn sẽ ở trạng thái &ldquo;Chờ
                chuyển khoản&rdquo; một lúc kể cả khi ngân hàng báo đã chuyển thành công.
                Đơn tự huỷ nếu sau 48 giờ chưa thấy tiền về.
              </div>
            </div>
          )}

          {state === "payment-failed" && (
            <div className="tl-shop-notice tl-shop-notice--danger" role="alert" style={{ marginTop: 12 }}>
              <AlertTriangle size={16} aria-hidden="true" />
              <div>
                <strong>Chưa tạo được đơn.</strong> Mất kết nối lúc gửi.{" "}
                <strong>Chưa có khoản tiền nào bị trừ</strong> và giỏ hàng của anh/chị vẫn
                nguyên. Bấm lại nút bên dưới để thử tiếp.
              </div>
            </div>
          )}
        </section>

        {/* ── 4. Items ───────────────────────────────────────────────── */}
        <section aria-labelledby="b09-items">
          <h2 className="tl-shop-h2" id="b09-items">
            4. Kiểm tra lại
          </h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {lines.map((l) => {
              const p = productById(l.productId);
              const v = p.variants.find((x) => x.id === l.variantId);
              return (
                <li key={`${l.productId}-${l.variantId}`} className="tl-shop-line">
                  <div className="tl-shop-line-media">
                    <ProductMedia tone={p.media[0]?.tone ?? "a"} label="" />
                  </div>
                  <div className="tl-shop-line-body">
                    <p className="tl-shop-line-title">{p.title}</p>
                    <span className="tl-shop-hint" style={{ marginTop: 0 }}>
                      {v?.values.length ? `${v.values.join(" · ")} · ` : ""}SL {l.qty}
                    </span>
                    <span className="tl-shop-price">{vnd(p.priceVnd * l.qty)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── 5. Policies ────────────────────────────────────────────── */}
        <section aria-labelledby="b09-policy">
          <h2 className="tl-shop-h2" id="b09-policy">
            5. Chính sách áp dụng cho đơn này
          </h2>
          <div className="tl-shop-card">
            <PolicySummary
              shop={shop}
              paymentNote={
                pay === "cod"
                  ? "Thanh toán khi nhận hàng. Nền tảng không giữ tiền."
                  : "Chuyển khoản VietQR, đối soát bằng tay."
              }
            />
          </div>
        </section>

        {/* ── Total + submit ─────────────────────────────────────────── */}
        <section aria-labelledby="b09-total">
          <h2 className="tl-shop-h2" id="b09-total">
            Tổng cộng
          </h2>
          <div className="tl-shop-card">
            <Row label={`Sản phẩm (${lines.length})`}>{vnd(items)}</Row>
            <Row label="Phí vận chuyển">{shipping ? vnd(shipping) : "—"}</Row>
            <div style={{ borderTop: "1px solid var(--tl-border)", marginTop: 6, paddingTop: 6 }}>
              <Row label="Anh/chị trả">
                <strong style={{ fontSize: 17 }}>{vnd(total)}</strong>
              </Row>
            </div>
            <p className="tl-shop-hint">
              Không có phí nào khác. ThePickleHub không thu phí của người mua.
            </p>
          </div>

          <button
            type="button"
            className="tl-shop-btn tl-shop-btn--primary tl-shop-btn--block"
            style={{ marginTop: 16 }}
            disabled={submitting || state === "no-shipping" || state === "address-error"}
            onClick={() => setSubmitting(true)}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                Đang gửi…
              </>
            ) : (
              `Đặt đơn · ${vnd(total)}`
            )}
          </button>
          <p className="tl-shop-hint" style={{ textAlign: "center" }}>
            Bấm &ldquo;Đặt đơn&rdquo; là gửi yêu cầu tới {shop.name}. Người bán xác nhận rồi
            mới gửi hàng.{" "}
            <Link to="/proto/shop/order-success">Xem màn hình sau khi đặt</Link>
          </p>
        </section>
      </main>
    </BuyerShell>
  );
}
