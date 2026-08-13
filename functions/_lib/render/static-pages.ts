/**
 * SSR render handlers — static pages, shells, default fallback, and 404.
 * SEO-04 — split from index.ts, code moved verbatim.
 */

import { buildHtml, htmlResponse } from "../html";
import { escapeHtml, detectLang, type Lang } from "../utils";

export function renderPrivacy(siteUrl: string, rawPath: string, lang: Lang): Response {
  const isVi = lang === "vi";
  const bodyContent = isVi
    ? `
      <h1>Chính sách bảo mật – ThePickleHub</h1>
      <p>ThePickleHub là nền tảng pickleball dành cho người chơi theo dõi tin tức và livestream, tìm người chơi và sân, đồng thời tạo hoặc tham gia giải đấu và sự kiện cộng đồng.</p>
      <h2>Thông tin chúng tôi thu thập</h2>
      <p>Chúng tôi thu thập email, tên hiển thị, ảnh đại diện và dữ liệu sử dụng cần thiết để xác thực tài khoản, vận hành hồ sơ, giải đấu, bảng xếp hạng, video và livestream.</p>
      <h2>Dữ liệu từ Google Sign-In</h2>
      <p>Khi bạn chọn đăng nhập bằng Google, ThePickleHub chỉ truy cập tên, địa chỉ email và ảnh đại diện từ tài khoản Google của bạn. Chúng tôi dùng dữ liệu này để xác thực danh tính, tạo và bảo vệ tài khoản ThePickleHub, đồng thời cá nhân hóa hồ sơ của bạn.</p>
      <p>Dữ liệu tài khoản được lưu trên hạ tầng đám mây bảo mật trong thời gian tài khoản hoạt động hoặc khi pháp luật yêu cầu. Dữ liệu chỉ được xử lý bởi Google, nhà cung cấp xác thực và hạ tầng dịch vụ cần thiết để vận hành đăng nhập. Chúng tôi không bán dữ liệu Google và không dùng dữ liệu Google Sign-In cho quảng cáo cá nhân hóa, nhắm mục tiêu quảng cáo hoặc đánh giá tín dụng.</p>
      <h2>Chia sẻ và bảo mật dữ liệu</h2>
      <p>Chúng tôi không bán dữ liệu cá nhân. Dữ liệu chỉ được chia sẻ khi cần để cung cấp dịch vụ hoặc tuân thủ yêu cầu pháp lý hợp lệ. Chúng tôi áp dụng các biện pháp bảo mật tiêu chuẩn ngành và giới hạn quyền truy cập cho nhân sự cần thiết.</p>
      <h2>Quyền và xóa dữ liệu</h2>
      <p>Bạn có thể xem, chỉnh sửa hoặc yêu cầu xóa tài khoản và dữ liệu cá nhân bằng cách gửi email tới <a href="mailto:tapickleballvn@gmail.com">tapickleballvn@gmail.com</a>. Dữ liệu được xóa theo yêu cầu, trừ khi pháp luật yêu cầu lưu giữ lâu hơn.</p>
      <p>Chính sách này được cập nhật và có hiệu lực từ ngày 08/08/2026.</p>
      <p><a href="${siteUrl}/">Về trang chủ ThePickleHub</a></p>`
    : `
      <h1>Privacy Policy – ThePickleHub</h1>
      <p>ThePickleHub is a pickleball platform where players follow news and livestreams, find players and courts, and create or join tournaments and community events.</p>
      <h2>Information We Collect</h2>
      <p>We collect the email address, display name, profile photo, and service usage data needed to authenticate accounts and operate profiles, tournaments, leaderboards, videos, and livestreams.</p>
      <h2>Google Sign-In Data</h2>
      <p>When you choose Google Sign-In, ThePickleHub accesses only your name, email address, and profile photo from your Google Account. We use this information to authenticate you, create and secure your ThePickleHub account, and personalize your profile.</p>
      <p>Account data is stored on secure cloud infrastructure while your account remains active or as required by law. It is processed only by Google, our authentication provider, and service infrastructure needed to operate sign-in. We do not sell Google user data or use Google Sign-In data for personalized advertising, ad targeting, or credit-worthiness decisions.</p>
      <h2>Data Sharing and Security</h2>
      <p>We do not sell personal data. We disclose it only when needed to provide the service or comply with a valid legal request. We apply industry-standard safeguards and limit access to essential personnel.</p>
      <h2>Your Rights and Data Deletion</h2>
      <p>You may view, correct, or request deletion of your account and personal data by emailing <a href="mailto:tapickleballvn@gmail.com">tapickleballvn@gmail.com</a>. Data is deleted on request unless a longer retention period is required by law.</p>
      <p>This policy was updated and is effective as of August 8, 2026.</p>
      <p><a href="${siteUrl}/">Return to ThePickleHub</a></p>`;

  return htmlResponse(buildHtml({
    title: isVi ? "Chính sách bảo mật | ThePickleHub" : "Privacy Policy | ThePickleHub",
    description: isVi
      ? "Chính sách bảo mật ThePickleHub — cách truy cập, sử dụng, lưu trữ và chia sẻ dữ liệu cá nhân, bao gồm dữ liệu Google Sign-In."
      : "ThePickleHub Privacy Policy — how we access, use, store, and share personal data, including Google Sign-In data.",
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    lang,
    bodyContent,
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

export function renderAdvertise(siteUrl: string, rawPath: string, lang: Lang): Response {
  const enUrl = `${siteUrl}/advertise`;
  const viUrl = `${siteUrl}/vi/advertise`;
  const isVi = lang === "vi";

  return htmlResponse(buildHtml({
    title: isVi ? "Quảng cáo cùng ThePickleHub" : "Advertise with ThePickleHub",
    description: isVi
      ? "Tiếp cận cộng đồng pickleball song ngữ tại Việt Nam và châu Á qua tài trợ, nội dung thương hiệu và các gói quảng cáo phù hợp."
      : "Reach an engaged bilingual pickleball audience across Vietnam and Asia through sponsorships, branded content, and tailored advertising packages.",
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    lang,
    alternates: [
      { hreflang: "en", href: enUrl },
      { hreflang: "vi", href: viUrl },
      { hreflang: "x-default", href: enUrl },
    ],
    bodyContent: isVi
      ? "<h2>Hợp tác cùng chúng tôi</h2><p>Đưa thương hiệu của bạn đến với người chơi, nhà tổ chức và người hâm mộ pickleball tại Việt Nam và châu Á.</p><p>Liên hệ: <a href=\"mailto:thecuong@gmail.com\">thecuong@gmail.com</a></p>"
      : "<h2>Partner with us</h2><p>Put your brand in front of pickleball players, organizers, and fans across Vietnam and Asia.</p><p>Contact: <a href=\"mailto:thecuong@gmail.com\">thecuong@gmail.com</a></p>",
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
  const homeHref = isVi ? `${siteUrl}/vi` : `${siteUrl}/`;
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
