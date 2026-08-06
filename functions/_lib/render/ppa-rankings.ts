/**
 * SSR render handler — /rankings/ppa-tour (+ /vi/rankings/ppa-tour).
 *
 * PPA Tour World Pickleball Rankings (WPR), editorial excerpt. Reads the same
 * static content module as the SPA page (src/content/ppa-rankings.ts) at
 * module load — same precedent as blog-meta.ts importing src/content. No RPC,
 * no per-request I/O: both boards render fully so bots see the superset of
 * what the SPA shows behind its board pills.
 *
 * Deliberately a SEPARATE route from /rankings: that page keeps its exact-match
 * "DUPR Việt Nam" title; this one owns the WPR/PPA topic (proposal
 * ppa-rankings-tab, D2). Data is a top-25 excerpt with credit — NOT a full
 * mirror; PPA's ToS forbids commercial scraping without written permission.
 */

import { buildHtml, htmlResponse } from "../html";
import { escapeHtml, type Lang } from "../utils";
import {
  PPA_WPR_BOARDS,
  PPA_WPR_FETCHED_AT,
  PPA_WPR_SOURCE_URL,
  PPA_WPR_VIET_HIGHLIGHTS,
  type PpaBoardKey,
} from "../../../src/content/ppa-rankings";

const BOARD_KEYS: PpaBoardKey[] = ["men", "women"];

export function renderPpaRankings(
  siteUrl: string,
  rawPath: string,
  lang: Lang,
): Response {
  const vi = lang === "vi";

  const title = vi
    ? "Bảng xếp hạng PPA Tour (WPR) | ThePickleHub"
    : "PPA Tour Rankings (WPR) | ThePickleHub";
  const description = vi
    ? "Top VĐV pickleball nhà nghề thế giới theo World Pickleball Ranking (WPR) của PPA Tour — bảng Nam và Nữ, kèm các VĐV Việt Nam và gốc Việt."
    : "Top professional pickleball players by PPA Tour's World Pickleball Ranking (WPR) — men's and women's boards, with Vietnamese and Vietnamese-origin pros.";

  const heading = vi
    ? "Bảng xếp hạng PPA Tour — World Pickleball Ranking (WPR)"
    : "PPA Tour Rankings — World Pickleball Ranking (WPR)";
  const intro = vi
    ? "WPR là bảng xếp hạng tổng hợp của PPA Tour: đôi 50%, đôi nam nữ 35%, đơn 15%, tính trên điểm 52 tuần gần nhất. Mỗi VĐV có một hạng duy nhất, không chia theo nội dung."
    : "The WPR is PPA Tour's composite ranking: doubles 50%, mixed 35%, singles 15%, over the trailing 52 weeks. Each player holds a single rank with no per-discipline split.";

  const boardLabel = (key: PpaBoardKey) =>
    key === "men" ? (vi ? "Nam" : "Men") : vi ? "Nữ" : "Women";

  const numberFmt = new Intl.NumberFormat(vi ? "vi-VN" : "en-GB", {
    maximumFractionDigits: 1,
  });

  const boardSections = BOARD_KEYS.map((key) => {
    const rows = PPA_WPR_BOARDS[key];
    const items = rows
      .map((p) =>
        `<li>${escapeHtml(p.name)} — ${escapeHtml(p.country)} — ${numberFmt.format(p.points)} ${vi ? "điểm" : "pts"}</li>`)
      .join("");
    return `<section><h2>${escapeHtml(`${boardLabel(key)} · Top ${rows.length}`)}</h2><ol>${items}</ol></section>`;
  }).join("");

  const vietItems = PPA_WPR_VIET_HIGHLIGHTS
    .map((p) =>
      `<li>#${p.rank} ${escapeHtml(p.name)}${p.countryCode === "vn" ? " 🇻🇳" : ""} — ${escapeHtml(boardLabel(p.board))} — ${numberFmt.format(p.points)} ${vi ? "điểm" : "pts"}</li>`)
    .join("");
  const vietSection = `<section><h2>${vi ? "Việt Nam &amp; gốc Việt trên bảng WPR" : "Vietnam &amp; Vietnamese-origin on the WPR board"}</h2><ul>${vietItems}</ul></section>`;

  const credit = vi
    ? `Điểm WPR do PPA Tour công bố tại <a href="${PPA_WPR_SOURCE_URL}" rel="nofollow noopener">ppatour.com/rankings</a>. ThePickleHub trích top 25 mỗi bảng làm tư liệu tham khảo (số liệu lấy ngày ${PPA_WPR_FETCHED_AT}). ThePickleHub không phải kênh chính thức hay đối tác của PPA Tour.`
    : `WPR points are published by PPA Tour at <a href="${PPA_WPR_SOURCE_URL}" rel="nofollow noopener">ppatour.com/rankings</a>. ThePickleHub excerpts the top 25 per board for reference (data pulled ${PPA_WPR_FETCHED_AT}). ThePickleHub is not an official PPA Tour channel or partner.`;

  const internalLinks = vi
    ? `<p><a href="${siteUrl}/vi/rankings">← Bảng xếp hạng DUPR Việt Nam</a> · <a href="${siteUrl}/vi/blog/bang-xep-hang-pickleball-the-gioi-wpr">WPR là gì? Đọc bài giải thích</a></p>`
    : `<p><a href="${siteUrl}/rankings">← Vietnam DUPR rankings</a> · <a href="${siteUrl}/blog/world-pickleball-rankings-wpr-explained">How WPR works — read the explainer</a></p>`;

  // schema.org ItemList per board — names only (players have no local profile
  // pages; external athlete URLs stay out of the structured data on purpose).
  const itemListJsonLd = BOARD_KEYS.map((key) => `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `PPA Tour WPR — ${boardLabel(key)}`,
    numberOfItems: PPA_WPR_BOARDS[key].length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: PPA_WPR_BOARDS[key].map((p) => ({
      "@type": "ListItem",
      position: p.rank,
      name: p.name,
    })),
  })}</script>`).join("");

  const hreflang = `<link rel="alternate" hreflang="en" href="${siteUrl}/rankings/ppa-tour"/>\n<link rel="alternate" hreflang="vi" href="${siteUrl}/vi/rankings/ppa-tour"/>\n<link rel="alternate" hreflang="x-default" href="${siteUrl}/rankings/ppa-tour"/>`;

  return htmlResponse(buildHtml({
    title,
    description,
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    lang,
    extraMeta: hreflang,
    bodyContent: `
      <header>
        <h1>${escapeHtml(heading)}</h1>
        <p>${escapeHtml(intro)}</p>
      </header>
      ${boardSections}
      ${vietSection}
      <p>${credit}</p>
      ${internalLinks}
      ${itemListJsonLd}
    `,
  }));
}
