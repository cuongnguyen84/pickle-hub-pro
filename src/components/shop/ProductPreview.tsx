// ============================================================================
// Seller preview (P2a step 7).
// ----------------------------------------------------------------------------
// Renders the CANONICAL projection — the same product_public_projection() the
// public PDP will read in P2b — so this is a preview of the thing a buyer will
// actually get, not a second rendering of the form state that happens to look
// similar today.
//
// Lazily loaded, and only from the editor. Nothing on the product list or the
// initial path pulls it in.
//
// The differences from a real PDP are the ones that must exist and no others:
// a banner saying it is a preview, a buy button that cannot buy, and signed
// URLs for photos that are not public yet. Everything the buyer would read —
// price, availability, options, media order, shipping and return notes — comes
// from the server, unchanged.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, PencilLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { vnd } from "@/lib/shop/productState";
import { SpecList } from "@/components/shop/SpecList";
import type { ProductProjection } from "@/integrations/supabase/shop-schema";

const DRAFT_BUCKET = "shop-product-media-draft";

const AVAILABILITY: Record<string, { label: string; tone: string }> = {
  in_stock: { label: "Còn hàng", tone: "ok" },
  out_of_stock: { label: "Hết hàng", tone: "danger" },
  // Not "còn hàng": the shop does not count this one, and saying it is in
  // stock would be the platform making a promise the shop never made.
  unknown: { label: "Shop chưa cập nhật số lượng", tone: "muted" },
};

/** Short-lived signed URLs, in memory only. Never persisted, never logged. */
function useSignedMedia(paths: string[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = paths.join("|");
  useEffect(() => {
    let cancelled = false;
    if (!paths.length) return;
    void supabase.storage
      .from(DRAFT_BUCKET)
      .createSignedUrls(paths, 300)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const next: Record<string, string> = {};
        for (const row of data) if (row.path && row.signedUrl) next[row.path] = row.signedUrl;
        setUrls(next);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
}

export default function ProductPreview({
  projection,
  editHref,
}: {
  projection: ProductProjection;
  editHref: string;
}) {
  const media = projection.media ?? [];
  const variants = projection.variants ?? [];
  const groups = projection.option_groups ?? [];

  const urls = useSignedMedia(
    useMemo(() => media.map((m) => m.path).filter((p): p is string => !!p), [media]),
  );

  /** The buyer's selection, one value per option group. Starts on the first
   *  variant, which is the one the seller ordered first. */
  const [selection, setSelection] = useState<Record<string, string>>(
    () => variants[0]?.option_values ?? {},
  );

  const selected = useMemo(() => {
    if (groups.length === 0) return variants[0] ?? null;
    return (
      variants.find((v) =>
        groups.every((g) => (v.option_values ?? {})[g.name] === selection[g.name]),
      ) ?? null
    );
  }, [groups, variants, selection]);

  /** Changing colour shows that colour's photo. Falls back to the main image,
   *  which is what the buyer surface will do too. */
  const activeMediaId = selected?.media_id ?? projection.primary_media_id;
  const [openedMediaId, setOpenedMediaId] = useState<string | null>(null);
  const shownMedia =
    media.find((m) => m.id === (openedMediaId ?? activeMediaId)) ?? media[0] ?? null;

  // A colour change re-points the gallery; an explicit thumbnail click wins
  // until the seller changes options again.
  useEffect(() => setOpenedMediaId(null), [activeMediaId]);

  const availability = AVAILABILITY[selected?.availability ?? "unknown"];

  return (
    <div>
      <div className="tl-shop-notice tl-shop-notice--info" role="status">
        <Eye size={16} aria-hidden="true" />
        <div>
          <strong>Bản xem trước — người mua chưa nhìn thấy.</strong> Đây là đúng những gì người
          mua sẽ thấy khi sản phẩm được duyệt và bật bán. Trang mua hàng công khai chưa mở.
          <div style={{ marginTop: 8 }}>
            <Link to={editHref} className="tl-shop-btn tl-shop-btn--sm">
              <PencilLine size={14} aria-hidden="true" /> Quay lại chỉnh sửa
            </Link>
          </div>
        </div>
      </div>

      <div className="tl-shop-pdp">
        <div className="tl-shop-pdp-media">
          <div className="tl-shop-gallery">
            {shownMedia && shownMedia.path && urls[shownMedia.path] ? (
              <img
                src={urls[shownMedia.path]}
                alt={shownMedia.alt_text ?? projection.title}
                style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 12 }}
              />
            ) : (
              <span className="tl-shop-media" aria-hidden="true" style={{ display: "block" }} />
            )}

            {media.length > 1 && (
              <div className="tl-shop-gallery-thumbs" role="group" aria-label="Ảnh sản phẩm">
                {media.map((m, index) => (
                  <button
                    key={m.id}
                    type="button"
                    className="tl-shop-gallery-thumb"
                    aria-current={m.id === shownMedia?.id}
                    aria-label={`Xem ảnh ${index + 1}`}
                    onClick={() => setOpenedMediaId(m.id)}
                  >
                    {m.path && urls[m.path] ? (
                      <img
                        src={urls[m.path]}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <span className="tl-shop-media" aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="tl-shop-h1" style={{ fontSize: "clamp(18px, 4.5vw, 24px)" }}>
            {projection.title}
          </h2>
          <p className="tl-shop-hint" style={{ marginTop: 4 }}>
            {projection.shop.name}
            {projection.shop.region ? ` · ${projection.shop.region}` : ""}
            {projection.condition === "used" ? " · Hàng đã qua sử dụng" : ""}
          </p>

          {/* One price, the selected variant's. No struck-through "was", because
              nothing here has ever been sold at another price. */}
          <p className="tl-shop-price tl-shop-price--lg" style={{ marginTop: 12 }}>
            {selected ? vnd(selected.price_vnd) : "—"}
          </p>
          <p className={`tl-shop-pill tl-shop-pill--${availability.tone}`}>{availability.label}</p>

          {groups.map((group) => (
            <fieldset key={group.name} className="tl-shop-fieldset" style={{ marginTop: 16 }}>
              <legend className="tl-shop-label" style={{ padding: 0 }}>
                {group.name}
              </legend>
              <div className="tl-shop-optrow">
                {group.values.map((value) => {
                  // Keep the other choices and try this one: a buyer changing
                  // colour should not lose their size.
                  const candidate = { ...selection, [group.name]: value };
                  const match = variants.find((v) =>
                    groups.every((g) => (v.option_values ?? {})[g.name] === candidate[g.name]),
                  );
                  return (
                    <button
                      key={value}
                      type="button"
                      className="tl-shop-opt"
                      aria-pressed={selection[group.name] === value}
                      // A combination that does not exist, or is sold out, is
                      // not selectable — and says so rather than failing later.
                      disabled={!match || match.availability === "out_of_stock"}
                      onClick={() => setSelection(candidate)}
                    >
                      {value}
                      {match?.availability === "out_of_stock" ? " · hết" : ""}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          {/* Before the CTA, deliberately: a buyer decides with these in view. */}
          {(projection.shop.shipping_note || projection.shop.return_note) && (
            <div className="tl-shop-card" style={{ marginTop: 18 }}>
              {projection.shop.shipping_note && (
                <p className="tl-shop-hint" style={{ marginTop: 0 }}>
                  <strong>Giao hàng:</strong> {projection.shop.shipping_note}
                </p>
              )}
              {projection.shop.return_note && (
                <p className="tl-shop-hint">
                  <strong>Đổi trả:</strong> {projection.shop.return_note}
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            className="tl-shop-btn tl-shop-btn--primary tl-shop-btn--block"
            style={{ marginTop: 18 }}
            disabled
          >
            Bản xem trước — chưa mua được
          </button>

          <p className="tl-shop-hint">
            Thông tin sản phẩm, giá và tồn kho do shop tự khai và tự chịu trách nhiệm.
            {projection.shop.verified
              ? " Shop đã được quản trị viên xác minh (đối chiếu giấy tờ hoặc gặp trực tiếp) — đây không phải cam kết chất lượng."
              : ""}
          </p>

          {/* Cùng một component với trang thật — bản xem trước mà khác trang
              thật thì nó không còn là bản xem trước. */}
          <div style={{ marginTop: 20 }}>
            <SpecList
              categorySlug={projection.category?.slug}
              specs={projection.specs}
              headingId="pv-specs"
            />
          </div>

          {projection.description && (
            <section aria-labelledby="pv-desc" style={{ marginTop: 20 }}>
              <h3 id="pv-desc" className="tl-shop-h2" style={{ fontSize: 15 }}>
                Mô tả
              </h3>
              <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 14 }}>
                {projection.description}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
