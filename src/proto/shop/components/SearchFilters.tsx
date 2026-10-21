// ============================================================================
// F05 — Search and filtering primitives
// ----------------------------------------------------------------------------
// The result count lives in a polite live region: a sighted user sees the
// number change when a filter toggles, and a screen-reader user hears it. That
// is the whole reason filtering feels responsive, so it is a primitive here
// rather than something each screen re-invents.
// ============================================================================

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";

// ─── Facet model ────────────────────────────────────────────────────────────

export interface Facet {
  key: string;
  label: string;
  options: { value: string; label: string; count: number }[];
}

export type Applied = Record<string, string[]>;

export const appliedCount = (a: Applied) =>
  Object.values(a).reduce((n, v) => n + v.length, 0);

export const toggleApplied = (a: Applied, key: string, value: string): Applied => {
  const cur = a[key] ?? [];
  const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
  const out = { ...a, [key]: next };
  if (next.length === 0) delete out[key];
  return out;
};

// ─── Search field ───────────────────────────────────────────────────────────

export const ShopSearchField = ({
  value,
  onChange,
  placeholder = "Tìm vợt, giày, bóng…",
  id = "shop-search",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
}) => (
  <div className="tl-shop-searchfield">
    <label htmlFor={id} className="tl-shop-sr">
      Tìm sản phẩm
    </label>
    <Search size={17} aria-hidden="true" />
    <input
      id={id}
      type="search"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      autoComplete="off"
    />
    {value && (
      <button type="button" className="clear" aria-label="Xoá từ khoá" onClick={() => onChange("")}>
        <X size={16} aria-hidden="true" />
      </button>
    )}
  </div>
);

// ─── Facet list (shared by rail + sheet) ────────────────────────────────────

export const FacetList = ({
  facets,
  applied,
  onToggle,
  idPrefix,
}: {
  facets: Facet[];
  applied: Applied;
  onToggle: (key: string, value: string) => void;
  idPrefix: string;
}) => (
  <>
    {facets.map((f) => (
      <details key={f.key} className="tl-shop-facet" open>
        <summary>
          {f.label}
          {(applied[f.key]?.length ?? 0) > 0 && (
            <span className="tl-shop-pill tl-shop-pill--ok">{applied[f.key].length}</span>
          )}
        </summary>
        <div className="tl-shop-facet-opts">
          {f.options.map((o) => {
            const id = `${idPrefix}-${f.key}-${o.value}`;
            const checked = (applied[f.key] ?? []).includes(o.value);
            return (
              <label key={o.value} className="tl-shop-check" htmlFor={id}>
                <input
                  id={id}
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(f.key, o.value)}
                />
                {o.label}
                <span className="count">{o.count}</span>
              </label>
            );
          })}
        </div>
      </details>
    ))}
  </>
);

// ─── Applied filter chips ───────────────────────────────────────────────────

export const AppliedFilterChips = ({
  facets,
  applied,
  onRemove,
  onClearAll,
}: {
  facets: Facet[];
  applied: Applied;
  onRemove: (key: string, value: string) => void;
  onClearAll: () => void;
}) => {
  const n = appliedCount(applied);
  if (n === 0) return null;
  const labelOf = (key: string, value: string) =>
    facets.find((f) => f.key === key)?.options.find((o) => o.value === value)?.label ?? value;

  return (
    <div className="tl-shop-chips">
      {Object.entries(applied).flatMap(([key, values]) =>
        values.map((v) => (
          <span key={`${key}:${v}`} className="tl-shop-chip">
            {labelOf(key, v)}
            <button type="button" aria-label={`Bỏ lọc ${labelOf(key, v)}`} onClick={() => onRemove(key, v)}>
              <X size={14} aria-hidden="true" />
            </button>
          </span>
        )),
      )}
      <button type="button" className="tl-shop-btn tl-shop-btn--sm tl-shop-btn--ghost" onClick={onClearAll}>
        Xoá tất cả bộ lọc
      </button>
    </div>
  );
};

// ─── Sort ───────────────────────────────────────────────────────────────────

export const SORTS = [
  { value: "moi-nhat", label: "Mới đăng trước" },
  { value: "gia-tang", label: "Giá thấp → cao" },
  { value: "gia-giam", label: "Giá cao → thấp" },
] as const;

export const SortControl = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) => (
  <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
    <span className="tl-shop-sr">Sắp xếp kết quả</span>
    <select
      className="tl-shop-select"
      style={{ width: "auto", minWidth: 172 }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Sắp xếp kết quả"
    >
      {SORTS.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  </label>
);

// ─── Result count (live region) ─────────────────────────────────────────────

export const ResultCount = ({ count, query }: { count: number; query?: string }) => (
  <p className="tl-shop-count" role="status" aria-live="polite">
    {count === 0
      ? query
        ? `Không có kết quả cho “${query}”`
        : "Không có sản phẩm nào"
      : `${count} sản phẩm${query ? ` cho “${query}”` : ""}`}
  </p>
);

// ─── Mobile filter sheet ────────────────────────────────────────────────────

/**
 * Focus is moved into the sheet on open and restored to the trigger on close —
 * without that, a keyboard user who opens the sheet is left tabbing through the
 * page behind it.
 */
export const FilterSheet = ({
  open,
  onClose,
  count,
  onClear,
  children,
}: {
  open: boolean;
  onClose: () => void;
  count: number;
  onClear: () => void;
  children: ReactNode;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    ref.current?.querySelector<HTMLElement>("button, input, [tabindex]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="tl-shop-sheet-backdrop" onClick={onClose} />
      <div
        className="tl-shop-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-sheet-title"
        ref={ref}
      >
        <div className="tl-shop-sheet-head">
          <h2 id="filter-sheet-title" style={{ margin: 0, fontSize: 15, fontWeight: 650 }}>
            Bộ lọc
          </h2>
          <span className="tl-proto-spacer" />
          <button type="button" className="tl-shop-iconbtn" aria-label="Đóng bộ lọc" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="tl-shop-sheet-body">{children}</div>
        <div className="tl-shop-sheet-foot">
          <button type="button" className="tl-shop-btn" onClick={onClear}>
            Xoá lọc
          </button>
          <button type="button" className="tl-shop-btn tl-shop-btn--primary" onClick={onClose}>
            Xem {count} sản phẩm
          </button>
        </div>
      </div>
    </>
  );
};

export const FilterSheetTrigger = ({
  onOpen,
  applied,
}: {
  onOpen: () => void;
  applied: Applied;
}) => {
  const n = appliedCount(applied);
  return (
    <button
      type="button"
      className="tl-shop-btn tl-shop-btn--sm"
      onClick={onOpen}
      style={{ display: "inline-flex" }}
    >
      <SlidersHorizontal size={15} aria-hidden="true" />
      Bộ lọc
      {n > 0 && <span className="tl-shop-pill tl-shop-pill--ok">{n}</span>}
    </button>
  );
};

/** Hook shared by the search/category screens so their state behaves identically. */
export const useFilterState = (initial: Applied = {}) => {
  const [applied, setApplied] = useState<Applied>(initial);
  const [sheetOpen, setSheetOpen] = useState(false);
  return {
    applied,
    sheetOpen,
    setSheetOpen,
    toggle: (k: string, v: string) => setApplied((a) => toggleApplied(a, k, v)),
    remove: (k: string, v: string) => setApplied((a) => toggleApplied(a, k, v)),
    clear: () => setApplied({}),
  };
};
