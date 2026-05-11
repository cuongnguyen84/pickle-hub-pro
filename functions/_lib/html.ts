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

export function buildHtml(opts: BuildHtmlOptions): string {
  const {
    title,
    description,
    url,
    siteUrl,
    image = DEFAULT_OG_IMAGE,
    type = "website",
    jsonLd,
    bodyContent = "",
    extraMeta = "",
    lang = "en",
    alternates,
  } = opts;

  const jsonLdScript = jsonLd
    ? `<script type="application/ld+json">${escapeJsonLd(JSON.stringify(jsonLd))}</script>`
    : "";

  const htmlLang = lang === "vi" ? "vi" : "en";
  const ogLocale = lang === "vi" ? "vi_VN" : "en_US";
  // The other locale a crawler might want to surface — declared via
  // og:locale:alternate. For single-canonical bilingual routes this
  // pair is symmetric (vi page declares en alternate; en page declares
  // vi alternate). When more locales are added, expand to an array.
  const ogLocaleAlternate = lang === "vi" ? "en_US" : "vi_VN";
  const alternatesHtml = (alternates ?? [])
    .map(
      (a) =>
        `<link rel="alternate" hreflang="${escapeHtml(a.hreflang)}" href="${escapeHtml(a.href)}"/>`,
    )
    .join("\n");
  const headerHtml = getHeaderHtml(lang, siteUrl);
  const footerHtml = getFooterHtml(lang, siteUrl);

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
<meta property="og:locale:alternate" content="${ogLocaleAlternate}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(title)}"/>
<meta name="twitter:description" content="${escapeHtml(description)}"/>
<meta name="twitter:image" content="${escapeHtml(image)}"/>
${extraMeta}
${jsonLdScript}
</head>
<body>
${headerHtml}
<main>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(description)}</p>
${bodyContent}
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
