/**
 * Master sitemap-index — references the 6 segment sitemaps.
 *
 * Phase 3B.3 split the legacy monolithic /sitemap.xml into 6 segments:
 *   /sitemap-static.xml      — landing + tools + privacy/terms (static URLs)
 *   /sitemap-blog.xml        — EN + VI blog posts (with hreflang)
 *   /sitemap-tournaments.xml — public tournaments
 *   /sitemap-matches.xml     — verified + pending matches < 365d
 *   /sitemap-players.xml     — non-ghost VN profiles (page lands Sprint 3)
 *   /sitemap-venues.xml      — venues (page lands Sprint 5)
 *
 * Players + venues URLs are emitted intentionally even though their detail
 * pages aren't built yet — Google discovers the URL pattern early so the
 * indexing pipeline is warm by the time the pages ship. Until then the
 * SPA serves a 404, which is the correct signal for crawlers.
 */

import {
  SITE_URL_DEFAULT,
  SITEMAP_CACHE_HEADERS,
  today,
  wrapSitemapIndex,
} from "./_lib/sitemap-helpers";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CANONICAL_HOST: string;
}

const SEGMENT_PATHS = [
  "/sitemap-static.xml",
  "/sitemap-blog.xml",
  "/sitemap-tournaments.xml",
  "/sitemap-matches.xml",
  "/sitemap-events.xml",
  // PR (2026-05-18 Ahrefs Site Audit Round 2 fix) — removed.
  // sitemap-players emitted /nguoi-choi/{username} URLs that were
  // legitimately orphan in Ahrefs (no internal link from any page).
  // Round 1 already filtered incomplete-onboarding profiles, but the
  // remaining 14 active profiles still flagged as orphan because there
  // is no /nguoi-choi/ directory page providing inlinks. Re-enable
  // when Sprint 3 ships the directory listing page.
  // "/sitemap-players.xml",
  // PR (2026-05-18 Ahrefs Site Audit fix Round 1) — /sitemap-venues.xml
  // emitted /san/{slug} URLs but no `renderVenue` SSR handler exists
  // (Sprint 5 page). Re-enable once /san/{slug} ships SSR.
  // "/sitemap-venues.xml",
];

export const onRequest: PagesFunction<Env> = (context) => {
  const siteUrl = context.env.CANONICAL_HOST || SITE_URL_DEFAULT;
  const xml = wrapSitemapIndex(siteUrl, SEGMENT_PATHS, today());
  return new Response(xml, { status: 200, headers: SITEMAP_CACHE_HEADERS });
};
