/**
 * Master sitemap-index — references the 6 segment sitemaps.
 *
 * Phase 3B.3 split the legacy monolithic /sitemap.xml into 6 segments:
 *   /sitemap-static.xml      — landing + tools + privacy/terms (static URLs)
 *   /sitemap-blog.xml        — EN + VI blog posts (with hreflang)
 *   /sitemap-tournaments.xml — public tournaments
 *   /sitemap-matches.xml     — verified + pending matches < 365d
 *   /sitemap-players.xml     — non-ghost VN profiles (PlayerProfile SSR live)
 *   /sitemap-venues.xml      — venues + city hubs (renderVenueDetail SSR live)
 *
 * Both player and venue detail pages now ship bot-prerender SSR
 * (renderPlayerProfile / renderVenueDetail), so every emitted URL resolves
 * to a real 200 with schema — no longer the early "warm the pipeline before
 * the page exists" placeholder this index started as.
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
  "/sitemap-news.xml",
  "/sitemap-tournaments.xml",
  "/sitemap-matches.xml",
  "/sitemap-events.xml",
  // Sprint A4 (2026-05-27) — re-enabled. The orphan issue from May 2026
  // is now solved by the Vietnam leaderboard at /rankings + the
  // PlayersNearRating widget on each PlayerProfile, both shipped in
  // Sprint A. Every public profile now has multiple in-app inlinks.
  // Sitemap also now filters is_public_profile=true (Sprint A4 update
  // in sitemap-players.xml.ts) so only opt-in profiles get crawled.
  "/sitemap-players.xml",
  // SEO-4 (2026-05-28) — new segments. Routes had SSR handlers since
  // earlier sprints but the sitemap-index didn't reference them, so
  // bots had to discover via incidental links. videos/livestreams pages
  // emit VideoObject + SportsEvent schemas; orgs emit Organization
  // — high-value rich-result surfaces that benefit from explicit
  // discovery.
  "/sitemap-videos.xml",
  "/sitemap-livestreams.xml",
  "/sitemap-organizations.xml",
  // /sitemap-venues.xml — emits /san/{slug} venue detail + /san/khu-vuc/{city}
  // hub URLs. Was held out in the 2026-05-18 Ahrefs Site Audit fix (Round 1)
  // because no SSR handler existed; re-enabled 2026-06 now that
  // renderVenueDetail + renderVenuesCity ship bot-prerender (functions/_lib/
  // render/venues.ts), so every URL resolves to a real 200.
  "/sitemap-venues.xml",
];

export const onRequest: PagesFunction<Env> = (context) => {
  const siteUrl = context.env.CANONICAL_HOST || SITE_URL_DEFAULT;
  const xml = wrapSitemapIndex(siteUrl, SEGMENT_PATHS, today());
  return new Response(xml, { status: 200, headers: SITEMAP_CACHE_HEADERS });
};
