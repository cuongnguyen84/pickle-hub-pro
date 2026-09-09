/**
 * SSR for /live/pro/<slug> (+ /vi twin) — pro-tour event results pages.
 *
 * Registry-driven and DB-free on purpose: the SPA page polls `matches` for
 * live scores, but a bot only needs the event facts (name, dates, venue,
 * tier, prize, credit links) and an honest phase line. Both come from
 * src/content/pro-tour-events.ts, the same registry the SPA reads, so the
 * two views can never disagree about which events exist. Unknown slug →
 * null, and the middleware falls through to its render404.
 */

import { buildHtml, htmlResponse } from "../html";
import { escapeHtml, type Lang } from "../utils";
import {
  eventPhase,
  formatEventDates,
  PRO_TOUR_EVENTS,
} from "../../../src/content/pro-tour-events";

export function renderProTourEvent(
  slug: string,
  siteUrl: string,
  rawPath: string,
  lang: Lang,
): Response | null {
  const meta = PRO_TOUR_EVENTS.find((e) => e.slug === slug);
  if (!meta) return null;

  const vi = lang === "vi";
  const name = escapeHtml(vi ? meta.nameVi : meta.nameEn);
  const dates = formatEventDates(meta, vi ? "vi" : "en");
  const place = `${escapeHtml(meta.city)}, ${escapeHtml(meta.country)}`;
  const phase = eventPhase(meta);
  const phaseLine = {
    upcoming: vi
      ? `Giải chưa bắt đầu — thi đấu từ ${dates}. Kết quả sẽ được cập nhật trực tiếp trên trang này.`
      : `Play has not started — the event runs ${dates}. Results update live on this page.`,
    live: vi
      ? "Giải đang diễn ra — kết quả từng trận được cập nhật liên tục trên trang này."
      : "The event is in progress — match results update continuously on this page.",
    finished: vi
      ? "Giải đã kết thúc — xem kết quả đầy đủ các nội dung trên trang này."
      : "The event has finished — full results for every draw are on this page.",
  }[phase];

  const title = vi
    ? `Kết quả ${name} | ThePickleHub`
    : `${name} Results | ThePickleHub`;
  const description = vi
    ? `Kết quả và nhánh đấu ${name} — ${place}, ${dates}. Cập nhật trực tiếp từng trận Pro trên ThePickleHub.`
    : `Results and draws for ${name} — ${place}, ${dates}. Live Pro match updates on ThePickleHub.`;

  const facts: string[] = [
    `<li>${vi ? "Thời gian" : "Dates"}: ${dates}</li>`,
    `<li>${vi ? "Địa điểm" : "Location"}: ${place}${meta.venue ? ` — ${escapeHtml(meta.venue)}` : ""}</li>`,
    `<li>${vi ? "Cấp giải" : "Tier"}: ${escapeHtml(meta.tier)} · ${escapeHtml(meta.tour)}</li>`,
  ];
  if (meta.prizeMoney) {
    facts.push(`<li>${vi ? "Tổng thưởng" : "Prize money"}: ${escapeHtml(meta.prizeMoney)}</li>`);
  }

  const bodyContent = `<article>
<h1>${vi ? `Kết quả ${name}` : `${name} — Results`}</h1>
<p>${phaseLine}</p>
<ul>${facts.join("")}</ul>
<p><a href="${escapeHtml(meta.bracketsUrl)}" rel="noopener">${vi ? "Nhánh đấu chính thức" : "Official draws"}</a> · <a href="${escapeHtml(meta.officialUrl)}" rel="noopener">${vi ? "Trang giải đấu" : "Tournament site"}</a></p>
<p>${
    vi
      ? `Trang kết quả do ThePickleHub cập nhật, gồm đầy đủ các nội dung Pro (đơn nam, đơn nữ, đôi nam, đôi nữ, đôi nam nữ), tỉ số từng game và đánh dấu các trận có VĐV Việt Nam.`
      : `This ThePickleHub results page covers every Pro draw (men's and women's singles, men's and women's doubles, mixed doubles) with per-game scores and highlights for matches featuring Vietnamese players.`
  }</p>
</article>`;

  return htmlResponse(
    buildHtml({
      title,
      description,
      url: `${siteUrl}${rawPath}`,
      siteUrl,
      lang,
      bodyContent,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "SportsEvent",
        name: meta.nameEn,
        sport: "Pickleball",
        startDate: meta.startDate,
        endDate: meta.endDate,
        eventStatus: "https://schema.org/EventScheduled",
        location: {
          "@type": "Place",
          name: meta.venue || meta.city,
          address: { "@type": "PostalAddress", addressLocality: meta.city, addressCountry: meta.countryCode },
        },
        organizer: { "@type": "Organization", name: meta.tour },
        url: `${siteUrl}${rawPath}`,
      },
    }),
  );
}
