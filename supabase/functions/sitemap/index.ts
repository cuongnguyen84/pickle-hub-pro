import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://www.thepicklehub.net";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StaticUrl {
  loc: string;
  changefreq: string;
  priority: string;
  lastmod?: string;
  hreflang?: { lang: string; href: string }[];
}

const TODAY = new Date().toISOString().slice(0, 10);

const STATIC_URLS: StaticUrl[] = [
  {
    loc: "/",
    changefreq: "daily",
    priority: "1.0",
    lastmod: TODAY,
    hreflang: [
      { lang: "en", href: `${SITE_URL}/` },
      { lang: "vi", href: `${SITE_URL}/vi` },
      { lang: "x-default", href: `${SITE_URL}/` },
    ],
  },
  {
    loc: "/vi",
    changefreq: "daily",
    priority: "0.9",
    lastmod: TODAY,
    hreflang: [
      { lang: "en", href: `${SITE_URL}/` },
      { lang: "vi", href: `${SITE_URL}/vi` },
      { lang: "x-default", href: `${SITE_URL}/` },
    ],
  },
  { loc: "/livestream", changefreq: "hourly", priority: "0.9", lastmod: TODAY },
  { loc: "/tournaments", changefreq: "daily", priority: "0.8", lastmod: TODAY },
  { loc: "/videos", changefreq: "daily", priority: "0.7", lastmod: TODAY },
  { loc: "/news", changefreq: "daily", priority: "0.7", lastmod: TODAY },
  { loc: "/forum", changefreq: "daily", priority: "0.7", lastmod: TODAY },
  { loc: "/tools", changefreq: "weekly", priority: "0.8", lastmod: TODAY },
  { loc: "/tools/flex-tournament", changefreq: "weekly", priority: "0.8", lastmod: TODAY },
  { loc: "/tools/doubles-elimination", changefreq: "weekly", priority: "0.7", lastmod: TODAY },
  { loc: "/tools/quick-tables", changefreq: "weekly", priority: "0.7", lastmod: TODAY },
  { loc: "/tools/team-match", changefreq: "weekly", priority: "0.7", lastmod: TODAY },
  { loc: "/blog", changefreq: "weekly", priority: "0.7", lastmod: TODAY },
  { loc: "/vi/blog", changefreq: "weekly", priority: "0.8", lastmod: TODAY },
  // EN blog posts
  { loc: "/blog/best-pickleball-tournament-software-2026", changefreq: "monthly", priority: "0.7" },
  { loc: "/blog/how-to-create-pickleball-bracket", changefreq: "monthly", priority: "0.7" },
  { loc: "/blog/pickleball-round-robin-generator-guide", changefreq: "monthly", priority: "0.7" },
  { loc: "/blog/pickleball-scoring-rules-guide", changefreq: "monthly", priority: "0.7" },
  { loc: "/blog/how-to-organize-pickleball-tournament", changefreq: "monthly", priority: "0.7" },
  { loc: "/blog/pickleball-doubles-strategy-guide", changefreq: "monthly", priority: "0.7" },
  { loc: "/blog/pickleball-tournament-formats-explained", changefreq: "monthly", priority: "0.7" },
  { loc: "/blog/pickleball-live-streaming-guide", changefreq: "monthly", priority: "0.7" },
  { loc: "/blog/mlp-format-explained", changefreq: "monthly", priority: "0.7" },
  { loc: "/blog/free-pickleball-bracket-generator", changefreq: "monthly", priority: "0.7" },
  { loc: "/blog/pickleball-bracket-templates", changefreq: "monthly", priority: "0.7" },
  { loc: "/privacy", changefreq: "monthly", priority: "0.3" },
  { loc: "/terms", changefreq: "monthly", priority: "0.3" },
];

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
  const parts = [
    `  <url>`,
    `    <loc>${escapeXml(entry.loc)}</loc>`,
  ];
  if (entry.lastmod) {
    parts.push(`    <lastmod>${entry.lastmod}</lastmod>`);
  }
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch all published Vietnamese blog posts
    const { data: viPosts, error } = await supabase
      .from("vi_blog_posts")
      .select("slug, updated_at")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (error) {
      console.error("Error fetching vi_blog_posts:", error);
    }

    // Build static URL entries
    const staticEntries = STATIC_URLS.map((u) =>
      buildUrlEntry({
        loc: `${SITE_URL}${u.loc}`,
        lastmod: u.lastmod,
        changefreq: u.changefreq,
        priority: u.priority,
        hreflang: u.hreflang,
      })
    );

    // Build dynamic Vietnamese blog entries
    const viEntries = (viPosts || []).map((post) => {
      const lastmod = post.updated_at
        ? new Date(post.updated_at).toISOString().slice(0, 10)
        : TODAY;
      return buildUrlEntry({
        loc: `${SITE_URL}/vi/blog/${post.slug}`,
        lastmod,
        changefreq: "monthly",
        priority: "0.8",
      });
    });

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${[...staticEntries, ...viEntries].join("\n")}
</urlset>`;

    return new Response(sitemap, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    console.error("Sitemap generation error:", err);
    return new Response("Internal server error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});
