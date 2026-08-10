// ============================================================================
// S05 — Seller products /seller/products
// ----------------------------------------------------------------------------
// Desktop gets a table because a seller scans many rows at once. Mobile gets
// cards, because a 6-column table at 375px means horizontal scrolling inside a
// management surface — where a mis-tap edits the wrong product.
// ============================================================================

import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { readScenario } from "../scenario";
import { SellerShell } from "../components/Shells";
import { ProductMedia } from "../components/Primitives";
import { ListingStatusBadge, listingStatusLabel } from "../components/Forms";
import { EmptyState, ErrorState, LoadingLines } from "../components/States";
import { PRODUCTS, vnd, type ProductStatus } from "../fixtures";

const STATUSES: ProductStatus[] = [
  "draft",
  "pending_review",
  "active",
  "needs_changes",
  "restricted",
  "archived",
];

export default function S05Products() {
  const location = useLocation();
  const scenario = readScenario(location.search);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<ProductStatus | "all">("all");

  const mine = useMemo(() => PRODUCTS.filter((p) => p.shopId === "shop-1"), []);
  const rows = useMemo(
    () =>
      mine.filter(
        (p) =>
          (filter === "all" || p.status === filter) &&
          (!q.trim() || p.title.toLowerCase().includes(q.trim().toLowerCase())),
      ),
    [mine, filter, q],
  );

  const counts = useMemo(() => {
    const m = new Map<ProductStatus, number>();
    for (const p of mine) m.set(p.status, (m.get(p.status) ?? 0) + 1);
    return m;
  }, [mine]);

  const body = () => {
    if (scenario === "slow") return <LoadingLines rows={5} />;
    if (scenario === "error")
      return (
        <ErrorState
          what="Chưa tải được danh sách sản phẩm."
          recovery="Sản phẩm của anh/chị không mất đi đâu cả, thử tải lại giúp."
        />
      );
    if (scenario === "empty" || mine.length === 0)
      return (
        <EmptyState
          title="Chưa có sản phẩm nào"
          action={
            <Link to="/proto/shop/seller/products/new" className="tl-shop-btn tl-shop-btn--primary">
              Đăng sản phẩm đầu tiên
            </Link>
          }
        >
          Một sản phẩm chỉ cần tên, giá và một tấm ảnh là đăng được.
        </EmptyState>
      );
    if (rows.length === 0)
      return (
        <EmptyState title="Không có sản phẩm nào khớp bộ lọc">
          Bỏ bộ lọc trạng thái hoặc xoá từ khoá để xem lại tất cả.
        </EmptyState>
      );

    return (
      <>
        {/* Desktop table */}
        <div className="tl-shop-tablewrap" data-desktop-only>
          <table className="tl-shop-table">
            <caption className="tl-shop-sr">Sản phẩm của shop</caption>
            <thead>
              <tr>
                <th scope="col">Sản phẩm</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Giá</th>
                <th scope="col">Tồn kho</th>
                <th scope="col">Phiên bản</th>
                <th scope="col">
                  <span className="tl-shop-sr">Hành động</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <th scope="row" style={{ fontWeight: 550, maxWidth: 320 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ width: 40, flex: "none" }}>
                        <ProductMedia tone={p.media[0]?.tone ?? "a"} label="" />
                      </span>
                      <span>{p.title}</span>
                    </div>
                  </th>
                  <td>
                    <ListingStatusBadge status={p.status} />
                  </td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>
                    {p.priceVnd ? vnd(p.priceVnd) : "—"}
                  </td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>
                    {p.variants.every((v) => v.stock === null)
                      ? "không theo dõi"
                      : p.variants.reduce((n, v) => n + (v.stock ?? 0), 0)}
                  </td>
                  <td>{p.variants.length}</td>
                  <td>
                    <Link to={`/proto/shop/seller/products/${p.id}/edit`} className="tl-shop-btn tl-shop-btn--sm">
                      Sửa
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }} data-mobile-only>
          {rows.map((p) => (
            <li key={p.id} className="tl-shop-card" style={{ display: "flex", gap: 12 }}>
              <span style={{ width: 56, flex: "none" }}>
                <ProductMedia tone={p.media[0]?.tone ?? "a"} label="" />
              </span>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35 }}>{p.title}</div>
                <ListingStatusBadge status={p.status} />
                <div className="tl-shop-hint" style={{ marginTop: 0 }}>
                  {p.priceVnd ? vnd(p.priceVnd) : "chưa đặt giá"} · {p.variants.length} phiên bản
                </div>
                {p.moderationNote && (
                  <p className="tl-shop-hint" style={{ marginTop: 0, color: "var(--shop-danger)" }}>
                    {p.moderationNote}
                  </p>
                )}
                <Link
                  to={`/proto/shop/seller/products/${p.id}/edit`}
                  className="tl-shop-btn tl-shop-btn--sm"
                  style={{ alignSelf: "flex-start" }}
                >
                  Sửa
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </>
    );
  };

  return (
    <SellerShell
      active="products"
      title="Sản phẩm"
      badges={{ products: counts.get("needs_changes") ?? 0 }}
      actions={
        <Link to="/proto/shop/seller/products/new" className="tl-shop-btn tl-shop-btn--sm tl-shop-btn--primary">
          <Plus size={15} aria-hidden="true" />
          Thêm
        </Link>
      }
    >
      <div className="tl-shop-page">
        <h1 className="tl-shop-sr">Sản phẩm của shop</h1>

        <div className="tl-shop-searchfield" style={{ marginBottom: 14 }}>
          <label htmlFor="s05-q" className="tl-shop-sr">
            Tìm trong sản phẩm của shop
          </label>
          <Search size={17} aria-hidden="true" />
          <input
            id="s05-q"
            type="search"
            value={q}
            placeholder="Tìm theo tên sản phẩm"
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="tl-shop-cats" role="group" aria-label="Lọc theo trạng thái">
          <button
            type="button"
            className="tl-shop-cat"
            aria-current={filter === "all" ? "page" : undefined}
            onClick={() => setFilter("all")}
          >
            Tất cả ({mine.length})
          </button>
          {STATUSES.map((st) => (
            <button
              key={st}
              type="button"
              className="tl-shop-cat"
              aria-current={filter === st ? "page" : undefined}
              onClick={() => setFilter(st)}
            >
              {listingStatusLabel(st)} ({counts.get(st) ?? 0})
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>{body()}</div>
      </div>
    </SellerShell>
  );
}
