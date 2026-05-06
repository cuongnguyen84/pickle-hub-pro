/**
 * /sitemap-matches.xml — Phase 3B.3 NEW.
 *
 * Verified + pending public matches played in the last 365 days. Disputed,
 * rejected, and expired matches are intentionally excluded — those URLs
 * still resolve via /tran-dau/{slug} but shouldn't be promoted to Google.
 *
 * Hard cap of 5000 matches per sitemap; once we approach this we'll
 * partition by year (sitemap-matches-2026.xml etc).
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
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const siteUrl = context.env.CANONICAL_HOST || SITE_URL_DEFAULT;
  const TODAY = today();

  try {
    const supabase = createSupabaseClient(context.env);
    const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

    const { data: matches, error } = await supabase
      .from("matches")
      .select("slug, updated_at")
      .eq("is_public", true)
      .in("verification_status", ["verified", "pending"])
      .gte("played_at", cutoff)
      .order("updated_at", { ascending: false })
      .limit(5000);

    if (error) {
      console.error("sitemap-matches: query error:", error);
    }

    const entries = (matches || [])
      .filter((m: any) => m.slug && URL_SAFE_SLUG_RE.test(m.slug))
      .map((m: any) => {
        const lastmod = toLastmod(m.updated_at, TODAY);
        return buildUrlEntry({
          loc: `${siteUrl}/tran-dau/${m.slug}`,
          lastmod,
          changefreq: "weekly",
          priority: "0.7",
        });
      });

    return new Response(wrapUrlset(entries), { status: 200, headers: SITEMAP_CACHE_HEADERS });
  } catch (err) {
    console.error("sitemap-matches: fatal:", err);
    return new Response(wrapUrlset([]), { status: 503, headers: SITEMAP_CACHE_HEADERS });
  }
};
