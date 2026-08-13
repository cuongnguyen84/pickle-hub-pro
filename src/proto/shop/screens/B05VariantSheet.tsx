// ============================================================================
// B05 — Variant selector sheet
// ----------------------------------------------------------------------------
// Acceptance:
//   • Selecting a variant never changes the seller. Variants live inside one
//     product, which belongs to one shop — the sheet header pins the seller so
//     it is visibly impossible.
//   • Unrelated cheap options cannot masquerade as variants. The rule is
//     stated on this screen and enforced by the fixture shape: a variant is a
//     combination of the product's own option values, not a separate item.
// ============================================================================

import { useState } from "react";
import { useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { readVariant } from "../scenario";
import { BuyerShell } from "../components/Shells";
import { ProductMedia, SellerIdentity, StockStatus } from "../components/Primitives";
import { VariantSelector, useVariantSelection, QuantityControl } from "../components/Commerce";
import { productById, shopById, vnd, type ProtoProduct, type ProtoShop } from "../fixtures";

type Phase = "none" | "partial" | "valid" | "soldout" | "price" | "failed" | "sending";

const PHASES: { key: Phase; label: string; pick: string[] }[] = [
  { key: "none", label: "Chưa chọn gì", pick: [] },
  { key: "partial", label: "Chọn một phần", pick: ["Trắng"] },
  { key: "valid", label: "Chọn hợp lệ", pick: ["Trắng", "41"] },
  { key: "soldout", label: "Tổ hợp hết hàng", pick: ["Trắng", "40"] },
  { key: "price", label: "Đổi phiên bản → đổi giá", pick: ["Đen", "39"] },
  { key: "sending", label: "Đang gửi", pick: ["Trắng", "41"] },
  { key: "failed", label: "Thêm giỏ thất bại", pick: ["Trắng", "41"] },
];

const Sheet = ({
  phase,
  product,
  shop,
}: {
  phase: Phase;
  product: ProtoProduct;
  shop: ProtoShop;
}) => {
  const preset = PHASES.find((p) => p.key === phase)?.pick ?? [];
  const sel = useVariantSelection(
    product,
    product.optionNames.map((_, i) => preset[i] ?? (null as unknown as string)),
  );
  const [qty, setQty] = useState(1);

  const price = sel.variant?.priceVnd ?? product.priceVnd;
  const basePrice = product.priceVnd;
  const priceChanged = !!sel.variant && sel.variant.priceVnd !== basePrice;
  const soldOut = !!sel.variant && sel.variant.stock !== null && sel.variant.stock <= 0;

  return (
    <div
      className="tl-shop-card"
      role="dialog"
      aria-modal="false"
      aria-labelledby="b05-title"
      style={{ maxWidth: 460, padding: 0 }}
    >
      <div className="tl-shop-sheet-head">
        <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
          <div style={{ width: 56, flex: "none" }}>
            <ProductMedia tone={product.media[sel.variant?.mediaIndex ?? 0]?.tone ?? "b"} label="" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="tl-shop-price">{vnd(price)}</div>
            <div style={{ fontSize: 12, color: "var(--tl-fg-3)" }}>
              {sel.variant ? `Mã hàng ${sel.variant.sku}` : "Chọn để xem mã hàng"}
            </div>
          </div>
        </div>
        <span className="tl-proto-spacer" />
        <button type="button" className="tl-shop-iconbtn" aria-label="Đóng bảng chọn">
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div style={{ padding: "12px 14px" }}>
        {/* Seller pinned inside the sheet — the buyer can never lose track of
            who they are buying from mid-selection. */}
        <div style={{ marginBottom: 14 }}>
          <SellerIdentity shop={shop} linked={false} />
        </div>

        <h2 id="b05-title" className="tl-shop-sr">
          Chọn màu và size
        </h2>

        <VariantSelector product={product} selected={sel.selected} onPick={sel.pick} />

        <div style={{ marginTop: 16 }}>
          <span className="tl-shop-label">Số lượng</span>
          <QuantityControl value={qty} onChange={setQty} max={sel.variant?.stock ?? null} />
        </div>

        <div style={{ marginTop: 14 }} role="status" aria-live="polite">
          {sel.partial && (
            <p className="tl-shop-hint" style={{ marginTop: 0 }}>
              Còn thiếu:{" "}
              {product.optionNames
                .filter((_, i) => sel.selected[i] === null)
                .join(", ")
                .toLowerCase()}
              .
            </p>
          )}
          {sel.variant && <StockStatus stock={sel.variant.stock} />}
          {priceChanged && (
            <p className="tl-shop-hint">
              Phiên bản này giá {vnd(price)}, khác với {vnd(basePrice)} hiển thị lúc đầu.
            </p>
          )}
          {soldOut && (
            <p className="tl-shop-error" style={{ marginTop: 8 }}>
              Tổ hợp này hết hàng. Chọn size khác, hoặc lưu sản phẩm để được báo khi có lại.
            </p>
          )}
          {phase === "failed" && (
            <div className="tl-shop-notice tl-shop-notice--danger" style={{ marginTop: 10, marginBottom: 0 }}>
              <div>
                <strong>Chưa thêm được vào giỏ.</strong> Mất kết nối khi đang gửi. Sản phẩm vẫn
                còn trong kho, anh/chị thử lại giúp.
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="tl-shop-sheet-foot">
        <button
          type="button"
          className="tl-shop-btn tl-shop-btn--primary tl-shop-btn--block"
          disabled={sel.partial || soldOut || phase === "sending"}
        >
          {phase === "sending"
            ? "Đang gửi…"
            : soldOut
              ? "Hết hàng"
              : sel.partial
                ? "Chọn đủ phiên bản"
                : `Thêm vào giỏ · ${vnd(price * qty)}`}
        </button>
      </div>
    </div>
  );
};

export default function B05VariantSheet() {
  const location = useLocation();
  const initial = (readVariant(location.search) || "none") as Phase;
  const [phase, setPhase] = useState<Phase>(initial);
  const product = productById("p-2");
  const shop = shopById(product.shopId);

  return (
    <BuyerShell title="Chọn phiên bản" backTo="/proto/shop/product/giay-pickleball-court-pro">
      <main className="tl-shop-page">
        <p className="tl-shop-eyebrow">B05</p>
        <h1 className="tl-shop-h1">Bảng chọn phiên bản</h1>
        <p className="tl-shop-sub">
          Trên điện thoại là bảng trượt từ đáy. Từ 900px trở lên, phần chọn nằm thẳng trong
          trang sản phẩm — không có bảng nào cả.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {PHASES.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`tl-shop-btn tl-shop-btn--sm ${phase === p.key ? "tl-shop-btn--primary" : ""}`}
              onClick={() => setPhase(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="tl-shop-notice tl-shop-notice--info">
          <div>
            <strong>Hai quy tắc không được phá:</strong> đổi phiên bản <em>không bao giờ</em>{" "}
            đổi người bán (phiên bản nằm trong một sản phẩm, sản phẩm thuộc một shop); và không
            được dựng &ldquo;phiên bản&rdquo; là một món khác rẻ hơn để câu giá — mỗi phiên bản
            phải là cùng món hàng, khác màu/size.
          </div>
        </div>

        <Sheet key={phase} phase={phase} product={product} shop={shop} />
      </main>
    </BuyerShell>
  );
}
