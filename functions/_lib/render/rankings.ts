/**
 * SSR render handlers — rankings pages (/rankings + /vi/rankings).
 * SEO-04 — split from index.ts, code moved verbatim.
 */

import type { SupabaseClient } from "../supabase";
import { buildHtml, htmlResponse } from "../html";
import { escapeHtml, type Lang } from "../utils";

// PR (2026-05-18 Ahrefs Site Audit fix) — /rankings was returning 404
// for bots (8 broken-link reports tracing to homepage `/` linking to
// `/rankings`). Routes exist in React (App.tsx line 572) but middleware
// had no SSR handler. Same fix as /live below.
//
// Sprint A10 (2026-05-27) — when no scope query param OR scope=vietnam,
// fetch top-25 from public.dupr_leaderboard_vietnam RPC and embed as a
// bot-readable <ol> + ItemList JSON-LD. Bots and Googlebot get real
// content + structured data; SPA hydrates and replaces with React table
// (same visual). Default scope is now "vietnam" matching the React
// page's initial state.
export async function renderRankings(
  supabase: SupabaseClient,
  siteUrl: string,
  rawPath: string,
  lang: Lang,
): Promise<Response> {
  const titleVn = lang === "vi"
    ? "Bảng xếp hạng DUPR Pickleball Việt Nam | ThePickleHub"
    : "Vietnam DUPR Pickleball Rankings | ThePickleHub";
  const descriptionVn = lang === "vi"
    ? "Bảng xếp hạng DUPR cho VĐV pickleball Việt Nam đã kết nối DUPR — cập nhật theo thời gian thực qua webhook DUPR. Top 100 đôi và đơn."
    : "Live DUPR leaderboard for Vietnamese pickleball players linked to DUPR — updated in real time via DUPR webhook. Top 100 doubles and singles.";

  // Fetch live data. RPC is SECURITY DEFINER + whitelist columns so any
  // SSR-side client (anon or service) can call safely. We pass through
  // any error silently and fall back to the meta-only shell — same
  // behavior as the legacy renderRankings.
  const { data, error } = await supabase.rpc("dupr_leaderboard_vietnam", {
    p_format: "doubles",
    p_limit: 25,
  });

  if (error) {
    console.error("renderRankings: vietnam RPC error", { error });
  }

  type Row = {
    rank: number;
    user_id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    city: string | null;
    dupr_rating: number;
  };
  const rows: Row[] = Array.isArray(data) ? (data as Row[]) : [];

  // Render an <ol> with player links so Googlebot can crawl into
  // /nguoi-choi/:username and pick up the leaderboard as internal linking.
  const heading = lang === "vi"
    ? "Top 25 đôi nam/nữ — Việt Nam"
    : "Top 25 Doubles — Vietnam";
  const subhead = lang === "vi"
    ? "Đọc trực tiếp từ profile VĐV đã kết nối DUPR và bật chế độ công khai."
    : "Live from profiles of players linked to DUPR with public visibility on.";
  const empty = lang === "vi"
    ? "Chưa có VĐV Việt Nam nào kết nối DUPR công khai."
    : "No Vietnamese players have connected DUPR publicly yet.";

  const listItems = rows.length === 0
    ? `<p>${empty}</p>`
    : `<ol>${rows
        .map((r) => {
          const name = escapeHtml(r.display_name ?? r.username);
          const cityFragment = r.city ? ` — ${escapeHtml(r.city)}` : "";
          return `<li><a href="${siteUrl}/nguoi-choi/${encodeURIComponent(r.username)}">${name}</a>${cityFragment} — DUPR ${r.dupr_rating.toFixed(3)}</li>`;
        })
        .join("")}</ol>`;

  // schema.org ItemList — helps Google understand this is a ranked list.
  // Each item is a ListItem pointing to the player's public profile page.
  // Skip when empty so we don't ship an empty itemListElement array.
  const itemListJsonLd = rows.length === 0 ? "" : `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: heading,
    numberOfItems: rows.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: rows.map((r) => ({
      "@type": "ListItem",
      position: r.rank,
      url: `${siteUrl}/nguoi-choi/${encodeURIComponent(r.username)}`,
      name: r.display_name ?? r.username,
    })),
  })}</script>`;

  // Reciprocal hreflang — /rankings (EN) and /vi/rankings (VI) are both real
  // bilingual routes (src/App.tsx) that render translated copy via `lang`.
  // renderRankings previously emitted zero hreflang, so Googlebot saw two
  // language variants with no return-tag pairing (curl Googlebot showed
  // hreflang en=0 vi=0 x-default=0). Each path stays self-canonical and the
  // triplet points en→/rankings, vi→/vi/rankings, x-default→/rankings.
  const rankingsHreflang = `<link rel="alternate" hreflang="en" href="${siteUrl}/rankings"/>\n<link rel="alternate" hreflang="vi" href="${siteUrl}/vi/rankings"/>\n<link rel="alternate" hreflang="x-default" href="${siteUrl}/rankings"/>`;

  // SEO wiring (2026-08-12, docs/seo-topical-authority-plan.md §6) — connect the
  // rankings page (E-E-A-T pillar) to the DUPR/WPR explainer guides a ranking
  // reader also wants. Deep-links, not the blog index. All slugs verified live
  // 200 on both tracks (EN from BLOG_POST_META, VI from vi_blog_posts).
  const duprGuides =
    lang === "vi"
      ? [
          { s: "dupr-la-gi-huong-dan-cho-nguoi-choi-viet-nam", t: "DUPR là gì? Hướng dẫn cho người chơi Việt Nam" },
          { s: "bang-xep-hang-pickleball-the-gioi-wpr", t: "Bảng xếp hạng pickleball thế giới (WPR) là gì" },
          { s: "huong-dan-dung-dupr-tren-thepicklehub", t: "Hướng dẫn dùng DUPR trên ThePickleHub" },
        ]
      : [
          { s: "what-is-dupr-pickleball-rating-system", t: "What is DUPR — the pickleball rating system" },
          { s: "world-pickleball-rankings-wpr-explained", t: "World Pickleball Rankings (WPR) explained" },
          { s: "dupr-algorithm-explained-performance-vs-expectation", t: "How the DUPR algorithm works" },
        ];
  // THIN-01 (2026-08-24) — this page rendered 135 words (EN) / 165 (VI) for
  // Googlebot: a heading, one line of subcopy, twelve player rows and a link
  // list. Everything a reader might ask about the leaderboard — where the
  // numbers come from, who qualifies, how often it moves — was answered
  // nowhere on the page, and DUPR-rating queries are exactly the informational
  // intent this route should own.
  //
  // GEO rule (CLAUDE.md): name ThePickleHub once, front-load the answer, no
  // throat-clearing, so the opening survives extraction as a standalone passage.
  const lead =
    lang === "vi"
      ? `Bảng xếp hạng DUPR pickleball Việt Nam trên ThePickleHub xếp ${rows.length > 0 ? `${rows.length} ` : ""}VĐV theo chỉ số DUPR đôi, đọc trực tiếp từ hồ sơ đã liên kết DUPR và để chế độ công khai. Cập nhật theo thời gian thực qua webhook DUPR, không nhập tay.`
      : `This ThePickleHub leaderboard ranks ${rows.length > 0 ? `${rows.length} ` : ""}Vietnamese pickleball players by DUPR doubles rating, read straight from profiles linked to DUPR with public visibility on. It updates in real time through the DUPR webhook — no manual entry.`;

  // Standing explainer. Answers the questions a rating-curious reader actually
  // arrives with, and gives the route informational depth beyond the table.
  const explainer =
    lang === "vi"
      ? `<h2>Số DUPR này đến từ đâu</h2>` +
        `<p>DUPR (Dynamic Universal Pickleball Rating) là thang điểm từ 2.000 đến 8.000, tính theo kết quả từng trận: thắng đội mạnh hơn kỳ vọng thì điểm tăng, thua đội yếu hơn thì điểm giảm. Tỷ số cũng được tính, nên thua sát nút một đối thủ mạnh vẫn có thể làm tăng điểm.</p>` +
        `<p>ThePickleHub không tự chấm điểm. Mọi con số trên trang này do DUPR tính và đẩy sang qua webhook — bảng xếp hạng chỉ lọc ra VĐV Việt Nam và sắp xếp lại.</p>` +
        `<h2>Làm sao để có tên trong bảng</h2>` +
        `<p>Cần ba điều kiện: có tài khoản DUPR, liên kết tài khoản đó với hồ sơ ThePickleHub, và bật chế độ công khai cho hồ sơ. Thiếu bước công khai thì điểm vẫn cập nhật nhưng tên không hiện trong bảng — đây là lý do phổ biến nhất khiến người chơi có DUPR mà không thấy mình ở đây.</p>` +
        `<h2>Đôi và đơn khác nhau thế nào</h2>` +
        `<p>DUPR chấm hai chỉ số riêng biệt. Bảng mặc định ở trên là <strong>đôi</strong>, vì phần lớn trận đấu tại Việt Nam là đánh đôi. Chỉ số đơn thường lệch so với đôi ở cùng một người chơi, nên không so trực tiếp hai con số với nhau được.</p>` +
        `<h2>Bao lâu cập nhật một lần</h2>` +
        `<p>Ngay khi DUPR xác nhận một trận. Trận thi đấu tại giải thường lên điểm trong vòng vài giờ sau khi ban tổ chức nhập kết quả; trận tự ghi cần cả hai bên xác nhận trước.</p>`
      : `<h2>Where these DUPR numbers come from</h2>` +
        `<p>DUPR (Dynamic Universal Pickleball Rating) is a 2.000-8.000 scale calculated per match: beating a stronger team than expected raises a rating, losing to a weaker one lowers it. Score margin counts too, so a narrow loss to a strong pair can still move a rating up.</p>` +
        `<p>ThePickleHub does not compute any of it. Every figure on this page is calculated by DUPR and pushed over a webhook — this leaderboard filters for Vietnamese players and re-sorts.</p>` +
        `<h2>How to appear on this leaderboard</h2>` +
        `<p>Three things are required: a DUPR account, that account linked to a ThePickleHub profile, and public visibility switched on for the profile. Skip the visibility step and the rating still updates but the name stays off the table — the most common reason a rated player cannot find themselves here.</p>` +
        `<h2>Doubles versus singles</h2>` +
        `<p>DUPR maintains two separate ratings. The default table above is <strong>doubles</strong>, because most competitive play in Vietnam is doubles. A player's singles rating usually differs from their doubles one, so the two numbers are not directly comparable.</p>` +
        `<h2>How often it updates</h2>` +
        `<p>As soon as DUPR confirms a match. Tournament results typically post within hours of the organiser entering them; self-reported matches need both sides to confirm first.</p>`;

  const guidesBlogBase = lang === "vi" ? `${siteUrl}/vi/blog` : `${siteUrl}/blog`;
  const guidesHeading = lang === "vi" ? "Hiểu về DUPR & xếp hạng" : "Understand DUPR & rankings";
  const guidesNav = `<nav><h2>${escapeHtml(guidesHeading)}</h2><ul>${duprGuides
    .map((g) => `<li><a href="${guidesBlogBase}/${g.s}">${escapeHtml(g.t)}</a></li>`)
    .join("")}</ul></nav>`;

  return htmlResponse(buildHtml({
    title: titleVn,
    description: descriptionVn,
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    lang,
    extraMeta: rankingsHreflang,
    bodyContent: `
      <header>
        <h1>${escapeHtml(heading)}</h1>
        <p>${escapeHtml(lead)}</p>
        <p>${escapeHtml(subhead)}</p>
      </header>
      ${listItems}
      <p><a href="${siteUrl}${lang === "vi" ? "/vi/rankings/ppa-tour" : "/rankings/ppa-tour"}">${lang === "vi" ? "Xem thêm: bảng xếp hạng PPA Tour (WPR) thế giới" : "See more: PPA Tour world rankings (WPR)"}</a></p>
      ${explainer}
      ${guidesNav}
      ${itemListJsonLd}
    `,
    // The body already opens with its own <h1>; without this the shared
    // auto-header adds a second one titled "<title> | ThePickleHub".
    omitAutoHeader: true,
  }));
}
