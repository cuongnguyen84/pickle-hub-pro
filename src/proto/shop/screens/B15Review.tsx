// ============================================================================
// B15 — Verified review composer
// ----------------------------------------------------------------------------
// Acceptance: the prototype visibly communicates verified purchase, and there
// is no incentive for a positive review.
//
// So: the exact order + variant is pinned at the top, the prompt is neutral
// ("Sản phẩm có đúng như mô tả không?" — not "Bạn có hài lòng không?"), and
// nothing on the page offers points, vouchers or thanks for high stars.
// ============================================================================

import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Star, ShieldCheck, Upload, AlertTriangle, Check } from "lucide-react";
import { readVariant } from "../scenario";
import { BuyerShell } from "../components/Shells";
import { ProductMedia } from "../components/Primitives";
import { orderByCode, productById, shopById, dmy } from "../fixtures";

type State = "eligible" | "already" | "not-yet" | "invalid" | "submitted";

export default function B15Review() {
  const location = useLocation();
  const state = (readVariant(location.search) || "eligible") as State;

  const order = orderByCode("PH-2607-0018");
  const line = order.lines[0];
  const product = productById(line.productId);
  const variant = product.variants.find((v) => v.id === line.variantId);
  const shop = shopById(product.shopId);

  const [stars, setStars] = useState(0);
  const [text, setText] = useState("");

  const Context = () => (
    <div className="tl-shop-card" style={{ display: "flex", gap: 12, marginBottom: 20 }}>
      <div style={{ width: 56, flex: "none" }}>
        <ProductMedia tone={product.media[0]?.tone ?? "a"} label="" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35 }}>{product.title}</div>
        <div className="tl-shop-hint" style={{ marginTop: 4 }}>
          {variant?.values.length ? `${variant.values.join(" · ")} · ` : ""}
          {shop.name}
        </div>
        <div style={{ marginTop: 8 }}>
          <span className="tl-shop-pill tl-shop-pill--info tl-shop-pill--wrap">
            <ShieldCheck size={12} aria-hidden="true" style={{ flex: "none" }} />
            Mua thật · đơn {order.code} · nhận {dmy(order.timeline[order.timeline.length - 1].at)}
          </span>
        </div>
      </div>
    </div>
  );

  if (state === "already")
    return (
      <BuyerShell title="Đánh giá" backTo={`/proto/shop/order/${order.code}`} cartCount={null}>
        <main className="tl-shop-page tl-shop-page--narrow">
          <h1 className="tl-shop-h1">Anh/chị đã đánh giá sản phẩm này</h1>
          <Context />
          <p className="tl-shop-sub">
            Đánh giá gửi ngày 02/08/2026. Mỗi đơn chỉ đánh giá một lần để số đánh giá phản ánh
            đúng số người đã mua.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="tl-shop-btn">
              Sửa đánh giá
            </button>
            <Link to={`/proto/shop/order/${order.code}`} className="tl-shop-btn tl-shop-btn--ghost">
              Về đơn hàng
            </Link>
          </div>
        </main>
      </BuyerShell>
    );

  if (state === "not-yet")
    return (
      <BuyerShell title="Đánh giá" backTo={`/proto/shop/order/${order.code}`} cartCount={null}>
        <main className="tl-shop-page tl-shop-page--narrow">
          <h1 className="tl-shop-h1">Chưa đến lúc đánh giá</h1>
          <Context />
          <div className="tl-shop-notice tl-shop-notice--warn">
            <AlertTriangle size={16} aria-hidden="true" />
            <div>
              Đơn đang ở trạng thái &ldquo;Đang giao&rdquo;. Anh/chị đánh giá được sau khi nhận
              hàng — để đánh giá nói về món hàng thật, không phải về kỳ vọng.
            </div>
          </div>
          <Link to={`/proto/shop/order/${order.code}`} className="tl-shop-btn">
            Về đơn hàng
          </Link>
        </main>
      </BuyerShell>
    );

  if (state === "submitted")
    return (
      <BuyerShell title="Đánh giá" backTo={`/proto/shop/order/${order.code}`} cartCount={null}>
        <main className="tl-shop-page tl-shop-page--narrow">
          <div className="tl-shop-notice tl-shop-notice--info" role="status">
            <Check size={16} aria-hidden="true" />
            <div>
              <strong>Đã gửi đánh giá.</strong> Đánh giá hiện công khai kèm dòng &ldquo;Mua
              thật&rdquo; trên trang sản phẩm. Người bán trả lời được nhưng không xoá được.
            </div>
          </div>
          <h1 className="tl-shop-h1">Cảm ơn anh/chị</h1>
          <Context />
          <Link to={`/proto/shop/product/${product.slug}`} className="tl-shop-btn tl-shop-btn--primary">
            Xem trên trang sản phẩm
          </Link>
        </main>
      </BuyerShell>
    );

  const invalid = state === "invalid" || (stars > 0 && stars <= 2 && text.trim().length < 10);

  return (
    <BuyerShell title="Đánh giá" backTo={`/proto/shop/order/${order.code}`} cartCount={null}>
      <main className="tl-shop-page tl-shop-page--narrow">
        <h1 className="tl-shop-h1">Đánh giá sản phẩm</h1>
        <Context />

        <fieldset style={{ border: 0, padding: 0, margin: "0 0 20px" }}>
          <legend className="tl-shop-label" style={{ padding: 0, marginBottom: 8 }}>
            Sản phẩm có đúng như mô tả không?
          </legend>
          <div style={{ display: "flex", gap: 4 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} sao`}
                aria-pressed={stars === n}
                onClick={() => setStars(n)}
                style={{
                  width: 44,
                  height: 44,
                  display: "grid",
                  placeItems: "center",
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                  color: n <= stars ? "var(--tl-gold)" : "var(--tl-fg-4)",
                }}
              >
                <Star size={26} fill={n <= stars ? "currentColor" : "none"} aria-hidden="true" />
              </button>
            ))}
          </div>
          <p className="tl-shop-hint">
            1 sao = khác hẳn mô tả · 5 sao = đúng như mô tả. Đánh giá nói về sản phẩm, không
            phải về tốc độ giao hàng.
          </p>
        </fieldset>

        <label className="tl-shop-field">
          <span className="tl-shop-label">
            Nhận xét {stars > 0 && stars <= 2 ? "(bắt buộc)" : "(không bắt buộc)"}
          </span>
          <textarea
            className="tl-shop-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-invalid={invalid || undefined}
            placeholder="Điều gì đúng, điều gì khác so với mô tả?"
          />
          {invalid && (
            <span className="tl-shop-error">
              <AlertTriangle size={13} aria-hidden="true" />
              Đánh giá 1–2 sao cần vài chữ giải thích, để người bán biết sửa gì và người mua sau
              hiểu vì sao.
            </span>
          )}
        </label>

        <div className="tl-shop-field">
          <span className="tl-shop-label">Ảnh (không bắt buộc)</span>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))" }}>
            <button
              type="button"
              className="tl-shop-media"
              style={{ borderStyle: "dashed", cursor: "pointer", flexDirection: "column", gap: 6 }}
              aria-label="Thêm ảnh vào đánh giá"
            >
              <Upload size={20} aria-hidden="true" />
              <span className="tl-shop-media-label">Thêm ảnh</span>
            </button>
          </div>
        </div>

        <div className="tl-shop-notice">
          <div>
            Đánh giá hiện công khai kèm tên tài khoản và dòng &ldquo;Mua thật&rdquo;. ThePickleHub{" "}
            <strong>không tặng điểm, không tặng voucher</strong> cho đánh giá — kể cả đánh giá
            5 sao.
          </div>
        </div>

        <button
          type="button"
          className="tl-shop-btn tl-shop-btn--primary tl-shop-btn--block"
          disabled={stars === 0 || invalid}
        >
          Gửi đánh giá
        </button>

        <nav aria-label="Bản mẫu · trạng thái" style={{ marginTop: 28 }}>
          <div className="tl-shop-cats">
            {(["eligible", "already", "not-yet", "invalid", "submitted"] as State[]).map((k) => (
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
