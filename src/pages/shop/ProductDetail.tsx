// ============================================================================
// /shop/product/:slug — prototype B04 + B05 in production.
// ----------------------------------------------------------------------------
// Reads shop_public_product(slug): one call that answers "here it is", "it
// moved" or "there is nothing", and answers the last two identically for a
// draft and for a slug nobody ever used.
//
// P2b has no cart. The primary action is "Liên hệ shop" (D2), and when there
// is no approved channel the page says so rather than showing a disabled
// button that means nothing.
//
// Everything before the CTA is what B04 was accepted on: seller and
// verification, the selected variant and its SKU, the price, where it ships
// from and the return note. A buyer should not have to scroll past the action
// to find out who they are buying from.
// ============================================================================

import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { BadgeCheck, ExternalLink, Phone } from "lucide-react";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { LoadingState } from "@/components/states/PageStates";
import { usePublicProduct } from "@/hooks/shop/usePublicShop";
import {
  CONDITION_LABEL,
  availabilityLabel,
  formatVnd,
  mediaBox,
  publicMediaUrl,
} from "@/lib/shop/publicCatalog";
import {
  activeMediaId,
  displayPrice,
  initialSelection,
  optionState,
  pickOption,
  resolveVariant,
  type OptionGroup,
  type PublicVariant,
  type Selection,
} from "@/lib/shop/variantSelection";
import {
  CONTACT_DESTINATION,
  CONTACT_LABEL,
  NO_CONTACT_COPY,
  contactAnalyticsPayload,
  contactHref,
  usableContacts,
  type PublicContact,
} from "@/lib/shop/contactCta";
import "@/styles/shop.css";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";

interface PublicProduct {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  condition: "new" | "used";
  category: { slug: string; name: string } | null;
  shop: {
    slug: string; name: string; region: string | null; verified: boolean;
    shipping_note: string | null; return_note: string | null;
  };
  option_groups: OptionGroup[];
  variants: PublicVariant[];
  media: { id: string; public_path: string; alt_text: string | null; width: number | null; height: number | null }[];
  primary_media_id: string | null;
}

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const q = usePublicProduct(slug ?? null);
  const [selection, setSelection] = useState<Selection | null>(null);

  const product = (q.data?.product ?? null) as PublicProduct | null;
  const contacts = usableContacts(q.data?.contacts as PublicContact[] | undefined);

  const groups = product?.option_groups ?? [];
  const variants = product?.variants ?? [];

  const sel = selection ?? (product ? initialSelection(groups, variants) : {});
  const resolved = useMemo(
    () => (product ? resolveVariant(groups, variants, sel) : null),
    [product, groups, variants, sel],
  );
  const price = useMemo(
    () => (product ? displayPrice(variants, sel, resolved) : null),
    [product, variants, sel, resolved],
  );
  const shownMediaId = product
    ? activeMediaId(resolved, variants, sel, product.primary_media_id)
    : null;
  const shown = product?.media.find((m) => m.id === shownMediaId) ?? product?.media[0] ?? null;

  if (q.isLoading) {
    return (
      <TheLineLayout title="Sản phẩm">
        <DynamicMeta title="Sản phẩm" noindex />
        <main className="tl-shop"><LoadingState /></main>
      </TheLineLayout>
    );
  }

  // The server resolved a retired slug. A client redirect is the SPA half; the
  // Pages Function issues the real 301 for a crawler (P2b.6).
  if (q.data && !q.data.found && q.data.redirect_to) {
    return <Navigate to={`/shop/product/${q.data.redirect_to}`} replace />;
  }

  if (!product) {
    return (
      <TheLineLayout title="Không tìm thấy sản phẩm">
        <DynamicMeta title="Không tìm thấy sản phẩm" noindex />
        <main className="tl-shop">
          <h1 className="tl-shop-h1">Không tìm thấy sản phẩm này</h1>
          <p className="tl-shop-sub">
            Có thể sản phẩm đã được gỡ, hoặc đường dẫn không đúng.
          </p>
          <Link to="/shop" className="tl-shop-btn">Về trang chợ</Link>
        </main>
      </TheLineLayout>
    );
  }

  const box = mediaBox(shown?.width ?? null, shown?.height ?? null, 800);

  return (
    <TheLineLayout title={product.title}>
      <DynamicMeta title={product.title} description={product.description ?? undefined} noindex />
      <main className="tl-shop">
        <nav aria-label="Đường dẫn" className="tl-shop-sub tl-shop-crumbs">
          <Link to="/shop" className="tl-crumb">Chợ</Link>
          <span aria-hidden="true" className="tl-crumb-sep">/</span>
          {product.category && (
            <>
              <Link to={`/shop/category/${product.category.slug}`} className="tl-crumb">
                {product.category.name}
              </Link>
              <span aria-hidden="true" className="tl-crumb-sep">/</span>
            </>
          )}
          <span aria-current="page" className="tl-crumb-current">{product.title}</span>
        </nav>

        <div className="tl-pdp">
          <section aria-labelledby="pdp-media-h" className="tl-pdp-media">
            <h2 id="pdp-media-h" className="tl-shop-sr">Ảnh sản phẩm</h2>
            {shown ? (
              <img
                src={publicMediaUrl(SUPABASE_URL, shown.public_path)}
                alt={shown.alt_text ?? product.title}
                width={box.width}
                height={box.height}
                loading="eager"
                decoding="async"
              />
            ) : (
              <div className="tl-pcard-noimg" style={{ aspectRatio: "4 / 3" }} aria-hidden="true" />
            )}

            {product.media.length > 1 && (
              <ul className="tl-pdp-thumbs">
                {product.media.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="tl-pdp-thumb"
                      aria-current={m.id === shownMediaId ? "true" : undefined}
                      aria-label={`Xem ảnh ${m.alt_text ?? ""}`.trim()}
                      onClick={() => {
                        // Picking a thumbnail selects the variant that photo
                        // belongs to, so the price and SKU follow the image
                        // instead of drifting from it.
                        const owner = variants.find((v) => v.media_id === m.id);
                        if (owner?.option_values) setSelection({ ...owner.option_values });
                      }}
                    >
                      <img
                        src={publicMediaUrl(SUPABASE_URL, m.public_path)}
                        alt=""
                        width={64}
                        height={64}
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="pdp-info-h" className="tl-pdp-info">
            <h2 id="pdp-info-h" className="tl-shop-sr">Thông tin sản phẩm</h2>
            <h1 className="tl-shop-h1">{product.title}</h1>

            <p className="tl-pdp-price">
              {price
                ? price.min === price.max
                  ? formatVnd(price.min)
                  : `${formatVnd(price.min)} – ${formatVnd(price.max)}`
                : "Chưa có giá"}
            </p>

            <p className="tl-pdp-meta">
              {CONDITION_LABEL[product.condition]}
              <span aria-hidden="true"> · </span>
              {availabilityLabel(resolved?.availability ?? null)}
              {resolved?.sku && (
                <>
                  <span aria-hidden="true"> · </span>
                  <span>Mã hàng {resolved.sku}</span>
                </>
              )}
            </p>

            {groups.map((g) => (
              <fieldset key={g.name} className="tl-filter-group">
                <legend>{g.name}</legend>
                <div className="tl-pdp-opts">
                  {g.values.map((val) => {
                    const st = optionState(variants, sel, g.name, val);
                    const active = sel[g.name] === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        className="tl-pdp-opt"
                        aria-pressed={active}
                        // A combination the seller never made, or one that is
                        // sold out, is disabled — with the reason in the label
                        // rather than left to the buyer to guess.
                        disabled={!st.exists || !st.available}
                        onClick={() => setSelection(pickOption(groups, variants, sel, g.name, val))}
                      >
                        {val}
                        {st.exists && !st.available && (
                          <span className="tl-shop-sr"> — hết hàng</span>
                        )}
                        {!st.exists && <span className="tl-shop-sr"> — không có lựa chọn này</span>}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}

            {/* Seller, shipping and returns BEFORE the action. */}
            <div className="tl-pdp-seller">
              <p className="tl-pdp-shopname">
                <Link to={`/shop/store/${product.shop.slug}`} className="tl-crumb">
                  {product.shop.name}
                </Link>
                {product.shop.verified && (
                  <>
                    <BadgeCheck size={14} aria-hidden="true" className="tl-pcard-verified" />
                    <span className="tl-shop-sr">shop đã được xác minh giấy tờ</span>
                  </>
                )}
              </p>
              {product.shop.region && <p className="tl-pdp-note">Gửi từ {product.shop.region}</p>}
              {product.shop.shipping_note && <p className="tl-pdp-note">{product.shop.shipping_note}</p>}
              {product.shop.return_note && <p className="tl-pdp-note">{product.shop.return_note}</p>}
              <p className="tl-shop-hint" style={{ marginBottom: 0 }}>
                Thông tin sản phẩm, giá và tình trạng hàng do shop tự khai và tự chịu trách nhiệm.
                ThePickleHub duyệt hồ sơ shop và kiểm duyệt nội dung sản phẩm trước khi hiển thị;
                tình trạng xác minh giấy tờ của shop (nếu có) xem trên trang shop.
              </p>
            </div>

            {/* D2: contact, not cart. */}
            <div className="tl-pdp-cta">
              {contacts.length > 0 ? (
                <>
                  {contacts.map((c) => {
                    const href = contactHref(c)!;
                    return (
                      <a
                        key={c.id}
                        href={href}
                        className="tl-shop-btn tl-shop-btn--primary tl-shop-btn--block"
                        target={c.type === "phone" ? undefined : "_blank"}
                        rel="noopener noreferrer nofollow"
                        onClick={() => {
                          // Type and public ids only. Never the number or URL.
                          void contactAnalyticsPayload(c, product.id, product.shop.slug);
                        }}
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
                  <p className="tl-shop-hint" style={{ marginBottom: 0 }}>
                    {contacts.map((c) => CONTACT_DESTINATION[c.type]).join(" · ")}. ThePickleHub
                    không có tin nhắn nội bộ — anh/chị trao đổi thẳng với shop.
                  </p>
                </>
              ) : (
                <p className="tl-shop-hint" style={{ marginBottom: 0 }}>{NO_CONTACT_COPY}</p>
              )}
            </div>

            {product.description && (
              <section aria-labelledby="pdp-desc">
                <h2 className="tl-shop-h2" id="pdp-desc">Mô tả</h2>
                <p className="tl-pdp-desc">{product.description}</p>
              </section>
            )}
          </section>
        </div>
      </main>
    </TheLineLayout>
  );
}
