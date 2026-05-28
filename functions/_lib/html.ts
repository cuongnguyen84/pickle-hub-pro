/**
 * HTML page builder for SSR prerendering.
 */

import { escapeHtml, escapeJsonLd, type Lang, SITE_NAME, DEFAULT_OG_IMAGE } from "./utils";

interface BuildHtmlAlternate {
  /** ISO language code or "x-default" for the fallback. */
  hreflang: string;
  /** Absolute URL the alt-language version lives at. For routes where
   *  one canonical URL serves both VI and EN (language toggled via
   *  SPA context), all alternates point to the same canonical. */
  href: string;
}

interface BuildHtmlOptions {
  title: string;
  description: string;
  url: string;
  siteUrl: string;
  image?: string;
  type?: string;
  jsonLd?: Record<string, unknown>;
  bodyContent?: string;
  extraMeta?: string;
  lang?: Lang;
  /** hreflang link[rel=alternate] tags. When omitted, no alternate
   *  links are emitted (the previous default). Routes that serve
   *  bilingual content via single canonical URL should pass
   *  [{ hreflang: "vi", href }, { hreflang: "en", href }, { hreflang: "x-default", href }]
   *  so search engines connect the two language versions. */
  alternates?: BuildHtmlAlternate[];
  /** PR73 Phase 2D (audit I-11) — skip the auto-emitted <h1>${title}</h1>
   *  + <p>${description}</p> pair when the caller's bodyContent already
   *  provides its own page heading. Defaults to false so existing
   *  renderers keep working unchanged. renderSocialEvent + renderClub
   *  pass true so the page has exactly one h1 with the clean event /
   *  club name instead of the decorated full title. */
  omitAutoHeader?: boolean;
}

function getHeaderHtml(lang: Lang, siteUrl: string): string {
  const prefix = lang === "vi" ? "/vi" : "";
  if (lang === "vi") {
    return `<header><nav>
<a href="${siteUrl}${prefix}/">Trang chủ</a>
<a href="${siteUrl}${prefix}/blog">Blog</a>
<a href="${siteUrl}${prefix}/tools">Công cụ</a>
<a href="${siteUrl}${prefix}/tournaments">Giải đấu</a>
<a href="${siteUrl}${prefix}/livestream">Livestream</a>
<a href="${siteUrl}${prefix}/news">Tin tức</a>
<a href="${siteUrl}${prefix}/videos">Video</a>
<a href="${siteUrl}${prefix}/forum">Diễn đàn</a>
</nav></header>`;
  }
  return `<header><nav>
<a href="${siteUrl}/">Home</a>
<a href="${siteUrl}/blog">Blog</a>
<a href="${siteUrl}/tools">Tools</a>
<a href="${siteUrl}/tournaments">Tournaments</a>
<a href="${siteUrl}/livestream">Livestream</a>
<a href="${siteUrl}/news">News</a>
<a href="${siteUrl}/videos">Videos</a>
<a href="${siteUrl}/forum">Forum</a>
</nav></header>`;
}

function getFooterHtml(lang: Lang, siteUrl: string): string {
  const prefix = lang === "vi" ? "/vi" : "";
  if (lang === "vi") {
    return `<footer>
<p>&copy; 2026 ThePickleHub - Cộng đồng Pickleball Việt Nam</p>
<nav>
<a href="${siteUrl}${prefix}/privacy">Chính sách bảo mật</a>
<a href="${siteUrl}${prefix}/terms">Điều khoản sử dụng</a>
</nav>
</footer>`;
  }
  return `<footer>
<p>&copy; 2026 ThePickleHub - Pickleball Tournaments, Livestream &amp; Community</p>
<nav>
<a href="${siteUrl}/privacy">Privacy Policy</a>
<a href="${siteUrl}/terms">Terms of Service</a>
</nav>
</footer>`;
}

// SEO audit 2026-05-28 (batch 5) — SEOnaut uses Go's len() on the
// title/description string, which counts UTF-8 BYTES not Unicode code
// points. A Vietnamese diacritic glyph encodes to 2-3 bytes (ố, ấ, ệ,
// đ) so a 59-character VI title is ~82 bytes and trips the "> 60"
// threshold even though it would be fine if measured in chars. Batch
// 4 truncated by char count which was a no-op for the VI news fleet.
// truncateForSeo() now budgets in bytes, walks the source char by
// char accumulating UTF-8 byte length, then cuts at the last
// whitespace within the budget. Ellipsis "\u2026" itself is 3 bytes,
// reserved up front.
const SEO_TITLE_MAX_BYTES = 60;
const SEO_DESCRIPTION_MAX_BYTES = 160;
const ELLIPSIS_BYTES = 3; // "\u2026" in UTF-8

const TEXT_ENCODER = new TextEncoder();

function utf8ByteLength(s: string): number {
  return TEXT_ENCODER.encode(s).length;
}

function truncateForSeo(text: string, byteLimit: number): string {
  if (!text) return text;
  if (utf8ByteLength(text) <= byteLimit) return text;

  // Walk the source one Unicode code point at a time, summing the
  // UTF-8 byte cost. Use Array.from() to iterate full code points so
  // surrogate-pair emoji or rare CJK glyphs aren't sliced in half.
  const target = byteLimit - ELLIPSIS_BYTES;
  const chars = Array.from(text);
  let bytes = 0;
  let charIndex = 0;
  for (let i = 0; i < chars.length; i++) {
    const cost = utf8ByteLength(chars[i]);
    if (bytes + cost > target) break;
    bytes += cost;
    charIndex = i + 1;
  }
  const sliced = chars.slice(0, charIndex).join("");

  // Prefer breaking at the last whitespace within the budget so SERP
  // previews don't slice mid-word. minKept guards against the case
  // where a single early word would leave a useless stub like "PPA…"
  // — for empirical Vietnamese news titles 0.6 of the prefix is the
  // sweet spot.
  const lastSpace = sliced.lastIndexOf(" ");
  const minKept = Math.floor(sliced.length * 0.6);
  const base = lastSpace >= minKept ? sliced.slice(0, lastSpace) : sliced;
  return base.replace(/[\s.,;:\-—–]+$/, "") + "\u2026";
}

export function buildHtml(opts: BuildHtmlOptions): string {
  const {
    title: rawTitle,
    description: rawDescription,
    url,
    siteUrl,
    image = DEFAULT_OG_IMAGE,
    type = "website",
    jsonLd,
    bodyContent = "",
    extraMeta = "",
    lang = "en",
    alternates,
    omitAutoHeader = false,
  } = opts;

  // SEO audit batch 4 — clamp the user-visible title + description to
  // the recommended SERP previews. We keep the original (rawTitle /
  // rawDescription) for JSON-LD where the limits do not apply.
  const title = truncateForSeo(rawTitle, SEO_TITLE_MAX_BYTES);
  const description = truncateForSeo(rawDescription, SEO_DESCRIPTION_MAX_BYTES);

  const jsonLdScript = jsonLd
    ? `<script type="application/ld+json">${escapeJsonLd(JSON.stringify(jsonLd))}</script>`
    : "";

  const htmlLang = lang === "vi" ? "vi" : "en";
  const ogLocale = lang === "vi" ? "vi_VN" : "en_US";
  // og:locale:alternate is gated on the caller actually declaring
  // alternates. Emitting it unconditionally would claim alt-locale
  // availability for single-canonical routes that don't have one
  // — a parallel of the fake-hreflang invalid-signal problem
  // (Codex P1 on PR #40). When a route truly serves multiple locales
  // it passes `alternates` AND inherits the og:locale:alternate tag.
  const hasAlternates = !!(alternates && alternates.length > 0);
  const ogLocaleAlternate = lang === "vi" ? "en_US" : "vi_VN";
  const ogLocaleAlternateTag = hasAlternates
    ? `<meta property="og:locale:alternate" content="${ogLocaleAlternate}"/>`
    : "";
  const alternatesHtml = (alternates ?? [])
    .map(
      (a) =>
        `<link rel="alternate" hreflang="${escapeHtml(a.hreflang)}" href="${escapeHtml(a.href)}"/>`,
    )
    .join("\n");
  const headerHtml = getHeaderHtml(lang, siteUrl);
  const footerHtml = getFooterHtml(lang, siteUrl);

  const autoHeader = omitAutoHeader
    ? ""
    : `<h1>${escapeHtml(title)}</h1>\n<p>${escapeHtml(description)}</p>\n`;

  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}"/>
<link rel="canonical" href="${escapeHtml(url)}"/>
${alternatesHtml}
<meta property="og:type" content="${type}"/>
<meta property="og:url" content="${escapeHtml(url)}"/>
<meta property="og:title" content="${escapeHtml(title)}"/>
<meta property="og:description" content="${escapeHtml(description)}"/>
<meta property="og:image" content="${escapeHtml(image)}"/>
<meta property="og:site_name" content="${SITE_NAME}"/>
<meta property="og:locale" content="${ogLocale}"/>
${ogLocaleAlternateTag}
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:site" content="@ThePickleHub"/>
<meta name="twitter:title" content="${escapeHtml(title)}"/>
<meta name="twitter:description" content="${escapeHtml(description)}"/>
<meta name="twitter:image" content="${escapeHtml(image)}"/>
${extraMeta}
${jsonLdScript}
</head>
<body>
${headerHtml}
<main>
${autoHeader}${bodyContent}
</main>
${footerHtml}
</body>
</html>`;
}

export function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      Vary: "User-Agent",
    },
  });
}
