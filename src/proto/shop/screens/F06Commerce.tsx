// ============================================================================
// F06 — Commerce action primitives, eight-state matrix
// ============================================================================

import { useState } from "react";
import {
  VariantSelector,
  useVariantSelection,
  QuantityControl,
  StickyCommerceBar,
  CartSellerGroup,
  OrderStatusTimeline,
  PolicySummary,
} from "../components/Commerce";
import { ProductMedia } from "../components/Primitives";
import { MatrixSection, Cell, Cells } from "../components/Matrix";
import { productById, shopById, orderByCode, vnd, ORDERS } from "../fixtures";

const STATES = [
  "Chưa chọn",
  "Chọn một phần",
  "Chọn hợp lệ",
  "Tổ hợp hết hàng",
  "Đổi phiên bản đổi giá",
  "Đang gửi yêu cầu",
  "Thêm vào giỏ lỗi",
  "Đã thêm vào giỏ",
];

export default function F06Commerce() {
  const shoes = productById("p-2");
  const sel = useVariantSelection(shoes);
  const [qty, setQty] = useState(1);
  const [barState, setBarState] = useState<"idle" | "busy" | "error" | "done">("idle");

  const price = sel.variant?.priceVnd ?? shoes.priceVnd;

  return (
    <main className="tl-shop-page">
      <p className="tl-shop-eyebrow">F06</p>
      <h1 className="tl-shop-h1">Thành phần hành động mua hàng</h1>
      <p className="tl-shop-sub">
        Nguyên tắc chung: một cú bấm ở đây không bao giờ có nghĩa là tiền đã chuyển hoặc hàng
        đã gửi. Nút nói mình <em>yêu cầu</em> gì; dòng thời gian nói điều gì <em>đã</em> xảy
        ra và ai làm.
      </p>

      <MatrixSection
        id="f06-states"
        title="8 trạng thái của luồng chọn mua"
        note={`Danh sách trạng thái bắt buộc: ${STATES.join(" · ")}.`}
      >
        <div className="tl-shop-card" style={{ maxWidth: 520 }}>
          <VariantSelector product={shoes} selected={sel.selected} onPick={sel.pick} />
          <div style={{ display: "flex", gap: 16, alignItems: "flex-end", marginTop: 18, flexWrap: "wrap" }}>
            <div>
              <span className="tl-shop-label">Số lượng</span>
              <QuantityControl value={qty} onChange={setQty} max={sel.variant?.stock ?? null} />
            </div>
            <div>
              <div className="tl-shop-label">Giá</div>
              <div className="tl-shop-price tl-shop-price--lg">{vnd(price * qty)}</div>
              {sel.partial && (
                <p className="tl-shop-hint">Chọn đủ màu và size để biết giá chính xác.</p>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <button type="button" className="tl-shop-btn tl-shop-btn--sm" onClick={() => sel.reset()}>
              Về &ldquo;chưa chọn&rdquo;
            </button>
            <button type="button" className="tl-shop-btn tl-shop-btn--sm" onClick={() => setBarState("busy")}>
              Đang gửi
            </button>
            <button type="button" className="tl-shop-btn tl-shop-btn--sm" onClick={() => setBarState("error")}>
              Lỗi
            </button>
            <button type="button" className="tl-shop-btn tl-shop-btn--sm" onClick={() => setBarState("done")}>
              Đã thêm
            </button>
            <button type="button" className="tl-shop-btn tl-shop-btn--sm" onClick={() => setBarState("idle")}>
              Bình thường
            </button>
          </div>

          <div role="status" aria-live="polite" style={{ marginTop: 14 }}>
            {barState === "error" && (
              <div className="tl-shop-notice tl-shop-notice--danger" style={{ marginBottom: 0 }}>
                <div>
                  <strong>Chưa thêm được vào giỏ.</strong> Mất kết nối khi đang gửi. Sản phẩm
                  vẫn còn trong kho, anh/chị thử lại giúp.
                </div>
              </div>
            )}
            {barState === "done" && (
              <div className="tl-shop-notice tl-shop-notice--info" style={{ marginBottom: 0 }}>
                <div>
                  Đã thêm {qty} sản phẩm vào giỏ. Chưa trừ tiền — anh/chị vẫn xem lại được
                  trước khi đặt.
                </div>
              </div>
            )}
          </div>
        </div>
      </MatrixSection>

      <MatrixSection
        id="f06-bar"
        title="Thanh hành động dính (điện thoại)"
        note="Nằm phía trên thanh điều hướng 5 mục sẵn có của ứng dụng, đã cộng vùng an toàn iPhone. Thu cửa sổ dưới 900px để thấy."
      >
        <p className="tl-shop-hint">
          Thanh đang hiển thị ở cuối màn hình này với trạng thái{" "}
          <strong>
            {barState === "busy" ? "đang gửi" : barState === "done" ? "đã thêm" : sel.partial ? "chưa chọn đủ" : "sẵn sàng"}
          </strong>
          .
        </p>
      </MatrixSection>

      <MatrixSection
        id="f06-group"
        title="CartSellerGroup"
        note="Mỗi shop là một nhóm riêng, có tạm tính riêng và nút đặt hàng riêng — vì mỗi shop tự gửi hàng."
      >
        <CartSellerGroup shop={shopById("shop-1")} subtotal={2_690_000}>
          <div className="tl-shop-line">
            <div className="tl-shop-line-media">
              <ProductMedia label="Ảnh" />
            </div>
            <div className="tl-shop-line-body">
              <p className="tl-shop-line-title">{productById("p-1").title}</p>
              <span className="tl-shop-price">{vnd(2_450_000)}</span>
            </div>
          </div>
          <div className="tl-shop-line">
            <div className="tl-shop-line-media">
              <ProductMedia tone="c" label="Ảnh" />
            </div>
            <div className="tl-shop-line-body">
              <p className="tl-shop-line-title">{productById("p-6").title} · Đen</p>
              <span className="tl-shop-price">{vnd(240_000)}</span>
            </div>
          </div>
        </CartSellerGroup>
      </MatrixSection>

      <MatrixSection
        id="f06-timeline"
        title="OrderStatusTimeline"
        note="Mỗi mốc ghi rõ AI làm — người mua, người bán, quản trị viên hay hệ thống. Không có mốc nào là “đã xác nhận” chung chung."
      >
        <Cells min={260}>
          {ORDERS.slice(0, 4).map((o) => (
            <Cell key={o.code} label={o.status}>
              <div className="tl-shop-card">
                <OrderStatusTimeline order={o} />
              </div>
            </Cell>
          ))}
        </Cells>
      </MatrixSection>

      <MatrixSection
        id="f06-policy"
        title="PolicySummary"
        note="Khi người bán chưa đăng chính sách đổi trả, ô này nói thẳng là chưa có — không im lặng bỏ trống, cũng không bịa một chính sách mặc định."
      >
        <Cells min={280}>
          <Cell label="Shop có chính sách">
            <div className="tl-shop-card">
              <PolicySummary shop={shopById("shop-1")} product={productById("p-1")} />
            </div>
          </Cell>
          <Cell label="Shop chưa có chính sách">
            <div className="tl-shop-card">
              <PolicySummary shop={shopById("shop-2")} product={productById("p-4")} />
            </div>
          </Cell>
        </Cells>
      </MatrixSection>

      <StickyCommerceBar
        priceLabel={sel.partial ? "Chọn phiên bản" : vnd(price * qty)}
        subLabel={
          sel.variant
            ? `${shoes.optionNames.map((n, i) => `${n} ${sel.selected[i]}`).join(" · ")}`
            : orderByCode("PH-2608-0041").shopId && "Chưa chọn đủ màu và size"
        }
        action={barState === "busy" ? "Đang gửi…" : "Thêm vào giỏ"}
        disabled={sel.partial || barState === "busy"}
        onAction={() => setBarState("done")}
      />
    </main>
  );
}
