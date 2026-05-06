/**
 * /sitemap-venues.xml — Phase 3B.3 NEW.
 *
 * All venues. Like /sitemap-players.xml, the /san/{slug} detail page lands
 * in Sprint 5 — URLs are emitted early so the indexing pipeline is warm
 * by then.
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
    const { data: venues, error } = await supabase
      .from("venues")
      .select("slug, updated_at")
      .order("updated_at", { ascending: false })
      .limit(5000);

    if (error) {
      console.error("sitemap-venues: query error:", error);
    }

    const entries = (venues || [])
      .filter((v: any) => v.slug && URL_SAFE_SLUG_RE.test(v.slug))
      .map((v: any) => {
        const lastmod = toLastmod(v.updated_at, TODAY);
        return buildUrlEntry({
          loc: `${siteUrl}/san/${v.slug}`,
          lastmod,
          changefreq: "monthly",
          priority: "0.5",
        });
      });

    return new Response(wrapUrlset(entries), { status: 200, headers: SITEMAP_CACHE_HEADERS });
  } catch (err) {
    console.error("sitemap-venues: fatal:", err);
    return new Response(wrapUrlset([]), { status: 503, headers: SITEMAP_CACHE_HEADERS });
  }
};
