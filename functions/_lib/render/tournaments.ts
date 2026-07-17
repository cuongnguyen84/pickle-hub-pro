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

  // SEO-2.1 (2026-05-28) — locale-aware meta so EN canonical doesn't ship VN copy.
  const title = lang === "en"
    ? "Pickleball Tournaments in Vietnam & Asia | ThePickleHub"
    : "Giải đấu Pickleball | ThePickleHub";
  const description = lang === "en"
    ? "Live and upcoming pickleball tournaments in Vietnam and Asia. Live brackets, schedules, registration, and full results from PPA Tour Asia and local events."
    : "Danh sách các giải đấu pickleball đang diễn ra và sắp tới tại Việt Nam. Xem lịch thi đấu, bảng đấu, kết quả trực tiếp và đăng ký tham gia giải pickleball.";

  return htmlResponse(buildHtml({
    title,
    description,
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    extraMeta: bilingualHreflang(`${siteUrl}/tournaments`, `${siteUrl}/vi/tournaments`),
    jsonLd: buildListJsonLd(title, listItems),
    bodyContent: items ? `<h2>${lang === "en" ? "Tournaments" : "Giải đấu"}</h2><ul>${items}</ul>` : "",
    lang,
  }));
}

// ─── Tool instance pages (noindex) ────────────────────────

export async function renderQuickTable(supabase: SupabaseClient, shareId: string, siteUrl: string): Promise<Response> {
  const { data: qt } = await supabase.from("quick_tables").select("id, name, format, player_count, status, share_id").eq("share_id", shareId).single();
  if (!qt) return render404(`/tools/quick-tables/${shareId}`, siteUrl);

  const title = buildTitle(qt.name, " | Bảng đấu Pickleball");
  const desc = `Bảng đấu ${qt.name} – ${qt.player_count} VĐV, ${qt.format}. Xem kết quả trực tiếp trên ThePickleHub.`.slice(0, 160);
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
  const { data: ft } = await supabase.from("flex_tournaments").select("id, name, status, share_id").eq("share_id", shareId).single();
  if (!ft) return render404(`/tools/flex-tournament/${shareId}`, siteUrl);

  const title = buildTitle(ft.name, " | Flex Tournament");
  const desc = `Giải đấu ${ft.name}. Tạo nhóm, xếp lịch thi đấu linh hoạt trên ThePickleHub.`.slice(0, 160);
  const bc = breadcrumb([{ label: "Trang chủ", href: siteUrl }, { label: "Công cụ", href: `${siteUrl}/tools` }, { label: "Flex Tournament", href: `${siteUrl}/tools/flex-tournament` }, { label: ft.name }]);

  return htmlResponse(buildHtml({ title, description: desc, url: `${siteUrl}/tools/flex-tournament/${shareId}`, siteUrl, extraMeta: `<meta name="robots" content="noindex, follow"/>`, bodyContent: `${bc}${relatedToolLinks("flex-tournament", siteUrl)}` }));
}
