// ============================================================================
// /shop/category/:slug — prototype B03 in production.
// ----------------------------------------------------------------------------
// The same query as search, pinned to one category. A category that is
// disabled, or that never existed, answers identically: the taxonomy belongs
// to the platform (Q3), and a 404 that distinguished the two would leak which
// categories exist but are switched off.
// ============================================================================

import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { usePublicCategories, usePublicSearch } from "@/hooks/shop/usePublicShop";
import {
  DEFAULT_FILTERS,
  FilterFields,
  FilterOpenButton,
  FilterSheet,
  ResultsGrid,
  type Filters,
} from "@/components/shop/CatalogResults";
import "@/styles/shop.css";

export default function ShopCategory() {
  const { slug } = useParams<{ slug: string }>();
  const [params, setParams] = useSearchParams();
  const [sheetOpen, setSheetOpen] = useState(false);

  const filters: Filters = {
    condition: (params.get("condition") as Filters["condition"]) ?? null,
    inStockOnly: params.get("stock") === "1",
    sort: (params.get("sort") as Filters["sort"]) ?? "recent",
  };

  const categories = usePublicCategories();
  const category = (categories.data ?? []).find((c) => c.slug === slug) ?? null;
  const known = categories.isLoading || category !== null;

  const results = usePublicSearch(
    {
      categorySlug: slug ?? null,
      condition: filters.condition,
      inStockOnly: filters.inStockOnly,
      sort: filters.sort,
      cursorAt: params.get("after"),
      cursorId: params.get("after_id"),
    },
    !!slug,
  );

  const patch = (kv: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(kv)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    next.delete("after");
    next.delete("after_id");
    setParams(next);
  };

  const rows = results.data?.rows ?? [];

  if (!categories.isLoading && !category) {
    // Disabled and never-existed give the SAME answer. Distinguishing them
    // would tell a visitor which categories the platform has switched off.
    return (
      <TheLineLayout title="Không tìm thấy ngành hàng">
        <DynamicMeta title="Không tìm thấy ngành hàng" noindex />
        <main className="tl-shop">
          <h1 className="tl-shop-h1">Không tìm thấy ngành hàng này</h1>
          <p className="tl-shop-sub">Có thể đường dẫn đã đổi, hoặc ngành hàng không còn mở.</p>
          <Link to="/shop" className="tl-shop-btn">Về trang chợ</Link>
        </main>
      </TheLineLayout>
    );
  }

  return (
    <TheLineLayout title={category?.name ?? "Ngành hàng"}>
      <DynamicMeta title={category ? category.name : "Ngành hàng"} noindex />
      <main className="tl-shop">
        <nav aria-label="Đường dẫn" className="tl-shop-sub tl-shop-crumbs">
          <Link to="/shop" className="tl-crumb">Chợ</Link>
          <span aria-hidden="true" className="tl-crumb-sep">/</span>
          <span aria-current="page" className="tl-crumb-current">{category?.name ?? "…"}</span>
        </nav>

        <h1 className="tl-shop-h1">{category?.name ?? "Ngành hàng"}</h1>

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
              idPrefix="cat-rail"
            />
          </aside>

          <div>
            <ResultsGrid
              rows={rows}
              total={results.data?.total ?? 0}
              isLoading={results.isLoading || !known}
              isError={results.isError}
              onRetry={() => void results.refetch()}
              emptyTitle="Ngành hàng này chưa có sản phẩm nào"
              emptyBody="Sàn đang ở giai đoạn thử nghiệm. Thử ngành hàng khác nhé."
              onClearFilters={
                filters.condition || filters.inStockOnly || filters.sort !== DEFAULT_FILTERS.sort
                  ? () => patch({ condition: null, stock: null, sort: null })
                  : undefined
              }
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
                    setParams(next);
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
      </main>
    </TheLineLayout>
  );
}
