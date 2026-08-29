// ============================================================================
// /shop/search — prototype B02 in production.
// ----------------------------------------------------------------------------
// Query, filters, sort and the cursor all live in the URL. Back restores the
// exact working set, and a link is shareable — the acceptance criterion B02
// was written around.
//
// The typing race is handled by the CACHE KEY, not by an abort controller:
// react-query keys on the full argument list, so a slow response for "vo" is
// written into the entry for "vo" and can never overwrite the one for "vot".
// A debounce on top of that is about not asking the server four times, not
// about correctness.
// ============================================================================

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, SearchX } from "lucide-react";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { usePublicCategories, usePublicSearch } from "@/hooks/shop/usePublicShop";
import { ShopCartLink } from "@/components/shop/CartLink";
import {
  CategoryChips,
  FilterFields,
  FilterOpenButton,
  FilterSheet,
  ResultsGrid,
  type Filters,
} from "@/components/shop/CatalogResults";
import "@/styles/shop.css";

const DEBOUNCE_MS = 300;

export default function ShopSearch() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const category = params.get("cat");
  const filters: Filters = {
    condition: (params.get("condition") as Filters["condition"]) ?? null,
    inStockOnly: params.get("stock") === "1",
    sort: (params.get("sort") as Filters["sort"]) ?? "recent",
  };

  // The input is local so typing is not throttled by the router; the URL
  // catches up after the debounce. Re-synced when the URL changes underneath
  // (Back/Forward), which is the case a naive local state gets wrong.
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);

  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (draft === q) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (draft.trim()) next.set("q", draft.trim());
      else next.delete("q");
      next.delete("after");
      next.delete("after_id");
      // replace: typing should not fill the history with one entry per letter.
      setParams(next, { replace: true });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [draft, q, params, setParams]);

  const patch = (kv: Record<string, string | null>, replace = false) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(kv)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    // Any change to the working set invalidates the cursor.
    next.delete("after");
    next.delete("after_id");
    setParams(next, { replace });
  };

  const categories = usePublicCategories();
  const results = usePublicSearch({
    q,
    categorySlug: category,
    condition: filters.condition,
    inStockOnly: filters.inStockOnly,
    sort: filters.sort,
    cursorAt: params.get("after"),
    cursorId: params.get("after_id"),
  });

  const rows = results.data?.rows ?? [];

  return (
    <TheLineLayout title="Tìm sản phẩm">
      <DynamicMeta title={q ? `Tìm: ${q}` : "Tìm sản phẩm"} noindex />
      <main className="tl-shop">
        {/* R5 #1 — the page frame: gutters + max-width + BottomNav clearance. */}
        <div className="tl-shop-page tl-shop-has-fab">
        {/* No breadcrumb on this screen, so the topline carries the cart badge
            alone. It must NOT go in TheLineLayout's tl-nav — that nav is
            shared with /live, /feed and /blog. */}
        <div className="tl-shop-topline">
          <ShopCartLink floating />
        </div>
        <h1 className="tl-shop-h1">Tìm sản phẩm</h1>

        <form role="search" className="tl-shop-searchfield" onSubmit={(e) => e.preventDefault()}>
          <label htmlFor="shop-q" className="tl-shop-sr">Từ khoá</label>
          <Search size={15} aria-hidden="true" />
          <input
            id="shop-q"
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Tìm vợt, giày, bóng…"
            style={{ fontSize: 16 }}
          />
          <button type="submit" className="tl-shop-btn tl-shop-btn--primary">
            Tìm
          </button>
        </form>

        <CategoryChips
          categories={categories.data ?? []}
          active={category}
          onPick={(slug) => patch({ cat: slug })}
        />

        <div style={{ margin: "12px 0" }}>
          <FilterOpenButton onClick={() => setSheetOpen(true)} />
        </div>

        <div className="tl-shop-layout">
          <aside className="tl-filter-rail" aria-label="Bộ lọc">
            <FilterFields
              value={filters}
              onChange={(f) =>
                patch({
                  condition: f.condition,
                  stock: f.inStockOnly ? "1" : null,
                  sort: f.sort === "recent" ? null : f.sort,
                })
              }
              idPrefix="rail"
            />
          </aside>

          <div>
            <ResultsGrid
              rows={rows}
              total={results.data?.total ?? 0}
              hidePilotNote
              isLoading={results.isLoading}
              isError={results.isError}
              onRetry={() => void results.refetch()}
              emptyTitle={q ? `Không tìm thấy sản phẩm nào cho “${q}”` : "Không có sản phẩm nào khớp bộ lọc"}
              emptyBody="Thử bỏ bớt bộ lọc, hoặc tìm bằng từ ngắn hơn."
              emptyIcon={<SearchX size={28} aria-hidden="true" />}
              onClearFilters={() => patch({ condition: null, stock: null, sort: null, cat: null })}
            />

            {results.data?.has_more && rows.length > 0 && (
              <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
                <button
                  type="button"
                  className="tl-shop-btn"
                  onClick={() => {
                    const last = rows[rows.length - 1];
                    const next = new URLSearchParams(params);
                    next.set("after", last.created_at);
                    next.set("after_id", last.id);
                    setParams(next);   // a real history entry: Back returns here
                  }}
                >
                  Xem thêm
                </button>
              </div>
            )}
          </div>
        </div>

        <FilterSheet
          open={sheetOpen}
          value={filters}
          onClose={() => setSheetOpen(false)}
          onApply={(f) => {
            setSheetOpen(false);
            patch({
              condition: f.condition,
              stock: f.inStockOnly ? "1" : null,
              sort: f.sort === "recent" ? null : f.sort,
            });
          }}
        />
        </div>
      </main>
    </TheLineLayout>
  );
}
