// ============================================================================
// /shop/store/:slug — prototype B06 in production.
// ----------------------------------------------------------------------------
// Rendered from an allowlist built in Postgres (shop_public_shop). Every
// private profile field, the application, the owner's identity and the city
// are absent by construction rather than by this page remembering not to print
// them — B06's acceptance criterion.
//
// A suspended shop answers exactly like one that never existed, and so does
// its retired slug. Anything else confirms which shops are real.
// ============================================================================

import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { BadgeCheck, ExternalLink, Package, Phone } from "lucide-react";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { usePublicSearch, usePublicShopPage } from "@/hooks/shop/usePublicShop";
import { ResultsGrid } from "@/components/shop/CatalogResults";
import { ShopMonogram } from "@/components/shop/ShopMonogram";
import { ShopCartLink } from "@/components/shop/CartLink";
import { publicMediaUrl } from "@/lib/shop/publicCatalog";
import {
  CONTACT_LABEL,
  NO_CONTACT_COPY,
  contactHref,
  usableContacts,
  type PublicContact,
} from "@/lib/shop/contactCta";
import "@/styles/shop.css";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";

/** focal_y arrives from the server 0..1, but the style is built here — clamp
 *  defensively so a bad value degrades to a legal position, not broken CSS. */
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export default function ShopStore() {
  const { slug } = useParams<{ slug: string }>();
  const [params, setParams] = useSearchParams();
  const q = usePublicShopPage(slug ?? null);

  const catalog = usePublicSearch(
    {
      shopSlug: slug ?? null,
      cursorAt: params.get("after"),
      cursorId: params.get("after_id"),
    },
    !!slug && q.data?.found === true,
  );

  if (q.isLoading) {
    // R5 #6: a bare centred spinner told the buyer nothing about what is
    // coming. The skeleton is the storefront header's own shape — monogram,
    // name, one meta line — so the page does not jump when the data lands.
    return (
      <TheLineLayout title="Shop">
        <DynamicMeta title="Shop" noindex />
        <main className="tl-shop">
          <div className="tl-shop-page" aria-busy="true" aria-label="Đang tải trang shop">
            <div className="tl-shop-storehead-row">
              <span className="tl-shop-sk" style={{ width: 72, height: 72, borderRadius: 20, flex: "none" }} />
              <div className="tl-shop-grow">
                <span className="tl-shop-sk tl-shop-sk--title" />
                <span className="tl-shop-sk tl-shop-sk--line" style={{ width: "45%" }} />
              </div>
            </div>
            <span className="tl-shop-sk tl-shop-sk--line" style={{ width: "80%" }} />
          </div>
        </main>
      </TheLineLayout>
    );
  }

  if (q.data && !q.data.found && q.data.redirect_to) {
    return <Navigate to={`/shop/store/${q.data.redirect_to}`} replace />;
  }

  const shop = q.data?.shop;
  if (!shop) {
    // Suspended, closed, or never existed — one answer for all three.
    return (
      <TheLineLayout title="Không tìm thấy shop">
        <DynamicMeta title="Không tìm thấy shop" noindex />
        <main className="tl-shop">
          <div className="tl-shop-page">
            <h1 className="tl-shop-h1">Không tìm thấy shop này</h1>
            <p className="tl-shop-sub">Có thể shop đã đổi đường dẫn hoặc không còn hoạt động.</p>
            <Link to="/shop" className="tl-shop-btn">Về trang chợ</Link>
          </div>
        </main>
      </TheLineLayout>
    );
  }

  const contacts = usableContacts(q.data?.contacts as PublicContact[] | undefined);
  const rows = catalog.data?.rows ?? [];

  return (
    <TheLineLayout title={shop.name}>
      {/* Phase 4: robots is decided at the edge by SHOP_PUBLIC_INDEXING. The
          loading and not-found branches above keep theirs. */}
      <DynamicMeta title={shop.name} description={shop.intro ?? undefined} />
      <main className="tl-shop">
        <div className="tl-shop-page tl-shop-has-fab">
        <div className="tl-shop-topline">
          {/* Last crumb = the <h1> below it, so it is dropped (R5 #14). */}
          <nav aria-label="Đường dẫn" className="tl-shop-crumbs">
            <Link to="/shop" className="tl-crumb">Chợ</Link>
          </nav>
          <ShopCartLink floating />
        </div>

        <header className="tl-shop-storehead">
          {/* No published cover → no banner DOM at all: the R3 layout stands
              unchanged until the seller actually publishes one. */}
          {shop.cover_path && (
            <img
              src={publicMediaUrl(SUPABASE_URL, shop.cover_path)}
              alt=""
              className="tl-shop-storehead-cover"
              style={{
                objectPosition: `50% ${clamp01(shop.cover_focal_y ?? 0.5) * 100}%`,
              }}
            />
          )}
          <div className="tl-shop-storehead-row">
            {shop.logo_path ? (
              <img
                src={publicMediaUrl(SUPABASE_URL, shop.logo_path)}
                alt={`Logo shop ${shop.name}`}
                width={72}
                height={72}
                className="tl-shop-storehead-logo"
              />
            ) : (
              <ShopMonogram name={shop.name} size={72} />
            )}
            <div className="tl-shop-storehead-id">
              <h1 className="tl-shop-h1">{shop.name}</h1>
              <div className="tl-shop-storehead-pills">
                {shop.verified && (
                  <span className="tl-shop-pill tl-shop-pill--info">
                    <BadgeCheck size={13} aria-hidden="true" />
                    Đã xác minh
                    <span className="tl-shop-sr">bởi ThePickleHub</span>
                  </span>
                )}
                <span className="tl-shop-storehead-meta">
                  {shop.product_count} sản phẩm
                  {shop.region && ` · ${shop.region}`}
                </span>
              </div>
            </div>
          </div>
          {shop.intro && (
            <p className="tl-shop-sub tl-shop-storehead-intro">{shop.intro}</p>
          )}
        </header>

        {contacts.length > 0 && (
          <section aria-label="Liên hệ" className="tl-shop-section">
            {/* R5 #12 — one horizontal row of SECONDARY buttons. Green is for
                buying, and it is the same decision on the product page. */}
            <div className="tl-shop-contactrow">
              {contacts.map((c) => {
                const href = contactHref(c)!;
                return (
                  <a
                    key={c.id}
                    href={href}
                    className="tl-shop-btn"
                    target={c.type === "phone" ? undefined : "_blank"}
                    rel="noopener noreferrer nofollow"
                  >
                    {c.type === "phone" ? (
                      <Phone size={15} aria-hidden="true" />
                    ) : (
                      <ExternalLink size={15} aria-hidden="true" />
                    )}
                    {CONTACT_LABEL[c.type]}
                  </a>
                );
              })}
            </div>
            <p className="tl-shop-hint tl-shop-flush-b">
              Bấm sẽ mở ứng dụng ngoài — anh/chị rời ThePickleHub.
            </p>
          </section>
        )}

        <section aria-labelledby="store-catalog" className="tl-shop-section">
          <h2 className="tl-shop-h2" id="store-catalog">Sản phẩm</h2>
          <ResultsGrid
            rows={rows}
            total={catalog.data?.total ?? 0}
            hideSparseNote
            isLoading={catalog.isLoading}
            isError={catalog.isError}
            onRetry={() => void catalog.refetch()}
            emptyTitle="Shop chưa đăng bán sản phẩm nào"
            emptyBody="Quay lại sau, hoặc liên hệ shop để hỏi trực tiếp."
            emptyIcon={<Package size={28} aria-hidden="true" />}
          />
          {catalog.data?.has_more && rows.length > 0 && (
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
        </section>

        {/* Every honest sentence from the old above-the-fold blocks, verbatim,
            as a footer — moved, not deleted. */}
        <footer className="tl-shop-storefoot">
          <h2 className="tl-shop-h2">Thông tin shop</h2>
          <dl className="tl-shop-deflist">
            {shop.region && (
              <div><dt>Khu vực</dt><dd>{shop.region}</dd></div>
            )}
            {shop.shipping_note && <div><dt>Giao hàng</dt><dd>{shop.shipping_note}</dd></div>}
            {shop.return_note && <div><dt>Đổi trả</dt><dd>{shop.return_note}</dd></div>}
            <div>
              <dt>Xác minh</dt>
              <dd>
                {shop.verified
                  ? "ThePickleHub đã xác minh shop này — đối chiếu giấy tờ hoặc gặp trực tiếp người bán."
                  : "Shop chưa được ThePickleHub xác minh."}
              </dd>
            </div>
          </dl>
          <p className="tl-shop-hint">
            Chính sách giao hàng và đổi trả do shop tự khai.
          </p>
          {contacts.length === 0 && <p className="tl-shop-hint">{NO_CONTACT_COPY}</p>}
        </footer>
        </div>
      </main>
    </TheLineLayout>
  );
}
