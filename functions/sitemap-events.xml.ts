/**
 * /sitemap-events.xml
 *
 * Public social events + club landing pages. Only published+public events
 * are emitted; cancelled / completed events stay reachable but drop out
 * of the sitemap once start_at < now - 30 days to keep the file size
 * bounded.
 *
 * Hreflang: single canonical URL serves both VI and EN (SPA toggles via
 * useI18n context), so en/vi/x-default all point at the same /social/*
 * or /clb/* path. Matches the convention from sitemap-players.xml.
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
      .map((e) => {
        const loc = `${siteUrl}/social/${e.slug}`;
        return buildUrlEntry({
          loc,
          lastmod: toLastmod(e.updated_at, TODAY),
          changefreq: "daily",
          priority: "0.8",
          hreflang: [
            { lang: "en", href: loc },
            { lang: "vi", href: loc },
            { lang: "x-default", href: loc },
          ],
        });
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
