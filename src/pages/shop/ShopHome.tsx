// ============================================================================
// /shop — prototype B01 in production.
// ----------------------------------------------------------------------------
// Search box and categories first; no marketing hero. On a 320px phone the
// first product card is already peeking above the fold, which was B01's
// acceptance criterion and is the only reason a catalogue home exists.
//
// The catalogue is genuinely small during the pilot, so the page says so
// instead of padding itself with sections. There is no "bán chạy" (no sales
// data), no "sắp hết" (no reservation model), and no carousel.
// ============================================================================

import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Search } from "lucide-react";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { usePublicCategories, usePublicSearch } from "@/hooks/shop/usePublicShop";
import { CategoryChips, ResultsGrid } from "@/components/shop/CatalogResults";
import "@/styles/shop.css";

export default function ShopHome() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const categories = usePublicCategories();
  // The home grid is the same query the search page runs, with no arguments.
  const latest = usePublicSearch({ limit: 12 });

  return (
    <TheLineLayout title="Chợ đồ pickleball">
      {/* Q4: the pilot catalogue is not indexed. Server-rendered robots come
          from the Pages Function; this is the SPA half of the same answer. */}
      <DynamicMeta title="Chợ đồ pickleball" noindex />
      <main className="tl-shop">
        <h1 className="tl-shop-h1">Chợ đồ pickleball</h1>
        {/* R3: tighter sub — every vertical px here pushes the first card
            below the 320px fold (B01). */}
        <p className="tl-shop-sub" style={{ marginBottom: 12, fontSize: 13.5 }}>
          {/* Wave 0: the pilot does not collect papers, so "đã xác minh giấy
              tờ" was a claim about diligence nobody performed — the exact
              class of overstatement the Seller Rules exist to prevent. Say
              what actually happens. */}
          Vợt, giày, bóng và phụ kiện từ những shop được ThePickleHub duyệt hồ sơ và kiểm duyệt từng sản phẩm.
        </p>

        <form
          role="search"
          className="tl-shop-searchfield"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(`/shop/search?q=${encodeURIComponent(q.trim())}`);
          }}
        >
          <label htmlFor="shop-home-q" className="tl-shop-sr">Tìm sản phẩm</label>
          <Search size={15} aria-hidden="true" />
          <input
            id="shop-home-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm vợt, giày, bóng…"
            style={{ fontSize: 16 }}
          />
          <button type="submit" className="tl-shop-btn tl-shop-btn--primary">
            Tìm
          </button>
        </form>

        {/* No "Ngành hàng" heading — the chips are self-evident and the
            CategoryChips group already carries the aria-label. */}
        <section style={{ marginTop: 14 }}>
          {categories.isLoading ? (
            <div className="tl-shop-cats" aria-busy="true" aria-label="Đang tải ngành hàng">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="tl-shop-sk" style={{ width: 88, height: 44, borderRadius: 999, flex: "none" }} />
              ))}
            </div>
          ) : (
            <CategoryChips
              categories={categories.data ?? []}
              active={null}
              onPick={(slug) => slug && navigate(`/shop/category/${slug}`)}
            />
          )}
        </section>

        <section aria-labelledby="shop-latest">
          <h2 className="tl-shop-h2" id="shop-latest">Mới đăng</h2>
          <ResultsGrid
            rows={latest.data?.rows ?? []}
            total={latest.data?.total ?? 0}
            isLoading={latest.isLoading}
            isError={latest.isError}
            onRetry={() => void latest.refetch()}
            emptyTitle="Chưa có sản phẩm nào đang bán"
            emptyBody="Sàn đang ở giai đoạn thử nghiệm với vài shop đầu tiên. Quay lại sau nhé."
            emptyAction={
              <p className="tl-shop-hint">
                Anh/chị có đồ pickleball muốn bán? <Link to="/shop/sell">Tìm hiểu cách mở shop</Link>
              </p>
            }
          />
        </section>
      </main>
    </TheLineLayout>
  );
}
