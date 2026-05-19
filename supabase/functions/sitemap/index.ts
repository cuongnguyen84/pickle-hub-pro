/**
 * Sitemap edge function (Supabase) — sibling of the CF Pages /sitemap*.xml
 * family in `functions/`. The CF Pages copy is the one Google reaches at
 * www.thepicklehub.net/sitemap.xml; this Supabase version is kept in sync
 * as a backup endpoint that admins can hit directly without touching
 * Cloudflare (e.g. during a CF Pages incident).
 *
 * Phase 3B.3 split the legacy single sitemap into 6 segments + 1 index.
 * This function dispatches via ?type= query param:
 *   ?type=index|static|blog|tournaments|matches|players|venues
 * defaulting to 'index' when omitted (preserves the legacy /functions/v1/
 * sitemap URL contract).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://www.thepicklehub.net";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const xmlHeaders = {
  ...corsHeaders,
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=300, s-maxage=300",
};

const URL_SAFE_SLUG = /^[a-z0-9-]+$/;
const URL_SAFE_USERNAME = /^[a-z0-9._-]+$/i;
const TODAY = new Date().toISOString().slice(0, 10);

const SEGMENT_PATHS = [
  "/sitemap-static.xml",
  "/sitemap-blog.xml",
  "/sitemap-tournaments.xml",
  "/sitemap-matches.xml",
  "/sitemap-players.xml",
  "/sitemap-venues.xml",
];

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface UrlEntry {
  loc: string;
  lastmod?: string;
  changefreq: string;
  priority: string;
  hreflang?: { lang: string; href: string }[];
}

function buildUrlEntry(entry: UrlEntry): string {
  const parts = [`  <url>`, `    <loc>${escapeXml(entry.loc)}</loc>`];
  if (entry.lastmod) parts.push(`    <lastmod>${entry.lastmod}</lastmod>`);
  parts.push(`    <changefreq>${entry.changefreq}</changefreq>`);
  parts.push(`    <priority>${entry.priority}</priority>`);
  if (entry.hreflang) {
    for (const h of entry.hreflang) {
      parts.push(
        `    <xhtml:link rel="alternate" hreflang="${h.lang}" href="${escapeXml(h.href)}"/>`,
      );
    }
  }
  parts.push(`  </url>`);
  return parts.join("\n");
}

function wrapUrlset(entries: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join("\n")}
</urlset>`;
}

function wrapSitemapIndex(): string {
  const segments = SEGMENT_PATHS
    .map(
      (p) =>
        `  <sitemap>\n    <loc>${escapeXml(`${SITE_URL}${p}`)}</loc>\n    <lastmod>${TODAY}</lastmod>\n  </sitemap>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${segments}
</sitemapindex>`;
}

function toLastmod(value: string | null | undefined): string {
  if (!value) return TODAY;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return TODAY;
  return d.toISOString().slice(0, 10);
}

const bilingual = (enPath: string, viPath: string) => [
  { lang: "en", href: `${SITE_URL}${enPath}` },
  { lang: "vi", href: `${SITE_URL}${viPath}` },
  { lang: "x-default", href: `${SITE_URL}${enPath}` },
];

const enOnly = (enPath: string) => [
  { lang: "en", href: `${SITE_URL}${enPath}` },
  { lang: "x-default", href: `${SITE_URL}${enPath}` },
];

const EN_BLOG_SLUGS = [
  "how-to-watch-ppa-tour-live-2026",
  "ppa-tour-asia-2026-complete-guide",
  "best-pickleball-tournament-software-2026",
  "how-to-create-pickleball-bracket",
  "pickleball-round-robin-generator-guide",
  "pickleball-scoring-rules-guide",
  "how-to-organize-pickleball-tournament",
  "pickleball-doubles-strategy-guide",
  "pickleball-tournament-formats-explained",
  "pickleball-live-streaming-guide",
  "mlp-format-explained",
  "free-pickleball-bracket-generator",
  "pickleball-bracket-templates",
  "pickleball-rules-complete-guide",
  "pickleball-world-cup-2026-da-nang",
  "tournament-organizer-hub",
  "how-to-play-pickleball",
];

const STATIC_URLS: { loc: string; changefreq: string; priority: string; lastmod?: string; hreflang?: { lang: string; href: string }[] }[] = [
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
  { loc: "/tools", changefreq: "weekly", priority: "0.8", lastmod: TODAY, hreflang: bilingual("/tools", "/vi/tools") },
  { loc: "/vi/tools", changefreq: "weekly", priority: "0.8", lastmod: TODAY, hreflang: bilingual("/tools", "/vi/tools") },
  { loc: "/tools/flex-tournament", changefreq: "weekly", priority: "0.8", lastmod: TODAY, hreflang: enOnly("/tools/flex-tournament") },
  { loc: "/tools/doubles-elimination", changefreq: "weekly", priority: "0.7", lastmod: TODAY, hreflang: enOnly("/tools/doubles-elimination") },
  { loc: "/tools/quick-tables", changefreq: "weekly", priority: "0.7", lastmod: TODAY, hreflang: enOnly("/tools/quick-tables") },
  { loc: "/tools/team-match", changefreq: "weekly", priority: "0.7", lastmod: TODAY, hreflang: enOnly("/tools/team-match") },
  { loc: "/blog", changefreq: "weekly", priority: "0.7", lastmod: TODAY, hreflang: bilingual("/blog", "/vi/blog") },
  { loc: "/vi/blog", changefreq: "weekly", priority: "0.8", lastmod: TODAY, hreflang: bilingual("/blog", "/vi/blog") },
  { loc: "/privacy", changefreq: "monthly", priority: "0.3" },
  { loc: "/terms", changefreq: "monthly", priority: "0.3" },
  { loc: "/rss.xml", changefreq: "hourly", priority: "0.3" },
];

async function buildStatic(supabase: any): Promise<string> {
  const { data: viPosts } = await supabase
    .from("vi_blog_posts")
    .select("slug, alternate_en_slug")
    .eq("status", "published");
  const enToVi = new Map<string, string>();
  for (const p of viPosts || []) if (p.alternate_en_slug) enToVi.set(p.alternate_en_slug, p.slug);

  const staticEntries = STATIC_URLS.map((u) =>
    buildUrlEntry({ loc: `${SITE_URL}${u.loc}`, lastmod: u.lastmod, changefreq: u.changefreq, priority: u.priority, hreflang: u.hreflang }),
  );
  const enBlogEntries = EN_BLOG_SLUGS.map((slug) => {
    const viSlug = enToVi.get(slug);
    const hreflang = viSlug ? bilingual(`/blog/${slug}`, `/vi/blog/${viSlug}`) : enOnly(`/blog/${slug}`);
    return buildUrlEntry({ loc: `${SITE_URL}/blog/${slug}`, changefreq: "monthly", priority: "0.7", hreflang });
  });
  return wrapUrlset([...staticEntries, ...enBlogEntries]);
}

async function buildBlog(supabase: any): Promise<string> {
  const { data: viPosts } = await supabase
    .from("vi_blog_posts")
    .select("slug, updated_at, alternate_en_slug")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(5000);
  const entries = (viPosts || []).map((post: any) => {
    const lastmod = toLastmod(post.updated_at);
    const hreflang = post.alternate_en_slug
      ? [
          { lang: "en", href: `${SITE_URL}/blog/${post.alternate_en_slug}` },
          { lang: "vi", href: `${SITE_URL}/vi/blog/${post.slug}` },
          { lang: "x-default", href: `${SITE_URL}/blog/${post.alternate_en_slug}` },
        ]
      : [
          { lang: "vi", href: `${SITE_URL}/vi/blog/${post.slug}` },
          { lang: "x-default", href: `${SITE_URL}/vi/blog/${post.slug}` },
        ];
    return buildUrlEntry({
      loc: `${SITE_URL}/vi/blog/${post.slug}`,
      lastmod,
      changefreq: "monthly",
      priority: "0.8",
      hreflang,
    });
  });
  return wrapUrlset(entries);
}

async function buildTournaments(supabase: any): Promise<string> {
  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("slug, updated_at")
    .order("start_date", { ascending: false })
    .limit(5000);
  const entries = (tournaments || [])
    .filter((t: any) => t.slug && URL_SAFE_SLUG.test(t.slug))
    .map((t: any) =>
      buildUrlEntry({
        loc: `${SITE_URL}/tournament/${t.slug}`,
        lastmod: toLastmod(t.updated_at),
        changefreq: "weekly",
        priority: "0.7",
        hreflang: bilingual(`/tournament/${t.slug}`, `/vi/tournament/${t.slug}`),
      }),
    );
  return wrapUrlset(entries);
}

async function buildMatches(supabase: any): Promise<string> {
  const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const { data: matches } = await supabase
    .from("matches")
    .select("slug, updated_at")
    .eq("is_public", true)
    .in("verification_status", ["verified", "pending"])
    .gte("played_at", cutoff)
    .order("updated_at", { ascending: false })
    .limit(5000);
  const entries = (matches || [])
    .filter((m: any) => m.slug && URL_SAFE_SLUG.test(m.slug))
    .map((m: any) =>
      buildUrlEntry({
        loc: `${SITE_URL}/tran-dau/${m.slug}`,
        lastmod: toLastmod(m.updated_at),
        changefreq: "weekly",
        priority: "0.7",
      }),
    );
  return wrapUrlset(entries);
}

async function buildPlayers(supabase: any): Promise<string> {
  const { data: players } = await supabase
    .from("profiles")
    .select("username, created_at")
    .eq("is_ghost", false)
    .eq("country", "VN")
    .not("username", "is", null)
    .order("created_at", { ascending: false })
    .limit(5000);
  const entries = (players || [])
    .filter((p: any) => p.username && URL_SAFE_USERNAME.test(p.username))
    .map((p: any) =>
      buildUrlEntry({
        loc: `${SITE_URL}/nguoi-choi/${p.username}`,
        lastmod: toLastmod(p.created_at),
        changefreq: "weekly",
        priority: "0.6",
      }),
    );
  return wrapUrlset(entries);
}

async function buildVenues(supabase: any): Promise<string> {
  const { data: venues } = await supabase
    .from("venues")
    .select("slug, updated_at")
    .order("updated_at", { ascending: false })
    .limit(5000);
  const entries = (venues || [])
    .filter((v: any) => v.slug && URL_SAFE_SLUG.test(v.slug))
    .map((v: any) =>
      buildUrlEntry({
        loc: `${SITE_URL}/san/${v.slug}`,
        lastmod: toLastmod(v.updated_at),
        changefreq: "monthly",
        priority: "0.5",
      }),
    );
  return wrapUrlset(entries);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const type = (url.searchParams.get("type") || "index").toLowerCase();

    if (type === "index") {
      return new Response(wrapSitemapIndex(), { status: 200, headers: xmlHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    let xml: string;
    switch (type) {
      case "static":      xml = await buildStatic(supabase); break;
      case "blog":        xml = await buildBlog(supabase); break;
      case "tournaments": xml = await buildTournaments(supabase); break;
      case "matches":     xml = await buildMatches(supabase); break;
      case "players":     xml = await buildPlayers(supabase); break;
      case "venues":      xml = await buildVenues(supabase); break;
      default:
        return new Response(`Unknown sitemap type: ${type}`, { status: 400, headers: corsHeaders });
    }

    return new Response(xml, { status: 200, headers: xmlHeaders });
  } catch (err) {
    console.error("Sitemap generation error:", err);
    return new Response("Internal server error", { status: 500, headers: corsHeaders });
  }
});
