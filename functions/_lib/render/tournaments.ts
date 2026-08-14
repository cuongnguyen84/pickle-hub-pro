/**
 * SSR render handlers — tournaments + tool-instance pages
 * (quick tables, team match, doubles elimination, flex tournament).
 * SEO-04 — split from index.ts, code moved verbatim.
 */

import type { SupabaseClient } from "../supabase";
import { buildHtml, htmlResponse } from "../html";
import {
  escapeHtml,
  buildTitle,
  buildMetaDescription,
  breadcrumb,
  relatedToolLinks,
  bilingualHreflang,
  singleCanonicalHreflang,
  buildBreadcrumbJsonLd,
} from "../utils";
import { buildListJsonLd } from "./shared";
import { displayChampionName } from "../../../src/lib/championDisplay";
import {
  PRO_CALENDAR_2026,
  proCalendarDateRange,
  proCalendarStatus,
} from "../../../src/content/tournaments/pro-calendar-2026";
import { render404 } from "./static-pages";

// ─── Tournament ─────────────────────────────────��─────────

export async function renderTournamentDetail(supabase: SupabaseClient, slug: string, siteUrl: string): Promise<Response> {
  const { data: t } = await supabase
    .from("tournaments")
    .select("id, name, description, status, start_date, end_date, slug")
    .eq("slug", slug)
    .single();

  if (!t) return render404(`/tournament/${slug}`, siteUrl);

  const statusText = t.status === "ongoing" ? "Đang diễn ra" : t.status === "upcoming" ? "Sắp diễn ra" : "Đã kết thúc";
  const title = buildTitle(t.name, " | Pickleball Tournament");
  const desc = buildMetaDescription(t.description, { type: "default", title: t.name });

  const crumbs = [
    { label: "Trang chủ", href: siteUrl },
    { label: "Giải đấu", href: `${siteUrl}/tournaments` },
    { label: t.name },
  ];
  const bc = breadcrumb(crumbs);

  return htmlResponse(buildHtml({
    title,
    description: desc,
    url: `${siteUrl}/tournament/${t.slug}`,
    siteUrl,
    extraMeta: singleCanonicalHreflang(`${siteUrl}/tournament/${t.slug}`, "en"),
    // SEO-3.1 — @graph pattern combines SportsEvent + BreadcrumbList
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "SportsEvent",
          name: t.name,
          description: desc,
          url: `${siteUrl}/tournament/${t.slug}`,
          sport: "Pickleball",
          eventStatus: "https://schema.org/EventScheduled",
          eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
          location: { "@type": "VirtualLocation", url: `${siteUrl}/tournament/${t.slug}` },
          organizer: { "@type": "Organization", name: "ThePickleHub", url: siteUrl },
          ...(t.start_date ? { startDate: t.start_date } : {}),
          ...(t.end_date ? { endDate: t.end_date } : {}),
        },
        buildBreadcrumbJsonLd(crumbs),
      ],
    },
    bodyContent: `${bc}<p>${statusText}</p>`,
  }));
}

export async function renderTournaments(supabase: SupabaseClient, siteUrl: string, rawPath = "/tournaments", lang: "en" | "vi" = "en"): Promise<Response> {
  const { data: tournaments } = await supabase.from("tournaments").select("id, name, slug, status").in("status", ["ongoing", "upcoming"]).order("start_date", { ascending: false }).limit(20);
  const items = (tournaments || []).map((t) => `<li><a href="${siteUrl}/tournament/${t.slug}">${escapeHtml(t.name)}</a></li>`).join("");
  const listItems = (tournaments || []).map((t) => ({
    url: `${siteUrl}/tournament/${t.slug}`,
    name: t.name,
  }));

  // Tournament-hub upgrade (2026-08-14, growth-tasks/PROPOSAL-tournament-hub):
  // /tournaments doubles as the curated 2026 pro-calendar hub. Title targets
  // the queries GSC already shows demand for ("vietnam pickleball tournament
  // 2026 schedule" EN / "lịch giải pickleball" VI); both stay ≤60 bytes.
  const title = lang === "en"
    ? "Vietnam Pickleball Tournaments 2026 | ThePickleHub"
    : "Lịch giải Pickleball 2026 | ThePickleHub";
  const description = lang === "en"
    ? "2026 pickleball tournament calendar for Vietnam & Asia — full PPA Tour Asia schedule, Heineken World Cup Da Nang, prize money, dates and results."
    : "Lịch giải pickleball 2026: đủ mùa PPA Tour Asia, World Cup Đà Nẵng 30/8–6/9, tiền thưởng, ngày thi đấu và kết quả. Cập nhật liên tục.";

  // Curated calendar (shared data with the React page — see
  // src/content/tournaments/pro-calendar-2026.ts). Bot-readable <table> +
  // deep-links into our previews/recaps make this page the internal-link
  // trunk of the whole event cluster.
  const todayIso = new Date().toISOString().slice(0, 10);
  const statusLabel = (st: "past" | "live" | "upcoming") =>
    lang === "vi"
      ? st === "past" ? "Đã xong" : st === "live" ? "Đang diễn ra" : "Sắp diễn ra"
      : st === "past" ? "Finished" : st === "live" ? "Live" : "Upcoming";
  const calRows = PRO_CALENDAR_2026.map((ev) => {
    const name = lang === "vi" ? ev.nameVi : ev.nameEn;
    const blog = lang === "vi" ? ev.blogVi : ev.blogEn;
    const nameCell = blog ? `<a href="${siteUrl}${blog}">${escapeHtml(name)}</a>` : escapeHtml(name);
    const prize = lang === "vi" ? ev.prizeVi : ev.prizeEn;
    return `<tr><td>${proCalendarDateRange(ev)}</td><td>${nameCell}</td><td>${escapeHtml(lang === "vi" ? ev.placeVi : ev.placeEn)}</td><td>${escapeHtml(ev.tier)}${prize ? ` · ${escapeHtml(prize)}` : ""}</td><td>${statusLabel(proCalendarStatus(ev, todayIso))}</td></tr>`;
  }).join("");
  const calHead = lang === "vi"
    ? "<tr><th>Thời gian</th><th>Giải đấu</th><th>Địa điểm</th><th>Cấp / thưởng</th><th>Trạng thái</th></tr>"
    : "<tr><th>Dates</th><th>Tournament</th><th>Location</th><th>Tier / prize</th><th>Status</th></tr>";
  const calHeading = lang === "vi"
    ? "Lịch giải Pickleball 2026 — Việt Nam & châu Á"
    : "2026 Tournament Calendar — Vietnam & Asia";
  const calendarHtml = `<h2>${calHeading}</h2><table><thead>${calHead}</thead><tbody>${calRows}</tbody></table>`;

  // SportsEvent JSON-LD for live + upcoming curated events only (past events
  // add noise; app-tournament ItemList below already covers internal ones).
  const sportsEvents = PRO_CALENDAR_2026
    .filter((ev) => proCalendarStatus(ev, todayIso) !== "past")
    .map((ev) => ({
      "@type": "SportsEvent",
      name: lang === "vi" ? ev.nameVi : ev.nameEn,
      sport: "Pickleball",
      startDate: ev.startDate,
      endDate: ev.endDate,
      eventStatus: "https://schema.org/EventScheduled",
      location: { "@type": "Place", name: lang === "vi" ? ev.placeVi : ev.placeEn },
      organizer: { "@type": "Organization", name: "PPA Tour Asia" },
    }));

  return htmlResponse(buildHtml({
    title,
    description,
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    extraMeta: bilingualHreflang(`${siteUrl}/tournaments`, `${siteUrl}/vi/tournaments`),
    jsonLd: { "@context": "https://schema.org", "@graph": [buildListJsonLd(title, listItems), ...sportsEvents] },
    bodyContent: `${calendarHtml}${items ? `<h2>${lang === "en" ? "Tournaments on ThePickleHub" : "Giải đấu trên ThePickleHub"}</h2><ul>${items}</ul>` : ""}`,
    lang,
  }));
}

// ─── Tool instance pages (noindex) ────────────────────────

export async function renderQuickTable(supabase: SupabaseClient, shareId: string, siteUrl: string): Promise<Response> {
  const { data: qt } = await supabase.from("quick_tables").select("id, name, format, player_count, status, share_id, is_public, champion_name").eq("share_id", shareId).single();
  // Client service-role bypass RLS — bảng private phải 404 y hệt không tồn tại.
  if (!qt || !qt.is_public) return render404(`/tools/quick-tables/${shareId}`, siteUrl);

  const title = buildTitle(qt.name, " | Bảng đấu Pickleball");
  // Champion đứng ĐẦU description để sống sót khi Zalo cắt ngắn; không vào
  // <title> (budget 60 byte, tên VN có dấu ăn hết). Không champion → chuỗi cũ.
  const champion = displayChampionName(qt.champion_name);
  const desc = (champion
    ? `Vô địch: ${champion}. Bảng đấu ${qt.name} – ${qt.player_count} VĐV. Xem kết quả trên ThePickleHub.`
    : `Bảng đấu ${qt.name} – ${qt.player_count} VĐV, ${qt.format}. Xem kết quả trực tiếp trên ThePickleHub.`).slice(0, 160);
  const bc = breadcrumb([{ label: "Trang chủ", href: siteUrl }, { label: "Công cụ", href: `${siteUrl}/tools` }, { label: "Quick Tables", href: `${siteUrl}/tools/quick-tables` }, { label: qt.name }]);

  return htmlResponse(buildHtml({ title, description: desc, url: `${siteUrl}/tools/quick-tables/${shareId}`, siteUrl, extraMeta: `<meta name="robots" content="noindex, follow"/>`, bodyContent: `${bc}${relatedToolLinks("quick-tables", siteUrl)}` }));
}

export async function renderTeamMatch(supabase: SupabaseClient, id: string, siteUrl: string): Promise<Response> {
  const { data: tm } = await supabase.from("team_match_tournaments").select("id, name, status").eq("id", id).single();
  if (!tm) return render404(`/tools/team-match/${id}`, siteUrl);

  const title = buildTitle(tm.name, " | Team Match Pickleball");
  const desc = `Giải đấu đội ${tm.name}. Xem lineup, kết quả và bảng xếp hạng trực tiếp trên ThePickleHub.`.slice(0, 160);
  const bc = breadcrumb([{ label: "Trang chủ", href: siteUrl }, { label: "Công cụ", href: `${siteUrl}/tools` }, { label: "Team Match", href: `${siteUrl}/tools/team-match` }, { label: tm.name }]);

  return htmlResponse(buildHtml({ title, description: desc, url: `${siteUrl}/tools/team-match/${id}`, siteUrl, extraMeta: `<meta name="robots" content="noindex, follow"/>`, bodyContent: `${bc}${relatedToolLinks("team-match", siteUrl)}` }));
}

export async function renderDoublesElimination(supabase: SupabaseClient, shareId: string, siteUrl: string): Promise<Response> {
  // DUPR Phase 3 (2026-05-29). Select DUPR fields so the bot sees the
  // rating recommendation in meta + JSON-LD. Page is noindex (private
  // tournament) so this is purely for richer link previews when an
  // organizer shares the URL in chat/email.
  const { data: de } = await supabase
    .from("doubles_elimination_tournaments")
    .select("id, name, team_count, status, share_id, rating_source, min_dupr_rating, max_dupr_rating")
    .eq("share_id", shareId)
    .single();
  if (!de) return render404(`/tools/doubles-elimination/${shareId}`, siteUrl);

  // Optional DUPR range suffix for description + JSON-LD.
  const ratingSource = (de as { rating_source?: string }).rating_source ?? "self";
  const minDupr = (de as { min_dupr_rating?: number | null }).min_dupr_rating ?? null;
  const maxDupr = (de as { max_dupr_rating?: number | null }).max_dupr_rating ?? null;
  const hasRange = ratingSource !== "self" && (minDupr != null || maxDupr != null);
  const rangeStr = hasRange
    ? (minDupr != null && maxDupr != null
        ? `${minDupr.toFixed(2)}–${maxDupr.toFixed(2)}`
        : minDupr != null
          ? `≥ ${minDupr.toFixed(2)}`
          : `≤ ${maxDupr!.toFixed(2)}`)
    : "";
  const duprDescSuffix = hasRange ? ` Khuyến nghị DUPR ${rangeStr}.` : "";

  const title = buildTitle(de.name, " | Doubles Elimination");
  const desc = `Giải đấu loại trực tiếp ${de.name} – ${de.team_count} đội.${duprDescSuffix} Xem bracket và kết quả trực tiếp trên ThePickleHub.`.slice(0, 160);
  const bc = breadcrumb([{ label: "Trang chủ", href: siteUrl }, { label: "Công cụ", href: `${siteUrl}/tools` }, { label: "Doubles Elimination", href: `${siteUrl}/tools/doubles-elimination` }, { label: de.name }]);

  // SportsEvent JSON-LD — informational only (page stays noindex). Skill
  // range surfaces as audience requirement when DUPR is enforced.
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: de.name,
    description: desc,
    url: `${siteUrl}/tools/doubles-elimination/${shareId}`,
    eventStatus: de.status === "completed"
      ? "https://schema.org/EventCompleted"
      : de.status === "ongoing"
        ? "https://schema.org/EventScheduled"
        : "https://schema.org/EventScheduled",
    sport: "Pickleball",
  };
  if (hasRange) {
    jsonLd.audience = {
      "@type": "PeopleAudience",
      requiredMinAge: undefined,
      suggestedMinAge: undefined,
      audienceType: `DUPR ${rangeStr}`,
    };
  }

  return htmlResponse(buildHtml({
    title,
    description: desc,
    url: `${siteUrl}/tools/doubles-elimination/${shareId}`,
    siteUrl,
    extraMeta: `<meta name="robots" content="noindex, follow"/>`,
    jsonLd,
    bodyContent: `${bc}${relatedToolLinks("doubles-elimination", siteUrl)}`,
  }));
}

export async function renderFlexTournament(supabase: SupabaseClient, shareId: string, siteUrl: string): Promise<Response> {
  const { data: ft } = await supabase.from("flex_tournaments").select("id, name, status, share_id, is_public").eq("share_id", shareId).single();
  // Client service-role bypass RLS — giải private phải 404 y hệt không tồn tại.
  if (!ft || !ft.is_public) return render404(`/tools/flex-tournament/${shareId}`, siteUrl);

  const title = buildTitle(ft.name, " | Flex Tournament");
  const desc = `Giải đấu ${ft.name}. Tạo nhóm, xếp lịch thi đấu linh hoạt trên ThePickleHub.`.slice(0, 160);
  const bc = breadcrumb([{ label: "Trang chủ", href: siteUrl }, { label: "Công cụ", href: `${siteUrl}/tools` }, { label: "Flex Tournament", href: `${siteUrl}/tools/flex-tournament` }, { label: ft.name }]);

  return htmlResponse(buildHtml({ title, description: desc, url: `${siteUrl}/tools/flex-tournament/${shareId}`, siteUrl, extraMeta: `<meta name="robots" content="noindex, follow"/>`, bodyContent: `${bc}${relatedToolLinks("flex-tournament", siteUrl)}` }));
}
