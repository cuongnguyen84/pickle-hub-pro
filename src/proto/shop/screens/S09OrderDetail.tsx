// ============================================================================
// S09 — Seller order detail /seller/orders/:id
// ----------------------------------------------------------------------------
// Acceptance: the UI never implies that a client-side click alone completes a
// financial or shipment state transition.
//
// So every action button is phrased as a request or a record ("Ghi nhận đã
// gửi", "Đề nghị huỷ đơn"), and money states are explicitly attributed:
// VietQR reads "chờ quản trị viên đối soát" until an admin confirms it, never
// "đã thanh toán".
// ============================================================================

import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { AlertTriangle, Clock, Wallet } from "lucide-react";
import { readVariant } from "../scenario";
import { SellerShell } from "../components/Shells";
import { ProductMedia, Row } from "../components/Primitives";
import { OrderStatusTimeline } from "../components/Commerce";
import {
  ORDERS,
  orderByCode,
  orderTotal,
  productById,
  untilDeadline,
  vnd,
  dmyhm,
} from "../fixtures";

const PRESETS: Record<string, string> = {
  new: "PH-2608-0039",
  packed: "PH-2608-0031",
  shipped: "PH-2608-0031",
  cancel: "PH-2607-0009",
  ret: "PH-2607-0022",
  dispute: "PH-2607-0025",
  awaiting: "PH-2608-0041",
};

export default function S09OrderDetail() {
  const { id } = useParams();
  const location = useLocation();
  const variant = readVariant(location.search);
  const code = PRESETS[variant] ?? id ?? ORDERS[1].code;
  const order = orderByCode(code);
  const [tracking, setTracking] = useState(order.trackingCode ?? "");

  const deadline = order.sellerDeadline ? untilDeadline(order.sellerDeadline) : null;
  const total = orderTotal(order);

  /** Actions depend on state — and each says who completes it. */
  const actions = () => {
    switch (order.status) {
      case "cho-thanh-toan":
        return (
          <>
            <div className="tl-shop-notice tl-shop-notice--warn">
              <Wallet size={16} aria-hidden="true" />
              <div>
                <strong>Chưa nhận được tiền.</strong> Người mua chọn VietQR. Quản trị viên đối
                soát sao kê rồi mới xác nhận — anh/chị{" "}
                <strong>đừng gửi hàng trước khi trạng thái đổi</strong>. Đơn tự huỷ nếu quá 48
                giờ không có tiền về.
              </div>
            </div>
            <button type="button" className="tl-shop-btn tl-shop-btn--danger">
              Đề nghị huỷ đơn
            </button>
          </>
        );
      case "dang-xu-ly":
        return (
          <div style={{ display: "grid", gap: 12 }}>
            <button type="button" className="tl-shop-btn tl-shop-btn--primary">
              Ghi nhận đã đóng gói
            </button>
            <label className="tl-shop-field" style={{ marginBottom: 0 }}>
              <span className="tl-shop-label">Mã vận đơn</span>
              <input
                className="tl-shop-input"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="VD: VN0293841772"
              />
              <span className="tl-shop-hint">
                Nhập mã rồi bấm &ldquo;Ghi nhận đã gửi&rdquo;. ThePickleHub chưa nối với đơn vị
                vận chuyển nên không tự theo dõi được — mã này để người mua tự tra trên trang
                của hãng.
              </span>
            </label>
            <button type="button" className="tl-shop-btn" disabled={!tracking.trim()}>
              Ghi nhận đã gửi
            </button>
            <button type="button" className="tl-shop-btn tl-shop-btn--danger">
              Đề nghị huỷ đơn (hết hàng)
            </button>
          </div>
        );
      case "dang-giao":
        return (
          <div className="tl-shop-notice">
            <div>
              Đã ghi nhận gửi hàng lúc {dmyhm(order.timeline[order.timeline.length - 1].at)}. Đơn
              chuyển sang &ldquo;Đã giao&rdquo; khi người mua xác nhận, hoặc sau 7 ngày kể từ
              ngày gửi.
            </div>
          </div>
        );
      case "tra-hang":
        return (
          <div style={{ display: "grid", gap: 12 }}>
            <div className="tl-shop-notice tl-shop-notice--warn">
              <div>
                <strong>Người mua yêu cầu trả hàng: sai size.</strong> Anh/chị trả lời trong
                thời hạn; không trả lời thì hệ thống chuyển sang khiếu nại và quản trị viên
                quyết định.
              </div>
            </div>
            <button type="button" className="tl-shop-btn tl-shop-btn--primary">
              Đồng ý nhận lại hàng
            </button>
            <button type="button" className="tl-shop-btn">
              Đề nghị hoàn một phần
            </button>
            <button type="button" className="tl-shop-btn tl-shop-btn--danger">
              Từ chối, kèm lý do
            </button>
          </div>
        );
      case "khieu-nai":
        return (
          <div style={{ display: "grid", gap: 12 }}>
            <div className="tl-shop-notice tl-shop-notice--danger">
              <AlertTriangle size={16} aria-hidden="true" />
              <div>
                <strong>Đang có khiếu nại.</strong> Anh/chị trả lời kèm bằng chứng. Quyết định
                cuối do quản trị viên đưa ra, không phải do bên nào tự bấm nút.
              </div>
            </div>
            <Link to="/proto/shop/dispute/dis-1" className="tl-shop-btn tl-shop-btn--primary">
              Trả lời khiếu nại
            </Link>
          </div>
        );
      default:
        return (
          <div className="tl-shop-notice">
            <div>Đơn đã kết thúc. Không còn thao tác nào.</div>
          </div>
        );
    }
  };

  return (
    <SellerShell active="orders" title={`Đơn ${order.code}`}>
      <div className="tl-shop-page tl-shop-page--narrow">
        <nav aria-label="Bản mẫu · trạng thái đơn" style={{ marginBottom: 16 }}>
          <div className="tl-shop-cats">
            {Object.entries(PRESETS).map(([k]) => (
              <Link key={k} to={`?variant=${k}`} className="tl-shop-cat" aria-current={variant === k ? "page" : undefined}>
                {k}
              </Link>
            ))}
          </div>
        </nav>

        <h1 className="tl-shop-h1" style={{ fontSize: "clamp(18px, 4.5vw, 22px)" }}>
          Đơn {order.code}
        </h1>
        <p className="tl-shop-sub">
          Đặt lúc {dmyhm(order.placedAt)} · {order.paymentMethod === "cod" ? "Thanh toán khi nhận" : "VietQR"}
        </p>

        {deadline && (
          <div className={`tl-shop-notice ${deadline.overdue ? "tl-shop-notice--danger" : "tl-shop-notice--warn"}`}>
            <Clock size={16} aria-hidden="true" />
            <div>
              Hạn anh/chị phải trả lời: <strong>{deadline.text}</strong>. Quá hạn thì đơn được
              chuyển cho quản trị viên xử lý.
            </div>
          </div>
        )}

        <section aria-labelledby="s09-actions">
          <h2 className="tl-shop-h2" id="s09-actions" style={{ marginTop: 20 }}>
            Việc cần làm
          </h2>
          {actions()}
        </section>

        <section aria-labelledby="s09-items">
          <h2 className="tl-shop-h2" id="s09-items">
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
                    <p className="tl-shop-line-title">{p.title}</p>
                    <span className="tl-shop-hint" style={{ marginTop: 0 }}>
                      {v?.values.length ? `${v.values.join(" · ")} · ` : ""}Mã hàng {v?.sku || "—"} ·{" "}
                      SL {l.qty}
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

        <section aria-labelledby="s09-addr">
          <h2 className="tl-shop-h2" id="s09-addr">
            Địa chỉ giao
          </h2>
          <div className="tl-shop-card" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 650 }}>{order.address.name}</div>
            <div>{order.address.phone}</div>
            <div style={{ color: "var(--tl-fg-2)" }}>
              {order.address.line}, {order.address.ward}, {order.address.district},{" "}
              {order.address.city}
            </div>
          </div>
          <p className="tl-shop-hint">
            Số điện thoại người mua chỉ hiện với anh/chị vì đã có đơn hàng, và chỉ tới khi đơn
            kết thúc 30 ngày.
          </p>
        </section>

        <section aria-labelledby="s09-pay">
          <h2 className="tl-shop-h2" id="s09-pay">
            Thanh toán
          </h2>
          <div className="tl-shop-card" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
            {order.paymentMethod === "cod" ? (
              <>
                Thanh toán khi nhận hàng. Anh/chị thu tiền trực tiếp; ThePickleHub không giữ
                tiền của đơn này.
              </>
            ) : order.paymentConfirmedAt ? (
              <>
                Quản trị viên xác nhận đã nhận chuyển khoản lúc {dmyhm(order.paymentConfirmedAt)}.
              </>
            ) : (
              <>
                <strong>Chờ quản trị viên đối soát sao kê.</strong> Chưa có xác nhận nào là đã
                nhận tiền. Đừng gửi hàng trước.
              </>
            )}
          </div>
        </section>

        <section aria-labelledby="s09-timeline">
          <h2 className="tl-shop-h2" id="s09-timeline">
            Diễn biến
          </h2>
          <div className="tl-shop-card">
            <OrderStatusTimeline order={order} />
          </div>
        </section>
      </div>
    </SellerShell>
  );
}
