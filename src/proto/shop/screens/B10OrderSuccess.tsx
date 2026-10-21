// ============================================================================
// B10 — Order success
// ----------------------------------------------------------------------------
// Acceptance: status, seller, next step and tracking entry are understandable
// without celebratory decoration. No confetti, no giant tick — the page leads
// with what the buyer must do next, which for VietQR is "go transfer the money"
// and for COD is "wait for the seller to confirm".
// ============================================================================

import { Link, useLocation } from "react-router-dom";
import { Wallet, Clock, Copy } from "lucide-react";
import { readVariant } from "../scenario";
import { BuyerShell } from "../components/Shells";
import { Row, SellerIdentity } from "../components/Primitives";
import { orderByCode, orderTotal, shopById, vnd, dmyhm } from "../fixtures";

type State = "cod" | "awaiting" | "confirmed";

export default function B10OrderSuccess() {
  const location = useLocation();
  const state = (readVariant(location.search) || "awaiting") as State;

  const order = orderByCode(
    state === "cod" ? "PH-2608-0039" : state === "confirmed" ? "PH-2608-0031" : "PH-2608-0041",
  );
  const shop = shopById(order.shopId);
  const total = orderTotal(order);

  const NEXT: Record<State, { title: string; body: React.ReactNode }> = {
    cod: {
      title: "Đã gửi đơn tới người bán",
      body: (
        <>
          Bước tiếp theo là <strong>chờ {shop.name} xác nhận</strong> — thường trong 1–2 ngày
          làm việc. Anh/chị trả tiền khi nhận hàng, không phải trả gì lúc này.
        </>
      ),
    },
    awaiting: {
      title: "Đã tạo đơn — còn chờ anh/chị chuyển khoản",
      body: (
        <>
          Chuyển đúng số tiền và đúng nội dung bên dưới. Một quản trị viên sẽ đối soát sao kê
          rồi xác nhận, <strong>không tự động</strong>, nên trạng thái đơn sẽ đổi sau chứ không
          đổi ngay.
        </>
      ),
    },
    confirmed: {
      title: "Đã nhận được chuyển khoản",
      body: (
        <>
          Quản trị viên xác nhận lúc {order.paymentConfirmedAt ? dmyhm(order.paymentConfirmedAt) : "—"}.
          Bước tiếp theo là chờ {shop.name} gửi hàng.
        </>
      ),
    },
  };

  return (
    <BuyerShell title="Đơn hàng" backTo="/proto/shop/orders" cartCount={null}>
      <main className="tl-shop-page tl-shop-page--narrow">
        <p className="tl-shop-eyebrow">Mã đơn {order.code}</p>
        <h1 className="tl-shop-h1">{NEXT[state].title}</h1>
        <p className="tl-shop-sub">{NEXT[state].body}</p>

        {state === "awaiting" && (
          <section aria-labelledby="b10-pay" className="tl-shop-card" style={{ marginBottom: 20 }}>
            <h2 className="tl-shop-h2" id="b10-pay" style={{ marginTop: 0 }}>
              Thông tin chuyển khoản
            </h2>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div
                style={{
                  width: 148,
                  height: 148,
                  flex: "none",
                  display: "grid",
                  placeItems: "center",
                  background: "var(--tl-surface-2)",
                  border: "1px solid var(--tl-border)",
                  borderRadius: "var(--tl-radius)",
                  color: "var(--tl-fg-3)",
                  fontSize: 11,
                  fontFamily: '"Geist Mono", monospace',
                }}
                aria-label="Mã QR chuyển khoản (bản mẫu)"
              >
                MÃ QR
              </div>
              <dl style={{ flex: 1, minWidth: 190, display: "grid", gap: 8, margin: 0, fontSize: 13.5 }}>
                {[
                  ["Ngân hàng", "Vietcombank"],
                  ["Số tài khoản", "0011 0022 4821"],
                  ["Chủ tài khoản", "CONG TY THEPICKLEHUB"],
                  ["Số tiền", vnd(total)],
                  ["Nội dung", order.code],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <dt style={{ color: "var(--tl-fg-3)" }}>{k}</dt>
                    <dd style={{ margin: 0, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <button type="button" className="tl-shop-btn tl-shop-btn--sm" style={{ marginTop: 12 }}>
              <Copy size={14} aria-hidden="true" />
              Sao chép nội dung chuyển khoản
            </button>
            <div className="tl-shop-notice tl-shop-notice--warn" style={{ marginTop: 12, marginBottom: 0 }}>
              <Clock size={16} aria-hidden="true" />
              <div>
                Ghi <strong>đúng nội dung {order.code}</strong>, nếu không quản trị viên sẽ
                không ghép được khoản tiền với đơn. Đơn tự huỷ sau 48 giờ nếu chưa thấy tiền
                về — anh/chị không mất gì, chỉ phải đặt lại.
              </div>
            </div>
          </section>
        )}

        {state === "confirmed" && (
          <div className="tl-shop-notice tl-shop-notice--info">
            <Wallet size={16} aria-hidden="true" />
            <div>
              Đã ghi nhận thanh toán {vnd(total)}. Đây là xác nhận của quản trị viên sau khi
              đối soát sao kê, không phải xác nhận tự động của ngân hàng.
            </div>
          </div>
        )}

        <section aria-labelledby="b10-order">
          <h2 className="tl-shop-h2" id="b10-order">
            Đơn hàng
          </h2>
          <div className="tl-shop-card">
            <div style={{ marginBottom: 12 }}>
              <SellerIdentity shop={shop} showBadge />
            </div>
            <Row label="Mã đơn">{order.code}</Row>
            <Row label="Đặt lúc">{dmyhm(order.placedAt)}</Row>
            <Row label="Thanh toán">{order.paymentMethod === "cod" ? "Khi nhận hàng" : "VietQR"}</Row>
            <Row label="Tổng">
              <strong>{vnd(total)}</strong>
            </Row>
          </div>
        </section>

        <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
          <Link to={`/proto/shop/order/${order.code}`} className="tl-shop-btn tl-shop-btn--primary">
            Theo dõi đơn hàng
          </Link>
          <Link to="/proto/shop/home" className="tl-shop-btn">
            Tiếp tục xem hàng
          </Link>
        </div>

        <nav aria-label="Bản mẫu · trạng thái" style={{ marginTop: 28 }}>
          <div className="tl-shop-cats">
            {(["cod", "awaiting", "confirmed"] as State[]).map((k) => (
              <Link key={k} to={`?variant=${k}`} className="tl-shop-cat" aria-current={state === k ? "page" : undefined}>
                {k}
              </Link>
            ))}
          </div>
        </nav>
      </main>
    </BuyerShell>
  );
}
