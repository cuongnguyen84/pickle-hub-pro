/**
 * SSR render handlers — tools hub + per-tool marketing/new pages.
 * SEO-04 — split from index.ts, code moved verbatim.
 */

import { buildHtml, htmlResponse } from "../html";
import { bilingualHreflang } from "../utils";
import {
  TOOLS_FAQ_EN,
  TOOLS_FAQ_VI,
  TOOLS_HOWTO_EN,
  TOOLS_HOWTO_VI,
  TOOLS_HOWTO_META,
} from "../../../src/content/tools/hub-copy";
import { renderNoindexShell } from "./static-pages";

// ─── Tools hub ─────────────────────────────���──────────────

// FAQ + how-to copy now lives in src/content/tools/hub-copy.ts so the SSR
// JSON-LD, the SSR body and the React page (ToolsHubFaqSection) cannot drift
// apart. Pages Functions import from src/ directly — same pattern as
// pro-calendar-2026.ts and blog-meta.ts.

export function renderTools(siteUrl: string, _rawPath = "/tools", lang: "en" | "vi" = "en"): Response {
  const isVi = lang === "vi";
  const canonical = isVi ? `${siteUrl}/vi/tools` : `${siteUrl}/tools`;
  // VI SEO (2026-07-13) — /vi/tools previously served the ENGLISH title/meta/
  // body (only the organizer-guide links switched), and NEITHER /tools nor
  // /vi/tools emitted hreflang. GSC 7d: all /tools queries are English while
  // the audience is ~95% VN — the Vietnamese keyword space ("tạo bảng đấu
  // pickleball", "chia cặp vòng tròn", "phần mềm quản lý giải pickleball")
  // has no entrenched competitor. Full VI variant below + reciprocal
  // hreflang en/vi/x-default on both URLs (sitemap-static already declares
  // the /tools ↔ /vi/tools pair; page-level tags now match it).
  return htmlResponse(buildHtml({
    // VI title/description are budgeted to buildHtml's SEO byte limits
    // (60/160 UTF-8 BYTES — Vietnamese diacritics cost 2-3 bytes each;
    // title = 57B, description = 156B). Longer variants get ellipsis-
    // truncated by truncateForSeo, which mangles the SERP title AND the
    // auto-emitted <h1>.
    title: isVi
      ? "Tạo Bảng Đấu Pickleball Miễn Phí | ThePickleHub"
      // EN title carries the exact head term. GSC 90d: "pickleball bracket
      // generator" sent 54 impressions to this page at avg pos ~11 while the
      // title said "Tournament Tools" — the phrase appeared nowhere in the
      // SERP title or the bot-visible <h1> (buildHtml emits <h1>{title}</h1>).
      : "Free Pickleball Bracket Generator | ThePickleHub",
    description: isVi
      ? "Tạo bảng đấu pickleball miễn phí: chia cặp vòng tròn, loại trực tiếp, đội MLP. Chấm điểm trực tiếp, không cần đăng ký."
      : "Free pickleball bracket generator: round robin scheduler, single and double elimination brackets, MLP team match. Live scoring, no signup.",
    url: canonical,
    siteUrl,
    extraMeta: bilingualHreflang(`${siteUrl}/tools`, `${siteUrl}/vi/tools`),
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebApplication",
          "@id": `${canonical}#app`,
          name: isVi
            ? "Bracket Lab — Công cụ tạo bảng đấu pickleball miễn phí"
            : "Bracket Lab — Free Pickleball Tournament Bracket Generator",
          url: canonical,
          inLanguage: lang,
          applicationCategory: "SportsApplication",
          operatingSystem: "Web",
          browserRequirements: "Requires JavaScript. Requires HTML5.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          description: isVi
            ? "Công cụ tạo bảng đấu pickleball miễn phí — vòng tròn tính điểm, loại trực tiếp đơn và đôi, đấu đồng đội MLP, định dạng linh hoạt. Chấm điểm trực tiếp, bảng điểm chia sẻ được, không cần đăng ký."
            : "Free pickleball tournament bracket generator — round robin, single and double elimination, MLP team match, flex format. Live scoring, shareable scoreboard, no signup.",
          // Note: aggregateRating intentionally omitted. Google Rich Results
          // requires verified user reviews; previous fake "4.8 / 120 reviews"
          // value (removed 2026-04-28) was non-compliant. Re-add only when we
          // ship real review collection.
        },
        {
          "@type": "ItemList",
          "@id": `${canonical}#formats`,
          itemListElement: isVi
            ? [
              { "@type": "ListItem", position: 1, name: "Bảng đấu nhanh (Vòng tròn tính điểm)", url: `${siteUrl}/vi/tools/quick-tables` },
              { "@type": "ListItem", position: 2, name: "Loại trực tiếp Đôi", url: `${siteUrl}/vi/tools/doubles-elimination` },
              { "@type": "ListItem", position: 3, name: "Giải Linh hoạt", url: `${siteUrl}/vi/tools/flex-tournament` },
              { "@type": "ListItem", position: 4, name: "Đấu đồng đội (Định dạng MLP)", url: `${siteUrl}/vi/tools/team-match` },
            ]
            : [
              { "@type": "ListItem", position: 1, name: "Quick Tables (Round Robin)", url: `${siteUrl}/tools/quick-tables` },
              { "@type": "ListItem", position: 2, name: "Doubles Elimination Bracket", url: `${siteUrl}/tools/doubles-elimination` },
              { "@type": "ListItem", position: 3, name: "Flex Tournament", url: `${siteUrl}/tools/flex-tournament` },
              { "@type": "ListItem", position: 4, name: "Team Match (MLP Format)", url: `${siteUrl}/tools/team-match` },
            ],
        },
        // FAQPage — every Q&A below is also rendered in bodyContent (and in
        // ToolsSeoContent.tsx for human visitors), which Google requires:
        // FAQ markup must match answers visible on the page.
        {
          "@type": "FAQPage",
          "@id": `${canonical}#faq`,
          mainEntity: (isVi ? TOOLS_FAQ_VI : TOOLS_FAQ_EN).map(([q, a]) => ({
            "@type": "Question",
            name: q,
            acceptedAnswer: { "@type": "Answer", text: a },
          })),
        },
        // HowTo — SEO-GUARD-01 (2026-08-19). /tools ranked on "pickleball
        // bracket generator" (GSC pos 12.2) but held no procedural content and
        // slid to 19 while losing all 16 of its weekly clicks. Every step below
        // is also rendered as a visible <ol> in bodyContent and by
        // ToolsHubFaqSection for human visitors — HowTo markup describing steps
        // the page does not show is a structured-data policy violation.
        {
          "@type": "HowTo",
          "@id": `${canonical}#howto`,
          name: TOOLS_HOWTO_META[lang].name,
          description: TOOLS_HOWTO_META[lang].description,
          totalTime: TOOLS_HOWTO_META[lang].totalTime,
          inLanguage: lang,
          // The tool is free, so an explicit zero-cost estimate is honest and
          // lets Google render the "free" qualifier.
          estimatedCost: { "@type": "MonetaryAmount", currency: "USD", value: "0" },
          supply: [],
          tool: [
            {
              "@type": "HowToTool",
              name: isVi ? "Bracket Lab của ThePickleHub" : "ThePickleHub Bracket Lab",
            },
          ],
          step: (isVi ? TOOLS_HOWTO_VI : TOOLS_HOWTO_EN).map(([name, text], i) => ({
            "@type": "HowToStep",
            position: i + 1,
            name,
            text,
            url: `${canonical}#step-${i + 1}`,
          })),
        },
      ],
    },
    // Bot-visible body — mirrors hero + pillar copy from src/pages/Tools.tsx
    // (lines 151-159 hero, 277-308 'What Bracket Lab actually does' section).
    // Without this, Googlebot only saw a 4-link skeleton and missed the
    // commercial keywords commit dd05713 added to the React source. Bing's
    // bot runs JS so it already saw the copy, but Googlebot is SSR-only.
    // Verified 2026-04-29 (curl `-A "Googlebot" /tools` was 5056 chars vs
    // 7361 for homepage). Keep this block in sync if Tools.tsx hero or
    // pillar prose changes — set a search alert for "free pickleball
    // tournament bracket generator".
    // H2 (not H1) here — buildHtml already emits <h1>${title}</h1>
    // at the top of <main>; a second H1 in bodyContent caused Ahrefs
    // Site Audit to flag /tools + /vi/tools as "Multiple H1 tags".
    bodyContent: isVi
      ? `<h2>60 giây để có bảng đấu pickleball.</h2>
<p>Trình tạo bảng đấu pickleball miễn phí — chia cặp vòng tròn tính điểm (round robin), loại trực tiếp đơn và đôi, đấu đồng đội kiểu MLP, và định dạng linh hoạt. Chấm điểm trực tiếp trên điện thoại, link bảng điểm chia sẻ được, bracket in được. Không cần cài app, không cần đăng ký, hoàn toàn miễn phí.</p>
<h2>Các định dạng giải đấu</h2>
<ul>
  <li><a href="${siteUrl}/vi/tools/quick-tables">Bảng đấu nhanh – Vòng tròn tính điểm &amp; Loại trực tiếp đơn</a></li>
  <li><a href="${siteUrl}/vi/tools/team-match">Đấu đồng đội – Định dạng MLP</a></li>
  <li><a href="${siteUrl}/vi/tools/doubles-elimination">Loại trực tiếp Đôi</a></li>
  <li><a href="${siteUrl}/vi/tools/flex-tournament">Giải Linh hoạt – Luật tùy chỉnh</a></li>
</ul>
<h2>Phần mềm quản lý giải pickleball — Bracket Lab làm gì</h2>
<p>Bracket Lab là công cụ tạo bảng đấu và quản lý giải pickleball miễn phí, dành cho câu lạc bộ, người tổ chức giải cuối tuần và các sự kiện chuyên nghiệp tại Việt Nam và châu Á. Chọn định dạng — vòng tròn tính điểm, loại trực tiếp đơn, loại trực tiếp đôi, đấu đồng đội MLP, hay giải linh hoạt tùy chỉnh — công cụ sẽ tự chia cặp, dựng bảng đấu, xếp lịch trận, xoay sân và theo dõi tỉ số trực tiếp. Chia sẻ một link duy nhất cho người chơi và khán giả; cần thì in bracket treo tường.</p>
<p>Không cần đăng ký. Không cần tải về. Không có kiểu dùng thử 14 ngày rồi thành gói $99/tháng. Xây dựng và duy trì bởi <a href="${siteUrl}/vi">ThePickleHub</a>, nền tảng pickleball song ngữ Việt-Anh đưa tin PPA Tour Asia, MLP và các giải pro khu vực.</p>
<h2 id="cach-tao">${TOOLS_HOWTO_META.vi.heading}</h2>
<p>${TOOLS_HOWTO_META.vi.description}</p>
<ol>
${TOOLS_HOWTO_VI.map(([name, text], i) => `  <li id="step-${i + 1}"><strong>${name}.</strong> ${text}</li>`).join("\n")}
</ol>
<h2>${TOOLS_HOWTO_META.vi.faqHeading}</h2>
${TOOLS_FAQ_VI.map(([q, a]) => `<p><strong>${q}</strong> ${a}</p>`).join("\n")}
<h2>Hướng dẫn cho ban tổ chức</h2>
<ul>
  <li><a href="${siteUrl}/vi/blog/du-toan-ngan-sach-giai-pickleball">Tổ chức giải pickleball tốn bao nhiêu? Dự toán chi tiết + file mẫu miễn phí</a></li>
  <li><a href="${siteUrl}/vi/blog/huong-dan-to-chuc-giai">Hướng dẫn tổ chức giải pickleball từ A-Z</a></li>
  <li><a href="${siteUrl}/vi/blog/lich-giai-pickleball-viet-nam-2026">Lịch giải pickleball Việt Nam 2026</a></li>
</ul>`
      : `<h2>60 seconds to a pickleball bracket.</h2>
<p>A free pickleball tournament bracket generator — round robin, single and double elimination, MLP team match, and flex format. Live scoring on your phone, shareable scoreboard URL, printable bracket. No apps, no signup, no catch.</p>
<h2>Tournament formats</h2>
<ul>
  <li><a href="${siteUrl}/tools/quick-tables">Quick Tables – Round Robin &amp; Single Elimination</a></li>
  <li><a href="${siteUrl}/tools/team-match">Team Match – MLP Format</a></li>
  <li><a href="${siteUrl}/tools/doubles-elimination">Doubles Elimination Bracket</a></li>
  <li><a href="${siteUrl}/tools/flex-tournament">Flex Tournament</a></li>
</ul>
<h2>What Bracket Lab actually does</h2>
<p>Bracket Lab is a free pickleball tournament bracket generator built for clubs, weekend organizers, and pro events across Asia. Pick a format — round robin, single elimination, double elimination, MLP team match, or a fully custom flex tournament — and the tool builds the bracket, schedules matches, rotates courts, and tracks live scores. Share a single link with players and spectators; print a wall bracket if you need one.</p>
<p>No signup. No download. No 14-day trial that turns into a $99/month subscription. Built and maintained by <a href="${siteUrl}/blog/tournament-organizer-hub">ThePickleHub</a>, a bilingual Vietnamese-English platform reporting on PPA Tour Asia, MLP, and the regional pro circuit.</p>
<h2>Round robin generator for club play</h2>
<p>Most club events are round robin, so that is what Quick Tables is tuned for: enter 4 to 200 players, choose a group size, and it pairs everyone against everyone in their group, rotates courts so nobody plays back-to-back, seeds groups by skill rating, and keeps live standings with point differential as the tiebreaker. A 6-player group is 15 matches — the tool does the n × (n − 1) ÷ 2 math and the court-time estimate for you.</p>
<h2 id="how-to">${TOOLS_HOWTO_META.en.heading}</h2>
<p>${TOOLS_HOWTO_META.en.description}</p>
<ol>
${TOOLS_HOWTO_EN.map(([name, text], i) => `  <li id="step-${i + 1}"><strong>${name}.</strong> ${text}</li>`).join("\n")}
</ol>
<h2>${TOOLS_HOWTO_META.en.faqHeading}</h2>
${TOOLS_FAQ_EN.map(([q, a]) => `<p><strong>${q}</strong> ${a}</p>`).join("\n")}
<h2>Organizer guides</h2>
<ul>
  <li><a href="${siteUrl}/blog/how-to-create-pickleball-bracket">How to create a pickleball bracket — step by step, plus bracket sizes for 4–64 players</a></li>
  <li><a href="${siteUrl}/blog/pickleball-round-robin-generator-guide">How to run a pickleball round robin — schedule, byes and tiebreakers</a></li>
  <li><a href="${siteUrl}/blog/pickleball-tournament-budget-calculator-guide">How much does a pickleball tournament cost? Full budget guide + free template</a></li>
  <li><a href="${siteUrl}/blog/vietnam-pickleball-tournament-calendar-2026">Vietnam Pickleball Tournament Calendar 2026</a></li>
  <li><a href="${siteUrl}/blog/tournament-organizer-hub">The tournament organizer hub — every guide in the order you need it</a></li>
</ul>`,
    lang,
  }));
}

const TOOL_PAGE_META: Record<string, { title: string; description: string }> = {
  "quick-tables": {
    title: "Quick Tables – Round Robin & Single Elimination | ThePickleHub",
    description: "Free round-robin & single elimination bracket generator. Auto-scheduling, real-time scoring, shareable links. No signup — ThePickleHub.",
  },
  "team-match": {
    title: "Team Match – MLP Format Pickleball | ThePickleHub",
    description: "Free MLP-style team match pickleball bracket tool. Manage team lineups, track singles and doubles results, and generate instant standings. No signup required.",
  },
  "doubles-elimination": {
    title: "Doubles Elimination Bracket Generator | ThePickleHub",
    description: "Free doubles elimination bracket generator. Auto bracket draw, live scoring, shareable results. No signup — ThePickleHub.",
  },
  "flex-tournament": {
    title: "Flex Tournament Generator – Flexible Bracket | ThePickleHub",
    description: "Free flex-format tournament generator. Custom groups, flexible scheduling, live scoring. Perfect for clubs — ThePickleHub.",
  },
};

export function renderToolPage(toolSlug: string, siteUrl: string, rawPath: string, lang: "en" | "vi" = "en"): Response {
  const meta = TOOL_PAGE_META[toolSlug];
  if (!meta) return renderTools(siteUrl, rawPath, lang);

  return htmlResponse(buildHtml({
    title: meta.title,
    description: meta.description,
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: meta.title,
      applicationCategory: "SportsApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    bodyContent: `<h2>${meta.title}</h2><p>${meta.description}</p>
      <p><a href="${siteUrl}/tools">← All Tournament Tools</a></p>`,
  }));
}

// W1.1 (2026-05-15) — page-specific metadata for /tools/{tool}/new
// setup pages. Previously these were caught by the
// /^\/(?:vi\/)?tools\/[^/]+\/new(?:\/|$)/ noindex pattern in
// _middleware.ts so bots saw the renderNoindexShell — wasting all of
// their organic SEO potential. Now the bot path serves a real
// SoftwareApplication-typed shell with create-flow copy. Quick Tables
// has no /new variant (the list page IS the create flow), so only 3
// tools are mapped here.
const TOOL_NEW_PAGE_META: Record<string, {
  en: { title: string; description: string };
  vi: { title: string; description: string };
}> = {
  "doubles-elimination": {
    en: {
      title: "Create Doubles Elimination Bracket | ThePickleHub",
      description: "Free doubles elimination bracket generator. Auto bracket draw, live scoring, shareable results. No signup — ThePickleHub.",
    },
    vi: {
      title: "Tạo Doubles Elimination Bracket | ThePickleHub",
      description: "Công cụ miễn phí tạo bracket loại kép pickleball. Bốc thăm tự động, chấm điểm trực tiếp, chia sẻ kết quả qua link. Không cần đăng ký — ThePickleHub.",
    },
  },
  "flex-tournament": {
    en: {
      title: "Create Flex Tournament | ThePickleHub",
      description: "Free flexible tournament generator. Custom groups, brackets, and match formats. No signup — ThePickleHub.",
    },
    vi: {
      title: "Tạo Flex Tournament | ThePickleHub",
      description: "Công cụ miễn phí tạo giải đấu pickleball với cấu trúc tự do. Tự thiết kế nhóm, bracket, và thể thức trận đấu. Không cần đăng ký — ThePickleHub.",
    },
  },
  "team-match": {
    en: {
      title: "Create MLP Team Match | ThePickleHub",
      description: "Free MLP-style team match software. Lineup management, multi-round scoring, dreambreaker support. No signup — ThePickleHub.",
    },
    vi: {
      title: "Tạo Team Match (MLP) | ThePickleHub",
      description: "Phần mềm miễn phí cho đấu đồng đội theo format MLP. Quản lý lineup, chấm điểm nhiều ván, hỗ trợ dreambreaker. Không cần đăng ký — ThePickleHub.",
    },
  },
};

export function renderToolNewPage(toolSlug: string, siteUrl: string, rawPath: string, lang: "en" | "vi" = "en"): Response {
  const entry = TOOL_NEW_PAGE_META[toolSlug];
  // Unknown tool → fall back to noindex shell rather than a generic
  // shell. /tools/<unknown>/new is almost certainly a typo or stale
  // link; better to signal noindex than serve a thin 200.
  if (!entry) return renderNoindexShell(siteUrl, rawPath, lang);
  const meta = entry[lang] || entry.en;

  return htmlResponse(buildHtml({
    title: meta.title,
    description: meta.description,
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: meta.title,
      applicationCategory: "SportsApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    bodyContent: `<h2>${meta.title}</h2><p>${meta.description}</p>
      <p><a href="${siteUrl}/tools/${toolSlug}">← ${lang === "vi" ? "Quay lại" : "Back to"} ${toolSlug}</a></p>`,
  }));
}
