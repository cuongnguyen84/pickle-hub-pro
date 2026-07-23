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
  // Hostname check, not substring — `evil.com/googleusercontent.com` must not
  // short-circuit (CodeQL js/incomplete-url-substring-sanitization).
  try {
    const host = new URL(url).hostname;
    if (host === "googleusercontent.com" || host.endsWith(".googleusercontent.com")) {
      return url;
    }
  } catch {
    // not an absolute URL — fall through to the Drive-ID extraction below
  }
  const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileIdMatch) return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
  const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch) return `https://lh3.googleusercontent.com/d/${idParamMatch[1]}`;
  return url;
}

/**
 * SEO-3.1 (2026-05-28) — Build a BreadcrumbList JSON-LD node.
 *
 * Pass the same crumb array used by `breadcrumb()` (HTML helper). Returns
 * a plain object you can drop into a `@graph` array alongside the page's
 * primary schema (BlogPosting / SportsEvent / etc). When you have only
 * the breadcrumb to emit, wrap with `{ "@context": "https://schema.org",
 * ...buildBreadcrumbJsonLd(...) }` yourself.
 *
 * Schema.org spec: every item needs absolute URL except the last (current
 * page) where url is optional but recommended.
 */
export function buildBreadcrumbJsonLd(
  crumbs: Array<{ label: string; href?: string }>,
): {
  "@type": "BreadcrumbList";
  itemListElement: Array<{ "@type": "ListItem"; position: number; name: string; item?: string }>;
} {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: c.label,
      ...(c.href ? { item: c.href } : {}),
    })),
  };
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
 * Single-canonical hreflang — intentionally empty.
 *
 * Iteration history:
 *
 *   Batch 6 (2026-05-28): emitted `vi` + `x-default` both pointing at
 *   the same URL so the self-reference matched the page's html lang
 *   attribute. Cleared SEOnaut's NewHreflangMismatchingLang and
 *   NewMultipleLanguageReference flags.
 *
 *   Batch 9 (2026-05-28, after Ahrefs auto-crawl): Ahrefs flagged
 *   'Missing reciprocal hreflang (no return-tag)' and 'Page referenced
 *   for more than one language in hreflang' on the same routes — a
 *   self-only hreflang declares a translation that doesn't exist.
 *   Google's docs make this explicit (Search Central, "Localized
 *   versions of your pages"): if only one URL is indexed across all
 *   locales, omit hreflang entirely. Returning "" satisfies SEOnaut
 *   AND Ahrefs AND Google for /live/:id, /watch/:id, /forum/post/:id,
 *   /tran-dau/:slug, /tournament/:slug, /org/:slug — all single-
 *   canonical pages with one URL serving both locales via SPA toggle.
 *
 * The signature is kept stable so callers don't have to change; the
 * function just now returns empty.
 */
export function singleCanonicalHreflang(_url: string, _lang: "en" | "vi"): string {
  return "";
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
 * Sanitize stored blog HTML before injecting it into server-rendered pages.
 *
 * The Cloudflare Pages Functions / Workers runtime has no DOM, so DOMPurify
 * (which needs jsdom) cannot run here — the client renderer uses DOMPurify, but
 * the SSR path (served to bots and cached in KV) previously injected
 * vi_blog_posts.content_html raw. If the admin CMS or the Gemini translation
 * pipeline ever wrote hostile HTML, it would execute for every visitor/bot for
 * the cache TTL. This is a defense-in-depth allowlist-strip: it removes the
 * common script-execution vectors while leaving normal blog markup (headings,
 * paragraphs, lists, links, images, tables, blockquotes) intact.
 *
 * NOTE: regex sanitizing is not a substitute for a real parser. It is
 * deliberately aggressive (strip on anything suspicious) rather than clever.
 */
export function sanitizeBlogHtml(html: string): string {
  if (!html) return html;
  let out = html;

  // 1. Remove dangerous elements entirely (opening tag → closing tag, incl.
  //    self-closing / unclosed variants).
  const DANGEROUS_TAGS = [
    "script", "style", "iframe", "object", "embed", "form", "input",
    "button", "textarea", "link", "meta", "base", "svg", "math", "template",
    "noscript", "frame", "frameset", "applet", "portal",
  ];
  // Steps 1–2 loop to a fixpoint so nested/overlapping fragments cannot
  // reassemble into a tag or handler after one pass (e.g. `<scr<script>ipt>`,
  // ` onclonclick=ick=x`) — CodeQL js/incomplete-multi-character-sanitization.
  let prev: string;
  do {
    prev = out;
    for (const tag of DANGEROUS_TAGS) {
      // Paired: <tag ...>...</tag>
      out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, "gi"), "");
      // Any residual opening/self-closing/closing tag
      out = out.replace(new RegExp(`</?${tag}\\b[^>]*>`, "gi"), "");
    }

    // 2. Strip inline event handlers: on*="..." / on*='...' / on*=value
    out = out.replace(/\son[a-z0-9_-]+\s*=\s*"[^"]*"/gi, "");
    out = out.replace(/\son[a-z0-9_-]+\s*=\s*'[^']*'/gi, "");
    out = out.replace(/\son[a-z0-9_-]+\s*=\s*[^\s>]+/gi, "");
  } while (out !== prev);

  // 3. Neutralize dangerous URL schemes in href/src/xlink:href/formaction etc.
  //    Allow http(s), mailto, tel, protocol-relative //, root-relative /,
  //    fragments #, and data:image/* (used for inline images). Everything else
  //    (javascript:, vbscript:, data:text/html, file:, etc.) → '#'.
  out = out.replace(
    /\s(href|src|xlink:href|formaction|action|poster|background|cite)\s*=\s*(["'])([\s\S]*?)\2/gi,
    (match, attr, quote, value) => {
      // Strip whitespace + control chars so "java\tscript:" style bypasses
      // can't slip past the scheme check.
      // eslint-disable-next-line no-control-regex -- control chars are exactly what this strips (XSS scheme-bypass defense)
      const v = String(value).replace(/[\s\u0000-\u001f]/g, "").toLowerCase();
      const safe =
        v.startsWith("http://") ||
        v.startsWith("https://") ||
        v.startsWith("mailto:") ||
        v.startsWith("tel:") ||
        v.startsWith("//") ||
        v.startsWith("/") ||
        v.startsWith("#") ||
        v.startsWith("data:image/");
      return safe ? match : ` ${attr}=${quote}#${quote}`;
    },
  );

  // 4. Belt-and-braces: strip any leftover "javascript:" / "vbscript:" tokens.
  out = out.replace(/(javascript|vbscript)\s*:/gi, "");

  return out;
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
  /googlebot|bingbot|yandexbot|duckduckbot|baiduspider|facebookexternalhit|facebot|twitterbot|linkedinbot|whatsapp|zalo|telegrambot|applebot|discordbot|pinterestbot|redditbot|slackbot|slurp|gptbot|claudebot|perplexitybot|bytespider|petalbot|seznambot|ahrefsbot|ahrefssiteaudit|semrushbot|mj12bot|dotbot|screaming frog|sitebulb|rogerbot|dataforseobot|serpstatbot|moz\.com|cocoabot|google-inspectiontool|google-read-aloud|google-site-verification|google-structureddatatestingtool|mediapartners-google|adsbot-google|google-pagerenderer|chrome-lighthouse|google-extended|googleother|google-cloudvertexbot|validator\.schema\.org|schemamarkupvalidator|seonaut|crawlobserver|seobserver/i;

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
