/**
 * Dynamic sitemap generation as a Cloudflare Pages Function.
 * Ported from supabase/functions/sitemap/index.ts
 */

import { createSupabaseClient } from "./_lib/supabase";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CANONICAL_HOST: string;
}

interface StaticUrl {
  loc: string;
  changefreq: string;
  priority: string;
  lastmod?: string;
  hreflang?: { lang: string; href: string }[];
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildUrlEntry(entry: {
  loc: string;
  lastmod?: string;
  changefreq: string;
  priority: string;
  hreflang?: { lang: string; href: string }[];
}): string {
  const parts = [`  <url>`, `    <loc>${escapeXml(entry.loc)}</loc>`];
  if (entry.lastmod) parts.push(`    <lastmod>${entry.lastmod}</lastmod>`);
  parts.push(`    <changefreq>${entry.changefreq}</changefreq>`);
  parts.push(`    <priority>${entry.priority}</priority>`);
  if (entry.hreflang) {
    for (const h of entry.hreflang) {
      parts.push(`    <xhtml:link rel="alternate" hreflang="${h.lang}" href="${escapeXml(h.href)}"/>`);
    }
  }
  parts.push(`  </url>`);
  return parts.join("\n");
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const siteUrl = env.CANONICAL_HOST || "https://www.thepicklehub.net";
  const TODAY = new Date().toISOString().slice(0, 10);

  // EN blog post slugs (static — kept in sync with src/lib/blog-data.ts)
  const EN_BLOG_SLUGS = [
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
  ];

  const bilingual = (enPath: string, viPath: string) => [
    { lang: "en", href: `${siteUrl}${enPath}` },
    { lang: "vi", href: `${siteUrl}${viPath}` },
    { lang: "x-default", href: `${siteUrl}${enPath}` },
  ];

  const enOnly = (enPath: string) => [
    { lang: "en", href: `${siteUrl}${enPath}` },
    { lang: "x-default", href: `${siteUrl}${enPath}` },
  ];

  const STATIC_URLS: StaticUrl[] = [
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
    // Tool sub-pages are EN-only (no VI equivalents)
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

  try {
    const supabase = createSupabaseClient(env);

    // Fetch published Vietnamese blog posts (include alternate_en_slug for bidirectional hreflang)
    const { data: viPosts, error } = await supabase
      .from("vi_blog_posts")
      .select("slug, updated_at, alternate_en_slug")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (error) console.error("Error fetching vi_blog_posts:", error);

    // Build EN slug → VI slug lookup map
    const enToViSlug = new Map<string, string>();
    for (const post of viPosts || []) {
      if (post.alternate_en_slug) {
        enToViSlug.set(post.alternate_en_slug, post.slug);
      }
    }

    // Build static entries
    const staticEntries = STATIC_URLS.map((u) =>
      buildUrlEntry({ loc: `${siteUrl}${u.loc}`, lastmod: u.lastmod, changefreq: u.changefreq, priority: u.priority, hreflang: u.hreflang }),
    );

    // Build EN blog post entries with optional VI hreflang
    const enBlogEntries = EN_BLOG_SLUGS.map((slug) => {
      const viSlug = enToViSlug.get(slug);
      const hreflang = viSlug
        ? bilingual(`/blog/${slug}`, `/vi/blog/${viSlug}`)
        : enOnly(`/blog/${slug}`);
      return buildUrlEntry({ loc: `${siteUrl}/blog/${slug}`, changefreq: "monthly", priority: "0.7", hreflang });
    });

    // Build dynamic Vietnamese blog entries with bidirectional hreflang
    const viEntries = (viPosts || []).map((post: any) => {
      const lastmod = post.updated_at ? new Date(post.updated_at).toISOString().slice(0, 10) : TODAY;
      const hreflang = post.alternate_en_slug
        ? bilingual(`/blog/${post.alternate_en_slug}`, `/vi/blog/${post.slug}`)
        : [{ lang: "vi", href: `${siteUrl}/vi/blog/${post.slug}` }, { lang: "x-default", href: `${siteUrl}/vi/blog/${post.slug}` }];
      return buildUrlEntry({ loc: `${siteUrl}/vi/blog/${post.slug}`, lastmod, changefreq: "monthly", priority: "0.8", hreflang });
    });

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${[...staticEntries, ...enBlogEntries, ...viEntries].join("\n")}
</urlset>`;

    return new Response(sitemap, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    console.error("Sitemap generation error:", err);
    return new Response("<?xml version=\"1.0\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"/>", {
      status: 503,
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  }
};
