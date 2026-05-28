/**
 * /sitemap-organizations.xml — SEO-4 (2026-05-28)
 *
 * Lists every organization with a slug + at least one public-facing
 * surface. /org/:slug (renderOrgDetail with Organization JSON-LD) was
 * orphan vs sitemap before this segment — Google had to rely on
 * incidental links from livestreams / tournaments. Adding the segment
 * gives explicit discovery.
 *
 * Bilingual hreflang: /org/:slug + /vi/org/:slug both exist as React
 * routes (App.tsx), renderOrgDetail emits the reciprocal `<link>` since
 * Sprint SEO-1.2.
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
  updated_at: string | null;
  created_at: string | null;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const siteUrl = context.env.CANONICAL_HOST || SITE_URL_DEFAULT;
  const TODAY = today();

  try {
    const supabase = createSupabaseClient(context.env);
    const { data, error } = await supabase
      .from("organizations")
      .select("slug, updated_at, created_at")
      .not("slug", "is", null)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) {
      console.error("sitemap-organizations: query error:", error);
    }

    const entries = ((data ?? []) as OrgRow[])
      .filter((o) => o.slug && URL_SAFE_SLUG_RE.test(o.slug))
      .map((o) => {
        const lastmod = toLastmod(o.updated_at || o.created_at, TODAY);
        const enUrl = `${siteUrl}/org/${o.slug}`;
        const viUrl = `${siteUrl}/vi/org/${o.slug}`;
        return buildUrlEntry({
          loc: enUrl,
          lastmod,
          changefreq: "weekly",
          priority: "0.6",
          hreflang: [
            { lang: "en", href: enUrl },
            { lang: "vi", href: viUrl },
            { lang: "x-default", href: enUrl },
          ],
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
