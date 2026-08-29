/**
 * /sitemap-shop.xml — Phase 4 public launch.
 *
 * Product detail, storefront and category pages, both locales, with reciprocal
 * hreflang. /shop itself lives in sitemap-static.xml with the other hub pages.
 *
 * Two rules this file exists to keep:
 *
 *  1. It answers an EMPTY urlset — not a 404, not a 503 — while
 *     SHOP_PUBLIC_INDEXING is off. The sitemap index references the segment
 *     unconditionally, and a segment that 404s makes the whole index look
 *     broken in Search Console. An empty one is a legitimate "nothing here
 *     yet" and flips to full the moment the gate opens, with no redeploy.
 *
 *  2. It lists exactly what shop_public_search would show a stranger. Reading
 *     the products table directly here would put draft and rejected listings
 *     in the sitemap — the surface Google trusts most — while every rendered
 *     page correctly hid them. The RPC is SECURITY DEFINER and already carries
 *     the approved/published/active/has-media filter, so it is the only
 *     honest source. Its cap is 48 per call, hence the cursor loop.
 */

import { createSupabaseClient } from "./_lib/supabase";
import {
  SITE_URL_DEFAULT,
  SITEMAP_CACHE_HEADERS,
  URL_SAFE_SLUG_RE,
  buildUrlEntry,
  toLastmod,
  today,
  wrapUrlset,
} from "./_lib/sitemap-helpers";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CANONICAL_HOST: string;
  SHOP_PUBLIC_INDEXING?: string;
}

const PAGE = 48;
/** 20 pages ≈ 960 products. Well past the pilot; a real cap, not a promise. */
const MAX_PAGES = 20;

interface SearchRow {
  id: string;
  slug: string;
  created_at: string | null;
  shop: { slug: string } | null;
  category: { slug: string } | null;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const siteUrl = context.env.CANONICAL_HOST || SITE_URL_DEFAULT;
  const TODAY = today();

  // Same gate as the middleware and robots.txt, read at request time.
  if (context.env.SHOP_PUBLIC_INDEXING !== "1") {
    return new Response(wrapUrlset([]), { status: 200, headers: SITEMAP_CACHE_HEADERS });
  }

  try {
    const supabase = createSupabaseClient(context.env);

    const products: SearchRow[] = [];
    let cursorAt: string | null = null;
    let cursorId: string | null = null;

    for (let page = 0; page < MAX_PAGES; page++) {
      const { data, error } = await supabase.rpc("shop_public_search", {
        _limit: PAGE,
        _sort: "recent",
        ...(cursorAt ? { _cursor_at: cursorAt, _cursor_id: cursorId } : {}),
      });
      if (error) {
        console.error("sitemap-shop: rpc error:", error);
        break;
      }
      const payload = data as { rows?: SearchRow[]; has_more?: boolean } | null;
      const rows = payload?.rows ?? [];
      products.push(...rows);
      if (!payload?.has_more || rows.length === 0) break;
      const last = rows[rows.length - 1];
      cursorAt = last.created_at;
      cursorId = last.id;
      if (page === MAX_PAGES - 1) {
        // Never truncate silently — a sitemap that stops at 960 URLs and says
        // nothing reads as "we listed everything".
        console.warn(`sitemap-shop: hit MAX_PAGES, ${products.length} products listed, more exist`);
      }
    }

    const pair = (path: string, lastmod: string, priority: string, changefreq: string) => {
      const enLoc = `${siteUrl}${path}`;
      const viLoc = `${siteUrl}/vi${path}`;
      const hreflang = [
        { lang: "en", href: enLoc },
        { lang: "vi", href: viLoc },
        { lang: "x-default", href: viLoc }, // must match localePair() in render/shop.ts
      ];
      return [
        buildUrlEntry({ loc: enLoc, lastmod, changefreq, priority, hreflang }),
        buildUrlEntry({ loc: viLoc, lastmod, changefreq, priority, hreflang }),
      ];
    };

    // /shop itself lives here rather than in sitemap-static.xml: static has no
    // launch flag, so listing the hub there would have advertised the
    // catalogue while the gate was still shut.
    const hubEntries = pair("/shop", TODAY, "0.8", "daily");

    const productEntries = products
      .filter((p) => p.slug && URL_SAFE_SLUG_RE.test(p.slug))
      .flatMap((p) =>
        // weekly, not daily: the page changes when the seller edits it, and
        // price/stock churn is handled by the 5-minute prerender TTL instead.
        pair(`/shop/product/${p.slug}`, toLastmod(p.created_at, TODAY), "0.7", "weekly"),
      );

    // Storefronts and categories, deduped from the same rows — no extra query,
    // and by construction each one has at least one publicly visible product,
    // so no empty page reaches the sitemap.
    const shopSlugs = [...new Set(products.map((p) => p.shop?.slug).filter(Boolean) as string[])];
    const catSlugs = [...new Set(products.map((p) => p.category?.slug).filter(Boolean) as string[])];

    const storeEntries = shopSlugs
      .filter((s) => URL_SAFE_SLUG_RE.test(s))
      .flatMap((s) => pair(`/shop/store/${s}`, TODAY, "0.6", "weekly"));

    const categoryEntries = catSlugs
      .filter((s) => URL_SAFE_SLUG_RE.test(s))
      .flatMap((s) => pair(`/shop/category/${s}`, TODAY, "0.6", "weekly"));

    return new Response(wrapUrlset([...hubEntries, ...productEntries, ...storeEntries, ...categoryEntries]), {
      status: 200,
      headers: SITEMAP_CACHE_HEADERS,
    });
  } catch (err) {
    console.error("sitemap-shop: fatal:", err);
    return new Response(wrapUrlset([]), { status: 503, headers: SITEMAP_CACHE_HEADERS });
  }
};
