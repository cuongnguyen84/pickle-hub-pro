/**
 * RSS 2.0 feed for ThePickleHub blog posts.
 * Serves both Vietnamese (from Supabase vi_blog_posts) and English (blogMetadata) posts.
 * Used by Mailchimp RSS-to-Email automation.
 */

import { blogMetadata } from "../src/content/blog/metadata";
import type { BlogPostMetadata } from "../src/content/blog/types";
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

// AUDIT-03 (2026-11-10): EN items come from blogMetadata — the single blog
// source of truth (same as sitemap + SSR). A hand-kept list of 9 EN posts
// (2025-12…2026-03) was never updated, so after the merge+slice every EN
// item fell out and the "bilingual" feed shipped 20 VI items.
export function buildEnRssItems(meta: readonly BlogPostMetadata[]): RssItem[] {
  return meta.map((m) => ({
    title: m.titleEn,
    link: `/blog/${m.slug}`,
    description: m.metaDescriptionEn,
    pubDate: m.publishedDate,
    lang: "en" as const,
  }));
}

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
      viItems = (viPosts || []).map((post: { slug: string; title: string | null; meta_description: string | null; published_at: string | null }) => ({
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

  // Merge EN (metadata) + VI (DB), sort by pubDate DESC, take top 20
  const allItems: RssItem[] = [...buildEnRssItems(blogMetadata), ...viItems].sort(
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

  // Channel <language> stays vi-VN (majority audience); each item's
  // dc:language marks it en or vi-VN.
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

  // SEO audit 2026-05-28 (batch 7) — RSS XML lives outside the
  // _middleware.ts SSR path and so doesn't pick up the HSTS / CSP /
  // X-Content-Type-Options that applySecurityHeaders() attaches there.
  // SEOnaut crawled /rss.xml and flagged 'Missing HSTS' + 'Incorrect
  // media type' on the same response. Same headers as the rest of
  // the site so the surface advertises a consistent policy.
  return new Response(rss, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
};
