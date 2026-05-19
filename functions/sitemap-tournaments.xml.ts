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
    const { data: tournaments, error } = await supabase
      .from("tournaments")
      .select("slug, updated_at")
      .order("start_date", { ascending: false })
      .limit(5000);

    if (error) {
      console.error("sitemap-tournaments: query error:", error);
    }

    const entries = (tournaments || [])
      .filter((t: any) => t.slug && URL_SAFE_SLUG_RE.test(t.slug))
      .map((t: any) => {
        const lastmod = toLastmod(t.updated_at, TODAY);
        return buildUrlEntry({
          loc: `${siteUrl}/tournament/${t.slug}`,
          lastmod,
          changefreq: "weekly",
          priority: "0.7",
          hreflang: [
            { lang: "en", href: `${siteUrl}/tournament/${t.slug}` },
            { lang: "vi", href: `${siteUrl}/vi/tournament/${t.slug}` },
            { lang: "x-default", href: `${siteUrl}/tournament/${t.slug}` },
          ],
        });
      });

    return new Response(wrapUrlset(entries), { status: 200, headers: SITEMAP_CACHE_HEADERS });
  } catch (err) {
    console.error("sitemap-tournaments: fatal:", err);
    return new Response(wrapUrlset([]), { status: 503, headers: SITEMAP_CACHE_HEADERS });
  }
};
