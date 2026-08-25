/**
 * /sitemap-static.xml
 *
 * Hand-curated static landing/utility URLs (homepage, tools, privacy, etc.).
 * EN blog post URLs live here too — they're a known, slow-moving list that
 * doesn't justify a query, and the bilingual hreflang is computed against
 * the dynamic vi_blog_posts mapping.
 */

import { createSupabaseClient } from "./_lib/supabase";
import { EN_BLOG_SLUGS } from "./_lib/static-blog-slugs";
import {
  SITE_URL_DEFAULT,
  SITEMAP_CACHE_HEADERS,
  buildUrlEntry,
  fetchAllRows,
  today,
  wrapUrlset,
  type UrlEntry,
} from "./_lib/sitemap-helpers";

export { EN_BLOG_SLUGS } from "./_lib/static-blog-slugs";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CANONICAL_HOST: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const siteUrl = context.env.CANONICAL_HOST || SITE_URL_DEFAULT;
  const TODAY = today();

  const bilingual = (enPath: string, viPath: string) => [
    { lang: "en", href: `${siteUrl}${enPath}` },
    { lang: "vi", href: `${siteUrl}${viPath}` },
    { lang: "x-default", href: `${siteUrl}${enPath}` },
  ];

  const enOnly = (enPath: string) => [
    { lang: "en", href: `${siteUrl}${enPath}` },
    { lang: "x-default", href: `${siteUrl}${enPath}` },
  ];

  const STATIC_URLS: UrlEntry[] = [
    { loc: "/", changefreq: "daily", priority: "1.0", lastmod: TODAY, hreflang: bilingual("/", "/vi") },
    { loc: "/vi", changefreq: "daily", priority: "0.9", lastmod: TODAY, hreflang: bilingual("/", "/vi") },
    { loc: "/live", changefreq: "hourly", priority: "0.9", lastmod: TODAY, hreflang: bilingual("/live", "/vi/live") },
    { loc: "/vi/live", changefreq: "hourly", priority: "0.9", lastmod: TODAY, hreflang: bilingual("/live", "/vi/live") },
    { loc: "/tournaments", changefreq: "daily", priority: "0.8", lastmod: TODAY, hreflang: bilingual("/tournaments", "/vi/tournaments") },
    { loc: "/vi/tournaments", changefreq: "daily", priority: "0.8", lastmod: TODAY, hreflang: bilingual("/tournaments", "/vi/tournaments") },
    { loc: "/videos", changefreq: "daily", priority: "0.7", lastmod: TODAY, hreflang: bilingual("/videos", "/vi/videos") },
    { loc: "/vi/videos", changefreq: "daily", priority: "0.7", lastmod: TODAY, hreflang: bilingual("/videos", "/vi/videos") },
    { loc: "/news", changefreq: "daily", priority: "0.7", lastmod: TODAY, hreflang: bilingual("/news", "/vi/news") },
    { loc: "/vi/news", changefreq: "daily", priority: "0.7", lastmod: TODAY, hreflang: bilingual("/news", "/vi/news") },
    { loc: "/forum", changefreq: "daily", priority: "0.7", lastmod: TODAY, hreflang: bilingual("/forum", "/vi/forum") },
    { loc: "/vi/forum", changefreq: "daily", priority: "0.7", lastmod: TODAY, hreflang: bilingual("/forum", "/vi/forum") },
    // Sprint 4 Phase 4A shipped /feed + /vi/feed (Bet #1 social entry).
    // Phase 4D: emit in sitemap so the trending discovery surface is
    // crawlable. hourly changefreq matches the engagement-weighted RPC's
    // typical refresh cadence — kudos/comments shift the order constantly.
    { loc: "/feed", changefreq: "hourly", priority: "0.8", lastmod: TODAY, hreflang: bilingual("/feed", "/vi/feed") },
    { loc: "/vi/feed", changefreq: "hourly", priority: "0.8", lastmod: TODAY, hreflang: bilingual("/feed", "/vi/feed") },
    // PR73 Phase 2B shipped these as Social Events MVP hub list pages on a
    // single canonical serving both locales. 2026-08-17 moved /clubs off
    // that pattern and 2026-08-19 moved /social — renderSocialList and
    // renderClubList now self-reference each locale, so both URLs are
    // submitted and each hreflang array points at two distinct URLs.
    { loc: "/social", changefreq: "daily", priority: "0.8", lastmod: TODAY, hreflang: bilingual("/social", "/vi/social") },
    { loc: "/vi/social", changefreq: "daily", priority: "0.8", lastmod: TODAY, hreflang: bilingual("/social", "/vi/social") },
    { loc: "/clubs", changefreq: "daily", priority: "0.7", lastmod: TODAY, hreflang: bilingual("/clubs", "/vi/clubs") },
    { loc: "/vi/clubs", changefreq: "daily", priority: "0.7", lastmod: TODAY, hreflang: bilingual("/clubs", "/vi/clubs") },
    { loc: "/tools", changefreq: "weekly", priority: "0.8", lastmod: TODAY, hreflang: bilingual("/tools", "/vi/tools") },
    { loc: "/vi/tools", changefreq: "weekly", priority: "0.8", lastmod: TODAY, hreflang: bilingual("/tools", "/vi/tools") },
    { loc: "/tools/flex-tournament", changefreq: "weekly", priority: "0.8", lastmod: TODAY, hreflang: enOnly("/tools/flex-tournament") },
    { loc: "/tools/doubles-elimination", changefreq: "weekly", priority: "0.7", lastmod: TODAY, hreflang: enOnly("/tools/doubles-elimination") },
    { loc: "/tools/quick-tables", changefreq: "weekly", priority: "0.7", lastmod: TODAY, hreflang: enOnly("/tools/quick-tables") },
    { loc: "/tools/team-match", changefreq: "weekly", priority: "0.7", lastmod: TODAY, hreflang: enOnly("/tools/team-match") },
    { loc: "/blog", changefreq: "weekly", priority: "0.7", lastmod: TODAY, hreflang: bilingual("/blog", "/vi/blog") },
    { loc: "/vi/blog", changefreq: "weekly", priority: "0.8", lastmod: TODAY, hreflang: bilingual("/blog", "/vi/blog") },
    // SEO-1.1 (2026-05-28) — Sprint A Vietnam DUPR leaderboard SSR
    // shipped a month ago but the URL was never added to the sitemap.
    // Adding now so Google + Bing can discover the unique Vietnam-scope
    // ranking content surfaced by dupr_leaderboard_vietnam RPC.
    { loc: "/rankings", changefreq: "daily", priority: "0.9", lastmod: TODAY, hreflang: bilingual("/rankings", "/vi/rankings") },
    { loc: "/vi/rankings", changefreq: "daily", priority: "0.9", lastmod: TODAY, hreflang: bilingual("/rankings", "/vi/rankings") },
    { loc: "/rankings/ppa-tour", changefreq: "weekly", priority: "0.7", lastmod: TODAY, hreflang: bilingual("/rankings/ppa-tour", "/vi/rankings/ppa-tour") },
    { loc: "/vi/rankings/ppa-tour", changefreq: "weekly", priority: "0.7", lastmod: TODAY, hreflang: bilingual("/rankings/ppa-tour", "/vi/rankings/ppa-tour") },
    // SEO-1.1 — bracket / tournament tool public landing pages. Each has
    // a dedicated SSR handler (renderToolNewPage) but were never added
    // to the sitemap.
    { loc: "/tools/doubles-elimination/new", changefreq: "weekly", priority: "0.6", lastmod: TODAY, hreflang: enOnly("/tools/doubles-elimination/new") },
    { loc: "/tools/flex-tournament/new", changefreq: "weekly", priority: "0.6", lastmod: TODAY, hreflang: enOnly("/tools/flex-tournament/new") },
    { loc: "/tools/team-match/new", changefreq: "weekly", priority: "0.6", lastmod: TODAY, hreflang: enOnly("/tools/team-match/new") },
    { loc: "/privacy", changefreq: "monthly", priority: "0.3", lastmod: TODAY, hreflang: bilingual("/privacy", "/vi/privacy") },
    { loc: "/vi/privacy", changefreq: "monthly", priority: "0.3", lastmod: TODAY, hreflang: bilingual("/privacy", "/vi/privacy") },
    { loc: "/about", changefreq: "monthly", priority: "0.4", lastmod: TODAY, hreflang: bilingual("/about", "/vi/about") },
    { loc: "/vi/about", changefreq: "monthly", priority: "0.4", lastmod: TODAY, hreflang: bilingual("/about", "/vi/about") },
    { loc: "/contact", changefreq: "monthly", priority: "0.3", lastmod: TODAY, hreflang: bilingual("/contact", "/vi/contact") },
    { loc: "/vi/contact", changefreq: "monthly", priority: "0.3", lastmod: TODAY, hreflang: bilingual("/contact", "/vi/contact") },
    { loc: "/terms", changefreq: "monthly", priority: "0.3", lastmod: TODAY, hreflang: bilingual("/terms", "/vi/terms") },
    { loc: "/vi/terms", changefreq: "monthly", priority: "0.3", lastmod: TODAY, hreflang: bilingual("/terms", "/vi/terms") },
    { loc: "/advertise", changefreq: "monthly", priority: "0.4", lastmod: TODAY, hreflang: bilingual("/advertise", "/vi/advertise") },
    { loc: "/vi/advertise", changefreq: "monthly", priority: "0.4", lastmod: TODAY, hreflang: bilingual("/advertise", "/vi/advertise") },
    { loc: "/rss.xml", changefreq: "hourly", priority: "0.3" },
  ];

  // Build EN blog post entries with optional bilingual hreflang
  const enToViSlug = new Map<string, string>();
  try {
    const supabase = createSupabaseClient(context.env);
    // CAP-01 (2026-08-25) — paged. This query had no .limit() at all, which
    // does not mean "no cap": PostgREST applies max-rows = 1000 by default and
    // reports nothing. The consequence here is quieter than a missing URL —
    // the EN entries would still be emitted, just stripped of their VI
    // hreflang, so EN and VI would compete instead of pairing. 66 rows today.
    // `slug` is the unique tie breaker.
    const viPosts = await fetchAllRows<{ slug: string; alternate_en_slug: string | null }>(
      (from, to) =>
        supabase
          .from("vi_blog_posts")
          .select("slug, alternate_en_slug")
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .order("slug", { ascending: true })
          .range(from, to),
    );
    for (const p of viPosts) {
      if (p.alternate_en_slug) enToViSlug.set(p.alternate_en_slug, p.slug);
    }
  } catch (err) {
    console.error("sitemap-static: vi_blog_posts lookup failed:", err);
  }

  const staticEntries = STATIC_URLS.map((u) =>
    buildUrlEntry({ loc: `${siteUrl}${u.loc}`, lastmod: u.lastmod, changefreq: u.changefreq, priority: u.priority, hreflang: u.hreflang }),
  );

  const enBlogEntries = EN_BLOG_SLUGS.map((slug) => {
    const viSlug = enToViSlug.get(slug);
    const hreflang = viSlug
      ? bilingual(`/blog/${slug}`, `/vi/blog/${viSlug}`)
      : enOnly(`/blog/${slug}`);
    return buildUrlEntry({ loc: `${siteUrl}/blog/${slug}`, changefreq: "monthly", priority: "0.7", hreflang });
  });

  const xml = wrapUrlset([...staticEntries, ...enBlogEntries]);
  return new Response(xml, { status: 200, headers: SITEMAP_CACHE_HEADERS });
};
