// ============================================================================
// F06 — Commerce action primitives
// ----------------------------------------------------------------------------
// The one rule these all share: a click here NEVER implies that money moved or
// that a shipment state changed. Buttons say what they request; the timeline
// says what actually happened and who did it.
// ============================================================================

import { useMemo, useState, type ReactNode } from "react";
import { Minus, Plus, MapPin, RotateCcw, Wallet, ShieldAlert } from "lucide-react";
import {
  type ProtoProduct,
  type ProtoVariant,
  type ProtoOrder,
  type ProtoShop,
  vnd,
  dmyhm,
} from "../fixtures";
import { SellerIdentity, StockStatus } from "./Primitives";

// ─── Variant selector ───────────────────────────────────────────────────────

export interface VariantSelectorState {
  selected: (string | null)[];
  variant: ProtoVariant | null;
  /** true when at least one option is still unchosen. */
  partial: boolean;
}

export const useVariantSelection = (product: ProtoProduct, initial?: string[]) => {
  const [selected, setSelected] = useState<(string | null)[]>(
    () => initial ?? product.optionNames.map(() => null),
  );

  const state: VariantSelectorState = useMemo(() => {
    if (product.optionNames.length === 0) {
      return { selected: [], variant: product.variants[0] ?? null, partial: false };
    }
    const partial = selected.some((v) => v === null);
    const variant = partial
      ? null
      : (product.variants.find((v) => v.values.every((val, i) => val === selected[i])) ?? null);
    return { selected, variant, partial };
  }, [product, selected]);

  const pick = (index: number, value: string) =>
    setSelected((s) => s.map((v, i) => (i === index ? (v === value ? null : value) : v)));

  return { ...state, pick, reset: () => setSelected(product.optionNames.map(() => null)) };
};

/** Values for `index` that cannot combine with what is already chosen. */
const unavailableValues = (
  product: ProtoProduct,
  selected: (string | null)[],
  index: number,
): Set<string> => {
  const out = new Set<string>();
  const values = new Set(product.variants.map((v) => v.values[index]));
  for (const value of values) {
    const matches = product.variants.filter(
      (v) =>
        v.values[index] === value &&
        selected.every((sel, i) => i === index || sel === null || v.values[i] === sel),
    );
    const anyInStock = matches.some((v) => v.stock === null || v.stock > 0);
    if (matches.length === 0 || !anyInStock) out.add(value);
  }
  return out;
};

export const VariantSelector = ({
  product,
  selected,
  onPick,
}: {
  product: ProtoProduct;
  selected: (string | null)[];
  onPick: (index: number, value: string) => void;
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    {product.optionNames.map((name, i) => {
      const values = [...new Set(product.variants.map((v) => v.values[i]))];
      const blocked = unavailableValues(product, selected, i);
      return (
        <fieldset key={name} style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="tl-shop-label" style={{ padding: 0 }}>
            {name}
            {selected[i] ? (
              <span style={{ color: "var(--tl-fg)", fontWeight: 500 }}> · {selected[i]}</span>
            ) : (
              <span style={{ color: "var(--tl-fg-3)", fontWeight: 400 }}> · chưa chọn</span>
            )}
          </legend>
          <div className="tl-shop-optrow">
            {values.map((v) => {
              const isBlocked = blocked.has(v);
              return (
                <button
                  key={v}
                  type="button"
                  className="tl-shop-opt"
                  aria-pressed={selected[i] === v}
                  disabled={isBlocked}
                  aria-label={isBlocked ? `${name} ${v} — hết hàng` : `${name} ${v}`}
                  onClick={() => onPick(i, v)}
                >
                  {v}
                </button>
              );
            })}
          </div>
        </fieldset>
      );
    })}
  </div>
);

// ─── Quantity ───────────────────────────────────────────────────────────────

export const QuantityControl = ({
  value,
  onChange,
  max,
  label = "Số lượng",
}: {
  value: number;
  onChange: (n: number) => void;
  max?: number | null;
  label?: string;
}) => {
  const ceiling = max ?? 99;
  return (
    <div>
      <div className="tl-shop-qty">
        <button
          type="button"
          aria-label={`Giảm ${label.toLowerCase()}`}
          disabled={value <= 1}
          onClick={() => onChange(value - 1)}
        >
          <Minus size={16} aria-hidden="true" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          aria-label={label}
          onChange={(e) => {
            const n = Number(e.target.value.replace(/\D/g, ""));
            if (n >= 1 && n <= ceiling) onChange(n);
          }}
        />
        <button
          type="button"
          aria-label={`Tăng ${label.toLowerCase()}`}
          disabled={value >= ceiling}
          onClick={() => onChange(value + 1)}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
      {max !== null && max !== undefined && value >= max && (
        <p className="tl-shop-hint" style={{ marginTop: 6 }}>
          Người bán chỉ còn {max} sản phẩm.
        </p>
      )}
    </div>
  );
};

// ─── Sticky commerce bar ────────────────────────────────────────────────────

export const StickyCommerceBar = ({
  priceLabel,
  subLabel,
  action,
  disabled,
  onAction,
}: {
  priceLabel: string;
  subLabel?: string;
  action: string;
  disabled?: boolean;
  onAction?: () => void;
}) => (
  <div className="tl-shop-stickybar">
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{priceLabel}</div>
      {subLabel && (
        <div style={{ fontSize: 11.5, color: "var(--tl-fg-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {subLabel}
        </div>
      )}
    </div>
    <button
      type="button"
      className="tl-shop-btn tl-shop-btn--primary"
      disabled={disabled}
      onClick={onAction}
    >
      {action}
    </button>
  </div>
);

// ─── Cart seller group ──────────────────────────────────────────────────────

export const CartSellerGroup = ({
  shop,
  subtotal,
  children,
  footNote,
  action,
  actionDisabled,
}: {
  shop: ProtoShop;
  subtotal: number;
  children: ReactNode;
  footNote?: ReactNode;
  action?: ReactNode;
  actionDisabled?: boolean;
}) => (
  <section className="tl-shop-sellergroup" aria-label={`Sản phẩm từ ${shop.name}`}>
    <header className="tl-shop-sellergroup-head">
      <SellerIdentity shop={shop} showBadge />
    </header>
    <div className="tl-shop-sellergroup-body">{children}</div>
    <footer className="tl-shop-sellergroup-foot">
      <div style={{ flex: 1, minWidth: 140 }}>
        <div style={{ fontSize: 12, color: "var(--tl-fg-3)" }}>Tạm tính cho shop này</div>
        <div style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{vnd(subtotal)}</div>
        {footNote}
      </div>
      {action ?? (
        <button type="button" className="tl-shop-btn tl-shop-btn--primary" disabled={actionDisabled}>
          Đặt hàng shop này
        </button>
      )}
    </footer>
  </section>
);

// ─── Order status timeline ──────────────────────────────────────────────────

const WHO: Record<"buyer" | "seller" | "admin" | "system", string> = {
  buyer: "Người mua",
  seller: "Người bán",
  admin: "Quản trị viên",
  system: "Hệ thống",
};

export const OrderStatusTimeline = ({ order }: { order: ProtoOrder }) => (
  <ol className="tl-shop-timeline">
    {order.timeline.map((e, i) => (
      <li
        key={`${e.at}-${i}`}
        className={i === order.timeline.length - 1 ? "is-current" : "is-done"}
      >
        <div className="tl-shop-timeline-when">{dmyhm(e.at)}</div>
        <div className="tl-shop-timeline-what">{e.label}</div>
        <div className="tl-shop-timeline-who">{WHO[e.by]}</div>
      </li>
    ))}
  </ol>
);

// ─── Policy summary ─────────────────────────────────────────────────────────

export const PolicySummary = ({
  product,
  shop,
  paymentNote,
}: {
  product?: ProtoProduct;
  shop: ProtoShop;
  paymentNote?: string;
}) => (
  <div className="tl-shop-policy">
    <div className="tl-shop-policy-item">
      <MapPin size={15} aria-hidden="true" />
      <span>
        Gửi từ {product?.shippingFromCity ?? shop.city}.{" "}
        {shop.shippingNote || "Người bán chưa ghi chú về vận chuyển."}
      </span>
    </div>
    <div className="tl-shop-policy-item">
      <RotateCcw size={15} aria-hidden="true" />
      <span>
        {shop.returnPolicy || (
          <>
            <strong>Người bán chưa đăng chính sách đổi trả.</strong> Nếu hàng không đúng mô
            tả, anh/chị vẫn mở được khiếu nại.
          </>
        )}
      </span>
    </div>
    <div className="tl-shop-policy-item">
      <Wallet size={15} aria-hidden="true" />
      <span>{paymentNote ?? "Thanh toán khi nhận hàng (COD) hoặc chuyển khoản VietQR."}</span>
    </div>
    <div className="tl-shop-policy-item">
      <ShieldAlert size={15} aria-hidden="true" />
      <span>
        ThePickleHub là nơi kết nối người mua và người bán. Hàng hoá do người bán chịu trách
        nhiệm; nền tảng chỉ hỗ trợ khi hai bên không tự giải quyết được.
      </span>
    </div>
  </div>
);

export { StockStatus };
