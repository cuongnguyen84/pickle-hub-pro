/**
 * Shared utilities for Cloudflare Pages Functions
 */

export const SITE_NAME = "ThePickleHub";
export const DEFAULT_OG_IMAGE = "https://www.thepicklehub.net/og-image.png";

/**
 * Escape strings for safe inclusion in JSON-LD <script> tags.
 * Prevents HTML-looking text (like `<Live>`) from breaking JSON-LD parsing.
 */
export function escapeJsonLd(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "\\u0026")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");
}

/**
 * Escape HTML entities for safe inclusion in HTML attributes/content.
 */
export function escapeHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Build a page title, truncated to 60 chars with optional suffix.
 *
 * PR73 Phase 2C (audit I-4) — when the raw title is too long we now
 * break at the last whitespace before the budget instead of a hard
 * char cut, so "175 Định Công" no longer renders as "175 Đị…" in
 * the SERP. We accept a slightly shorter title rather than orphan a
 * partial Vietnamese glyph. Falls back to the hard cut only when the
 * budget leaves no whitespace to break on (or the break would land
 * too early in the title).
 */
export function buildTitle(rawTitle: string, suffix = " | ThePickleHub"): string {
  const maxTotal = 60;
  if ((rawTitle + suffix).length <= maxTotal) return rawTitle + suffix;
  if (rawTitle.length <= maxTotal) return rawTitle;
  const budget = maxTotal - 1;
  const head = rawTitle.slice(0, budget);
  const lastSpace = head.lastIndexOf(" ");
  // Require >=50% of the budget to remain after the break — a tiny
  // break early in the title would orphan most of the headline.
  if (lastSpace > budget * 0.5) {
    return head.slice(0, lastSpace).trimEnd() + "\u2026";
  }
  return head.trim() + "\u2026";
}

/**
 * Build a meta description between 120-160 chars with fallbacks.
 */
export function buildMetaDescription(
  rawDesc: string | null | undefined,
  context: { type: string; title: string },
): string {
  const MIN_LENGTH = 120;
  const MAX_LENGTH = 160;

  if (rawDesc && rawDesc.length >= MIN_LENGTH && rawDesc.length <= MAX_LENGTH) {
    return rawDesc;
  }

  if (!rawDesc || rawDesc.length < MIN_LENGTH) {
    const fallbacks: Record<string, string> = {
      video: `${context.title} - Xem video pickleball miễn phí tại ThePickleHub. Cập nhật highlight, kỹ thuật, và những khoảnh khắc đỉnh nhất từ giải đấu pickleball Việt Nam và quốc tế.`,
      "forum-post": `${context.title} - Thảo luận trên diễn đàn ThePickleHub. Tham gia cộng đồng pickleball Việt Nam để trao đổi kinh nghiệm, kỹ thuật, và tìm bạn chơi pickleball.`,
      blog: `${context.title} - Hướng dẫn chi tiết về pickleball từ ThePickleHub. Khám phá luật chơi, kỹ thuật, chiến thuật và mẹo chơi pickleball cho mọi trình độ.`,
      default: `${context.title} - ThePickleHub là nền tảng pickleball hàng đầu Việt Nam với giải đấu, livestream, tools và cộng đồng sôi động.`,
    };
    const fb = fallbacks[context.type] || fallbacks.default;
    return fb.slice(0, MAX_LENGTH);
  }

  return rawDesc.slice(0, MAX_LENGTH - 3).trim() + "...";
}

/**
 * Normalize image URLs (Google Drive → direct googleusercontent link).
 */
export function normalizeImageUrl(url: string): string {
  if (!url) return "";
  if (url.includes("googleusercontent.com")) return url;
  const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileIdMatch) return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
  const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch) return `https://lh3.googleusercontent.com/d/${idParamMatch[1]}`;
  return url;
}

/**
 * SEO-1.2 (2026-05-28) — Build a bilingual hreflang triplet.
 *
 * Returns the `<link rel="alternate">` block to pass as `extraMeta`
 * to buildHtml() on any handler whose URL has both EN + VI variants
 * in the sitemap. Without these tags the sitemap's `xhtml:link`
 * declarations are one-sided and Google flags them as "no return tag".
 *
 * For single-canonical pages (same URL serves both locales), pass the
 * same URL for both enUrl + viUrl — Google docs allow this pattern.
 */
export function bilingualHreflang(
  enUrl: string,
  viUrl: string,
  xDefaultUrl?: string,
): string {
  const xDefault = xDefaultUrl ?? enUrl;
  return [
    `<link rel="alternate" hreflang="en" href="${enUrl}"/>`,
    `<link rel="alternate" hreflang="vi" href="${viUrl}"/>`,
    `<link rel="alternate" hreflang="x-default" href="${xDefault}"/>`,
  ].join("\n");
}

/**
 * Get absolute image URL.
 */
export function absImage(url: string | null | undefined, siteUrl: string): string {
  if (!url) return DEFAULT_OG_IMAGE;
  const normalized = normalizeImageUrl(url);
  if (normalized.startsWith("http")) return normalized;
  return `${siteUrl}${normalized.startsWith("/") ? "" : "/"}${normalized}`;
}

/**
 * Normalize image src attributes in HTML content.
 */
export function normalizeImagesInHtml(html: string): string {
  if (!html) return html;
  return html.replace(
    /<img([^>]*)\ssrc=["']([^"']+)["']/gi,
    (_match: string, beforeSrc: string, src: string) =>
      `<img${beforeSrc} src="${normalizeImageUrl(src)}"`,
  );
}

// ─── Language Detection ────────────────────────────────────

export type Lang = "en" | "vi";

export function detectLang(path: string): Lang {
  return path === "/vi" || path.startsWith("/vi/") ? "vi" : "en";
}

export function stripLangPrefix(path: string): string {
  if (path === "/vi") return "/";
  if (path.startsWith("/vi/")) return path.substring(3);
  return path;
}

// ─── Breadcrumb helper ─────────────────────────────────────

export function breadcrumb(crumbs: { label: string; href?: string }[]): string {
  return `<nav aria-label="breadcrumb"><ol>${crumbs
    .map((c, i) => {
      const isLast = i === crumbs.length - 1;
      // Defensive against missing `href` on intermediate crumbs — prior
      // versions emitted `<a href="undefined">` which broke SEO audits
      // (the href attribute went out as the literal string "undefined").
      // Now: if href is missing OR this is the last crumb, render the
      // label as plain text. Callers that want a real link must pass
      // a non-empty href.
      if (isLast || !c.href) {
        return `<li>${escapeHtml(c.label)}</li>`;
      }
      return `<li><a href="${escapeHtml(c.href)}">${escapeHtml(c.label)}</a></li>`;
    })
    .join(" &gt; ")}</ol></nav>`;
}

// ─── Bot UA detection ──────────────────────────────────────

export const BOT_UA =
  /googlebot|bingbot|yandexbot|duckduckbot|baiduspider|facebookexternalhit|facebot|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|discordbot|pinterestbot|redditbot|slackbot|slurp|gptbot|claudebot|perplexitybot|bytespider|petalbot|seznambot|ahrefsbot|ahrefssiteaudit|semrushbot|mj12bot|dotbot|screaming frog|sitebulb|rogerbot|dataforseobot|serpstatbot|moz\.com|cocoabot|google-inspectiontool|google-read-aloud|google-site-verification|google-structureddatatestingtool|mediapartners-google|adsbot-google|google-pagerenderer|chrome-lighthouse|google-extended|googleother|google-cloudvertexbot|validator\.schema\.org|schemamarkupvalidator/i;

// ─── Related content links ─────────────────────────────────

export const ALL_BLOGS = [
  { slug: "mlp-format-explained", title: "MLP Format Explained 2026" },
  { slug: "how-to-organize-pickleball-tournament", title: "Hướng dẫn tổ chức giải Pickleball" },
  { slug: "pickleball-round-robin-generator-guide", title: "Round Robin Generator Guide" },
  { slug: "pickleball-tournament-formats-explained", title: "Tournament Formats Explained" },
  { slug: "pickleball-bracket-templates", title: "Bracket Templates 2026" },
  { slug: "pickleball-scoring-rules-guide", title: "Pickleball Scoring Rules" },
  { slug: "pickleball-doubles-strategy-guide", title: "Doubles Strategy Guide" },
  { slug: "pickleball-live-streaming-guide", title: "Live Streaming Guide" },
  { slug: "best-pickleball-tournament-software-2026", title: "Best Tournament Software 2026" },
  { slug: "free-pickleball-bracket-generator", title: "Free Bracket Generator" },
  { slug: "how-to-create-pickleball-bracket", title: "How to Create a Bracket" },
];

export const ALL_TOOLS = [
  { slug: "flex-tournament", title: "Flex Tournament Generator" },
  { slug: "doubles-elimination", title: "Double Elimination Bracket" },
  { slug: "quick-tables", title: "Quick Tables" },
  { slug: "team-match", title: "Team Match" },
];

export function relatedBlogLinks(currentSlug: string, siteUrl: string): string {
  const related = ALL_BLOGS.filter((b) => b.slug !== currentSlug).slice(0, 3);
  return `<section><h2>Bài viết liên quan</h2><ul>${related
    .map((p) => `<li><a href="${siteUrl}/blog/${p.slug}">${escapeHtml(p.title)}</a></li>`)
    .join("")}</ul></section>`;
}

export function relatedToolLinks(currentSlug: string, siteUrl: string): string {
  const related = ALL_TOOLS.filter((t) => t.slug !== currentSlug);
  return `<section><h2>Công cụ khác</h2><ul>${related
    .map((t) => `<li><a href="${siteUrl}/tools/${t.slug}">${escapeHtml(t.title)}</a></li>`)
    .join("")}</ul></section>`;
}
