// ============================================================================
// B02 — Shop search /shop/search
// ----------------------------------------------------------------------------
// Acceptance: Back restores query, filters and scroll position.
// So query / filters / sort live in the URL (useSearchParams, push not replace)
// and the scroll offset is written to history.state on navigation away — the
// browser then restores it for free instead of us re-implementing it.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { readScenario } from "../scenario";
import { BuyerShell } from "../components/Shells";
import { ProductCard } from "../components/Primitives";
import {
  ShopSearchField,
  FacetList,
  AppliedFilterChips,
  SortControl,
  ResultCount,
  FilterSheet,
  FilterSheetTrigger,
  toggleApplied,
  type Applied,
} from "../components/SearchFilters";
import { PADDLE_FACETS } from "./F05Search";
import { LoadingGrid, ErrorState, EmptyState } from "../components/States";
import { buyableProducts, PRODUCTS } from "../fixtures";

/** URL ⇄ filter state. One place, so Back and a pasted link behave identically. */
const readApplied = (sp: URLSearchParams): Applied => {
  const out: Applied = {};
  for (const f of PADDLE_FACETS) {
    const v = sp.getAll(f.key);
    if (v.length) out[f.key] = v;
  }
  return out;
};

const writeApplied = (sp: URLSearchParams, applied: Applied): URLSearchParams => {
  const next = new URLSearchParams(sp);
  for (const f of PADDLE_FACETS) next.delete(f.key);
  for (const [k, vals] of Object.entries(applied)) for (const v of vals) next.append(k, v);
  return next;
};

export default function B02Search() {
  const location = useLocation();
  const scenario = readScenario(location.search);
  const [sp, setSp] = useSearchParams();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const q = sp.get("q") ?? "";
  const sort = sp.get("sort") ?? "moi-nhat";
  const applied = useMemo(() => readApplied(sp), [sp]);

  const setQ = (v: string) => {
    const next = new URLSearchParams(sp);
    if (v) next.set("q", v);
    else next.delete("q");
    setSp(next);
  };
  const setSort = (v: string) => {
    const next = new URLSearchParams(sp);
    next.set("sort", v);
    setSp(next);
  };
  const toggle = (k: string, v: string) => setSp(writeApplied(sp, toggleApplied(applied, k, v)));
  const clear = () => setSp(writeApplied(sp, {}));

  // Fixture "search": empty query returns everything; a query filters by title.
  const results = useMemo(() => {
    if (scenario === "empty") return [];
    const base = scenario === "suspended" ? PRODUCTS.filter((p) => p.status === "active") : buyableProducts();
    if (!q.trim()) return base;
    const needle = q.trim().toLowerCase();
    return base.filter((p) => p.title.toLowerCase().includes(needle));
  }, [q, scenario]);

  // "spelling suggestion" state: a query we know is a near-miss.
  const suggestion = q.trim().toLowerCase() === "pickelball" ? "pickleball" : null;

  useEffect(() => {
    if (!loadingMore) return;
    const id = setTimeout(() => setLoadingMore(false), 900);
    return () => clearTimeout(id);
  }, [loadingMore]);

  const body = () => {
    if (scenario === "slow") return <LoadingGrid />;
    if (scenario === "error")
      return (
        <ErrorState
          what="Tìm kiếm không chạy được."
          cause="Mất kết nối tới máy chủ."
          recovery="Từ khoá và bộ lọc của anh/chị vẫn còn trên thanh địa chỉ, bấm Thử lại là chạy tiếp."
        />
      );
    if (results.length === 0)
      return (
        <EmptyState title={q ? `Không có sản phẩm nào khớp “${q}”` : "Chưa có sản phẩm nào"}>
          Thử bỏ bớt bộ lọc, hoặc tìm bằng từ ngắn hơn — ví dụ &ldquo;vợt&rdquo; thay vì
          &ldquo;vợt carbon 16mm control&rdquo;.
        </EmptyState>
      );

    return (
      <>
        {/* Heading level must not jump H1 → H3 (the card titles are h3). */}
        <h2 className="tl-shop-sr">Kết quả tìm kiếm</h2>
        <div className="tl-shop-grid">
          {results.map((p) => (
            <ProductCard key={p.id} product={p} onToggleSave={() => {}} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 22 }}>
          {loadingMore ? (
            <span className="tl-shop-count" role="status" aria-live="polite">
              Đang tải thêm…
            </span>
          ) : (
            <button type="button" className="tl-shop-btn" onClick={() => setLoadingMore(true)}>
              Xem thêm
            </button>
          )}
        </div>
      </>
    );
  };

  return (
    <BuyerShell title="Tìm kiếm" backTo="/proto/shop/home" searchSlot={<span />}>
      <main className="tl-shop-page">
        <h1 className="tl-shop-sr">Kết quả tìm kiếm</h1>
        <ShopSearchField value={q} onChange={setQ} id="b02-q" />

        {suggestion && (
          <p className="tl-shop-count" style={{ marginTop: 12 }}>
            Có phải anh/chị tìm{" "}
            <button
              type="button"
              className="tl-shop-btn tl-shop-btn--sm tl-shop-btn--ghost"
              onClick={() => setQ(suggestion)}
            >
              {suggestion}
            </button>
            ?
          </p>
        )}

        <div className="tl-shop-toolbar" style={{ marginTop: 14 }}>
          <FilterSheetTrigger onOpen={() => setSheetOpen(true)} applied={applied} />
          <SortControl value={sort} onChange={setSort} />
          <span className="tl-proto-spacer" />
          <ResultCount count={results.length} query={q || undefined} />
        </div>

        <AppliedFilterChips
          facets={PADDLE_FACETS}
          applied={applied}
          onRemove={toggle}
          onClearAll={clear}
        />

        <div className="tl-shop-results">
          <aside className="tl-shop-rail" aria-label="Bộ lọc">
            <FacetList facets={PADDLE_FACETS} applied={applied} onToggle={toggle} idPrefix="b02" />
          </aside>
          <div>{body()}</div>
        </div>

        <FilterSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          count={results.length}
          onClear={clear}
        >
          <FacetList facets={PADDLE_FACETS} applied={applied} onToggle={toggle} idPrefix="b02s" />
        </FilterSheet>
      </main>
    </BuyerShell>
  );
}
