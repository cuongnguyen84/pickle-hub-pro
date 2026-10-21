// ============================================================================
// B12 — Order detail /shop/order/:orderCode
// ----------------------------------------------------------------------------
// The one question this screen must answer at a glance: WHO acts next, and BY
// WHEN. That line sits above everything else, including the timeline.
// ============================================================================

import { Link, useLocation, useParams } from "react-router-dom";
import { Clock, Wallet, Truck } from "lucide-react";
import { readVariant } from "../scenario";
import { BuyerShell } from "../components/Shells";
import { ProductMedia, Row, SellerIdentity } from "../components/Primitives";
import { OrderStatusTimeline, PolicySummary } from "../components/Commerce";
import {
  ORDERS,
  orderByCode,
  orderTotal,
  productById,
  shopById,
  untilDeadline,
  vnd,
  dmyhm,
  type OrderStatus,
} from "../fixtures";

const WHO_NEXT: Record<OrderStatus, { who: string; what: string; tone: "" | "--warn" | "--danger" | "--info" }> = {
  "cho-thanh-toan": { who: "Anh/chị", what: "chuyển khoản theo thông tin bên dưới", tone: "--warn" },
  "dang-xu-ly": { who: "Người bán", what: "chuẩn bị và gửi hàng", tone: "" },
  "dang-giao": { who: "Đơn vị vận chuyển", what: "giao hàng tới địa chỉ của anh/chị", tone: "" },
  "da-giao": { who: "Không ai", what: "đơn đã xong. Anh/chị có thể đánh giá hoặc yêu cầu đổi trả nếu còn hạn", tone: "--info" },
  "da-huy": { who: "Không ai", what: "đơn đã huỷ", tone: "" },
  "tra-hang": { who: "Người bán", what: "trả lời yêu cầu trả hàng của anh/chị", tone: "--warn" },
  "khieu-nai": { who: "Quản trị viên", what: "xem xét khiếu nại và quyết định", tone: "--danger" },
  "da-hoan-tien": { who: "Không ai", what: "đơn đã hoàn tiền xong", tone: "--info" },
};

const ALLOWED: Partial<Record<OrderStatus, { label: string; to: string; primary?: boolean }[]>> = {
  "cho-thanh-toan": [{ label: "Xem thông tin chuyển khoản", to: "/proto/shop/order-success?variant=awaiting", primary: true }],
  "dang-giao": [{ label: "Nhắn người bán", to: "#" }],
  "da-giao": [
    { label: "Viết đánh giá", to: "/proto/shop/review", primary: true },
    { label: "Yêu cầu đổi trả", to: "/proto/shop/return" },
  ],
  "tra-hang": [{ label: "Xem yêu cầu trả hàng", to: "/proto/shop/dispute/dis-2" }],
  "khieu-nai": [{ label: "Xem khiếu nại", to: "/proto/shop/dispute/dis-1", primary: true }],
};

export default function B12OrderDetail() {
  const { orderCode } = useParams();
  const location = useLocation();
  const variant = readVariant(location.search);
  const order = orderByCode(variant || orderCode || ORDERS[1].code);
  const shop = shopById(order.shopId);
  const next = WHO_NEXT[order.status];
  const deadline = order.sellerDeadline ? untilDeadline(order.sellerDeadline) : null;
  const total = orderTotal(order);

  return (
    <BuyerShell title={`Đơn ${order.code}`} backTo="/proto/shop/orders" cartCount={null}>
      <main className="tl-shop-page tl-shop-page--narrow">
        <p className="tl-shop-eyebrow">Mã đơn {order.code}</p>
        <h1 className="tl-shop-h1" style={{ fontSize: "clamp(18px, 4.5vw, 22px)" }}>
          {next.who === "Không ai" ? "Không cần làm gì thêm" : `${next.who} cần ${next.what}`}
        </h1>

        <div className={`tl-shop-notice tl-shop-notice${next.tone}`}>
          <Clock size={16} aria-hidden="true" />
          <div>
            {next.who === "Không ai" ? (
              <>Hiện {next.what}.</>
            ) : (
              <>
                Bước tiếp theo thuộc về <strong>{next.who.toLowerCase()}</strong>: {next.what}.
                {deadline && (
                  <>
                    {" "}
                    Hạn: <strong>{deadline.text}</strong>. Quá hạn thì quản trị viên vào xử lý.
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {(ALLOWED[order.status] ?? []).length > 0 && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
            {ALLOWED[order.status]!.map((a) => (
              <Link key={a.label} to={a.to} className={`tl-shop-btn ${a.primary ? "tl-shop-btn--primary" : ""}`}>
                {a.label}
              </Link>
            ))}
          </div>
        )}

        <section aria-labelledby="b12-ship">
          <h2 className="tl-shop-h2" id="b12-ship" style={{ marginTop: 0 }}>
            Vận chuyển
          </h2>
          <div className="tl-shop-card" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
            {order.trackingCode ? (
              <>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <Truck size={15} aria-hidden="true" style={{ color: "var(--tl-fg-3)" }} />
                  <span>Mã vận đơn</span>
                  <strong style={{ fontFamily: '"Geist Mono", monospace' }}>{order.trackingCode}</strong>
                </div>
                <p className="tl-shop-hint" style={{ marginTop: 6 }}>
                  ThePickleHub chưa nối với đơn vị vận chuyển nên không theo dõi được tự động —
                  anh/chị tra mã này trên trang của hãng vận chuyển.
                </p>
              </>
            ) : (
              <>Người bán chưa cung cấp mã vận đơn.</>
            )}
          </div>
        </section>

        <section aria-labelledby="b12-timeline">
          <h2 className="tl-shop-h2" id="b12-timeline">
            Diễn biến
          </h2>
          <div className="tl-shop-card">
            <OrderStatusTimeline order={order} />
          </div>
        </section>

        <section aria-labelledby="b12-seller">
          <h2 className="tl-shop-h2" id="b12-seller">
            Người bán
          </h2>
          <div className="tl-shop-card">
            <SellerIdentity shop={shop} showBadge />
          </div>
        </section>

        <section aria-labelledby="b12-items">
          <h2 className="tl-shop-h2" id="b12-items">
            Sản phẩm
          </h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {order.lines.map((l, i) => {
              const p = productById(l.productId);
              const v = p.variants.find((x) => x.id === l.variantId);
              return (
                <li key={`${l.productId}-${i}`} className="tl-shop-line">
                  <div className="tl-shop-line-media">
                    <ProductMedia tone={p.media[0]?.tone ?? "a"} label="" />
                  </div>
                  <div className="tl-shop-line-body">
                    <p className="tl-shop-line-title">
                      <Link to={`/proto/shop/product/${p.slug}`} style={{ color: "inherit" }}>
                        {p.title}
                      </Link>
                    </p>
                    <span className="tl-shop-hint" style={{ marginTop: 0 }}>
                      {v?.values.length ? `${v.values.join(" · ")} · ` : ""}SL {l.qty}
                    </span>
                    <span className="tl-shop-price">{vnd(l.unitVnd * l.qty)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
          <div style={{ marginTop: 12 }}>
            <Row label="Tạm tính">{vnd(total - order.shippingVnd)}</Row>
            <Row label="Phí vận chuyển">{vnd(order.shippingVnd)}</Row>
            <Row label="Tổng">
              <strong>{vnd(total)}</strong>
            </Row>
          </div>
        </section>

        <section aria-labelledby="b12-addr">
          <h2 className="tl-shop-h2" id="b12-addr">
            Địa chỉ nhận
          </h2>
          <div className="tl-shop-card" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 650 }}>
              {order.address.name} · {order.address.phone}
            </div>
            <div style={{ color: "var(--tl-fg-2)" }}>
              {order.address.line}, {order.address.ward}, {order.address.district}, {order.address.city}
            </div>
          </div>
        </section>

        <section aria-labelledby="b12-pay">
          <h2 className="tl-shop-h2" id="b12-pay">
            Thanh toán
          </h2>
          <div className="tl-shop-card" style={{ display: "flex", gap: 10, fontSize: 13.5, lineHeight: 1.6 }}>
            <Wallet size={15} aria-hidden="true" style={{ flex: "none", marginTop: 2, color: "var(--tl-fg-3)" }} />
            <div>
              {order.paymentMethod === "cod"
                ? "Thanh toán khi nhận hàng."
                : order.paymentConfirmedAt
                  ? `Quản trị viên xác nhận đã nhận chuyển khoản lúc ${dmyhm(order.paymentConfirmedAt)}.`
                  : "Chờ anh/chị chuyển khoản. Quản trị viên đối soát sao kê rồi mới xác nhận — không tự động."}
            </div>
          </div>
        </section>

        <section aria-labelledby="b12-policy">
          <h2 className="tl-shop-h2" id="b12-policy">
            Chính sách áp dụng
          </h2>
          <div className="tl-shop-card">
            <PolicySummary shop={shop} />
          </div>
        </section>

        <nav aria-label="Bản mẫu · trạng thái đơn" style={{ marginTop: 28 }}>
          <div className="tl-shop-cats">
            {ORDERS.map((o) => (
              <Link
                key={o.code}
                to={`?variant=${o.code}`}
                className="tl-shop-cat"
                aria-current={order.code === o.code ? "page" : undefined}
              >
                {o.status}
              </Link>
            ))}
          </div>
        </nav>
      </main>
    </BuyerShell>
  );
}
