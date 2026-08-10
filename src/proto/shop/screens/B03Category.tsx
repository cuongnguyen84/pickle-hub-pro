// ============================================================================
// B03 — Category catalogue /shop/category/:slug
// ----------------------------------------------------------------------------
// Acceptance: every key displayed product attribute has a corresponding useful
// facet, or a documented reason not to. That audit is rendered at
// ?variant=coverage rather than kept in a doc, so it stays honest when the
// attribute list changes.
// ============================================================================

import { useMemo, useState } from "react";
import { useParams, useSearchParams, useLocation } from "react-router-dom";
import { readScenario, readVariant } from "../scenario";
import { BuyerShell } from "../components/Shells";
import { ProductCard, CategoryShortcut } from "../components/Primitives";
import {
  FacetList,
  AppliedFilterChips,
  SortControl,
  ResultCount,
  FilterSheet,
  FilterSheetTrigger,
  toggleApplied,
  type Applied,
  type Facet,
} from "../components/SearchFilters";
import { PADDLE_FACETS } from "./F05Search";
import { LoadingGrid, ErrorState, EmptyState } from "../components/States";
import { CATEGORIES, PRODUCTS, buyableProducts, type CategorySlug } from "../fixtures";

/** Attribute shown on a paddle card/detail → the facet that filters it. */
const PADDLE_COVERAGE: { attr: string; facet: string | null; reason?: string }[] = [
  { attr: "Trọng lượng", facet: "Trọng lượng" },
  { attr: "Độ dày mặt vợt", facet: "Độ dày mặt vợt" },
  { attr: "Chất liệu mặt", facet: "Chất liệu mặt" },
  { attr: "Lõi", facet: "Lõi" },
  { attr: "Dáng vợt", facet: "Dáng vợt" },
  { attr: "Chu vi cán", facet: "Chu vi cán" },
  { attr: "Lối chơi phù hợp", facet: "Lối chơi" },
  { attr: "Tình trạng (mới / đã dùng)", facet: "Tình trạng" },
  { attr: "Người bán đã xác minh", facet: "Người bán" },
  { attr: "Còn hàng", facet: "Tình trạng bán" },
  {
    attr: "Giá",
    facet: null,
    reason:
      "Cố ý chưa có. Với dưới ~50 sản phẩm, thanh trượt giá lọc ra tập rỗng nhiều hơn là giúp ích. Sắp xếp theo giá đã đủ. Thêm lại khi một danh mục vượt 50 sản phẩm.",
  },
  {
    attr: "Thương hiệu",
    facet: null,
    reason:
      "Chưa có trường thương hiệu chuẩn hoá. Người bán tự gõ tên vào tiêu đề, nên bộ lọc thương hiệu sẽ sai. Cần trường riêng trước khi làm.",
  },
  {
    attr: "Gửi từ (tỉnh/thành)",
    facet: null,
    reason:
      "Đáng làm nhưng chờ đủ người bán ở nhiều tỉnh. Hiện 3 shop ở 3 thành phố — lọc theo tỉnh chỉ còn 1 shop mỗi lựa chọn.",
  },
];

const CATEGORY_FACETS: Partial<Record<CategorySlug, Facet[]>> = {
  vot: PADDLE_FACETS,
  giay: [
    {
      key: "size",
      label: "Size",
      options: [
        { value: "38", label: "38", count: 2 },
        { value: "39", label: "39", count: 3 },
        { value: "40", label: "40", count: 3 },
        { value: "41", label: "41", count: 2 },
      ],
    },
    {
      key: "mau",
      label: "Màu",
      options: [
        { value: "trang", label: "Trắng", count: 3 },
        { value: "den", label: "Đen", count: 3 },
      ],
    },
    {
      key: "be-mat",
      label: "Bề mặt sân",
      options: [
        { value: "ngoai-troi", label: "Sân cứng ngoài trời", count: 4 },
        { value: "trong-nha", label: "Sân trong nhà", count: 1 },
      ],
    },
  ],
};

const DEFAULT_FACETS: Facet[] = [
  {
    key: "tinh-trang",
    label: "Tình trạng",
    options: [
      { value: "moi", label: "Mới", count: 4 },
      { value: "cu", label: "Đã qua sử dụng", count: 1 },
    ],
  },
];

export default function B03Category() {
  const { slug } = useParams();
  const location = useLocation();
  const scenario = readScenario(location.search);
  const variant = readVariant(location.search);
  const [sp, setSp] = useSearchParams();
  const [sheetOpen, setSheetOpen] = useState(false);

  const cat = CATEGORIES.find((c) => c.slug === slug) ?? CATEGORIES[0];
  const facets = CATEGORY_FACETS[cat.slug] ?? DEFAULT_FACETS;

  const applied: Applied = useMemo(() => {
    const out: Applied = {};
    for (const f of facets) {
      const v = sp.getAll(f.key);
      if (v.length) out[f.key] = v;
    }
    return out;
  }, [sp, facets]);

  const write = (next: Applied) => {
    const p = new URLSearchParams(sp);
    for (const f of facets) p.delete(f.key);
    for (const [k, vals] of Object.entries(next)) for (const v of vals) p.append(k, v);
    setSp(p);
  };

  const results =
    scenario === "empty"
      ? []
      : (scenario === "suspended" ? PRODUCTS.filter((p) => p.status === "active") : buyableProducts()).filter(
          (p) => p.category === cat.slug,
        );

  if (variant === "coverage") {
    return (
      <BuyerShell title={cat.name} backTo="/proto/shop/home">
        <main className="tl-shop-page tl-shop-page--narrow">
          <p className="tl-shop-eyebrow">B03 · đối chiếu thuộc tính ↔ bộ lọc</p>
          <h1 className="tl-shop-h1">Vợt: mỗi thuộc tính hiển thị có bộ lọc tương ứng chưa?</h1>
          <p className="tl-shop-sub">
            Ghi chú thiết kế, không phải nội dung người mua thấy.
          </p>
          <div className="tl-shop-tablewrap">
            <table className="tl-shop-table">
              <thead>
                <tr>
                  <th scope="col">Thuộc tính hiển thị</th>
                  <th scope="col">Bộ lọc</th>
                </tr>
              </thead>
              <tbody>
                {PADDLE_COVERAGE.map((c) => (
                  <tr key={c.attr}>
                    <td style={{ fontWeight: 600 }}>{c.attr}</td>
                    <td>
                      {c.facet ? (
                        <span className="tl-shop-pill tl-shop-pill--ok">{c.facet}</span>
                      ) : (
                        <>
                          <span className="tl-shop-pill tl-shop-pill--muted">Cố ý chưa có</span>
                          <p className="tl-shop-hint">{c.reason}</p>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </BuyerShell>
    );
  }

  return (
    <BuyerShell title={cat.name} backTo="/proto/shop/home">
      <main className="tl-shop-page">
        <h1 className="tl-shop-h1">{cat.name}</h1>
        <p className="tl-shop-sub">
          {cat.slug === "vot"
            ? "Lọc theo trọng lượng, độ dày mặt và lối chơi. Nếu chưa quen, bắt đầu từ 16mm cho lối kiểm soát."
            : `Tất cả ${cat.name.toLowerCase()} đang bán trên ThePickleHub.`}
        </p>

        <nav aria-label="Danh mục khác" style={{ marginBottom: 16 }}>
          <div className="tl-shop-cats">
            {CATEGORIES.map((c) => (
              <CategoryShortcut key={c.slug} slug={c.slug} name={c.name} current={c.slug === cat.slug} />
            ))}
          </div>
        </nav>

        <div className="tl-shop-toolbar">
          <FilterSheetTrigger onOpen={() => setSheetOpen(true)} applied={applied} />
          <SortControl value={sp.get("sort") ?? "moi-nhat"} onChange={(v) => {
            const p = new URLSearchParams(sp);
            p.set("sort", v);
            setSp(p);
          }} />
          <span className="tl-proto-spacer" />
          <ResultCount count={results.length} />
        </div>

        <AppliedFilterChips
          facets={facets}
          applied={applied}
          onRemove={(k, v) => write(toggleApplied(applied, k, v))}
          onClearAll={() => write({})}
        />

        <div className="tl-shop-results">
          <aside className="tl-shop-rail" aria-label="Bộ lọc">
            <FacetList
              facets={facets}
              applied={applied}
              onToggle={(k, v) => write(toggleApplied(applied, k, v))}
              idPrefix="b03"
            />
          </aside>
          <div>
            {scenario === "slow" ? (
              <LoadingGrid />
            ) : scenario === "error" ? (
              <ErrorState
                what="Chưa tải được danh mục này."
                recovery="Bộ lọc của anh/chị vẫn còn trên thanh địa chỉ, bấm Thử lại là chạy tiếp."
              />
            ) : results.length === 0 ? (
              <EmptyState title={`Chưa có ${cat.name.toLowerCase()} nào đang bán`}>
                Bỏ bớt bộ lọc, hoặc xem danh mục khác ở trên.
              </EmptyState>
            ) : (
              <div className="tl-shop-grid">
                {results.map((p) => (
                  <ProductCard key={p.id} product={p} onToggleSave={() => {}} />
                ))}
              </div>
            )}
          </div>
        </div>

        <FilterSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          count={results.length}
          onClear={() => write({})}
        >
          <FacetList
            facets={facets}
            applied={applied}
            onToggle={(k, v) => write(toggleApplied(applied, k, v))}
            idPrefix="b03s"
          />
        </FilterSheet>
      </main>
    </BuyerShell>
  );
}
