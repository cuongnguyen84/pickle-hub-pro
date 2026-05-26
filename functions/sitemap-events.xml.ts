/**
 * /sitemap-events.xml
 *
 * Public social events + club landing pages. Only published+public events
 * are emitted; cancelled / completed events stay reachable but drop out
 * of the sitemap once start_at < now - 30 days to keep the file size
 * bounded.
 *
 * Hreflang: as of 2026-05-20, /social/{slug} now ships split EN/VI
 * canonicals (/social/{slug} EN, /vi/social/{slug} VI) so the
 * hreflang block here mirrors that split. /clb/{slug} remains single-
 * canonical (no VI mirror route yet) and keeps its all-pointing-to-same
 * pattern from PR (2026-05-18 Ahrefs Site Audit fix).
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

interface EventRow {
  slug: string;
  updated_at: string | null;
  start_at: string;
}

interface ClubRow {
  slug: string;
  created_at: string | null;
}

const STALE_CUTOFF_DAYS = 30;

export const onRequest: PagesFunction<Env> = async (context) => {
  const siteUrl = context.env.CANONICAL_HOST || SITE_URL_DEFAULT;
  const TODAY = today();
  const cutoffIso = new Date(
    Date.now() - STALE_CUTOFF_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  try {
    const supabase = createSupabaseClient(context.env);
    const [eventsRes, clubsRes] = await Promise.all([
      supabase
        .from("social_events")
        .select("slug, updated_at, start_at")
        .eq("status", "published")
        .eq("visibility", "public")
        .gte("start_at", cutoffIso)
        .order("start_at", { ascending: false })
        .limit(5000),
      supabase
        .from("clubs")
        .select("slug, created_at")
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);

    if (eventsRes.error) {
      console.error("sitemap-events: events query error:", eventsRes.error);
    }
    if (clubsRes.error) {
      console.error("sitemap-events: clubs query error:", clubsRes.error);
    }

    const eventEntries = ((eventsRes.data ?? []) as EventRow[])
      .filter((e) => e.slug && URL_SAFE_SLUG_RE.test(e.slug))
      .flatMap((e) => {
        const enLoc = `${siteUrl}/social/${e.slug}`;
        const viLoc = `${siteUrl}/vi/social/${e.slug}`;
        const lastmod = toLastmod(e.updated_at, TODAY);
        const hreflang = [
          { lang: "en", href: enLoc },
          { lang: "vi", href: viLoc },
          { lang: "x-default", href: enLoc },
        ];
        return [
          buildUrlEntry({
            loc: enLoc,
            lastmod,
            changefreq: "daily",
            priority: "0.8",
            hreflang,
          }),
          buildUrlEntry({
            loc: viLoc,
            lastmod,
            changefreq: "daily",
            priority: "0.8",
            hreflang,
          }),
        ];
      });

    const clubEntries = ((clubsRes.data ?? []) as ClubRow[])
      .filter((c) => c.slug && URL_SAFE_SLUG_RE.test(c.slug))
      .map((c) => {
        const loc = `${siteUrl}/clb/${c.slug}`;
        return buildUrlEntry({
          loc,
          lastmod: toLastmod(c.created_at, TODAY),
          changefreq: "weekly",
          priority: "0.6",
          hreflang: [
            { lang: "en", href: loc },
            { lang: "vi", href: loc },
            { lang: "x-default", href: loc },
          ],
        });
      });

    return new Response(wrapUrlset([...eventEntries, ...clubEntries]), {
      status: 200,
      headers: SITEMAP_CACHE_HEADERS,
    });
  } catch (err) {
    console.error("sitemap-events: fatal:", err);
    return new Response(wrapUrlset([]), {
      status: 503,
      headers: SITEMAP_CACHE_HEADERS,
    });
  }
};
