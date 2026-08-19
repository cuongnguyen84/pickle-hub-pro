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
  vnTodayIso,
} from "../../../src/content/tournaments/pro-calendar-2026";
import { render404 } from "./static-pages";

// ─── Tournament ───────────────────────────────────────────

/** Vietnamese date range for a tournament: "11–15/3/2026" / "28/12/2025–3/1/2026". */
function tournamentDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate) return "";
  const [sy, sm, sd] = startDate.split("-");
  if (!endDate || endDate === startDate) return `${Number(sd)}/${Number(sm)}/${sy}`;
  const [ey, em, ed] = endDate.split("-");
  if (sy === ey && sm === em) return `${Number(sd)}–${Number(ed)}/${Number(sm)}/${sy}`;
  if (sy === ey) return `${Number(sd)}/${Number(sm)}–${Number(ed)}/${Number(em)}/${sy}`;
  return `${Number(sd)}/${Number(sm)}/${sy}–${Number(ed)}/${Number(em)}/${ey}`;
}

/**
 * Lead sentence for a tournament — the passage AI search extracts and cites.
 * GEO rule (CLAUDE.md, 2026-08-14): front-load name + dates + status and name
 * "ThePickleHub" exactly once so an answer engine can attribute the snippet.
 * This is the BODY lead and is allowed to run long; the <meta> description is
 * built separately by tournamentDescription() against a hard byte budget.
 */
function tournamentLead(
  name: string,
  dateRange: string,
  statusText: string,
  broadcasterName: string | null,
): string {
  const when = dateRange ? ` diễn ra ${dateRange}` : "";
  const who = broadcasterName ? `, phát sóng bởi ${broadcasterName}` : "";
  return `${name} là giải pickleball${when}${who} — ${statusText.toLowerCase()}. Lịch thi đấu, trạng thái và kết quả được ThePickleHub cập nhật.`;
}

const DESCRIPTION_BYTE_BUDGET = 160;
const utf8Bytes = (s: string) => new TextEncoder().encode(s).length;

/**
 * <meta name="description"> for a tournament.
 *
 * buildHtml truncates the description at 160 UTF-8 BYTES, and a Vietnamese
 * diacritic costs 2-3 of them — so a sentence that looks comfortably under
 * 160 *characters* gets cut mid-clause. Feeding the body lead straight through
 * dropped the trailing "ThePickleHub" attribution on every single row, which
 * is the one token the GEO rule exists to protect. Instead: try progressively
 * shorter variants and emit the first that fits the budget whole, so the brand
 * mention and the dates always survive. Never falls back to the generic
 * "ThePickleHub là nền tảng…" boilerplate — that string was the original bug
 * (all 14 tournament URLs shared it verbatim).
 */
function tournamentDescription(
  name: string,
  dateRange: string,
  statusText: string,
  broadcasterName: string | null,
): string {
  const st = statusText.toLowerCase();
  const when = dateRange ? ` (${dateRange})` : "";
  const who = broadcasterName ? `, phát sóng bởi ${broadcasterName}` : "";
  const candidates = [
    `${name}${when} — giải pickleball ${st}${who}. Lịch thi đấu và kết quả cập nhật trên ThePickleHub.`,
    `${name}${when} — giải pickleball ${st}. Lịch thi đấu và kết quả trên ThePickleHub.`,
    `${name}${when} — giải pickleball ${st}. Kết quả trên ThePickleHub.`,
    `${name} — giải pickleball ${st}. Kết quả trên ThePickleHub.`,
  ];
  const fits = candidates.find((c) => utf8Bytes(c) <= DESCRIPTION_BYTE_BUDGET);
  // Last resort (pathologically long name): let buildHtml ellipsise the
  // shortest variant rather than swapping in the shared boilerplate.
  return fits ?? candidates[candidates.length - 1];
}

export async function renderTournamentDetail(supabase: SupabaseClient, slug: string, siteUrl: string): Promise<Response> {
  const { data: t } = await supabase
    .from("tournaments")
    .select("id, name, description, status, start_date, end_date, slug, organizations(name, slug)")
    .eq("slug", slug)
    .single();

  if (!t) return render404(`/tournament/${slug}`, siteUrl);

  // PostgREST returns an embedded to-one relation as an object, but older
  // client typings widen it to an array — normalise both shapes.
  //
  // IMPORTANT: `tournaments.organization_id` is NOT the organiser. Migration
  // 20260528100000 backfilled it from `livestreams.organization_id`, i.e. the
  // channel that BROADCAST the event. Every PPA row currently points at
  // TAPickleball, a Vietnamese streaming partner — calling that the organiser
  // of a US PPA Tour stop would be exactly the kind of false claim this fix
  // removes from the JSON-LD. Labelled as broadcaster in the body, and never
  // emitted as schema.org `organizer`.
  const rawOrg = (t as { organizations?: unknown }).organizations;
  const org = (Array.isArray(rawOrg) ? rawOrg[0] : rawOrg) as { name?: string; slug?: string } | null | undefined;
  const broadcasterName = org?.name ?? null;

  const statusText = t.status === "ongoing" ? "Đang diễn ra" : t.status === "upcoming" ? "Sắp diễn ra" : "Đã kết thúc";
  const dateRange = tournamentDateRange(t.start_date, t.end_date);
  const title = buildTitle(t.name, " | Pickleball Tournament");

  // Before this fix every tournament page shipped the same generic
  // "ThePickleHub là nền tảng pickleball hàng đầu…" fallback description and a
  // 70-word body, because `description` is empty for almost every row. Build
  // both from the data we actually have (name + dates + status + organiser) so
  // each URL is distinct and the opening passage answers the query.
  const lead = tournamentLead(t.name, dateRange, statusText, broadcasterName);
  const desc = tournamentDescription(t.name, dateRange, statusText, broadcasterName);

  const crumbs = [
    { label: "Trang chủ", href: siteUrl },
    { label: "Giải đấu", href: `${siteUrl}/tournaments` },
    { label: t.name },
  ];
  const bc = breadcrumb(crumbs);

  const facts = [
    dateRange ? `<li><strong>Thời gian:</strong> ${escapeHtml(dateRange)}</li>` : "",
    `<li><strong>Trạng thái:</strong> ${escapeHtml(statusText)}</li>`,
    broadcasterName
      ? `<li><strong>Đơn vị phát sóng:</strong> ${org?.slug ? `<a href="${siteUrl}/org/${escapeHtml(org.slug)}">${escapeHtml(broadcasterName)}</a>` : escapeHtml(broadcasterName)}</li>`
      : "",
    `<li><strong>Môn thi đấu:</strong> Pickleball</li>`,
  ].join("");

  const bodyContent = [
    bc,
    `<h1>${escapeHtml(t.name)}</h1>`,
    `<p>${escapeHtml(lead)}</p>`,
    `<ul>${facts}</ul>`,
    t.description ? `<p>${escapeHtml(t.description)}</p>` : "",
    `<p><a href="${siteUrl}/tournaments">Lịch giải Pickleball 2026 — Việt Nam &amp; châu Á</a> · <a href="${siteUrl}/vi/tournaments">Xem bản tiếng Việt</a></p>`,
  ].join("");

  return htmlResponse(buildHtml({
    title,
    description: desc,
    url: `${siteUrl}/tournament/${t.slug}`,
    siteUrl,
    extraMeta: singleCanonicalHreflang(`${siteUrl}/tournament/${t.slug}`, "en"),
    // SEO-3.1 — @graph pattern combines SportsEvent + BreadcrumbList.
    // The previous version declared every tournament as an online event held at
    // a VirtualLocation and organised by ThePickleHub. All of that is false for
    // physical PPA/MLP events we only aggregate, so it is dropped rather than
    // replaced with an invented venue: honest omission beats wrong structured
    // data. `location` and `organizer` are both intentionally absent — the
    // table carries neither (see the broadcaster note above).
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
          ...(t.start_date ? { startDate: t.start_date } : {}),
          ...(t.end_date ? { endDate: t.end_date } : {}),
        },
        buildBreadcrumbJsonLd(crumbs),
      ],
    },
    bodyContent,
    omitAutoHeader: true,
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
  // Pages Functions run in UTC; the curated calendar uses VN calendar dates.
  const todayIso = vnTodayIso();
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
      // Only emit an organizer we can actually source. The World Cup in Da
      // Nang is not a PPA Tour Asia event — hardcoding it here published a
      // false entity claim in structured data on our flagship VN event.
      ...(ev.organizer
        ? { organizer: { "@type": "Organization", name: ev.organizer } }
        : {}),
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

  const title = buildTitle(de.name, " | Double Elimination");
  const desc = `Giải đấu loại trực tiếp ${de.name} – ${de.team_count} đội.${duprDescSuffix} Xem bracket và kết quả trực tiếp trên ThePickleHub.`.slice(0, 160);
  const bc = breadcrumb([{ label: "Trang chủ", href: siteUrl }, { label: "Công cụ", href: `${siteUrl}/tools` }, { label: "Double Elimination", href: `${siteUrl}/tools/doubles-elimination` }, { label: de.name }]);

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
