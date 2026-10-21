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

/**
 * How far back sitemap-news.xml advertises. 90 days covered 696 of the 937
 * published VI rows on 2026-09-07; the 241 it drops had produced effectively
 * no search traffic. Raise it only against fresh GSC evidence that older
 * articles earn clicks — the number is a traffic judgement, not a convention.
 */
export const NEWS_SITEMAP_WINDOW_DAYS = 90;

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
    //
    // ─── 2026-09-07: recency window ──────────────────────────────────────
    // GSC export of the same date: 206 of the 419 URLs in "Discovered –
    // currently not indexed" are /vi/news/*, and not one EN news URL is in
    // there. Google is not failing to find this cluster; it found all 937 of
    // them, crawled ~695, and stopped. Over the 90 days to 2026-09-04 those
    // 695 crawled URLs returned 116 clicks and 5,457 impressions in total,
    // with 622 of them on zero clicks — 0.12 clicks per URL per quarter,
    // against 65 for a blog post.
    //
    // A sitemap is a request to spend crawl budget, not an index. Asking for
    // all 937 while intake runs at ~290/month is asking Google to re-evaluate
    // a cluster it has already judged, every time it reads the index. The
    // window keeps the ask proportional to what the cluster earns; older
    // articles stay 200, stay linked from /news, and stay indexed if they
    // already are — they simply stop being advertised.
    //
    // This is a throttle on the *ask*, not a fix for the *cluster*. The 0.12
    // clicks/URL number is a verdict on machine-translated aggregation, and no
    // sitemap change moves it — see docs/defects/ note in the PR body.
    const windowStart = new Date(Date.now() - NEWS_SITEMAP_WINDOW_DAYS * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const rows = await fetchAllRows<NewsRow>((from, to) =>
      supabase
        .from("news_items")
        .select("id, slug, language, updated_at, published_at, parent_news_id")
        .eq("status", "published")
        .not("slug", "is", null)
        .gte("published_at", windowStart)
        .order("published_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to)
    );

    const entries: string[] = [];

    // C3 (2026-08-25) — VI only. The EN feed is noindex (see the block in
    // functions/_lib/render/news.ts), and a sitemap must not advertise URLs
    // that carry a noindex: it asks Google to spend crawl budget confirming a
    // directive we already know the answer to, and it is a contradictory
    // signal on its face.
    //
    // Every VI row is emitted, whether or not it has an EN parent, and it
    // self-references in hreflang. Pairing with the EN URL would put a
    // noindexed page in the cluster, which is the one thing hreflang must
    // never do — so the EN/VI pairing index this loop used to need is gone.
    for (const vi of rows) {
      if (vi.language !== "vi" || !vi.slug) continue;
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
