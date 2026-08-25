/**
 * /sitemap-videos.xml — SEO-4 (2026-05-28)
 *
 * Lists every published video so /watch/:id detail pages (renderVideo
 * with VideoObject schema) can be discovered.
 *
 * Single-canonical surface — NO hreflang. The SPA toggles language via
 * the i18n context so one /watch/:id URL serves both locales; renderVideo
 * emits `singleCanonicalHreflang(..., "vi")` which is intentionally empty
 * (functions/_lib/utils.ts, "Batch 9" — a self-only hreflang triplet is
 * flagged by Ahrefs as "no return tag" / "referenced for more than one
 * language"). The sitemap must mirror that and omit hreflang, matching
 * the tournaments + matches segments.
 *
 * Limit 5000 — typical convention. Split into year-shards if we cross
 * 10k videos in the videos table.
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

interface VideoRow {
  id: string;
  published_at: string | null;
  created_at: string | null;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const siteUrl = context.env.CANONICAL_HOST || SITE_URL_DEFAULT;
  const TODAY = today();

  try {
    const supabase = createSupabaseClient(context.env);
    // Note: videos table has no `updated_at` column — only `created_at`
    // and `published_at`. Fall back to created_at when published_at null.
    //
    // CAP-01 (2026-08-25) — paged. PostgREST caps every response at 1000 rows
    // silently: `.limit(5000)` returns 1000 rows, HTTP 200, error = null (#644).
    // 6 videos today. `id` is the unique tie breaker; `published_at` is null on
    // some rows, and nulls sort together.
    const videos = await fetchAllRows<VideoRow>((from, to) =>
      supabase
        .from("videos")
        .select("id, published_at, created_at")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    );

    const entries = videos.map((v) => {
      const lastmod = toLastmod(v.published_at || v.created_at, TODAY);
      const url = `${siteUrl}/watch/${v.id}`;
      return buildUrlEntry({
        loc: url,
        lastmod,
        changefreq: "monthly",
        priority: "0.6",
      });
    });

    return new Response(wrapUrlset(entries), {
      status: 200,
      headers: SITEMAP_CACHE_HEADERS,
    });
  } catch (err) {
    console.error("sitemap-videos: fatal:", err);
    return new Response(wrapUrlset([]), {
      status: 503,
      headers: SITEMAP_CACHE_HEADERS,
    });
  }
};
