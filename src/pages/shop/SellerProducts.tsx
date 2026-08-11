// ============================================================================
// /seller/products — the shop's own catalog (P2a step 4).
// ----------------------------------------------------------------------------
// Desktop gets a table because a seller scans many rows at once. A phone gets
// cards: a six-column table at 375px means sideways scrolling inside a
// management surface, where a mis-tap edits the wrong product.
//
// Three numbers on this screen come from the database and from nowhere else,
// because each one is a number the seller will act on:
//   * the total is PostgREST's exact count for the CURRENT filters, not the
//     length of the page that arrived;
//   * every chip's count is one GROUP BY over the whole catalog;
//   * price and stock come off the variants, because the product row carries
//     neither — that is the P2a.1 invariant, not an implementation detail.
//
// No fixture, no scenario, no simulated delay.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ImageOff, Plus, Search } from "lucide-react";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { ShopScrollShell, SellerShell } from "@/components/shop/ShopShell";
import { ErrorState, LoadingState } from "@/components/states/PageStates";
import { useMyShopMembership, useShopCategories, useShopProfile } from "@/hooks/shop/useShopProfile";
import {
  EMPTY_FILTERS,
  PAGE_SIZE,
  PRODUCT_SORTS,
  hasActiveFilter,
  useProductStatusCounts,
  useSellerProducts,
  type ProductListFilters,
  type ProductSort,
} from "@/hooks/shop/useSellerProducts";
import {
  PRODUCT_STATUS_HINT,
  PRODUCT_STATUS_LABEL,
  PRODUCT_STATUS_ORDER,
  PRODUCT_STATUS_TONE,
  summarise,
} from "@/lib/shop/productState";
import { shopErrorMessage } from "@/lib/shop/errors";
import type { ProductStatus, SellerProductRow } from "@/integrations/supabase/shop-schema";

const SHOP_STATE_NOTICE: Record<string, string> = {
  pending_activation:
    "Shop chưa được kích hoạt nên chưa đăng sản phẩm được. Quản trị viên sẽ liên hệ khi xong.",
  restricted: "Shop đang bị hạn chế. Anh/chị xem được danh mục nhưng chưa đăng hoặc sửa sản phẩm.",
  suspended: "Shop đang tạm ngưng. Danh mục vẫn còn nguyên, nhưng chưa đăng hoặc sửa được.",
  closed: "Shop đã đóng. Danh mục chỉ còn để xem lại.",
};

export default function SellerProducts() {
  const membership = useMyShopMembership();
  const shopId = membership.data?.shop_id ?? null;
  const canWrite = membership.data?.role === "owner" || membership.data?.role === "manager";

  const profile = useShopProfile(shopId);
  const categories = useShopCategories();
  const [filters, setFilters] = useState<ProductListFilters>(EMPTY_FILTERS);

  // Debounced so a five-letter search is one request, not five. The input
  // itself stays uncontrolled-by-the-query so typing never stutters.
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const id = window.setTimeout(
      () => setFilters((f) => (f.search === searchInput ? f : { ...f, search: searchInput, page: 0 })),
      300,
    );
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const list = useSellerProducts(shopId, filters);
  const counts = useProductStatusCounts(shopId);

  const shopState = profile.data?.state ?? null;
  const shopBlocked = !!shopState && shopState !== "active";
  const catalogEmpty = useMemo(
    () => Object.values(counts.data ?? {}).reduce((n, v) => n + (v ?? 0), 0) === 0,
    [counts.data],
  );

  const setFilter = (patch: Partial<ProductListFilters>) =>
    setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 0 }));

  const shell = (children: React.ReactNode, actions?: React.ReactNode) => (
    <ShopScrollShell>
      <DynamicMeta title="Sản phẩm của shop" noindex />
      <SellerShell active="products" title="Sản phẩm" actions={actions}>
        <main className="tl-shop-page">{children}</main>
      </SellerShell>
    </ShopScrollShell>
  );

  if (membership.isLoading || profile.isLoading) return <LoadingState fullScreen />;

  if (membership.isError || profile.isError) {
    return shell(
      <ErrorState
        onRetry={() => {
          void membership.refetch();
          void profile.refetch();
        }}
      />,
    );
  }

  if (!membership.data || !profile.data) {
    return shell(
      <>
        <h1 className="tl-shop-h1">Chưa có shop</h1>
        <p className="tl-shop-sub">
          Tài khoản này chưa thuộc shop nào. Nếu anh/chị vừa được duyệt, thử tải lại trang.
        </p>
      </>,
    );
  }

  const addButton =
    canWrite && !shopBlocked ? (
      <Link to="/seller/products/new" className="tl-shop-btn tl-shop-btn--sm tl-shop-btn--primary">
        <Plus size={15} aria-hidden="true" />
        Thêm
      </Link>
    ) : undefined;

  return shell(
    <>
      <h1 className="tl-shop-h1">Sản phẩm</h1>
      <p className="tl-shop-sub">
        Danh mục của shop. Người mua chỉ thấy sản phẩm đã duyệt và đang bật bán — trang mua hàng
        chưa mở trong giai đoạn này.
      </p>

      {!canWrite && (
        <div className="tl-shop-notice tl-shop-notice--info" role="status">
          Vai trò <strong>{membership.data.role}</strong> chỉ xem được danh mục. Chủ shop hoặc quản
          lý mới thêm và sửa sản phẩm.
        </div>
      )}

      {shopBlocked && (
        <div className="tl-shop-notice tl-shop-notice--warn" role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{SHOP_STATE_NOTICE[shopState!] ?? `Shop đang ở trạng thái ${shopState}.`}</span>
        </div>
      )}

      <section aria-labelledby="sec-filters">
        <h2 id="sec-filters" className="tl-shop-sr">
          Tìm và lọc
        </h2>

        <div className="tl-shop-searchfield" style={{ marginBottom: 14 }}>
          <label htmlFor="prod-q" className="tl-shop-sr">
            Tìm trong sản phẩm của shop
          </label>
          <Search size={17} aria-hidden="true" />
          <input
            id="prod-q"
            type="search"
            value={searchInput}
            placeholder="Tìm theo tên sản phẩm"
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <div className="tl-shop-cats" role="group" aria-label="Lọc theo trạng thái">
          <button
            type="button"
            className="tl-shop-cat"
            aria-current={filters.status === "all" ? "page" : undefined}
            onClick={() => setFilter({ status: "all" })}
          >
            Tất cả ({Object.values(counts.data ?? {}).reduce((n, v) => n + (v ?? 0), 0)})
          </button>
          {PRODUCT_STATUS_ORDER.map((status) => (
            <button
              key={status}
              type="button"
              className="tl-shop-cat"
              aria-current={filters.status === status ? "page" : undefined}
              onClick={() => setFilter({ status })}
            >
              {PRODUCT_STATUS_LABEL[status]} ({counts.data?.[status] ?? 0})
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
          <div className="tl-shop-field" style={{ flex: "1 1 200px", marginBottom: 0 }}>
            <label className="tl-shop-label" htmlFor="prod-cat">
              Ngành hàng
            </label>
            <select
              id="prod-cat"
              className="tl-shop-select"
              value={filters.category}
              onChange={(e) => setFilter({ category: e.target.value })}
            >
              <option value="all">Tất cả ngành hàng</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name_vi}
                </option>
              ))}
            </select>
          </div>
          <div className="tl-shop-field" style={{ flex: "1 1 200px", marginBottom: 0 }}>
            <label className="tl-shop-label" htmlFor="prod-sort">
              Sắp xếp
            </label>
            <select
              id="prod-sort"
              className="tl-shop-select"
              value={filters.sort}
              onChange={(e) => setFilter({ sort: e.target.value as ProductSort })}
            >
              {(Object.keys(PRODUCT_SORTS) as ProductSort[]).map((key) => (
                <option key={key} value={key}>
                  {PRODUCT_SORTS[key].label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section aria-labelledby="sec-list" style={{ marginTop: 20 }}>
        <h2 id="sec-list" className="tl-shop-sr">
          Danh sách sản phẩm
        </h2>
        <ProductList
          query={list}
          filters={filters}
          catalogEmpty={catalogEmpty}
          canWrite={canWrite && !shopBlocked}
          onClearFilters={() => {
            setSearchInput("");
            setFilters(EMPTY_FILTERS);
          }}
          onPage={(page) => setFilters((f) => ({ ...f, page }))}
        />
      </section>
    </>,
    addButton,
  );
}

// ─── List body ──────────────────────────────────────────────────────────────

function ProductList({
  query,
  filters,
  catalogEmpty,
  canWrite,
  onClearFilters,
  onPage,
}: {
  query: ReturnType<typeof useSellerProducts>;
  filters: ProductListFilters;
  catalogEmpty: boolean;
  canWrite: boolean;
  onClearFilters: () => void;
  onPage: (page: number) => void;
}) {
  if (query.isLoading) {
    return (
      <div aria-busy="true" aria-live="polite">
        <p className="tl-shop-hint">Đang tải danh sách sản phẩm…</p>
        {[0, 1, 2].map((i) => (
          <div key={i} className="tl-shop-sk" style={{ height: 76, borderRadius: 10, marginBottom: 10 }} />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="tl-shop-notice tl-shop-notice--danger" role="alert">
        <AlertTriangle size={16} aria-hidden="true" />
        <div>
          <strong>Chưa tải được danh sách sản phẩm.</strong>{" "}
          {shopErrorMessage(query.error)} Sản phẩm của anh/chị không mất đi đâu cả.
          <div style={{ marginTop: 10 }}>
            <button type="button" className="tl-shop-btn tl-shop-btn--sm" onClick={() => void query.refetch()}>
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  const result = query.data;
  if (!result) return null;

  // Two different empties, two different answers. "Không tìm thấy" on a shop
  // with no products at all sends the seller looking for a filter they never set.
  if (result.total === 0 && catalogEmpty) {
    return (
      <div className="tl-shop-empty">
        <p className="tl-shop-empty-title">Chưa có sản phẩm nào</p>
        <p>Một sản phẩm cần tên, ngành hàng và giá là lưu được. Ảnh thêm sau.</p>
        {canWrite && (
          <Link to="/seller/products/new" className="tl-shop-btn tl-shop-btn--primary">
            Đăng sản phẩm đầu tiên
          </Link>
        )}
      </div>
    );
  }

  if (result.total === 0) {
    return (
      <div className="tl-shop-empty">
        <p className="tl-shop-empty-title">Không có sản phẩm nào khớp</p>
        <p>
          {hasActiveFilter(filters)
            ? "Bỏ bộ lọc trạng thái, ngành hàng hoặc xoá từ khoá để xem lại tất cả."
            : "Danh mục trống ở trang này."}
        </p>
        <button type="button" className="tl-shop-btn" onClick={onClearFilters}>
          Xoá bộ lọc
        </button>
      </div>
    );
  }

  const from = filters.page * PAGE_SIZE + 1;
  const to = Math.min(result.total, from + result.rows.length - 1);

  return (
    <>
      <p className="tl-shop-count" role="status">
        {result.total === result.rows.length && filters.page === 0
          ? `${result.total} sản phẩm`
          : `${from}–${to} trên ${result.total} sản phẩm`}
      </p>

      {/* Desktop table */}
      <div className="tl-shop-tablewrap" tabIndex={0} data-desktop-only style={{ marginTop: 10 }}>
        <table className="tl-shop-table">
          <caption className="tl-shop-sr">Sản phẩm của shop</caption>
          <thead>
            <tr>
              <th scope="col">Sản phẩm</th>
              <th scope="col">Trạng thái</th>
              <th scope="col">Giá</th>
              <th scope="col">Tồn kho</th>
              <th scope="col">Cập nhật</th>
              <th scope="col">
                <span className="tl-shop-sr">Hành động</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => (
              <ProductTableRow key={row.id} row={row} canWrite={canWrite} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards.
          No inline `display` here: [data-mobile-only] is what switches these
          on and off, and an inline display wins over the media query — which
          is exactly how the card list ended up rendering underneath the
          desktop table at 1440px, caught by the QA sweep. */}
      <ul data-mobile-only style={{ listStyle: "none", margin: "10px 0 0", padding: 0 }}>
        {result.rows.map((row) => (
          <ProductCard key={row.id} row={row} canWrite={canWrite} />
        ))}
      </ul>

      {result.pageCount > 1 && (
        <nav aria-label="Phân trang" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
          <button
            type="button"
            className="tl-shop-btn tl-shop-btn--sm"
            disabled={filters.page === 0}
            onClick={() => onPage(filters.page - 1)}
          >
            Trang trước
          </button>
          <span className="tl-shop-hint" style={{ marginTop: 0 }}>
            Trang {filters.page + 1} / {result.pageCount}
          </span>
          <button
            type="button"
            className="tl-shop-btn tl-shop-btn--sm"
            disabled={filters.page + 1 >= result.pageCount}
            onClick={() => onPage(filters.page + 1)}
          >
            Trang sau
          </button>
        </nav>
      )}
    </>
  );
}

/** The photo slot. It never pretends: step 6 owns uploading, and the private
 *  draft bucket needs a signed URL nobody is minting yet, so a product with no
 *  photo says it has no photo. */
const Thumb = ({ count }: { count: number }) => (
  <span
    className="tl-shop-media"
    aria-hidden="true"
    style={{ display: "grid", placeItems: "center", width: "100%" }}
  >
    {count === 0 ? <ImageOff size={18} /> : <span className="tl-shop-media-label">{count} ảnh</span>}
  </span>
);

const StatusPill = ({ status }: { status: ProductStatus }) => (
  <span
    className={`tl-shop-pill tl-shop-pill--${PRODUCT_STATUS_TONE[status]}`}
    title={PRODUCT_STATUS_HINT[status]}
  >
    {PRODUCT_STATUS_LABEL[status]}
  </span>
);

const dmy = (iso: string) =>
  new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

function ProductTableRow({ row, canWrite }: { row: SellerProductRow; canWrite: boolean }) {
  const s = summarise(row);
  return (
    <tr>
      <th scope="row" style={{ fontWeight: 550, maxWidth: 320 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ width: 44, flex: "none" }}>
            <Thumb count={s.mediaCount} />
          </span>
          <span>
            {row.title}
            {s.mediaCount === 0 && (
              <span className="tl-shop-hint" style={{ marginTop: 2 }}>
                Chưa có ảnh
              </span>
            )}
          </span>
        </div>
      </th>
      <td>
        <StatusPill status={row.status} />
        {row.applicant_note && (
          <p className="tl-shop-hint" style={{ marginTop: 4, maxWidth: 280 }}>
            {row.applicant_note}
          </p>
        )}
      </td>
      <td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{s.price}</td>
      <td style={{ fontVariantNumeric: "tabular-nums" }}>{s.stock}</td>
      <td style={{ whiteSpace: "nowrap" }}>{dmy(row.updated_at)}</td>
      <td>
        {/* Everyone gets a link; what it opens is decided by state and role
            inside the editor, and by the database regardless. */}
        <Link to={`/seller/products/${row.id}/edit`} className="tl-shop-btn tl-shop-btn--sm">
          {canWrite && s.canEdit ? "Sửa" : "Xem"}
        </Link>
      </td>
    </tr>
  );
}

function ProductCard({ row, canWrite }: { row: SellerProductRow; canWrite: boolean }) {
  const s = summarise(row);
  const action = canWrite && s.canEdit ? "Sửa" : "Xem";
  return (
    <li className="tl-shop-card" style={{ display: "flex", gap: 12, marginBottom: 10 }}>
      <span style={{ width: 56, flex: "none" }}>
        <Thumb count={s.mediaCount} />
      </span>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {/* ONE interactive element per card, and it is the title.
            The card is not itself an anchor — a card-sized link with buttons
            inside it nests interactive elements and a screen reader reads the
            buttons as part of the link text. And a second "Sửa" button below
            pointing at the same URL is one more thing to tab past for no new
            destination, so the title carries the whole 44px target instead. */}
        <Link
          to={`/seller/products/${row.id}/edit`}
          aria-label={`${action} sản phẩm ${row.title}`}
          style={{
            fontSize: 14,
            fontWeight: 600,
            lineHeight: 1.35,
            color: "inherit",
            display: "flex",
            alignItems: "center",
            minHeight: 44,
          }}
        >
          {row.title}
        </Link>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <StatusPill status={row.status} />
          {s.mediaCount === 0 && <span className="tl-shop-pill tl-shop-pill--muted">Chưa có ảnh</span>}
        </div>
        <div className="tl-shop-hint" style={{ marginTop: 0 }}>
          {s.price} · Tồn kho: {s.stock} · Cập nhật {dmy(row.updated_at)}
        </div>
        {row.applicant_note && (
          <p className="tl-shop-hint" style={{ marginTop: 0, color: "var(--shop-danger)" }}>
            {row.applicant_note}
          </p>
        )}
        {s.nextAction && (
          <p className="tl-shop-hint" style={{ marginTop: 0 }}>
            {s.nextAction}
          </p>
        )}
      </div>
    </li>
  );
}
