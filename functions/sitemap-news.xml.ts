/**
 * /sitemap-news.xml
 *
 * Phase 4 of the news aggregator feature.
 *
 * Lists every published news_items row with bidirectional hreflang. Each
 * EN row may have a VI sibling (produced by news-translate via
 * parent_news_id); we surface both URLs with the appropriate hreflang
 * pair. EN rows without a VI sibling get a single-language entry — the
 * VI URL is intentionally omitted rather than self-aliased so Google
 * doesn't index a non-existent page.
 *
 * Implementation note: we load both EN and VI rows in one query, group
 * by parent_news_id, then emit one urlset entry per pair. This is the
 * same shape as sitemap-blog.xml's pattern; the difference is we group
 * server-side because news rows don't carry the sibling slug directly.
 *
 * Rows are fetched in pages of 1000 (PostgREST's hard cap) via
 * fetchAllRows. A split (sitemap-news-2026.xml etc.) would be needed at
 * >10k URLs; until then keep it simple.
 */

import { createSupabaseClient } from "./_lib/supabase";
import {
  SITE_URL_DEFAULT,
  SITEMAP_CACHE_HEADERS,
  buildUrlEntry,
  fetchAllRows,
  toLastmod,
  today,
  wrapUrlset,
} from "./_lib/sitemap-helpers";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CANONICAL_HOST: string;
}

interface NewsRow {
  id: string;
  slug: string | null;
  language: "en" | "vi";
  updated_at: string | null;
  published_at: string | null;
  parent_news_id: string | null;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const siteUrl = context.env.CANONICAL_HOST || SITE_URL_DEFAULT;
  const TODAY = today();

  try {
    const supabase = createSupabaseClient(context.env);
    // Paged: PostgREST caps responses at 1000 rows, so the old .limit(5000)
    // silently truncated the sitemap to the ~500 newest articles.
    // `id` is the tie breaker — same-timestamp rows would otherwise shuffle
    // between pages and get lost.
    const rows = await fetchAllRows<NewsRow>((from, to) =>
      supabase
        .from("news_items")
        .select("id, slug, language, updated_at, published_at, parent_news_id")
        .eq("status", "published")
        .not("slug", "is", null)
        .order("published_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to)
    );

    // Index VI rows by parent_news_id so we can pair each EN row with its
    // sibling (when one exists). VI rows without a known EN parent are
    // skipped — they shouldn't happen in practice, but defending against
    // it keeps the sitemap valid.
    const viByParent = new Map<string, NewsRow>();
    for (const r of rows) {
      if (r.language === "vi" && r.parent_news_id) {
        viByParent.set(r.parent_news_id, r);
      }
    }

    const entries: string[] = [];

    for (const en of rows) {
      if (en.language !== "en" || !en.slug) continue;
      const vi = viByParent.get(en.id);
      const lastmod = toLastmod(en.updated_at ?? en.published_at, TODAY);

      // EN entry.
      const enHreflang = vi
        ? [
            { lang: "en", href: `${siteUrl}/news/${en.slug}` },
            { lang: "vi", href: `${siteUrl}/vi/news/${vi.slug}` },
            { lang: "x-default", href: `${siteUrl}/news/${en.slug}` },
          ]
        : [
            { lang: "en", href: `${siteUrl}/news/${en.slug}` },
            { lang: "x-default", href: `${siteUrl}/news/${en.slug}` },
          ];
      entries.push(
        buildUrlEntry({
          loc: `${siteUrl}/news/${en.slug}`,
          lastmod,
          changefreq: "weekly",
          priority: "0.6",
          hreflang: enHreflang,
        })
      );

      // VI entry (only when sibling exists).
      if (vi && vi.slug) {
        const viLastmod = toLastmod(vi.updated_at ?? vi.published_at, TODAY);
        entries.push(
          buildUrlEntry({
            loc: `${siteUrl}/vi/news/${vi.slug}`,
            lastmod: viLastmod,
            changefreq: "weekly",
            priority: "0.6",
            hreflang: [
              { lang: "en", href: `${siteUrl}/news/${en.slug}` },
              { lang: "vi", href: `${siteUrl}/vi/news/${vi.slug}` },
              { lang: "x-default", href: `${siteUrl}/news/${en.slug}` },
            ],
          })
        );
      }
    }

    // VI rows the loop above can never reach: it walks EN rows and pulls the
    // sibling in, so a VI article whose EN parent is missing (or is itself
    // unpublished / slug-less) drops out of the sitemap entirely. 61 rows were
    // in that state on 2026-08-23 — mostly a Feb–Mar seed batch that only ever
    // existed in Vietnamese. Emit them single-language: there is no EN URL to
    // pair with, and a self-referencing hreflang would be a lie.
    const enIds = new Set(rows.filter((r) => r.language === "en").map((r) => r.id));
    for (const vi of rows) {
      if (vi.language !== "vi" || !vi.slug) continue;
      if (vi.parent_news_id && enIds.has(vi.parent_news_id)) continue; // already emitted as a pair
      entries.push(
        buildUrlEntry({
          loc: `${siteUrl}/vi/news/${vi.slug}`,
          lastmod: toLastmod(vi.updated_at ?? vi.published_at, TODAY),
          changefreq: "weekly",
          priority: "0.6",
          hreflang: [
            { lang: "vi", href: `${siteUrl}/vi/news/${vi.slug}` },
            { lang: "x-default", href: `${siteUrl}/vi/news/${vi.slug}` },
          ],
        })
      );
    }

    return new Response(wrapUrlset(entries), {
      status: 200,
      headers: SITEMAP_CACHE_HEADERS,
    });
  } catch (err) {
    console.error("sitemap-news: fatal:", err);
    return new Response(wrapUrlset([]), {
      status: 503,
      headers: SITEMAP_CACHE_HEADERS,
    });
  }
};
