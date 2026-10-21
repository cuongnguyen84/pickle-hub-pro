// ============================================================================
// B13 — Return request
// ----------------------------------------------------------------------------
// The ineligible state is the important one: it explains WHY, points at where
// the buyer could have seen the policy before ordering, and still offers the
// route that remains open (a dispute for goods not as described). An
// "ineligible" dead end is how a buyer ends up in the comments instead.
// ============================================================================

import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, Upload, Check } from "lucide-react";
import { readVariant } from "../scenario";
import { BuyerShell } from "../components/Shells";
import { ProductMedia, Row } from "../components/Primitives";
import { RETURNS, orderByCode, productById, shopById, vnd } from "../fixtures";

type State = "eligible" | "ineligible" | "upload-error" | "submitted";

export default function B13Return() {
  const location = useLocation();
  const state = (readVariant(location.search) || "eligible") as State;
  const model = state === "ineligible" ? RETURNS.ineligible : RETURNS.eligible;
  const order = orderByCode(model.orderCode);
  const shop = shopById(order.shopId);

  const [picked, setPicked] = useState<string[]>([order.lines[0].productId]);
  const [reason, setReason] = useState("");
  const [want, setWant] = useState<"doi" | "hoan">("hoan");
  const needsEvidence = model.reasons.find((r) => r.key === reason)?.needsEvidence;

  if (state === "submitted")
    return (
      <BuyerShell title="Yêu cầu trả hàng" backTo="/proto/shop/orders" cartCount={null}>
        <main className="tl-shop-page tl-shop-page--narrow">
          <div className="tl-shop-notice tl-shop-notice--info" role="status">
            <Check size={16} aria-hidden="true" />
            <div>
              <strong>Đã gửi yêu cầu trả hàng.</strong> {shop.name} có 3 ngày để trả lời. Không
              trả lời thì yêu cầu tự chuyển thành khiếu nại và quản trị viên quyết định.
            </div>
          </div>
          <h1 className="tl-shop-h1">Đang chờ người bán trả lời</h1>
          <p className="tl-shop-sub">
            Anh/chị <strong>chưa cần gửi hàng đi</strong>. Chỉ gửi trả khi người bán đồng ý và
            cho địa chỉ nhận.
          </p>
          <Link to={`/proto/shop/order/${order.code}`} className="tl-shop-btn tl-shop-btn--primary">
            Về đơn hàng
          </Link>
        </main>
      </BuyerShell>
    );

  if (state === "ineligible")
    return (
      <BuyerShell title="Yêu cầu trả hàng" backTo="/proto/shop/orders" cartCount={null}>
        <main className="tl-shop-page tl-shop-page--narrow">
          <h1 className="tl-shop-h1">Đơn này không đổi trả được</h1>
          <div className="tl-shop-notice tl-shop-notice--warn">
            <AlertTriangle size={16} aria-hidden="true" />
            <div>{model.ineligibleReason}</div>
          </div>
          <p className="tl-shop-sub">
            Chính sách này hiển thị trên trang sản phẩm ở mục &ldquo;Đổi trả&rdquo; trước khi
            anh/chị đặt đơn —{" "}
            <Link to={`/proto/shop/product/${productById(order.lines[0].productId).slug}`}>
              xem lại trang sản phẩm
            </Link>
            .
          </p>
          <h2 className="tl-shop-h2">Đường còn mở</h2>
          <div className="tl-shop-card" style={{ fontSize: 14, lineHeight: 1.6 }}>
            Nếu hàng <strong>không đúng mô tả</strong> — khác ảnh, khác thông số, hỏng khi nhận
            — thì chính sách của shop không chặn được. Anh/chị mở khiếu nại, quản trị viên xem
            bằng chứng của cả hai bên rồi quyết định.
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <Link to="/proto/shop/dispute/dis-1" className="tl-shop-btn tl-shop-btn--primary">
              Mở khiếu nại
            </Link>
            <Link to={`/proto/shop/order/${order.code}`} className="tl-shop-btn">
              Về đơn hàng
            </Link>
          </div>
        </main>
      </BuyerShell>
    );

  return (
    <BuyerShell title="Yêu cầu trả hàng" backTo="/proto/shop/orders" cartCount={null}>
      <main className="tl-shop-page tl-shop-page--narrow">
        <h1 className="tl-shop-h1">Yêu cầu trả hàng</h1>
        <p className="tl-shop-sub">
          Đơn {order.code} · {shop.name} · còn hạn đổi trả đến 04/08/2026
        </p>

        <section aria-labelledby="b13-items">
          <h2 className="tl-shop-h2" id="b13-items" style={{ marginTop: 12 }}>
            1. Chọn sản phẩm cần trả
          </h2>
          {order.lines.map((l, i) => {
            const p = productById(l.productId);
            return (
              <label key={`${l.productId}-${i}`} className="tl-shop-line" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={picked.includes(l.productId)}
                  onChange={() =>
                    setPicked((ps) =>
                      ps.includes(l.productId) ? ps.filter((x) => x !== l.productId) : [...ps, l.productId],
                    )
                  }
                  style={{ width: 18, height: 18, marginTop: 4, flex: "none" }}
                />
                <div className="tl-shop-line-media">
                  <ProductMedia tone={p.media[0]?.tone ?? "a"} label="" />
                </div>
                <div className="tl-shop-line-body">
                  <p className="tl-shop-line-title">{p.title}</p>
                  <span className="tl-shop-price">{vnd(l.unitVnd * l.qty)}</span>
                </div>
              </label>
            );
          })}
        </section>

        <section aria-labelledby="b13-reason">
          <h2 className="tl-shop-h2" id="b13-reason">
            2. Lý do
          </h2>
          <div style={{ display: "grid", gap: 2 }}>
            {model.reasons.map((r) => (
              <label key={r.key} className="tl-shop-check">
                <input type="radio" name="reason" checked={reason === r.key} onChange={() => setReason(r.key)} />
                {r.label}
                {r.needsEvidence && <span className="tl-shop-pill tl-shop-pill--muted">cần ảnh</span>}
              </label>
            ))}
          </div>
          <label className="tl-shop-field" style={{ marginTop: 12 }}>
            <span className="tl-shop-label">Mô tả thêm</span>
            <textarea className="tl-shop-textarea" placeholder="Người bán và quản trị viên sẽ đọc đoạn này." />
          </label>
        </section>

        {needsEvidence && (
          <section aria-labelledby="b13-evi">
            <h2 className="tl-shop-h2" id="b13-evi">
              3. Ảnh / video chứng minh
            </h2>
            <p className="tl-shop-hint" style={{ marginTop: -6, marginBottom: 12 }}>
              Chụp cùng góc với ảnh đăng bán sẽ thuyết phục nhất. Video mở kiện hàng là bằng
              chứng mạnh cho trường hợp thiếu hàng.
            </p>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))" }}>
              <ProductMedia label="Ảnh 1" />
              <button
                type="button"
                className="tl-shop-media"
                style={{ borderStyle: "dashed", cursor: "pointer", flexDirection: "column", gap: 6 }}
                aria-label="Thêm ảnh chứng minh"
              >
                <Upload size={20} aria-hidden="true" />
                <span className="tl-shop-media-label">Thêm ảnh</span>
              </button>
            </div>
            {state === "upload-error" && (
              <div className="tl-shop-notice tl-shop-notice--danger" style={{ marginTop: 12 }}>
                <AlertTriangle size={16} aria-hidden="true" />
                <div>
                  <strong>Video &ldquo;IMG_5512.MOV&rdquo; vượt quá 25 MB.</strong> Quay lại
                  đoạn ngắn hơn (dưới 30 giây) hoặc gửi ảnh chụp màn hình từ video.
                </div>
              </div>
            )}
          </section>
        )}

        <section aria-labelledby="b13-want">
          <h2 className="tl-shop-h2" id="b13-want">
            {needsEvidence ? "4" : "3"}. Anh/chị muốn gì
          </h2>
          <div style={{ display: "grid", gap: 2 }}>
            <label className="tl-shop-check">
              <input type="radio" name="want" checked={want === "hoan"} onChange={() => setWant("hoan")} />
              Hoàn tiền
            </label>
            <label className="tl-shop-check">
              <input type="radio" name="want" checked={want === "doi"} onChange={() => setWant("doi")} />
              Đổi sang phiên bản khác
            </label>
          </div>
        </section>

        <section aria-labelledby="b13-review">
          <h2 className="tl-shop-h2" id="b13-review">
            {needsEvidence ? "5" : "4"}. Xem lại
          </h2>
          <div className="tl-shop-card">
            <Row label="Sản phẩm trả">{picked.length} món</Row>
            <Row label="Lý do">{model.reasons.find((r) => r.key === reason)?.label ?? "chưa chọn"}</Row>
            <Row label="Mong muốn">{want === "hoan" ? "Hoàn tiền" : "Đổi phiên bản"}</Row>
          </div>
          <div className="tl-shop-notice" style={{ marginTop: 12 }}>
            <div>
              Gửi xong, <strong>{shop.name} có 3 ngày để trả lời</strong>. Anh/chị{" "}
              <strong>chưa gửi hàng đi</strong> — chỉ gửi khi người bán đồng ý và cho địa chỉ.
            </div>
          </div>
          <button
            type="button"
            className="tl-shop-btn tl-shop-btn--primary tl-shop-btn--block"
            style={{ marginTop: 14 }}
            disabled={!reason || picked.length === 0}
          >
            Gửi yêu cầu
          </button>
        </section>
      </main>
    </BuyerShell>
  );
}
