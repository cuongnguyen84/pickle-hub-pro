/**
 * SSR for /live/pro/<slug> (+ /vi twin) — pro-tour event results pages.
 *
 * Event facts come from the `pro_tour_events` table (admin-managed since
 * 2026-09-09) — the same registry the SPA reads, so the two views can never
 * disagree about which events exist. The bot page needs no `matches` query:
 * facts + an honest phase line are enough. Unknown slug → null, and the
 * middleware falls through to its render404.
 */

import { buildHtml, htmlResponse } from "../html";
import { escapeHtml, type Lang } from "../utils";
import {
  eventPhase,
  formatEventDates,
  metaFromRow,
  type ProTourEventRow,
} from "../../../src/content/pro-tour-events";

// Minimal query surface — the middleware hands us its service client.
type SupabaseLike = {
  from(table: string): {
    select(cols: string): {
      eq(col: string, v: string): {
        maybeSingle(): Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
  };
};

export async function renderProTourEvent(
  supabase: SupabaseLike,
  slug: string,
  siteUrl: string,
  rawPath: string,
  lang: Lang,
): Promise<Response | null> {
  const { data, error } = await supabase
    .from("pro_tour_events")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  const meta = metaFromRow(data as ProTourEventRow);

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
      // bodyContent opens with its own <h1>; without this buildHtml() adds a
      // second one carrying the decorated "… | ThePickleHub" title. Same
      // regression single-h1.test.ts was written for.
      omitAutoHeader: true,
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
