/**
 * SSR render handlers — static pages, shells, default fallback, and 404.
 * SEO-04 — split from index.ts, code moved verbatim.
 */

import { buildHtml, htmlResponse } from "../html";
import { escapeHtml, detectLang, type Lang } from "../utils";

export function renderPrivacy(siteUrl: string, rawPath: string, lang: Lang): Response {
  const bodyContent = lang === "vi"
    ? `<section><h2>Dữ liệu chúng tôi thu thập</h2><p>ThePickleHub chỉ thu thập thông tin cần thiết để vận hành tài khoản, giải đấu, livestream và tính năng cộng đồng, như email, tên hiển thị, ảnh đại diện và dữ liệu sử dụng. Chúng tôi không bán dữ liệu cá nhân.</p><h2>Cách sử dụng và bảo vệ dữ liệu</h2><p>Dữ liệu được dùng để xác thực, cung cấp tính năng, phòng chống lạm dụng và cải thiện dịch vụ. Quyền truy cập được giới hạn và dữ liệu được lưu trên hạ tầng có biện pháp bảo mật phù hợp.</p><h2>Quyền của bạn</h2><p>Bạn có thể yêu cầu xem, sửa hoặc xóa dữ liệu cá nhân và ngừng sử dụng dịch vụ. Gửi yêu cầu đến <a href="mailto:tapickleballvn@gmail.com">tapickleballvn@gmail.com</a>.</p></section>`
    : `<section><h2>Information we collect</h2><p>ThePickleHub collects only the information needed to operate accounts, tournaments, livestreams, and community features, such as email address, display name, profile image, and service usage data. We do not sell personal information.</p><h2>How information is used and protected</h2><p>Information is used for authentication, product functionality, abuse prevention, support, and service improvement. Access is limited and data is stored using appropriate security controls.</p><h2>Your choices</h2><p>You may request access, correction, or deletion of your personal information and stop using the service. Send privacy requests to <a href="mailto:tapickleballvn@gmail.com">tapickleballvn@gmail.com</a>.</p></section>`;
  return htmlResponse(buildHtml({
    title: lang === "vi" ? "Chính sách bảo mật | ThePickleHub" : "Privacy Policy | ThePickleHub",
    description: "Chính sách bảo mật ThePickleHub — cách thu thập, lưu trữ, sử dụng dữ liệu cá nhân, cookie và quyền của người dùng pickleball Việt Nam.",
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    lang,
    bodyContent,
  }));
}

export function renderTerms(siteUrl: string, rawPath: string, lang: Lang): Response {
  const bodyContent = lang === "vi"
    ? `<section><h2>Sử dụng dịch vụ</h2><p>Bạn chịu trách nhiệm về tài khoản, nội dung và hoạt động của mình trên ThePickleHub. Không được dùng dịch vụ cho hành vi trái pháp luật, quấy rối, spam, mạo danh hoặc phát tán mã độc.</p><h2>Nội dung và vận hành</h2><p>Bạn giữ quyền sở hữu nội dung mình đăng và cấp cho ThePickleHub quyền cần thiết để hiển thị, phân phối và kiểm duyệt nội dung đó trong phạm vi cung cấp dịch vụ. Các tính năng được cung cấp theo hiện trạng và có thể thay đổi để bảo đảm an toàn, chất lượng hoặc tuân thủ pháp luật.</p><h2>Liên hệ</h2><p>Câu hỏi về điều khoản có thể gửi đến <a href="mailto:tapickleballvn@gmail.com">tapickleballvn@gmail.com</a>.</p></section>`
    : `<section><h2>Using the service</h2><p>You are responsible for your account, content, and activity on ThePickleHub. You may not use the service for unlawful conduct, harassment, spam, impersonation, malware, or interference with other users.</p><h2>Content and operation</h2><p>You retain ownership of content you submit and grant ThePickleHub the permissions needed to display, distribute, and moderate it while providing the service. Features are provided as available and may change to protect safety, quality, or legal compliance.</p><h2>Contact</h2><p>Questions about these terms may be sent to <a href="mailto:tapickleballvn@gmail.com">tapickleballvn@gmail.com</a>.</p></section>`;
  return htmlResponse(buildHtml({
    title: lang === "vi" ? "Điều khoản sử dụng | ThePickleHub" : "Terms of Service | ThePickleHub",
    description: "Điều khoản sử dụng ThePickleHub — quy định tài khoản, livestream, bracket, nội dung người dùng, sở hữu trí tuệ trên nền tảng pickleball Việt Nam.",
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    lang,
    bodyContent,
  }));
}

export function renderAbout(siteUrl: string, rawPath: string, lang: Lang): Response {
  const isVi = lang === "vi";
  return htmlResponse(buildHtml({
    title: isVi ? "Về ThePickleHub" : "About ThePickleHub",
    description: isVi
      ? "ThePickleHub là nền tảng pickleball song ngữ do đội ngũ tại Việt Nam xây dựng cho người chơi và ban tổ chức."
      : "ThePickleHub is a bilingual pickleball platform built in Vietnam for players and tournament organizers.",
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    lang,
    bodyContent: isVi
      ? `<section><h2>Chúng tôi làm gì</h2><p>ThePickleHub tập hợp công cụ quản lý giải đấu miễn phí, lịch và kết quả thi đấu, livestream, video, tin tức, bảng xếp hạng DUPR, danh bạ sân và hoạt động cộng đồng trong một nền tảng song ngữ Việt–Anh. Người tổ chức có thể thử các công cụ round robin, loại trực tiếp và thể thức đồng đội mà không cần đăng ký.</p><h2>Chúng tôi phục vụ ai</h2><p>Nền tảng dành cho người chơi muốn theo dõi môn thể thao, tìm sân và sự kiện; câu lạc bộ muốn kết nối cộng đồng; và ban tổ chức cần vận hành bracket, lịch đấu cùng live scoring. Đội ngũ ThePickleHub đặt tại TP.HCM và tập trung đặc biệt vào hệ sinh thái pickleball Việt Nam và châu Á.</p><h2>Nguyên tắc biên tập</h2><p>Chúng tôi ưu tiên thông tin có nguồn, cập nhật rõ ràng và nội dung hữu ích từ trải nghiệm thực tế của cộng đồng pickleball địa phương.</p></section>`
      : `<section><h2>What we do</h2><p>ThePickleHub brings together free tournament-management tools, schedules and results, livestreams, video, news, DUPR rankings, court discovery, and community events in one Vietnamese–English platform. Organizers can try round-robin, elimination, and team formats without creating an account.</p><h2>Who we serve</h2><p>The platform is for players following the sport or finding courts and events, clubs growing local communities, and organizers managing brackets, schedules, and live scoring. ThePickleHub's team is based in Ho Chi Minh City, with a particular focus on pickleball in Vietnam and across Asia.</p><h2>Editorial principles</h2><p>We prioritize sourced information, transparent updates, and useful coverage grounded in the first-hand experience of the local pickleball community.</p></section>`,
  }));
}

export function renderContact(siteUrl: string, rawPath: string, lang: Lang): Response {
  const isVi = lang === "vi";
  return htmlResponse(buildHtml({
    title: isVi ? "Liên hệ ThePickleHub" : "Contact ThePickleHub",
    description: isVi
      ? "Liên hệ đội ngũ ThePickleHub về hỗ trợ, giải đấu, nội dung, hợp tác và quyền riêng tư."
      : "Contact ThePickleHub about support, tournaments, editorial coverage, partnerships, and privacy.",
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    lang,
    bodyContent: isVi
      ? `<section><h2>Hỗ trợ và phản hồi</h2><p>Đội ngũ ThePickleHub hỗ trợ người chơi, câu lạc bộ và ban tổ chức về tài khoản, công cụ giải đấu, livestream, nội dung và dữ liệu công khai trên nền tảng. Khi báo lỗi, vui lòng gửi URL liên quan, thiết bị đang dùng và mô tả ngắn các bước dẫn đến lỗi.</p><h2>Nội dung và hợp tác</h2><p>Đơn vị tổ chức giải, câu lạc bộ, vận động viên và đối tác truyền thông có thể liên hệ để cập nhật lịch thi đấu, đề nghị chỉnh sửa thông tin, chia sẻ thông cáo hoặc trao đổi hợp tác. Chúng tôi xem xét từng yêu cầu và không bảo đảm mọi nội dung gửi đến sẽ được đăng.</p><h2>Thông tin liên hệ</h2><p>Email: <a href="mailto:tapickleballvn@gmail.com">tapickleballvn@gmail.com</a>. Đội ngũ vận hành tại TP.HCM, Việt Nam. Không gửi mật khẩu, mã đăng nhập hoặc dữ liệu nhạy cảm qua email.</p></section>`
      : `<section><h2>Support and feedback</h2><p>ThePickleHub's team helps players, clubs, and organizers with accounts, tournament tools, livestreams, editorial content, and public information on the platform. When reporting a problem, include the relevant URL, your device, and a short description of the steps that produced it.</p><h2>Editorial and partnerships</h2><p>Tournament organizers, clubs, athletes, and media partners may contact us with schedule updates, correction requests, press information, or partnership proposals. We review each request but cannot guarantee that every submission will be published.</p><h2>Contact details</h2><p>Email: <a href="mailto:tapickleballvn@gmail.com">tapickleballvn@gmail.com</a>. The team operates from Ho Chi Minh City, Vietnam. Do not send passwords, login codes, or sensitive personal information by email.</p></section>`,
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
