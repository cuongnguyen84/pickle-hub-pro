/**
 * SSR render handlers — static pages, shells, default fallback, and 404.
 * SEO-04 — split from index.ts, code moved verbatim.
 */

import { buildHtml, htmlResponse } from "../html";
import { escapeHtml, detectLang, type Lang } from "../utils";

export function renderPrivacy(siteUrl: string, rawPath: string, lang: Lang): Response {
  return htmlResponse(buildHtml({
    title: lang === "vi" ? "Chính sách bảo mật | ThePickleHub" : "Privacy Policy | ThePickleHub",
    description: "Chính sách bảo mật ThePickleHub — cách thu thập, lưu trữ, sử dụng dữ liệu cá nhân, cookie và quyền của người dùng pickleball Việt Nam.",
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    lang,
  }));
}

export function renderTerms(siteUrl: string, rawPath: string, lang: Lang): Response {
  return htmlResponse(buildHtml({
    title: lang === "vi" ? "Điều khoản sử dụng | ThePickleHub" : "Terms of Service | ThePickleHub",
    description: "Điều khoản sử dụng ThePickleHub — quy định tài khoản, livestream, bracket, nội dung người dùng, sở hữu trí tuệ trên nền tảng pickleball Việt Nam.",
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    lang,
  }));
}

// ─── Notifications page shell (Sprint 5 PR-C bot view) ────────────────────
//
// /notifications, /thong-bao, /vi/notifications, /vi/thong-bao all render
// the same Notifications React page (auth-gated). Bots get this noindex
// shell so they don't waste crawl budget on a private surface; real users
// bypass this branch entirely (middleware only routes here for bot UAs).

export function renderNotificationsShell(siteUrl: string, rawPath: string, lang: Lang): Response {
  return htmlResponse(buildHtml({
    title: lang === "vi" ? "Thông báo | ThePickleHub" : "Notifications | ThePickleHub",
    description: lang === "vi"
      ? "Thông báo cá nhân ThePickleHub — bình luận, kudo, theo dõi mới và lời nhắc đến từ cộng đồng pickleball."
      : "ThePickleHub personal notifications — new comments, likes, follows, and mentions from the pickleball community.",
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    lang,
    extraMeta: `<meta name="robots" content="noindex, nofollow"/>`,
  }));
}

// ─── Noindex private-route shell (PR72 — SEO Phase 2A I-7) ────────────────
//
// Single bot-facing shell for every NOINDEX_PATTERNS match in
// functions/_middleware.ts. We deliberately don't embed any of the
// path's actual data (the magic_token, the club slug, etc.) — the
// crawler just needs a clean noindex signal + a link back to the
// public surface. The middleware also sets X-Robots-Tag on the
// response; the meta tag in this body is belt-and-braces for crawlers
// that ignore the header.

export function renderNoindexShell(siteUrl: string, rawPath: string, lang: Lang): Response {
  const title = lang === "vi"
    ? "Trang riêng tư | ThePickleHub"
    : "Private page | ThePickleHub";
  const description = lang === "vi"
    ? "Đây là một trang nội bộ trên ThePickleHub. Quay lại trang chủ để xem giải đấu, livestream và sự kiện công khai."
    : "This is a private surface on ThePickleHub. Return to the homepage for tournaments, livestreams, and public events.";
  return htmlResponse(buildHtml({
    title,
    description,
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    lang,
    extraMeta: `<meta name="robots" content="noindex, nofollow, noarchive"/>`,
    bodyContent: `<p>${escapeHtml(description)}</p><p><a href="${siteUrl}/">${lang === "vi" ? "Về trang chủ" : "Go to homepage"}</a></p>`,
  }));
}

// ─── Default fallback ───────────────��─────────────────────

export function renderDefault(path: string, siteUrl: string, lang: Lang): Response {
  return htmlResponse(buildHtml({
    title: "ThePickleHub - Pickleball Community",
    description: "ThePickleHub là nền tảng pickleball hàng đầu Việt Nam với giải đấu, livestream, tools và cộng đồng sôi động.",
    url: `${siteUrl}${path}`,
    siteUrl,
    lang,
  }));
}

// ─── 404 ──────────────────────────────��───────────────────

export function render404(path: string, siteUrl: string): Response {
  const isVi = detectLang(path) === "vi";
  const title = isVi
    ? "404 - Không tìm thấy trang | ThePickleHub"
    : "404 - Page Not Found | ThePickleHub";
  const description = isVi
    ? "Trang bạn tìm không tồn tại. Quay lại trang chủ ThePickleHub để khám phá giải đấu, livestream và cộng đồng pickleball Việt Nam."
    : "The page you're looking for doesn't exist. Return to ThePickleHub for pickleball tournaments, livestreams, and Vietnam's pickleball community.";
  const homeHref = isVi ? `${siteUrl}/vi/` : `${siteUrl}/`;
  const homeLabel = isVi ? "Quay lại trang chủ" : "Return to home";
  // No canonical or og:url — emitting a canonical on a 404 sends a
  // contradictory signal (canonical = "this URL is authoritative" vs.
  // noindex = "don't index this"). Omitting both is correct for 404s.
  const html = `<!DOCTYPE html>
<html lang="${isVi ? "vi" : "en"}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}"/>
<meta name="robots" content="noindex, nofollow"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${escapeHtml(title)}"/>
<meta property="og:description" content="${escapeHtml(description)}"/>
<meta property="og:site_name" content="ThePickleHub"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:site" content="@ThePickleHub"/>
<meta name="twitter:title" content="${escapeHtml(title)}"/>
<meta name="twitter:description" content="${escapeHtml(description)}"/>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(description)}</p>
<p><a href="${escapeHtml(homeHref)}">${escapeHtml(homeLabel)}</a></p>
</body>
</html>`;
  return htmlResponse(html, 404);
}
