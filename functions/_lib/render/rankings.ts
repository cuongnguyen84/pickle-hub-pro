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
        <p>${escapeHtml(subhead)}</p>
      </header>
      ${listItems}
      <p><a href="${siteUrl}${lang === "vi" ? "/vi/rankings/ppa-tour" : "/rankings/ppa-tour"}">${lang === "vi" ? "Xem thêm: bảng xếp hạng PPA Tour (WPR) thế giới" : "See more: PPA Tour world rankings (WPR)"}</a></p>
      ${guidesNav}
      ${itemListJsonLd}
    `,
  }));
}
