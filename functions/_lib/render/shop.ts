// ============================================================================
// renderShop* — Phase 4 public launch.
// ----------------------------------------------------------------------------
// Until now `SHOP_PUBLIC_INDEXING` was off and the four catalogue surfaces
// never needed a renderer: the bot path short-circuited to renderNoindexShell
// before routeAndRender was reached. Flipping the flag without these handlers
// would have sent Googlebot to renderDefault — the generic "ThePickleHub"
// shell, no product, no price — which is exactly the 2026-08-05 blog failure
// (perfect tags, empty article) repeated on a commercial page.
//
//   /shop                  → catalogue + ItemList
//   /shop/category/:slug   → one category + ItemList
//   /shop/product/:slug    → Product + Offer/AggregateOffer  ← the SERP card
//   /shop/store/:slug      → storefront, Store + ItemList
//
// …each with its /vi/ twin, self-referencing canonical and reciprocal
// hreflang (the /clubs shape, not the single-canonical /feed shape).
//
// `/shop/search` deliberately has NO renderer: it moved to NOINDEX_PATTERNS
// in the same commit. A result page per query string is thin duplicate
// content, and it is the one shop URL whose value to a crawler is negative.
//
// Every read goes through the shop_public_* RPCs even though this client
// holds the service-role key. Those functions are SECURITY DEFINER with the
// approved/published/active filters and a column allowlist baked in; reading
// the tables directly here would bypass RLS AND the allowlist at once, and
// put draft products one typo away from the public HTML.
// ============================================================================

import type { SupabaseClient } from "../supabase";
import { buildHtml, htmlResponse } from "../html";
import { escapeHtml, type Lang } from "../utils";
// Cùng một từ điển thông số mà biểu mẫu người bán và trang sản phẩm dùng —
// giống cách blog-meta.ts đọc thẳng src/content/blog/metadata.ts. Một bản sao
// nhãn thông số ở đây là một bản sao sẽ lệch.
import { specRows } from "../../../src/lib/shop/productSpecs";

const LIST_LIMIT = 24;

type Availability = "in_stock" | "out_of_stock" | "unknown" | null;

interface CardRow {
  slug: string;
  title: string;
  price_min: number | null;
  price_max: number | null;
  availability: Availability;
  condition: "new" | "used" | null;
  category: { slug: string; name: string } | null;
  shop: { slug: string; name: string; verified: boolean } | null;
  cover: { public_path: string; alt_text: string | null } | null;
}

interface ProductRow {
  slug: string;
  title: string;
  description: string | null;
  /** Thông số kỹ thuật, khoá → chuỗi. Rỗng cho sản phẩm chưa khai. */
  specs: Record<string, string> | null;
  condition: "new" | "used" | null;
  in_stock: boolean | null;
  category: { slug: string; name: string } | null;
  shop: {
    slug: string;
    name: string;
    verified: boolean;
    region: string | null;
    shipping_note: string | null;
    return_note: string | null;
    shipping_fee_vnd: number | null;
    ordering_enabled: boolean | null;
  } | null;
  media: { public_path: string | null; alt_text: string | null }[] | null;
  variants: { price_vnd: number | null; availability: Availability; sku: string | null }[] | null;
}

// ─── Formatting ─────────────────────────────────────────────────────────────

/** D3: a zero shipping fee reads "Miễn phí", never "0₫" and never "—". */
function fmtVnd(vnd: number, lang: Lang): string {
  if (vnd <= 0) return lang === "vi" ? "Miễn phí" : "Free";
  return `${vnd.toLocaleString("vi-VN")}₫`;
}

function fmtPriceRange(min: number | null, max: number | null, lang: Lang): string {
  if (min == null) return lang === "vi" ? "Liên hệ" : "Contact for price";
  if (max == null || max === min) return `${min.toLocaleString("vi-VN")}₫`;
  return `${min.toLocaleString("vi-VN")}₫ – ${max.toLocaleString("vi-VN")}₫`;
}

function conditionLabel(c: "new" | "used" | null, lang: Lang): string {
  if (c === "used") return lang === "vi" ? "Đã qua sử dụng" : "Used";
  if (c === "new") return lang === "vi" ? "Mới" : "New";
  return "";
}

/**
 * `public_path` is a key in the PUBLIC bucket — the same contract the client
 * asserts in src/lib/shop/publicCatalog.ts. Anything that already looks like a
 * URL or a signed link is dropped rather than emitted: a signed URL in og:image
 * expires and turns into a broken card weeks later, silently.
 */
function mediaUrl(mediaBase: string, publicPath: string): string | null {
  if (/^https?:|token=|\/object\/sign\//.test(publicPath)) return null;
  return `${mediaBase.replace(/\/$/, "")}/storage/v1/object/public/shop-product-media/${publicPath}`;
}

/**
 * Both locales are real, distinct URLs, so hreflang is a valid signal here.
 *
 * x-default → VI (SEO audit 2026-08-29, PO chọn phương án a): the taxonomy,
 * the seller copy and 95% of the buyers are Vietnamese, and the EN page is a
 * translated frame around a Vietnamese description. Sending an unmatched
 * locale to the half-translated page was the wrong fallback. Must agree with
 * sitemap-shop.xml.ts — conflicting x-default between HTML and sitemap makes
 * Google drop the pair.
 */
function localePair(siteUrl: string, path: string) {
  const enUrl = `${siteUrl}${path}`;
  const viUrl = `${siteUrl}/vi${path}`;
  return {
    enUrl,
    viUrl,
    alternates: [
      { hreflang: "en", href: enUrl },
      { hreflang: "vi", href: viUrl },
      { hreflang: "x-default", href: viUrl },
    ],
  };
}

/**
 * The taxonomy (`product_categories.name`) is Vietnamese only. On the EN
 * page a title like "Vợt pickleball for 1.800.000₫" is half a language, so
 * the six known slugs get an English name here. Unknown slugs fall back to
 * the Vietnamese name — a wrong-language heading beats a slug as a heading.
 * ponytail: a map, not a name_en column — six rows that change once a year.
 */
const CATEGORY_NAME_EN: Record<string, string> = {
  vot: "Pickleball paddles",
  giay: "Pickleball shoes",
  bong: "Pickleball balls",
  "tui-balo": "Pickleball bags & backpacks",
  "grip-phu-kien": "Grips & accessories",
  "trang-phuc": "Pickleball apparel",
};

function categoryName(cat: { slug: string; name: string } | null, lang: Lang): string {
  if (!cat) return "";
  return lang === "en" ? (CATEGORY_NAME_EN[cat.slug] ?? cat.name) : cat.name;
}

const utf8Bytes = (s: string) => new TextEncoder().encode(s).length;

/**
 * First candidate that fits buildHtml's 60-byte <title> budget, else the
 * shortest one. Vietnamese costs 2–3 bytes a glyph, so "Tên — Danh mục giá
 * 1.800.000₫ | ThePickleHub" was ellipsised on ~40 of 52 product pages and
 * lost exactly the part that carried the price. Price lives in the
 * description and the Offer; the title keeps name + category + brand.
 */
function fitTitle(candidates: string[]): string {
  return candidates.find((c) => utf8Bytes(c) <= 60) ?? candidates[candidates.length - 1];
}

function imgTag(src: string, alt: string, eager = false): string {
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="${eager ? "eager" : "lazy"}" decoding="async">`;
}

function swapLink(lang: Lang, enUrl: string, viUrl: string): string {
  return lang === "vi"
    ? `<p><a href="${enUrl}" hreflang="en">English version</a></p>`
    : `<p><a href="${viUrl}" hreflang="vi">Phiên bản tiếng Việt</a></p>`;
}

function breadcrumb(lang: Lang, siteUrl: string, trail: { name: string; href?: string }[]): string {
  const home = lang === "vi"
    ? `<li><a href="${siteUrl}/vi">Trang chủ</a></li>`
    : `<li><a href="${siteUrl}/">Home</a></li>`;
  const rest = trail
    .map((t) => (t.href ? `<li><a href="${t.href}">${escapeHtml(t.name)}</a></li>` : `<li>${escapeHtml(t.name)}</li>`))
    .join(" &gt; ");
  return `<nav aria-label="breadcrumb"><ol>${home} &gt; ${rest}</ol></nav>`;
}

// ─── Shared product list ────────────────────────────────────────────────────

/**
 * `mediaBase` optional: the list pages did not receive it before the 2026-08-29
 * audit found bot HTML carried ZERO <img> on all 62 shop URLs — no Google
 * Images for a catalogue of paddles. Without it the card is text-only, as
 * before; with it the cover ships as a real <img> with alt text.
 */
function cardsHtml(rows: CardRow[], siteUrl: string, lang: Lang, mediaBase?: string): string {
  return rows
    .map((p, i) => {
      const price = fmtPriceRange(p.price_min, p.price_max, lang);
      const cond = conditionLabel(p.condition, lang);
      const shop = p.shop ? ` — ${escapeHtml(p.shop.name)}` : "";
      const cat = p.category ? ` · ${escapeHtml(categoryName(p.category, lang))}` : "";
      const sold = p.availability === "out_of_stock" ? ` · ${lang === "vi" ? "Tạm hết hàng" : "Sold out"}` : "";
      const cover = mediaBase && p.cover?.public_path ? mediaUrl(mediaBase, p.cover.public_path) : null;
      const img = cover ? imgTag(cover, p.cover?.alt_text || p.title, i < 4) + " " : "";
      return `<li>${img}<a href="${siteUrl}${lang === "vi" ? "/vi" : ""}/shop/product/${escapeHtml(p.slug)}">${escapeHtml(p.title)}</a> — <strong>${escapeHtml(price)}</strong>${cat}${cond ? ` · ${escapeHtml(cond)}` : ""}${shop}${sold}</li>`;
    })
    .join("");
}

function itemListJsonLd(rows: CardRow[], siteUrl: string, lang: Lang, name: string) {
  if (rows.length === 0) return undefined;
  const prefix = lang === "vi" ? "/vi" : "";
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: rows.length,
    itemListElement: rows.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${siteUrl}${prefix}/shop/product/${p.slug}`,
      name: p.title,
    })),
  };
}

async function fetchCards(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  where: string,
): Promise<{ rows: CardRow[]; total: number }> {
  try {
    const { data, error } = await supabase.rpc("shop_public_search", { _limit: LIST_LIMIT, ...args });
    if (error) {
      console.error(`${where}: rpc error`, error);
      return { rows: [], total: 0 };
    }
    const payload = data as { rows?: CardRow[]; total?: number } | null;
    return { rows: payload?.rows ?? [], total: payload?.total ?? 0 };
  } catch (err) {
    console.error(`${where}: fatal`, err);
    return { rows: [], total: 0 };
  }
}

/**
 * Cross-links every catalogue page carries. Shop pages were invisible to the
 * internal link graph until this launch — nothing on the site linked into
 * them — so each rendered page seeds the graph in both directions.
 */
function discoverNav(siteUrl: string, lang: Lang, extra: string[] = []): string {
  const prefix = lang === "vi" ? "/vi" : "";
  const links = [
    ...extra,
    `<li><a href="${siteUrl}${prefix}/shop">${lang === "vi" ? "Tất cả sản phẩm" : "All products"}</a></li>`,
    `<li><a href="${siteUrl}${prefix}/san">${lang === "vi" ? "Sân pickleball" : "Pickleball venues"}</a></li>`,
    `<li><a href="${siteUrl}${prefix}/blog">${lang === "vi" ? "Bài viết" : "Guides"}</a></li>`,
  ].join("");
  return `<nav><h2>${escapeHtml(lang === "vi" ? "Khám phá thêm" : "Discover more")}</h2><ul>${links}</ul></nav>`;
}

// ─── /shop + /vi/shop ───────────────────────────────────────────────────────

export async function renderShopCatalog(
  supabase: SupabaseClient,
  siteUrl: string,
  lang: Lang,
  mediaBase?: string,
): Promise<Response> {
  const { enUrl, viUrl, alternates } = localePair(siteUrl, "/shop");
  const { rows, total } = await fetchCards(supabase, {}, "renderShopCatalog");

  let categories: { slug: string; name: string; product_count?: number }[] = [];
  try {
    const { data } = await supabase.rpc("shop_public_categories", { _only_stocked: true });
    categories = (data as typeof categories) ?? [];
  } catch (err) {
    console.error("renderShopCatalog: categories fatal", err);
  }

  const title = lang === "vi"
    ? "Mua đồ pickleball chính hãng | ThePickleHub Shop"
    : "Buy pickleball gear in Vietnam | ThePickleHub Shop";
  const description = lang === "vi"
    ? `Vợt, giày và phụ kiện pickleball bán bởi shop đã xác minh trên ThePickleHub — ${total} sản phẩm đang mở bán, giá niêm yết bằng đồng, giao hàng toàn quốc.`
    : `Paddles, shoes and pickleball accessories from verified sellers on ThePickleHub — ${total} products listed with prices in VND and nationwide delivery.`;

  // GEO lead: the count, the categories and the name in the first two
  // sentences, so the passage survives being quoted on its own.
  const catNames = categories.slice(0, 5).map((c) => categoryName(c, lang)).join(", ");
  const lead = total > 0
    ? lang === "vi"
      ? `<p>ThePickleHub Shop đang mở bán ${total} sản phẩm pickleball từ các shop đã được xác minh${catNames ? ` — ${escapeHtml(catNames)}` : ""}. Giá niêm yết bằng VNĐ, đặt hàng trực tiếp trên trang và thanh toán khi nhận hàng hoặc chuyển khoản.</p>`
      : `<p>ThePickleHub Shop lists ${total} pickleball products from verified Vietnamese sellers${catNames ? ` — ${escapeHtml(catNames)}` : ""}. Prices are in VND, orders are placed on the page, and payment is cash on delivery or bank transfer.</p>`
    : lang === "vi"
      ? `<p>ThePickleHub Shop là nơi các shop pickleball Việt Nam đã xác minh đăng bán vợt, giày và phụ kiện. Hiện chưa có sản phẩm nào đang mở bán.</p>`
      : `<p>ThePickleHub Shop is where verified Vietnamese pickleball sellers list paddles, shoes and accessories. No products are on sale right now.</p>`;

  const catHtml = categories.length > 0
    ? `<section><h2>${escapeHtml(lang === "vi" ? "Danh mục" : "Categories")}</h2><ul>${categories
        .map(
          (c) =>
            `<li><a href="${siteUrl}${lang === "vi" ? "/vi" : ""}/shop/category/${escapeHtml(c.slug)}">${escapeHtml(categoryName(c, lang))}</a>${
              c.product_count ? ` · ${c.product_count}` : ""
            }</li>`,
        )
        .join("")}</ul></section>`
    : "";

  const bodyContent = `${breadcrumb(lang, siteUrl, [{ name: lang === "vi" ? "Cửa hàng" : "Shop" }])}
<h1>${escapeHtml(lang === "vi" ? "Cửa hàng pickleball" : "Pickleball shop")}</h1>
${lead}
${catHtml}
<section>
<h2>${escapeHtml(lang === "vi" ? "Sản phẩm đang bán" : "Products on sale")}</h2>
${rows.length > 0 ? `<ul>${cardsHtml(rows, siteUrl, lang, mediaBase)}</ul>` : `<p>${escapeHtml(lang === "vi" ? "Chưa có sản phẩm nào." : "No products yet.")}</p>`}
</section>
${discoverNav(siteUrl, lang)}
${swapLink(lang, enUrl, viUrl)}`;

  return htmlResponse(
    buildHtml({
      title,
      description,
      url: lang === "vi" ? viUrl : enUrl,
      siteUrl,
      lang,
      type: "website",
      jsonLd: itemListJsonLd(rows, siteUrl, lang, title),
      bodyContent,
      alternates,
      omitAutoHeader: true,
    }),
  );
}

// ─── /shop/category/:slug ───────────────────────────────────────────────────

export async function renderShopCategory(
  supabase: SupabaseClient,
  slug: string,
  siteUrl: string,
  lang: Lang,
  mediaBase?: string,
): Promise<Response> {
  const { enUrl, viUrl, alternates } = localePair(siteUrl, `/shop/category/${slug}`);
  const { rows, total } = await fetchCards(supabase, { _category_slug: slug }, "renderShopCategory");

  // The category NAME comes from the taxonomy, not from the slug — a slug
  // rendered as a heading is how a page ends up titled "vot".
  let catName = slug;
  try {
    const { data } = await supabase.rpc("shop_public_categories", { _only_stocked: false });
    const hit = ((data as { slug: string; name: string }[]) ?? []).find((c) => c.slug === slug);
    if (hit) catName = categoryName(hit, lang);
  } catch (err) {
    console.error("renderShopCategory: categories fatal", err);
  }

  // The taxonomy is Vietnamese and some names already carry the word — "Vợt
  // pickleball" does, "Giày" does not. Appending it unconditionally produced
  // "Vợt pickleball pickleball" and "Pickleball Vợt pickleball" on the live
  // preview. The keyword is worth having when it is absent and is noise when
  // it is not, so it is added conditionally rather than dropped.
  const hasKeyword = /pickleball/i.test(catName);
  const catVi = hasKeyword ? catName : `${catName} pickleball`;
  const catEn = hasKeyword ? catName : `Pickleball ${catName}`;

  const title = lang === "vi"
    ? `${catVi} — giá và nơi mua | ThePickleHub`
    : `${catEn} — prices and sellers | ThePickleHub`;
  const description = lang === "vi"
    ? `${total} sản phẩm ${catVi.toLowerCase()} đang bán trên ThePickleHub, giá niêm yết bằng VNĐ từ shop đã xác minh, giao hàng toàn quốc.`
    : `${total} ${catEn.toLowerCase()} listings on ThePickleHub with VND prices from verified Vietnamese sellers and nationwide delivery.`;

  // "starting at" is only said when a real number backs it — a category whose
  // rows all price null must not advertise a floor of Infinity₫.
  const floors = rows.map((r) => r.price_min).filter((p): p is number => typeof p === "number");
  const fromLabel = floors.length > 0
    ? lang === "vi"
      ? `, giá từ ${fmtPriceRange(Math.min(...floors), null, lang)}`
      : `, starting at ${fmtPriceRange(Math.min(...floors), null, lang)}`
    : "";

  const lead = total > 0
    ? lang === "vi"
      ? `<p>ThePickleHub đang liệt kê ${total} sản phẩm thuộc danh mục ${escapeHtml(catName)}${escapeHtml(fromLabel)}, bán bởi shop đã xác minh và giao hàng toàn quốc.</p>`
      : `<p>ThePickleHub lists ${total} ${escapeHtml(catEn.toLowerCase())} products${escapeHtml(fromLabel)}, from verified Vietnamese sellers with nationwide delivery.</p>`
    : lang === "vi"
      ? `<p>ThePickleHub chưa có sản phẩm nào trong danh mục ${escapeHtml(catName)}.</p>`
      : `<p>ThePickleHub has no ${escapeHtml(catEn.toLowerCase())} products listed yet.</p>`;

  const bodyContent = `${breadcrumb(lang, siteUrl, [
    { name: lang === "vi" ? "Cửa hàng" : "Shop", href: `${siteUrl}${lang === "vi" ? "/vi" : ""}/shop` },
    { name: catName },
  ])}
<h1>${escapeHtml(catName)}</h1>
${lead}
<section>
${rows.length > 0 ? `<ul>${cardsHtml(rows, siteUrl, lang, mediaBase)}</ul>` : `<p>${escapeHtml(lang === "vi" ? "Chưa có sản phẩm nào." : "No products yet.")}</p>`}
</section>
${discoverNav(siteUrl, lang)}
${swapLink(lang, enUrl, viUrl)}`;

  return htmlResponse(
    buildHtml({
      title,
      description,
      url: lang === "vi" ? viUrl : enUrl,
      siteUrl,
      lang,
      type: "website",
      jsonLd: itemListJsonLd(rows, siteUrl, lang, title),
      bodyContent,
      alternates,
      omitAutoHeader: true,
    }),
  );
}

// ─── /shop/store/:slug ──────────────────────────────────────────────────────

export async function renderShopStore(
  supabase: SupabaseClient,
  slug: string,
  siteUrl: string,
  lang: Lang,
  mediaBase?: string,
): Promise<Response> {
  const { enUrl, viUrl, alternates } = localePair(siteUrl, `/shop/store/${slug}`);

  let shop: { name: string; intro: string | null; region: string | null; verified: boolean; shipping_note: string | null; return_note: string | null } | null = null;
  try {
    const { data } = await supabase.rpc("shop_public_shop", { _slug: slug });
    const payload = data as { found?: boolean; shop?: typeof shop } | null;
    if (payload?.found) shop = payload.shop ?? null;
  } catch (err) {
    console.error("renderShopStore: fatal", err);
  }

  // A restricted, suspended or closed shop answers exactly like one that never
  // existed — the RPC's rule, kept here rather than softened into a 200.
  if (!shop) return render404Shop(siteUrl, lang);

  const { rows, total } = await fetchCards(supabase, { _shop_slug: slug }, "renderShopStore");

  const title = lang === "vi"
    ? `${shop.name} — cửa hàng pickleball trên ThePickleHub`
    : `${shop.name} — pickleball store on ThePickleHub`;
  const description = lang === "vi"
    ? `${shop.name} đang bán ${total} sản phẩm pickleball trên ThePickleHub${shop.region ? ` (${shop.region})` : ""}${shop.verified ? ", shop đã xác minh" : ""} — xem giá, tình trạng hàng và chính sách giao hàng.`
    : `${shop.name} lists ${total} pickleball products on ThePickleHub${shop.region ? ` (${shop.region})` : ""}${shop.verified ? ", a verified seller" : ""} — prices, stock and delivery terms.`;

  const lead = lang === "vi"
    ? `<p>${escapeHtml(shop.name)} là cửa hàng pickleball ${shop.verified ? "đã được xác minh " : ""}trên ThePickleHub, hiện có ${total} sản phẩm đang mở bán${shop.region ? ` tại ${escapeHtml(shop.region)}` : ""}.${shop.intro ? ` ${escapeHtml(shop.intro)}` : ""}</p>`
    : `<p>${escapeHtml(shop.name)} is a ${shop.verified ? "verified " : ""}pickleball store on ThePickleHub with ${total} products currently listed${shop.region ? ` in ${escapeHtml(shop.region)}` : ""}.${shop.intro ? ` ${escapeHtml(shop.intro)}` : ""}</p>`;

  const policies = [
    shop.shipping_note
      ? `<li><strong>${escapeHtml(lang === "vi" ? "Giao hàng" : "Delivery")}:</strong> ${escapeHtml(shop.shipping_note)}</li>`
      : "",
    shop.return_note
      ? `<li><strong>${escapeHtml(lang === "vi" ? "Đổi trả" : "Returns")}:</strong> ${escapeHtml(shop.return_note)}</li>`
      : "",
  ].join("");

  // One @graph, so the nested ItemList must NOT carry its own @context.
  const itemList = itemListJsonLd(rows, siteUrl, lang, title);
  const nestedItemList = itemList
    ? (({ "@context": _ctx, ...rest }) => rest)(itemList)
    : null;

  const storeJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Store",
        name: shop.name,
        url: lang === "vi" ? viUrl : enUrl,
        ...(shop.intro ? { description: shop.intro } : {}),
        ...(shop.region
          ? { address: { "@type": "PostalAddress", addressRegion: shop.region, addressCountry: "VN" } }
          : {}),
      },
      ...(nestedItemList ? [nestedItemList] : []),
    ],
  };

  const bodyContent = `${breadcrumb(lang, siteUrl, [
    { name: lang === "vi" ? "Cửa hàng" : "Shop", href: `${siteUrl}${lang === "vi" ? "/vi" : ""}/shop` },
    { name: shop.name },
  ])}
<h1>${escapeHtml(shop.name)}</h1>
${lead}
${policies ? `<section><h2>${escapeHtml(lang === "vi" ? "Chính sách" : "Store policies")}</h2><ul>${policies}</ul></section>` : ""}
<section>
<h2>${escapeHtml(lang === "vi" ? "Sản phẩm của shop" : "Products from this store")}</h2>
${rows.length > 0 ? `<ul>${cardsHtml(rows, siteUrl, lang, mediaBase)}</ul>` : `<p>${escapeHtml(lang === "vi" ? "Shop chưa đăng bán sản phẩm nào." : "This store has no products listed.")}</p>`}
</section>
${discoverNav(siteUrl, lang)}
${swapLink(lang, enUrl, viUrl)}`;

  return htmlResponse(
    buildHtml({
      title,
      description,
      url: lang === "vi" ? viUrl : enUrl,
      siteUrl,
      lang,
      type: "website",
      jsonLd: storeJsonLd,
      bodyContent,
      alternates,
      omitAutoHeader: true,
    }),
  );
}

// ─── /shop/product/:slug — the page that earns the SERP card ────────────────

export async function renderShopProduct(
  supabase: SupabaseClient,
  slug: string,
  siteUrl: string,
  lang: Lang,
  mediaBase: string,
): Promise<Response> {
  const { enUrl, viUrl, alternates } = localePair(siteUrl, `/shop/product/${slug}`);

  let product: ProductRow | null = null;
  try {
    const { data } = await supabase.rpc("shop_public_product", { _slug: slug });
    const payload = data as { found?: boolean; product?: ProductRow } | null;
    if (payload?.found) product = payload.product ?? null;
  } catch (err) {
    console.error("renderShopProduct: fatal", err);
  }

  if (!product) return render404Shop(siteUrl, lang);

  const prices = (product.variants ?? [])
    .map((v) => v.price_vnd)
    .filter((p): p is number => typeof p === "number");
  const priceMin = prices.length > 0 ? Math.min(...prices) : null;
  const priceMax = prices.length > 0 ? Math.max(...prices) : null;

  const images = (product.media ?? [])
    .map((m) => (m.public_path ? mediaUrl(mediaBase, m.public_path) : null))
    .filter((u): u is string => !!u);

  const shopName = product.shop?.name ?? "";
  const catName = categoryName(product.category, lang);
  const priceLabel = fmtPriceRange(priceMin, priceMax, lang);
  const soldOut = product.in_stock === false;
  const orderingOff = product.shop?.ordering_enabled === false;

  const title = fitTitle([
    `${product.title}${catName ? ` — ${catName}` : ""} | ThePickleHub`,
    `${product.title} | ThePickleHub`,
    product.title,
  ]);

  const shipping = product.shop?.shipping_fee_vnd;
  const shippingLabel = typeof shipping === "number" ? fmtVnd(shipping, lang) : null;

  // Budget is 160 BYTES; the old sentence ("…thanh toán khi nhận hoặc chuyển
  // khoản") was cut mid-clause on most VI pages. Say less, finish the sentence.
  const description = lang === "vi"
    ? `${product.title} giá ${priceLabel} tại ${shopName}.${shippingLabel ? ` Ship ${shippingLabel}.` : ""} ${soldOut ? "Tạm hết hàng." : "Đặt online, COD hoặc chuyển khoản."}`
    : `${product.title} at ${priceLabel} from ${shopName}.${shippingLabel ? ` Shipping ${shippingLabel}.` : ""} ${soldOut ? "Sold out." : "Order online, COD or bank transfer."}`;

  // Thông số kỹ thuật, theo thứ tự từ điển. Đây là phần một câu trả lời AI có
  // thể trích nguyên đoạn ("vợt X nặng 220 g, lõi 16 mm"), nên nó đi vào cả
  // HTML đọc được lẫn additionalProperty của schema.
  const specs = specRows(product.category?.slug, product.specs, lang === "vi" ? "vi" : "en");

  // GEO lead: product, price, seller and shipping in the first sentence, with
  // ThePickleHub named exactly once. Ba thông số đầu đi kèm vì một đoạn được
  // trích ra ("vợt X nặng 220 g, lõi 16 mm, giá …") tự đứng được, còn một đoạn
  // chỉ hứa có thông số thì không.
  // Merchant listings read `brand` as a Brand entity, not a PropertyValue; the
  // seller already typed it into the spec sheet. One SKU only when the product
  // IS one variant — a paddle in five weights has five SKUs, not one.
  const brand = product.specs?.brand?.trim() || null;
  const skus = (product.variants ?? []).map((v) => v.sku).filter((x): x is string => !!x);
  const sku = skus.length === 1 ? skus[0] : null;

  const specLead = specs
    .slice(0, 3)
    .map((s) => `${s.label.toLocaleLowerCase(lang === "vi" ? "vi" : "en")} ${s.value}`)
    .join(", ");
  const lead = lang === "vi"
    ? `<p>${escapeHtml(product.title)} có giá ${escapeHtml(priceLabel)}, do ${escapeHtml(shopName)} bán trên ThePickleHub${catName ? `, thuộc danh mục ${escapeHtml(catName)}` : ""}.${shippingLabel ? ` Phí giao hàng ${escapeHtml(shippingLabel)}.` : ""}${specLead ? ` Thông số: ${escapeHtml(specLead)}.` : ""} ${soldOut ? "Sản phẩm hiện tạm hết hàng." : orderingOff ? "Shop hiện tạm chưa nhận đơn trực tuyến — liên hệ shop để đặt." : "Đặt hàng trực tiếp trên trang, thanh toán khi nhận hàng hoặc chuyển khoản."}</p>`
    : `<p>${escapeHtml(product.title)} is priced at ${escapeHtml(priceLabel)} and sold by ${escapeHtml(shopName)} on ThePickleHub${catName ? `, in the ${escapeHtml(catName)} category` : ""}.${shippingLabel ? ` Shipping is ${escapeHtml(shippingLabel)}.` : ""}${specLead ? ` Specs: ${escapeHtml(specLead)}.` : ""} ${soldOut ? "It is currently sold out." : orderingOff ? "This store is not taking online orders right now — contact them to buy." : "Order it on the page and pay on delivery or by bank transfer."}</p>`;

  const facts = [
    catName
      ? `<li><strong>${escapeHtml(lang === "vi" ? "Danh mục" : "Category")}:</strong> <a href="${siteUrl}${lang === "vi" ? "/vi" : ""}/shop/category/${escapeHtml(product.category!.slug)}">${escapeHtml(catName)}</a></li>`
      : "",
    product.condition
      ? `<li><strong>${escapeHtml(lang === "vi" ? "Tình trạng" : "Condition")}:</strong> ${escapeHtml(conditionLabel(product.condition, lang))}</li>`
      : "",
    `<li><strong>${escapeHtml(lang === "vi" ? "Giá" : "Price")}:</strong> ${escapeHtml(priceLabel)}</li>`,
    shippingLabel
      ? `<li><strong>${escapeHtml(lang === "vi" ? "Phí giao hàng" : "Shipping")}:</strong> ${escapeHtml(shippingLabel)}</li>`
      : "",
    product.shop
      ? `<li><strong>${escapeHtml(lang === "vi" ? "Người bán" : "Seller")}:</strong> <a href="${siteUrl}${lang === "vi" ? "/vi" : ""}/shop/store/${escapeHtml(product.shop.slug)}">${escapeHtml(shopName)}</a>${product.shop.verified ? ` (${escapeHtml(lang === "vi" ? "đã xác minh" : "verified")})` : ""}</li>`
      : "",
    product.shop?.return_note
      ? `<li><strong>${escapeHtml(lang === "vi" ? "Đổi trả" : "Returns")}:</strong> ${escapeHtml(product.shop.return_note)}</li>`
      : "",
  ].join("");

  // Availability is stated only when it is actually known and actionable.
  // A shop with ordering switched off is not "InStock" no matter what the
  // variant rows say — emitting it anyway is how a rich result promises a
  // purchase the page cannot complete, and Google penalises exactly that.
  const availability = orderingOff
    ? null
    : soldOut
      ? "https://schema.org/OutOfStock"
      : "https://schema.org/InStock";

  const offer = priceMin == null
    ? undefined
    : priceMin === priceMax
      ? {
          "@type": "Offer",
          price: priceMin,
          priceCurrency: "VND",
          url: lang === "vi" ? viUrl : enUrl,
          ...(availability ? { availability } : {}),
          ...(shopName ? { seller: { "@type": "Organization", name: shopName } } : {}),
        }
      : {
          "@type": "AggregateOffer",
          lowPrice: priceMin,
          highPrice: priceMax,
          offerCount: prices.length,
          priceCurrency: "VND",
          url: lang === "vi" ? viUrl : enUrl,
          ...(availability ? { availability } : {}),
          ...(shopName ? { seller: { "@type": "Organization", name: shopName } } : {}),
        };

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: product.title,
        ...(product.description ? { description: product.description } : {}),
        ...(images.length > 0 ? { image: images } : {}),
        ...(catName ? { category: catName } : {}),
        ...(brand ? { brand: { "@type": "Brand", name: brand } } : {}),
        ...(sku ? { sku } : {}),
        ...(specs.length > 0
          ? {
              additionalProperty: specs.map((s) => ({
                "@type": "PropertyValue",
                name: s.label,
                value: s.value,
              })),
            }
          : {}),
        ...(product.condition
          ? {
              itemCondition:
                product.condition === "used"
                  ? "https://schema.org/UsedCondition"
                  : "https://schema.org/NewCondition",
            }
          : {}),
        ...(offer ? { offers: offer } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: lang === "vi" ? "Cửa hàng" : "Shop",
            item: `${siteUrl}${lang === "vi" ? "/vi" : ""}/shop`,
          },
          ...(product.category
            ? [
                {
                  "@type": "ListItem",
                  position: 2,
                  name: catName,
                  item: `${siteUrl}${lang === "vi" ? "/vi" : ""}/shop/category/${product.category.slug}`,
                },
              ]
            : []),
          {
            "@type": "ListItem",
            position: product.category ? 3 : 2,
            name: product.title,
            item: lang === "vi" ? viUrl : enUrl,
          },
        ],
      },
    ],
  };

  const bodyContent = `${breadcrumb(lang, siteUrl, [
    { name: lang === "vi" ? "Cửa hàng" : "Shop", href: `${siteUrl}${lang === "vi" ? "/vi" : ""}/shop` },
    ...(product.category
      ? [{ name: catName, href: `${siteUrl}${lang === "vi" ? "/vi" : ""}/shop/category/${product.category.slug}` }]
      : []),
    { name: product.title },
  ])}
<h1>${escapeHtml(product.title)}</h1>
${images.length > 0 ? `<figure>${images.map((src, i) => imgTag(src, product.media?.[i]?.alt_text || `${product.title}${i > 0 ? ` (${i + 1})` : ""}`, i === 0)).join("")}</figure>` : ""}
${lead}
${specs.length > 0 ? `<section><h2>${escapeHtml(lang === "vi" ? "Thông số" : "Specifications")}</h2><ul>${specs.map((s) => `<li><strong>${escapeHtml(s.label)}:</strong> ${escapeHtml(s.value)}</li>`).join("")}</ul></section>` : ""}
${product.description ? `<section><h2>${escapeHtml(lang === "vi" ? "Mô tả" : "Description")}</h2><p>${escapeHtml(product.description)}</p></section>` : ""}
<section><h2>${escapeHtml(lang === "vi" ? "Thông tin" : "Details")}</h2><ul>${facts}</ul></section>
${discoverNav(siteUrl, lang, product.shop ? [`<li><a href="${siteUrl}${lang === "vi" ? "/vi" : ""}/shop/store/${escapeHtml(product.shop.slug)}">${escapeHtml(lang === "vi" ? `Tất cả sản phẩm của ${shopName}` : `All products from ${shopName}`)}</a></li>`] : [])}
${swapLink(lang, enUrl, viUrl)}`;

  return htmlResponse(
    buildHtml({
      title,
      description,
      url: lang === "vi" ? viUrl : enUrl,
      siteUrl,
      lang,
      type: "product",
      ...(images[0] ? { image: images[0] } : {}),
      jsonLd,
      bodyContent,
      alternates,
      omitAutoHeader: true,
    }),
  );
}

// ─── 404 ────────────────────────────────────────────────────────────────────

/**
 * A missing (or suspended) shop/product answers 404, not a 200 shell. The
 * suspended case is deliberate: a 200 would tell a scraper the slug is real
 * and the shop merely hidden, which is the one bit the RPC refuses to leak.
 */
function render404Shop(siteUrl: string, lang: Lang): Response {
  const title = lang === "vi" ? "Không tìm thấy sản phẩm | ThePickleHub" : "Product not found | ThePickleHub";
  const res = htmlResponse(
    buildHtml({
      title,
      description: lang === "vi"
        ? "Sản phẩm hoặc cửa hàng này không còn tồn tại trên ThePickleHub."
        : "This product or store no longer exists on ThePickleHub.",
      url: `${siteUrl}${lang === "vi" ? "/vi" : ""}/shop`,
      siteUrl,
      lang,
      extraMeta: '<meta name="robots" content="noindex, follow">',
      bodyContent: `<h1>${escapeHtml(title)}</h1><p><a href="${siteUrl}${lang === "vi" ? "/vi" : ""}/shop">${escapeHtml(lang === "vi" ? "Về cửa hàng" : "Back to the shop")}</a></p>`,
      omitAutoHeader: true,
    }),
  );
  return new Response(res.body, { status: 404, headers: res.headers });
}
