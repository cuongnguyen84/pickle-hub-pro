/**
 * RSS 2.0 feed for ThePickleHub blog posts.
 * Serves both Vietnamese (from Supabase vi_blog_posts) and English (static) posts.
 * Used by Mailchimp RSS-to-Email automation.
 */

import { createSupabaseClient } from "./_lib/supabase";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CANONICAL_HOST: string;
}

interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string; // ISO 8601 for sorting; converted to RFC 2822 for output
  lang: "en" | "vi";
}

// EN blog posts — static (no DB table). Keep in sync with src/lib/blog-data.ts.
const EN_POSTS: RssItem[] = [
  {
    title: "Best Pickleball Tournament Software in 2026 — Free Tools Compared",
    link: "/blog/best-pickleball-tournament-software-2026",
    description: "Compare the best pickleball tournament software in 2026. Free bracket generators, round robin tools, and MLP team match platforms for organizers. No signup required.",
    pubDate: "2025-12-15",
    lang: "en",
  },
  {
    title: "How to Create a Pickleball Bracket — Step-by-Step Guide",
    link: "/blog/how-to-create-pickleball-bracket",
    description: "Learn how to create a pickleball bracket for round robin, single elimination, and double elimination tournaments. Free bracket generator with real-time scoring.",
    pubDate: "2025-11-20",
    lang: "en",
  },
  {
    title: "Pickleball Round Robin Generator — How to Run the Perfect Round Robin Tournament",
    link: "/blog/pickleball-round-robin-generator-guide",
    description: "Free pickleball round robin generator with automatic scheduling, court rotation, and live scoring. Learn how to organize the perfect round robin tournament.",
    pubDate: "2025-10-10",
    lang: "en",
  },
  {
    title: "Pickleball Scoring Rules Explained — Complete Guide for Beginners & Tournament Play",
    link: "/blog/pickleball-scoring-rules-guide",
    description: "Learn pickleball scoring rules for singles, doubles, and tournament play. Rally scoring vs side-out explained. Free digital scoring tool included.",
    pubDate: "2026-03-15",
    lang: "en",
  },
  {
    title: "How to Organize a Pickleball Tournament — The Complete Organizer's Checklist",
    link: "/blog/how-to-organize-pickleball-tournament",
    description: "Step-by-step guide to organizing a pickleball tournament. Venue, format selection, registration, scheduling, scoring, and free tools. Everything you need to run a successful event.",
    pubDate: "2026-03-20",
    lang: "en",
  },
  {
    title: "Pickleball Doubles Strategy — Winning Tips for Tournament Players",
    link: "/blog/pickleball-doubles-strategy-guide",
    description: "Master pickleball doubles strategy for tournaments. Partner communication, court positioning, stacking, and when to attack the kitchen. Improve your doubles game today.",
    pubDate: "2026-03-22",
    lang: "en",
  },
  {
    title: "Pickleball Tournament Formats Explained — Which One Should You Use?",
    link: "/blog/pickleball-tournament-formats-explained",
    description: "Complete guide to pickleball tournament formats: round robin, single elimination, double elimination, MLP team match, and flex tournaments. Choose the right format for your event.",
    pubDate: "2026-03-25",
    lang: "en",
  },
  {
    title: "Pickleball Live Streaming — How to Watch & Stream Pickleball Online",
    link: "/blog/pickleball-live-streaming-guide",
    description: "Watch pickleball live streams for free. Learn how to stream your own pickleball tournament online with The Pickle Hub's free livestreaming platform.",
    pubDate: "2026-03-29",
    lang: "en",
  },
  {
    title: "MLP Format Explained — Major League Pickleball Team Match Rules & How to Play",
    link: "/blog/mlp-format-explained",
    description: "Learn how the MLP format works in pickleball. Complete guide to Major League Pickleball team match rules, dreambreaker, lineup strategy, and how to organize your own MLP-style event.",
    pubDate: "2026-03-29",
    lang: "en",
  },
  {
    title: "Free Pickleball Bracket Generator — Create Tournament Brackets in 60 Seconds",
    link: "/blog/free-pickleball-bracket-generator",
    description: "Create free pickleball tournament brackets instantly. Round robin, single elimination, and double elimination bracket generator with real-time scoring. No signup required.",
    pubDate: "2026-03-29",
    lang: "en",
  },
  {
    title: "Pickleball Bracket Templates — Free Templates for Every Tournament Format",
    link: "/blog/pickleball-bracket-templates",
    description: "Free pickleball bracket templates for round robin, single elimination, and double elimination. Templates for 4, 8, 16, 32, and 64 players with real-time scoring.",
    pubDate: "2026-03-29",
    lang: "en",
  },
];

function escapeXml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Convert ISO date string (YYYY-MM-DD or full ISO) to RFC 2822 format.
function toRfc2822(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return new Date().toUTCString();
  return d.toUTCString().replace("GMT", "+0000");
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const siteUrl = env.CANONICAL_HOST || "https://www.thepicklehub.net";

  let viItems: RssItem[] = [];

  try {
    const supabase = createSupabaseClient(env);

    const { data: viPosts, error } = await supabase
      .from("vi_blog_posts")
      .select("slug, title, meta_description, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(50); // fetch more than needed; we trim after merge

    if (error) {
      console.error("Error fetching vi_blog_posts for RSS:", error);
    } else {
      viItems = (viPosts || []).map((post: any) => ({
        title: post.title || "",
        link: `/vi/blog/${post.slug}`,
        description: post.meta_description || "",
        pubDate: post.published_at || new Date().toISOString(),
        lang: "vi" as const,
      }));
    }
  } catch (err) {
    console.error("Supabase error in RSS feed:", err);
  }

  // Merge EN static + VI dynamic, sort by pubDate DESC, take top 20
  const allItems: RssItem[] = [...EN_POSTS, ...viItems].sort(
    (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime(),
  ).slice(0, 20);

  const itemsXml = allItems
    .map(
      (item) => `  <item>
    <title>${escapeXml(item.title)}</title>
    <link>${escapeXml(siteUrl + item.link)}</link>
    <guid isPermaLink="true">${escapeXml(siteUrl + item.link)}</guid>
    <description>${escapeXml(item.description)}</description>
    <pubDate>${toRfc2822(item.pubDate)}</pubDate>
    <dc:language>${item.lang === "vi" ? "vi-VN" : "en"}</dc:language>
  </item>`,
    )
    .join("\n");

  const lastBuildDate = toRfc2822(new Date().toISOString());

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>ThePickleHub Blog — Pickleball Tournaments, Strategy &amp; More</title>
    <link>${escapeXml(siteUrl)}/blog</link>
    <description>Tin tức, hướng dẫn và chiến thuật Pickleball từ ThePickleHub. Pickleball news, guides, and strategy from ThePickleHub.</description>
    <language>vi-VN</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <ttl>60</ttl>
    <atom:link href="${escapeXml(siteUrl)}/rss.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${escapeXml(siteUrl)}/og-image.png</url>
      <title>ThePickleHub</title>
      <link>${escapeXml(siteUrl)}</link>
    </image>
${itemsXml}
  </channel>
</rss>`;

  return new Response(rss, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
};
