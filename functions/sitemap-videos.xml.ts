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
    const { data, error } = await supabase
      .from("videos")
      .select("id, published_at, created_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(5000);

    if (error) {
      console.error("sitemap-videos: query error:", error);
    }

    const entries = ((data ?? []) as VideoRow[]).map((v) => {
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
