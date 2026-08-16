// ============================================================================
// The grid, its states, and the filter controls — shared by /shop,
// /shop/search and /shop/category/:slug.
// ----------------------------------------------------------------------------
// One implementation, because those three screens are one query with different
// arguments. Three copies would eventually disagree about what "no results"
// means, and a buyer would meet the disagreement.
//
// Error is not empty. A shopper told "không có sản phẩm nào" when the request
// actually failed stops looking — the P2a lesson, on a buyer surface now.
// ============================================================================

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, SlidersHorizontal } from "lucide-react";
import type { PublicCategory, ProductCard as Card } from "@/hooks/shop/usePublicShop";
import { ProductCard, ProductCardSkeleton } from "./ProductCard";
import { catalogMood } from "@/lib/shop/publicCatalog";

export interface Filters {
  condition: "new" | "used" | null;
  inStockOnly: boolean;
  sort: "recent" | "price_asc" | "price_desc";
}

export const DEFAULT_FILTERS: Filters = { condition: null, inStockOnly: false, sort: "recent" };

const SORTS: { key: Filters["sort"]; label: string }[] = [
  { key: "recent", label: "Mới đăng" },
  { key: "price_asc", label: "Giá thấp trước" },
  { key: "price_desc", label: "Giá cao trước" },
];

/** The filter controls themselves — same markup in the rail and in the sheet. */
export function FilterFields({
  value,
  onChange,
  idPrefix,
}: {
  value: Filters;
  onChange: (f: Filters) => void;
  idPrefix: string;
}) {
  return (
    <>
      <fieldset className="tl-filter-group">
        <legend>Sắp xếp</legend>
        {SORTS.map((s) => (
          <label key={s.key} className="tl-shop-check">
            <input
              type="radio"
              name={`${idPrefix}-sort`}
              checked={value.sort === s.key}
              onChange={() => onChange({ ...value, sort: s.key })}
            />
            {s.label}
          </label>
        ))}
      </fieldset>

      <fieldset className="tl-filter-group">
        <legend>Tình trạng</legend>
        {([null, "new", "used"] as const).map((c) => (
          <label key={c ?? "all"} className="tl-shop-check">
            <input
              type="radio"
              name={`${idPrefix}-condition`}
              checked={value.condition === c}
              onChange={() => onChange({ ...value, condition: c })}
            />
            {c === null ? "Tất cả" : c === "new" ? "Mới" : "Đã qua sử dụng"}
          </label>
        ))}
      </fieldset>

      <fieldset className="tl-filter-group">
        <legend>Kho hàng</legend>
        <label className="tl-shop-check">
          <input
            type="checkbox"
            checked={value.inStockOnly}
            onChange={(e) => onChange({ ...value, inStockOnly: e.target.checked })}
          />
          Chỉ hiện sản phẩm còn hàng
        </label>
        <p className="tl-shop-hint" style={{ marginTop: 4, marginBottom: 0 }}>
          Shop chưa khai số lượng thì vẫn hiện, kèm ghi chú — không coi &ldquo;chưa khai&rdquo; là
          hết hàng.
        </p>
      </fieldset>
    </>
  );
}

/**
 * The mobile filter sheet.
 *
 * A real `<dialog>`: Escape closes it, focus is trapped, and the page behind
 * does not scroll — all from the platform, none of it re-implemented. Edits go
 * to a draft and only reach the URL on Áp dụng, so a phone user does not fire
 * four queries while making up their mind.
 */
export function FilterSheet({
  open,
  value,
  onApply,
  onClose,
}: {
  open: boolean;
  value: Filters;
  onApply: (f: Filters) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // State, not a ref. The draft was a ref passed as the `value` of controlled
  // inputs, so a tap mutated it, re-rendered nothing, and React put the radio
  // straight back to unchecked — the filter committed correctly on Áp dụng and
  // looked broken for every second before that. A ref is only safe as a draft
  // when nothing renders from it.
  const [draft, setDraft] = useState<Filters>(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // The draft is reset on OPENING, not on every `value` change, so a
    // cancelled sheet does not reappear with the choice that was abandoned.
    if (open && !el.open) {
      setDraft(value);
      el.showModal();
    }
    if (!open && el.open) el.close();
  }, [open, value]);

  return (
    <dialog
      ref={ref}
      className="tl-sheet"
      aria-label="Bộ lọc"
      onClose={onClose}
      onCancel={onClose}
    >
      <form method="dialog" onSubmit={(e) => e.preventDefault()}>
        <div className="tl-sheet-inner">
          <h2 className="tl-shop-h2" style={{ marginTop: 0 }}>Bộ lọc</h2>
          <FilterFields value={draft} onChange={setDraft} idPrefix="sheet" />
        </div>
        <div className="tl-sheet-actions">
          <button type="button" className="tl-shop-btn" onClick={onClose}>Huỷ</button>
          <button
            type="button"
            className="tl-shop-btn tl-shop-btn--primary"
            onClick={() => onApply(draft)}
          >
            Áp dụng
          </button>
        </div>
      </form>
    </dialog>
  );
}

export function FilterOpenButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="tl-shop-btn tl-filter-open" onClick={onClick}>
      <SlidersHorizontal size={15} aria-hidden="true" /> Bộ lọc
    </button>
  );
}

export function CategoryChips({
  categories,
  active,
  onPick,
}: {
  categories: PublicCategory[];
  active: string | null;
  onPick: (slug: string | null) => void;
}) {
  return (
    <div className="tl-shop-cats" role="group" aria-label="Ngành hàng">
      <button
        type="button"
        className="tl-shop-cat"
        aria-current={active === null ? "page" : undefined}
        onClick={() => onPick(null)}
      >
        Tất cả
      </button>
      {categories.map((c) => (
        <button
          key={c.slug}
          type="button"
          className="tl-shop-cat"
          aria-current={active === c.slug ? "page" : undefined}
          onClick={() => onPick(c.slug)}
        >
          {c.name}
          <span className="count">{c.product_count}</span>
        </button>
      ))}
    </div>
  );
}

export function ResultsGrid({
  rows,
  total,
  isLoading,
  isError,
  onRetry,
  emptyTitle,
  emptyBody,
  emptyIcon,
  emptyAction,
  onClearFilters,
}: {
  rows: Card[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyTitle: string;
  emptyBody?: string;
  /** Decorative lucide icon above the empty title (28px, aria-hidden). */
  emptyIcon?: ReactNode;
  /** One extra line/CTA under the empty body — a prop, not a fork. */
  emptyAction?: ReactNode;
  onClearFilters?: () => void;
}) {
  if (isLoading) {
    return (
      <ul className="tl-pgrid" aria-busy="true" aria-label="Đang tải sản phẩm">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i}><ProductCardSkeleton /></li>
        ))}
      </ul>
    );
  }

  if (isError) {
    // Never "không có sản phẩm nào": a shopper told that when the request
    // failed stops looking, and the catalogue looks empty rather than broken.
    return (
      <div className="tl-shop-empty" role="alert">
        <p className="tl-shop-empty-title">
          <AlertTriangle size={15} aria-hidden="true" style={{ verticalAlign: -2 }} />{" "}
          Chưa tải được danh sách
        </p>
        <p className="tl-shop-hint">Đây là lỗi tải dữ liệu, không phải sàn đang trống.</p>
        <button type="button" className="tl-shop-btn" onClick={onRetry}>Thử lại</button>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="tl-shop-empty">
        {emptyIcon}
        <p className="tl-shop-empty-title">{emptyTitle}</p>
        {emptyBody && <p className="tl-shop-hint">{emptyBody}</p>}
        {onClearFilters && (
          <button type="button" className="tl-shop-btn" onClick={onClearFilters}>
            Bỏ bộ lọc
          </button>
        )}
        {emptyAction}
      </div>
    );
  }

  const mood = catalogMood(total);

  return (
    <>
      <p className="tl-shop-hint" role="status" style={{ marginTop: 0 }}>
        {total} sản phẩm
        {mood === "sparse" && " — sàn đang ở giai đoạn thử nghiệm, đây là toàn bộ những gì đang bán."}
      </p>
      <ul className="tl-pgrid">
        {rows.map((c, i) => (
          <li key={c.id}><ProductCard card={c} eager={i < 4} /></li>
        ))}
      </ul>
    </>
  );
}
