/**
 * SSR render handler — match permalink page (/tran-dau/{slug}).
 * NOTE: match-seo.ts is a separate, pre-existing module (pure SEO shape
 * helpers); this file holds the route handler that consumes it.
 * SEO-04 — split from index.ts, code moved verbatim.
 */

import type { SupabaseClient } from "../supabase";
import { buildHtml, htmlResponse } from "../html";
import { escapeHtml, buildTitle, breadcrumb } from "../utils";
import {
  buildMatchDescription,
  buildMatchSchema,
  roundLabel,
} from "./match-seo";
import { render404 } from "./static-pages";

// ─── Match permalink ─────────────────────────────────────
//
// /tran-dau/{slug} — public match page (RLS matches.is_public read).
// Renders SSR HTML matching the client-side SEO produced by
// src/pages/MatchPage.tsx#applyClientSeo so bots see a complete
// SportsEvent + meta tags identical to what humans see post-hydration.

interface MatchSeoParticipant {
  team: "a" | "b";
  position: number | null;
  username: string | null;
  display_name: string | null;
}

function fmtScoreCompact(a: number[], b: number[]): string {
  return a.map((s, i) => `${s}-${b[i] ?? 0}`).join(" ");
}

function fmtMatchDateVN(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function fmtMatchFormatVi(format: string): string {
  if (format === "singles") return "Đơn";
  if (format === "mixed") return "Đôi nam-nữ";
  return "Đôi";
}

export async function renderMatch(
  supabase: SupabaseClient,
  slug: string,
  siteUrl: string,
): Promise<Response> {
  // Fetches mirror useMatch (src/hooks/social/useMatch.ts) PLUS the
  // pro-tour provenance columns added in Sprint 6 — we need
  // tournament_name / tournament_event / round_name / source_provider
  // to build a rich meta description and the SportsEvent schema's
  // superEvent. duration_minutes feeds the schema's endDate (falls
  // back to a 45-min default when the source didn't capture it).
  const { data: matchRow } = await supabase
    .from("matches")
    .select(
      `id, slug, format, played_at, team_a_score, team_b_score, winning_team,
       venue_id, venue_name_override, court_number, duration_minutes,
       source_provider, tournament_name, tournament_event, round_name,
       venues:venue_id ( slug, name, city )`,
    )
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();

  if (!matchRow) return render404(`/tran-dau/${slug}`, siteUrl);

  const m = matchRow as Record<string, unknown>;
  const venue = m.venues as { slug: string; name: string; city: string } | null;
  const venueName = venue?.name ?? (m.venue_name_override as string | null) ?? "";
  const venueCity = venue?.city ?? "";

  const { data: parts } = await supabase
    .from("match_participants")
    .select(
      `team, position,
       profile:profiles!match_participants_player_id_fkey ( username, display_name )`,
    )
    .eq("match_id", m.id as string)
    .order("team", { ascending: true })
    .order("position", { ascending: true });

  const participants: MatchSeoParticipant[] = (parts ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const p = (r.profile ?? {}) as { username?: string | null; display_name?: string | null };
    return {
      team: r.team as "a" | "b",
      position: (r.position as number) ?? null,
      username: p.username ?? null,
      display_name: p.display_name ?? null,
    };
  });

  const teamA = participants.filter((p) => p.team === "a");
  const teamB = participants.filter((p) => p.team === "b");
  const teamAPlayers = teamA
    .map((p) => p.display_name ?? p.username ?? "")
    .filter(Boolean);
  const teamBPlayers = teamB
    .map((p) => p.display_name ?? p.username ?? "")
    .filter(Boolean);
  const teamALabel = teamAPlayers.join(" & ") || "?";
  const teamBLabel = teamBPlayers.join(" & ") || "?";

  const playedAt = m.played_at as string;
  const teamAScore = (m.team_a_score as number[]) || [];
  const teamBScore = (m.team_b_score as number[]) || [];
  const winningTeam = m.winning_team as "a" | "b" | null;
  const format = m.format as string;
  const tournamentName = (m.tournament_name as string | null) ?? null;
  const tournamentEvent = (m.tournament_event as string | null) ?? null;
  const roundCode = (m.round_name as string | null) ?? null;
  const courtNumber = (m.court_number as string | null) ?? null;
  const durationMinutes = (m.duration_minutes as number | null) ?? null;

  const date = fmtMatchDateVN(playedAt);
  const fmtLabel = fmtMatchFormatVi(format);
  const venueLabel = venueName ? venueName : "";
  const compactScore = fmtScoreCompact(teamAScore, teamBScore);

  // Title — keep concise; tournament context lives in the description.
  const rawTitle = `${teamALabel} vs ${teamBLabel}, ${compactScore}${venueLabel ? ` — ${venueLabel}` : ""}, ${date}`;
  const title = buildTitle(rawTitle, " | ThePickleHub");

  // Dynamic description (Bug 3 fix): match-specific sentence with
  // tournament + round + scores + winners, replaces the previous
  // boilerplate "Trận pickleball... kết quả X-Y" line.
  const description = buildMatchDescription(
    {
      teamALabel,
      teamBLabel,
      teamAScore,
      teamBScore,
      winningTeam,
      format,
      playedAtIso: playedAt,
      tournamentName,
      tournamentEvent,
      roundCode,
      venueName,
    },
    "vi",
  );

  // OG image computed once + reused for both buildHtml's image opt
  // and the schema's image property — Rich Results warns when image
  // is absent on SportsEvent.
  const ogImage = `${siteUrl}/og/match/${encodeURIComponent(slug)}.png`;

  // Rich JSON-LD (Bug 5 fix): SportsTeam competitors for doubles, Place
  // location with court → venue containment, eventStatus, superEvent
  // (now SportsSeries — see match-seo.ts comment), endDate from
  // duration_minutes, organizer from source_provider, image from OG.
  const jsonLd = buildMatchSchema({
    url: `${siteUrl}/tran-dau/${slug}`,
    description,
    imageUrl: ogImage,
    teamAPlayers,
    teamBPlayers,
    teamAScore,
    teamBScore,
    winningTeam,
    format,
    playedAtIso: playedAt,
    durationMinutes,
    tournamentName,
    venueName,
    venueCity,
    courtNumber,
    sourceProvider: (m.source_provider as string | null) as
      | "community"
      | "ppa_tour"
      | "app_tour"
      | "mlp"
      | "other"
      | null,
  });

  // Breadcrumb (Bug 1 fix): the "Trận đấu" middle crumb now points at
  // /feed?tab=trending — the closest thing to a "matches index" we
  // have today. The breadcrumb helper itself was hardened to render
  // a plain <li> when href is missing, but we want a working link
  // here so users (and Google's breadcrumb path display) get a
  // navigable route.
  const bc = breadcrumb([
    { label: "Trang chủ", href: `${siteUrl}/` },
    { label: "Trận đấu", href: `${siteUrl}/feed?tab=trending` },
    { label: `${teamALabel} vs ${teamBLabel}` },
  ]);

  // Bot-readable body. The H1 (Bug 2 fix) is now emitted by buildHtml
  // from the page title; the in-body teams headline is demoted to H2
  // so there's exactly one H1 per document. Tournament context is
  // surfaced as a paragraph above the score so the bot excerpt has
  // strong matching against tournament search queries.
  const tournamentLine = tournamentName
    ? `<p><em>${escapeHtml([tournamentName, tournamentEvent, roundLabel(roundCode, "vi")].filter(Boolean).join(" · "))}</em></p>`
    : "";
  const winnerLabel =
    winningTeam === "a" ? teamALabel : winningTeam === "b" ? teamBLabel : "";
  // SEO audit 2026-05-28 (batch 8) — Related matches + Latest news.
  // Match detail SSR was a thin score card (similar shape to the
  // /live SSR), well below the little-content threshold and orphan-
  // flagged. Fetch 6 sibling public matches + 3 latest VI news to
  // pad the body + create internal links between matches.
  const [relatedMatchRes, matchNewsRes] = await Promise.all([
    supabase.from("matches")
      .select("slug, tournament_name, tournament_event, played_at")
      .eq("is_public", true)
      .neq("slug", slug)
      // Mirror sitemap-matches.xml.ts exclusions: qt-* (QuickTable share IDs)
      // and *-test (seed data) are deliberately hidden from the sitemap, so
      // linking to them here handed Googlebot the exact URLs the sitemap
      // hides — every match page leaked internal links to excluded pages.
      .not("slug", "like", "qt-%")
      .not("slug", "like", "%-test%")
      .order("played_at", { ascending: false })
      .limit(6),
    supabase.from("news_items")
      .select("slug, title")
      .eq("language", "vi")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(3),
  ]);
  const relatedMatchItems = ((relatedMatchRes.data || []) as Array<{ slug: string; tournament_name: string | null; tournament_event: string | null; played_at: string | null }>)
    .map((mm) => {
      const label = [mm.tournament_name, mm.tournament_event].filter(Boolean).join(" · ") || "Trận đấu pickleball";
      return `<li><a href="${siteUrl}/tran-dau/${escapeHtml(mm.slug)}">${escapeHtml(label)}</a></li>`;
    })
    .join("");
  const matchNewsItems = ((matchNewsRes.data || []) as Array<{ slug: string; title: string }>)
    .map((n) => `<li><a href="${siteUrl}/vi/news/${escapeHtml(n.slug)}">${escapeHtml(n.title)}</a></li>`)
    .join("");
  const matchRelatedHtml =
    (relatedMatchItems ? `<section><h2>Trận đấu gần đây</h2><ul>${relatedMatchItems}</ul></section>` : "") +
    (matchNewsItems ? `<section><h2>Tin pickleball mới nhất</h2><ul>${matchNewsItems}</ul></section>` : "");

  const bodyContent = `${bc}
<h2>${escapeHtml(`${teamALabel} vs ${teamBLabel}`)}</h2>
${tournamentLine}
<p><strong>${escapeHtml(date)}</strong>${venueLabel ? ` · ${escapeHtml(venueLabel)}` : ""}${venueCity ? `, ${escapeHtml(venueCity)}` : ""}${courtNumber ? ` · ${escapeHtml(courtNumber)}` : ""}</p>
<p>Hình thức: ${escapeHtml(fmtLabel)}</p>
<p>Tỉ số: <strong>${escapeHtml(compactScore)}</strong></p>
${winnerLabel ? `<p>Đội thắng: <strong>${escapeHtml(winnerLabel)}</strong></p>` : ""}${matchRelatedHtml}`;

  // ogImage already declared above for the schema's `image` field.
  // Bug 6 fix on PR #40: twitter:image is emitted by buildHtml from
  // the `image` opt — don't duplicate via extraMeta. We still pass
  // PNG dimensions/type because buildHtml only emits the bare
  // og:image URL.
  const extraMeta = [
    `<meta property="og:image:width" content="1200"/>`,
    `<meta property="og:image:height" content="630"/>`,
    `<meta property="og:image:type" content="image/png"/>`,
  ].join("\n");

  // hreflang intentionally OMITTED. /tran-dau/<slug> is single-canonical
  // — there is no separate /en/match/<slug> or /vi/tran-dau/<slug> URL
  // serving distinct localized content (renderMatch hard-codes lang:"vi"
  // and the SPA toggles language client-side via context).
  //
  // Codex P1 on PR #40: emitting three <link hreflang> tags all
  // pointing at the same canonical URL is an invalid SEO signal —
  // Google will either ignore it or flag it in Search Console as
  // "alternate page with proper canonical tag" / "incorrect hreflang
  // implementation". Better to omit entirely until the route actually
  // ships split-canonical bilingual URLs. The og:locale:alternate tag
  // that buildHtml emits is similarly gated below.
  const canonicalUrl = `${siteUrl}/tran-dau/${slug}`;

  return htmlResponse(
    buildHtml({
      title,
      description,
      url: canonicalUrl,
      siteUrl,
      image: ogImage,
      type: "article",
      jsonLd,
      bodyContent,
      extraMeta,
      lang: "vi",
    }),
  );
}
