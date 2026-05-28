/**
 * /sitemap-videos.xml — SEO-4 (2026-05-28)
 *
 * Lists every published video so /watch/:id detail pages (renderVideo
 * with VideoObject schema) can be discovered. Single-canonical URLs
 * (the SPA toggles language via i18n context, same URL serves both
 * locales) — hreflang triplet points all three lang values at the
 * same href, matching the pattern in renderVideo.
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
  updated_at: string | null;
  published_at: string | null;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const siteUrl = context.env.CANONICAL_HOST || SITE_URL_DEFAULT;
  const TODAY = today();

  try {
    const supabase = createSupabaseClient(context.env);
    const { data, error } = await supabase
      .from("videos")
      .select("id, updated_at, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(5000);

    if (error) {
      console.error("sitemap-videos: query error:", error);
    }

    const entries = ((data ?? []) as VideoRow[]).map((v) => {
      const lastmod = toLastmod(v.updated_at || v.published_at, TODAY);
      const url = `${siteUrl}/watch/${v.id}`;
      return buildUrlEntry({
        loc: url,
        lastmod,
        changefreq: "monthly",
        priority: "0.6",
        hreflang: [
          { lang: "en", href: url },
          { lang: "vi", href: url },
          { lang: "x-default", href: url },
        ],
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
