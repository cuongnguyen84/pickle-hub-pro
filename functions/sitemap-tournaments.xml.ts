/**
 * /sitemap-tournaments.xml
 *
 * Public tournaments. Filtered through URL_SAFE_SLUG_RE to drop slugs that
 * would break Search Console validation (legacy data has tournament names
 * containing spaces).
 */

import { createSupabaseClient } from "./_lib/supabase";
import {
  SITE_URL_DEFAULT,
  SITEMAP_CACHE_HEADERS,
  URL_SAFE_SLUG_RE,
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

interface TournamentRow {
  slug: string | null;
  created_at: string | null;
  status: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const siteUrl = context.env.CANONICAL_HOST || SITE_URL_DEFAULT;
  const TODAY = today();

  try {
    const supabase = createSupabaseClient(context.env);
    // SEO-1.4 (2026-05-28) — only emit indexable tournaments. Production
    // statuses are 'ongoing' + 'ended' today; defensive whitelist excludes
    // any future 'cancelled' / 'archived' / 'draft' so they never reach
    // the sitemap.
    //
    // AUTOFIX (2026-06-05) — `tournaments` has no `updated_at` column
    // (only `created_at`), so the previous select failed with PostgREST
    // 42703 and this sitemap silently served an EMPTY urlset with HTTP
    // 200. Select `created_at` instead (same pattern as players/
    // organizations) and surface query errors as 503 so the failure
    // mode is visible to monitoring instead of silently de-listing
    // every tournament page.
    // CAP-01 (2026-08-25) — paged. PostgREST caps every response at 1000 rows
    // silently (`.limit(5000)` → 1000 rows, HTTP 200, error = null), the bug
    // that cost sitemap-news 209 URLs in #644. `tournaments` is only 15 rows
    // today, nowhere near the cap — this is here so the table can grow without
    // anyone having to remember that it must not pass 1000. `slug` is the
    // unique tie breaker; `start_date` alone repeats across same-day events.
    const tournaments = await fetchAllRows<TournamentRow>((from, to) =>
      supabase
        .from("tournaments")
        .select("slug, created_at, status")
        .in("status", ["ongoing", "ended", "upcoming"])
        .order("start_date", { ascending: false })
        .order("slug", { ascending: true })
        .range(from, to),
    );

    if (tournaments.length === 0) {
      // An empty result here is indistinguishable from a failed query, and
      // AUTOFIX 2026-06-05 (below) is the precedent: a bad select served an
      // empty urlset with HTTP 200 and silently de-listed every tournament.
      // 503 keeps that failure mode visible to monitoring.
      console.error("sitemap-tournaments: no rows returned");
      return new Response(wrapUrlset([]), { status: 503, headers: SITEMAP_CACHE_HEADERS });
    }

    // NOTE — no <xhtml:link hreflang> block here on purpose: SEO audit
    // batch 5 made tournament pages single-locale (/vi/tournament/* now
    // 301s to the EN canonical), so advertising a vi alternate in the
    // sitemap would point hreflang at a redirect.
    const entries = tournaments
      .filter((t) => t.slug && URL_SAFE_SLUG_RE.test(t.slug))
      .map((t) => {
        const lastmod = toLastmod(t.created_at, TODAY);
        return buildUrlEntry({
          loc: `${siteUrl}/tournament/${t.slug}`,
          lastmod,
          changefreq: "weekly",
          priority: "0.7",
        });
      });

    return new Response(wrapUrlset(entries), { status: 200, headers: SITEMAP_CACHE_HEADERS });
  } catch (err) {
    console.error("sitemap-tournaments: fatal:", err);
    return new Response(wrapUrlset([]), { status: 503, headers: SITEMAP_CACHE_HEADERS });
  }
};
