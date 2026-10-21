/**
 * /sitemap-livestreams.xml — SEO-4 (2026-05-28)
 *
 * Lists every public livestream (live + scheduled + ended/recent) so
 * /live/:id detail pages (renderLive with VideoObject + SportsEvent
 * schema) can be discovered. Stream URLs are valuable SEO surfaces
 * even after the broadcast ends because the page still serves the
 * recording + match metadata.
 *
 * Single-canonical surface — NO hreflang. The SPA toggles language so
 * one /live/:id URL serves both locales; renderLive emits
 * `singleCanonicalHreflang(..., "vi")` which is intentionally empty
 * (functions/_lib/utils.ts, "Batch 9"). The sitemap mirrors that and
 * omits hreflang, matching the tournaments + matches segments.
 * Excludes private/test streams via the public_livestreams view.
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

interface StreamRow {
  id: string;
  status: string;
  created_at: string | null;
  scheduled_start_at: string | null;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const siteUrl = context.env.CANONICAL_HOST || SITE_URL_DEFAULT;
  const TODAY = today();

  try {
    const supabase = createSupabaseClient(context.env);
    // CAP-01 (2026-08-25) — paged. PostgREST caps every response at 1000 rows
    // silently: `.limit(5000)` returns 1000 rows, HTTP 200, error = null. That
    // is how sitemap-news served 500 of 709 articles for months (#644). 29
    // streams today, but every livestream ever created lands here, so this
    // table only goes one way. `id` is the unique tie breaker.
    const streams = await fetchAllRows<StreamRow>((from, to) =>
      supabase
        .from("public_livestreams")
        .select("id, status, created_at, scheduled_start_at")
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    );

    const entries = streams.map((s) => {
      const lastmod = toLastmod(s.scheduled_start_at || s.created_at, TODAY);
      const url = `${siteUrl}/live/${s.id}`;
      // Live + scheduled streams refresh fast; ended streams behave
      // like videos and rarely change.
      const changefreq = s.status === "live" || s.status === "scheduled"
        ? "hourly"
        : "monthly";
      return buildUrlEntry({
        loc: url,
        lastmod,
        changefreq,
        priority: s.status === "live" ? "0.9" : "0.6",
      });
    });

    return new Response(wrapUrlset(entries), {
      status: 200,
      headers: SITEMAP_CACHE_HEADERS,
    });
  } catch (err) {
    console.error("sitemap-livestreams: fatal:", err);
    return new Response(wrapUrlset([]), {
      status: 503,
      headers: SITEMAP_CACHE_HEADERS,
    });
  }
};
