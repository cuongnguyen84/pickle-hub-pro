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

import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, BadgeCheck, ExternalLink, Loader2, Phone } from "lucide-react";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { usePublicProduct } from "@/hooks/shop/usePublicShop";
import { CartAddedToast, ShopCartLink } from "@/components/shop/CartLink";
import { SpecList } from "@/components/shop/SpecList";
import { CART_QTY_MAX, useCartMutations } from "@/hooks/shop/useCart";
import { useAuth } from "@/hooks/useAuth";
import { getLoginUrl } from "@/lib/auth-config";
import { shopErrorMessage } from "@/lib/shop/errors";
import {
  CONDITION_LABEL,
  availabilityLabel,
  formatVnd,
  mediaBox,
  publicMediaUrl,
} from "@/lib/shop/publicCatalog";
import {
  activeMediaId,
  shownMediaId,
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

// EN: Add to cart · Adding… · Try again · Quantity · This option is sold out.
// Pick another one, or message the shop. · Choose a {group} first. · This shop
// has paused selling. · You can still contact the shop directly.
const PDP_COPY = {
  add: "Thêm vào giỏ",
  addBusy: "Đang thêm…",
  addRetry: "Thử lại",
  qtyLabel: "Số lượng",
  soldOut:
    "Phiên bản này đang hết hàng. Chọn phiên bản khác, hoặc nhắn shop để hỏi.",
  pickVariant: (group: string) => `Chọn ${group} trước.`,
  /** Nhãn ngắn cho thanh dính đáy — chỗ đó chỉ vừa vài chữ. */
  pickVariantShort: "Chọn phiên bản",
  pausedTitle: "Shop đang tạm ngưng bán.",
  pausedBody: "Anh/chị vẫn liên hệ trực tiếp với shop được.",
};

interface PublicProduct {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  condition: "new" | "used";
  /** Luôn có mặt kể từ migration 20260823090000 — mặc định `{}`. */
  specs: Record<string, string>;
  category: { slug: string; name: string } | null;
  shop: {
    slug: string; name: string; region: string | null; verified: boolean;
    shipping_note: string | null; return_note: string | null;
    /** D1. Carried by product_public_projection since 20260818120000, so it is
     *  always present — no "the projection did not say" case to defend. */
    ordering_enabled: boolean;
    /** D3. 0 is free. */
    shipping_fee_vnd: number;
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
  // R5 #3. The photo used to be derived ENTIRELY from the variant, so on a
  // product with five photos and no options — the common case for a used
  // paddle — tapping thumbnails 2..5 did nothing at all and the page read as
  // broken. A picked photo wins until the buyer changes the variant, at which
  // point it is dropped and the variant's own photo takes over again.
  const [pickedMediaId, setPickedMediaId] = useState<string | null>(null);
  const chooseVariant = (next: Selection) => {
    setSelection(next);
    setPickedMediaId(null);
  };
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { add } = useCartMutations();
  const [qty, setQty] = useState(1);
  const [addError, setAddError] = useState<string | null>(null);
  const [toastNonce, setToastNonce] = useState(0);
  const [toastOpen, setToastOpen] = useState(false);

  // Thanh mua dính đáy chỉ xuất hiện khi nút mua trong trang đã trôi khỏi tầm
  // nhìn — không bao giờ có hai nút mua cùng lúc trên màn hình.
  // Giữ node trong state chứ không phải ref: effect tự chạy lại đúng lúc node
  // gắn vào hoặc rời đi, khỏi phải đoán dependency.
  const [ctaNode, setCtaNode] = useState<HTMLDivElement | null>(null);
  const [ctaOffScreen, setCtaOffScreen] = useState(false);
  useEffect(() => {
    if (!ctaNode || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setCtaOffScreen(!entry.isIntersecting),
      { rootMargin: "-8px 0px 0px 0px" },
    );
    io.observe(ctaNode);
    return () => io.disconnect();
  }, [ctaNode]);

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
  const variantMediaId = product
    ? activeMediaId(resolved, variants, sel, product.primary_media_id)
    : null;
  const currentMediaId = shownMediaId(pickedMediaId, product?.media ?? [], variantMediaId);
  const shown = product?.media.find((m) => m.id === currentMediaId) ?? product?.media[0] ?? null;

  if (q.isLoading) {
    // R5 #6 — the shape of a PDP, not a centred spinner: photo box, title,
    // price, one option row, the buy button.
    return (
      <TheLineLayout title="Sản phẩm">
        <DynamicMeta title="Sản phẩm" noindex />
        <main className="tl-shop">
          <div className="tl-shop-page" aria-busy="true" aria-label="Đang tải sản phẩm">
            <div className="tl-pdp">
              <div className="tl-pdp-media">
                <span className="tl-shop-sk tl-shop-sk--media" />
                <div className="tl-shop-skrow" style={{ marginTop: 10 }}>
                  <span className="tl-shop-sk tl-shop-sk--thumb" />
                  <span className="tl-shop-sk tl-shop-sk--thumb" />
                  <span className="tl-shop-sk tl-shop-sk--thumb" />
                </div>
              </div>
              <div className="tl-pdp-info">
                <span className="tl-shop-sk tl-shop-sk--title" />
                <span className="tl-shop-sk tl-shop-sk--line" style={{ width: "40%", height: 22 }} />
                <span className="tl-shop-sk tl-shop-sk--line" style={{ width: "60%" }} />
                <span className="tl-shop-sk tl-shop-sk--card" style={{ height: 46 }} />
              </div>
            </div>
          </div>
        </main>
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
          <div className="tl-shop-page">
            <h1 className="tl-shop-h1">Không tìm thấy sản phẩm này</h1>
            <p className="tl-shop-sub">
              Có thể sản phẩm đã được gỡ, hoặc đường dẫn không đúng.
            </p>
            <Link to="/shop" className="tl-shop-btn">Về trang chợ</Link>
          </div>
        </main>
      </TheLineLayout>
    );
  }

  const box = mediaBox(shown?.width ?? null, shown?.height ?? null, 800);

  // D1. The same flag shop_order_create refuses on, so the button and the
  // server cannot disagree.
  const ordering = product.shop.ordering_enabled;
  const maxQty = CART_QTY_MAX;
  const missingGroup = groups.find((g) => !sel[g.name]);
  const addBlockedReason = !resolved
    ? PDP_COPY.pickVariant(missingGroup?.name ?? "phiên bản")
    : resolved.availability === "out_of_stock"
      ? PDP_COPY.soldOut
      : null;
  const adding = add.isPending;

  const onAdd = async () => {
    // No (variant, qty) is stashed across the login round trip — deliberately.
    // A restored selection that no longer exists (retired variant, sold out
    // while the buyer was signing in) is a worse bug than picking the size
    // again. The original reason given here — "the pilot is noindex with
    // near-zero traffic" — stopped being true at the Phase 4 launch; the
    // reason above did not depend on it.
    if (!user) {
      navigate(getLoginUrl(location.pathname + location.search));
      return;
    }
    if (!resolved) return;
    setAddError(null);
    try {
      await add.mutateAsync({ variantId: resolved.id, qty });
      setToastNonce((n) => n + 1);
      setToastOpen(true);
    } catch (err) {
      setAddError(shopErrorMessage(err));
    }
  };

  return (
    <TheLineLayout title={product.title}>
      {/* Phase 4: robots is decided at the edge by SHOP_PUBLIC_INDEXING, and
          the bot never gets this far anyway — renderShopProduct answers it
          with the Product/Offer schema. The loading and not-found branches
          above keep their own noindex. */}
      <DynamicMeta title={product.title} description={product.description ?? undefined} />
      <main className="tl-shop">
        <div className="tl-shop-page">
        <div className="tl-shop-topline">
          {/* The product title is the <h1> two lines down; repeating it as a
              crumb was noise on a 375px row (R5 #14). */}
          <nav aria-label="Đường dẫn" className="tl-shop-crumbs">
            <Link to="/shop" className="tl-crumb">Chợ</Link>
            {product.category && (
              <>
                <span aria-hidden="true" className="tl-crumb-sep">/</span>
                <Link to={`/shop/category/${product.category.slug}`} className="tl-crumb">
                  {product.category.name}
                </Link>
              </>
            )}
          </nav>
          <ShopCartLink />
        </div>

        <div className={ordering ? "tl-pdp tl-shop-has-buybar" : "tl-pdp"}>
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
                      aria-current={m.id === currentMediaId ? "true" : undefined}
                      aria-label={`Xem ảnh ${m.alt_text ?? ""}`.trim()}
                      onClick={() => {
                        // Picking a thumbnail selects the variant that photo
                        // belongs to, so the price and SKU follow the image
                        // instead of drifting from it — and the photo shows
                        // either way, which is the half that was missing.
                        const owner = variants.find((v) => v.media_id === m.id);
                        if (owner?.option_values) setSelection({ ...owner.option_values });
                        setPickedMediaId(m.id);
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
                        onClick={() => chooseVariant(pickOption(groups, variants, sel, g.name, val))}
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


            {/* P3: cart first, contact second — but only one primary on the
                screen. When the shop is not selling, the contact buttons take
                the primary back (C3). */}
            <div className="tl-pdp-cta" ref={setCtaNode}>
              {ordering ? (
                <>
                  <label className="tl-shop-label" htmlFor="pdp-qty">{PDP_COPY.qtyLabel}</label>
                  <span className="tl-shop-qty" id="pdp-qty-box">
                    <button
                      type="button"
                      aria-label="Giảm số lượng"
                      disabled={qty <= 1 || adding}
                      onClick={() => setQty((n) => Math.max(1, n - 1))}
                    >
                      −
                    </button>
                    <input id="pdp-qty" type="text" inputMode="numeric" readOnly value={qty} />
                    <button
                      type="button"
                      aria-label="Tăng số lượng"
                      disabled={qty >= maxQty || adding}
                      onClick={() => setQty((n) => Math.min(maxQty, n + 1))}
                    >
                      +
                    </button>
                  </span>

                  {addError && (
                    <p className="tl-shop-notice tl-shop-notice--danger" role="alert">
                      <AlertTriangle size={16} aria-hidden="true" />
                      <span>{addError}</span>
                    </p>
                  )}

                  <button
                    type="button"
                    className="tl-shop-btn tl-shop-btn--primary tl-shop-btn--block"
                    disabled={adding || !!addBlockedReason}
                    aria-busy={adding || undefined}
                    aria-describedby={addBlockedReason ? "pdp-add-why" : undefined}
                    onClick={() => void onAdd()}
                  >
                    {adding && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                    {adding
                      ? PDP_COPY.addBusy
                      : addError
                        ? PDP_COPY.addRetry
                        : PDP_COPY.add}
                  </button>
                  {addBlockedReason && (
                    <p className="tl-shop-hint tl-shop-flush-t" id="pdp-add-why">
                      {addBlockedReason}
                    </p>
                  )}
                </>
              ) : (
                <div className="tl-shop-notice">
                  <div>
                    <strong>{PDP_COPY.pausedTitle}</strong> {PDP_COPY.pausedBody}
                  </div>
                </div>
              )}

              {contacts.length > 0 ? (
                <>
                  {/* R5 #12 — a horizontal row of secondary buttons, the same
                      on the storefront. Green stays on the buy button. */}
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
                  </div>
                  <p className="tl-shop-hint tl-shop-flush-b">
                    {contacts.map((c) => CONTACT_DESTINATION[c.type]).join(" · ")}. ThePickleHub
                    không có tin nhắn nội bộ — anh/chị trao đổi thẳng với shop.
                  </p>
                </>
              ) : (
                <p className="tl-shop-hint tl-shop-flush-b">{NO_CONTACT_COPY}</p>
              )}
            </div>

            {/* Trust info ngay DƯỚI nút mua: người mua quyết định xong mới đọc
                điều khoản, chứ không phải lội qua đoạn miễn trừ dài rồi mới thấy nút. */}
            <div className="tl-pdp-seller">
              <p className="tl-pdp-shopname">
                <Link to={`/shop/store/${product.shop.slug}`} className="tl-crumb">
                  {product.shop.name}
                </Link>
                {product.shop.verified && (
                  <>
                    <BadgeCheck size={14} aria-hidden="true" className="tl-pcard-verified" />
                    <span className="tl-shop-sr">shop đã được ThePickleHub xác minh</span>
                  </>
                )}
              </p>
              {product.shop.region && <p className="tl-pdp-note">Gửi từ {product.shop.region}</p>}
              {/* Con số, không phải lời hứa. `shipping_note` là ô chữ tự do và
                  nó đã từng ghi "miễn phí toàn quốc" trong khi giỏ hàng thu
                  30.000₫ — chi phí lộ muộn là nguyên nhân bỏ giỏ số một. Đây
                  đọc thẳng `shipping_fee_vnd`, đúng con số checkout sẽ cộng. */}
              <p className="tl-pdp-note">
                {product.shop.shipping_fee_vnd > 0
                  ? `Phí giao hàng ${formatVnd(product.shop.shipping_fee_vnd)}`
                  : "Miễn phí giao hàng"}
              </p>
              {product.shop.shipping_note && <p className="tl-pdp-note">{product.shop.shipping_note}</p>}
              {product.shop.return_note && <p className="tl-pdp-note">{product.shop.return_note}</p>}
              {/* R5 (cắt chữ): ba dòng miễn trừ còn một. Không mất nghĩa nào —
                  ai khai, ai duyệt — chỉ mất phần lặp lại trang shop đã nói. */}
              <p className="tl-shop-hint tl-shop-flush-b">
                Giá và tình trạng hàng do shop tự khai. ThePickleHub kiểm duyệt nội dung trước khi
                hiển thị.
              </p>
            </div>

            {/* Thông số trước mô tả: người mua vợt so sánh con số rồi mới đọc
                văn xuôi, và con số là thứ họ mở hai tab để đặt cạnh nhau. */}
            <SpecList categorySlug={product.category?.slug} specs={product.specs} />

            {product.description && (
              <section aria-labelledby="pdp-desc">
                <h2 className="tl-shop-h2" id="pdp-desc">Mô tả</h2>
                <p className="tl-pdp-desc">{product.description}</p>
              </section>
            )}
          </section>
        </div>
        </div>

        {ordering && (
          <div
            className="tl-shop-buybar"
            data-shown={ctaOffScreen ? "true" : "false"}
            aria-hidden={ctaOffScreen ? undefined : true}
          >
            <p className="tl-shop-buybar-price">
              {resolved
                ? formatVnd(resolved.price_vnd)
                : price
                  ? formatVnd(price.min)
                  : "Chưa có giá"}
            </p>
            <button
              type="button"
              className="tl-shop-btn tl-shop-btn--primary"
              // KHÔNG disable khi chưa chọn phiên bản: nút bị disable thì
              // onClick bên dưới không bao giờ chạy, tức là một nút xám không
              // làm gì và không có chỗ nào trong thanh để giải thích tại sao.
              disabled={adding}
              aria-busy={adding || undefined}
              // Ẩn khỏi thứ tự Tab khi thanh chưa hiện — nếu không, người dùng
              // bàn phím rơi vào một nút vô hình.
              tabIndex={ctaOffScreen ? undefined : -1}
              // Chưa chọn phiên bản thì đưa người mua về đúng chỗ phải chọn,
              // thay vì để họ bấm một nút xám không nói gì.
              onClick={() =>
                addBlockedReason
                  ? ctaNode?.scrollIntoView({ block: "center", behavior: "smooth" })
                  : void onAdd()
              }
            >
              {adding && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {adding ? PDP_COPY.addBusy : addBlockedReason ? PDP_COPY.pickVariantShort : PDP_COPY.add}
            </button>
          </div>
        )}

        <CartAddedToast
          open={toastOpen}
          nonce={toastNonce}
          onClose={() => setToastOpen(false)}
        />
      </main>
    </TheLineLayout>
  );
}
