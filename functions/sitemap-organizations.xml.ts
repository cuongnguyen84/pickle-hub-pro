/**
 * /sitemap-organizations.xml — SEO-4 (2026-05-28)
 *
 * Lists every organization with a slug + at least one public-facing
 * surface. /org/:slug (renderOrgDetail with Organization JSON-LD) was
 * orphan vs sitemap before this segment — Google had to rely on
 * incidental links from livestreams / tournaments. Adding the segment
 * gives explicit discovery.
 *
 * Single-canonical surface — NO hreflang. /org/:slug serves both
 * locales from one URL via the SPA i18n toggle; renderOrgDetail emits
 * `singleCanonicalHreflang(..., "en")` which is intentionally empty
 * (functions/_lib/utils.ts, "Batch 9"). The earlier /vi/org/:slug
 * alternate was an orphan, non-canonical URL — _middleware.ts collapses
 * /vi/org/* to /org/* and the page canonical points back to EN, so the
 * sitemap must NOT advertise a `vi` href (Ahrefs/SEOnaut "Hreflang to
 * non-canonical URL"). Matches the tournaments + matches segments.
 *
 * Limit 5000.
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

interface OrgRow {
  slug: string | null;
  created_at: string | null;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const siteUrl = context.env.CANONICAL_HOST || SITE_URL_DEFAULT;
  const TODAY = today();

  try {
    const supabase = createSupabaseClient(context.env);
    // Note: organizations table has no `updated_at`; created_at only.
    const { data, error } = await supabase
      .from("organizations")
      .select("slug, created_at")
      .not("slug", "is", null)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) {
      console.error("sitemap-organizations: query error:", error);
    }

    const entries = ((data ?? []) as OrgRow[])
      .filter((o) => o.slug && URL_SAFE_SLUG_RE.test(o.slug))
      .map((o) => {
        const lastmod = toLastmod(o.created_at, TODAY);
        const url = `${siteUrl}/org/${o.slug}`;
        return buildUrlEntry({
          loc: url,
          lastmod,
          changefreq: "weekly",
          priority: "0.6",
        });
      });

    return new Response(wrapUrlset(entries), {
      status: 200,
      headers: SITEMAP_CACHE_HEADERS,
    });
  } catch (err) {
    console.error("sitemap-organizations: fatal:", err);
    return new Response(wrapUrlset([]), {
      status: 503,
      headers: SITEMAP_CACHE_HEADERS,
    });
  }
};
