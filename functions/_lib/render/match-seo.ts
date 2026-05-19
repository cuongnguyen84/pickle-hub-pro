/**
 * Pure SEO helpers for /tran-dau/<slug> match prerender.
 *
 * Extracted from index.ts so the formatting / schema construction is
 * isolated from the database fetch and the buildHtml plumbing. None of
 * these functions touch I/O — all inputs come in as plain values.
 *
 * Bilingual: helpers accept `lang` and emit Vietnamese / English copy
 * accordingly. The /tran-dau/<slug> route is currently rendered as
 * Vietnamese (the SPA toggles language client-side via context), but
 * the EN paths are wired up so the same helpers can serve a future
 * /vi/tran-dau/<slug> split-canonical layout without rewriting.
 */

import type { Lang } from "../utils";

/* ─── Round name → bilingual label ───────────────────────────────────── */
//
// Mirrors src/lib/ticker/ticker-mode-resolver.ts ROUND_LABEL — kept in
// sync intentionally so the prerender + the SPA ticker speak the same
// vocabulary. If a code is added there, mirror here.

const ROUND_LABEL: Record<string, { en: string; vi: string }> = {
  F: { en: "Final", vi: "Chung kết" },
  SF: { en: "Semifinal", vi: "Bán kết" },
  QF: { en: "Quarterfinal", vi: "Tứ kết" },
  R16: { en: "Round of 16", vi: "Vòng 1/8" },
  R32: { en: "Round of 32", vi: "Vòng 1/16" },
  R64: { en: "Round of 64", vi: "Vòng 1/32" },
  "3P": { en: "Bronze", vi: "Tranh hạng 3" },
};

export function roundLabel(code: string | null | undefined, lang: Lang): string {
  if (!code) return "";
  const hit = ROUND_LABEL[code];
  if (hit) return hit[lang];
  return code; // unrecognized — return verbatim
}

/* ─── Format → bilingual label ───────────────────────────────────────── */

export function formatLabel(format: string | null | undefined, lang: Lang): string {
  if (!format) return "";
  if (format === "singles") return lang === "vi" ? "đơn" : "singles";
  if (format === "mixed") return lang === "vi" ? "đôi nam-nữ" : "mixed doubles";
  return lang === "vi" ? "đôi" : "doubles";
}

/* ─── Date formatter ─────────────────────────────────────────────────── */
//
// VI: dd/mm/yyyy via Intl in Asia/Ho_Chi_Minh. EN: "May 10, 2026" via
// Intl in en-US. Both clamp to a known timezone so the rendered string
// doesn't drift with the deploy region (the Worker runs near Tokyo per
// CLAUDE.md placement notes).

export function formatDate(iso: string, lang: Lang): string {
  try {
    if (lang === "vi") {
      return new Date(iso).toLocaleDateString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }
    return new Date(iso).toLocaleDateString("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

/* ─── Score formatter ────────────────────────────────────────────────── */
//
// Compact "11-7, 11-6, 11-2" form for the meta description. Same shape
// regardless of language (digits + en-dash); the surrounding sentence
// translates around it.

export function formatScoreList(a: number[], b: number[]): string {
  return a.map((s, i) => `${s}-${b[i] ?? 0}`).join(", ");
}

/* ─── Set wins counter ──────────────────────────────────────────────── */

export interface SetWins {
  a: number;
  b: number;
}

export function countSetWins(scoresA: number[], scoresB: number[]): SetWins {
  let a = 0;
  let b = 0;
  const n = Math.max(scoresA.length, scoresB.length);
  for (let i = 0; i < n; i++) {
    const sa = scoresA[i] ?? 0;
    const sb = scoresB[i] ?? 0;
    if (sa > sb) a += 1;
    else if (sb > sa) b += 1;
  }
  return { a, b };
}

/* ─── Tournament name normaliser (reused from ticker) ────────────────── */

const TOUR_PREFIX_RE = /^(PPA|APP|MLP)\s+Tour:\s*/i;

export function stripTourPrefix(name: string | null | undefined): string {
  if (!name) return "";
  return name.replace(TOUR_PREFIX_RE, "").trim();
}

/* ─── Dynamic match description (bilingual) ──────────────────────────── */

export interface MatchDescriptionInput {
  teamALabel: string;
  teamBLabel: string;
  teamAScore: number[];
  teamBScore: number[];
  winningTeam: "a" | "b" | null;
  format: string;
  playedAtIso: string;
  tournamentName: string | null;
  tournamentEvent: string | null;
  roundCode: string | null;
  venueName: string;
}

/**
 * Produce a Google-friendly meta description that reads as a complete
 * sentence describing the match outcome. Works whether the row is a
 * pro-tour result (with tournament + round context) or a community
 * match (without). Bilingual.
 *
 * Examples:
 *   EN: "Anna Leigh Waters & Anna Bright defeat Parris Todd & Rachel
 *        Rohrabacher 3-0 (11-7, 11-6, 11-2) at PPA Tour 2026 PPA Finals
 *        Mixed Doubles Pro Final on May 10, 2026."
 *   VI: "Anna Leigh Waters & Anna Bright thắng Parris Todd & Rachel
 *        Rohrabacher 3-0 (11-7, 11-6, 11-2) tại PPA Tour 2026 PPA Finals
 *        Chung kết đôi nam nữ chuyên nghiệp ngày 10/05/2026."
 */
export function buildMatchDescription(
  input: MatchDescriptionInput,
  lang: Lang,
): string {
  const wins = countSetWins(input.teamAScore, input.teamBScore);
  const winnerLeads = input.winningTeam === "b";
  const left = winnerLeads ? input.teamBLabel : input.teamALabel;
  const right = winnerLeads ? input.teamALabel : input.teamBLabel;
  const leftWins = winnerLeads ? wins.b : wins.a;
  const rightWins = winnerLeads ? wins.a : wins.b;

  // Reorder per-game scores so they read in the winner's perspective:
  // first number is the winning side's per-game points, second is the
  // losing side's. Keeps "3-0 (11-7, 11-6, 11-2)" coherent.
  const leftPerGame = winnerLeads ? input.teamBScore : input.teamAScore;
  const rightPerGame = winnerLeads ? input.teamAScore : input.teamBScore;
  const scoresList = formatScoreList(leftPerGame, rightPerGame);

  const dateStr = formatDate(input.playedAtIso, lang);
  const round = roundLabel(input.roundCode, lang);
  const fmt = formatLabel(input.format, lang);

  // Tournament context phrase — only emits when we actually have one.
  // Keep tournamentName as-is (don't strip "PPA Tour:" — the prefix is
  // the brand and reads well in context).
  const tournamentChunk = input.tournamentName ?? "";
  const eventChunk = input.tournamentEvent ?? "";
  const venueChunk = input.venueName ?? "";

  if (input.winningTeam === null) {
    // Unresolved match — no winner verb. Fall back to a neutral
    // "<team> vs <team> at <event> on <date>" sentence.
    if (lang === "vi") {
      const venuePhrase = venueChunk ? ` tại ${venueChunk}` : "";
      const tournPhrase = tournamentChunk
        ? ` thuộc ${[tournamentChunk, eventChunk, round].filter(Boolean).join(" ")}`
        : "";
      return `Trận ${fmt} ${input.teamALabel} vs ${input.teamBLabel}${tournPhrase}${venuePhrase} ngày ${dateStr}.`;
    }
    const venuePhrase = venueChunk ? ` at ${venueChunk}` : "";
    const tournPhrase = tournamentChunk
      ? ` at ${[tournamentChunk, eventChunk, round].filter(Boolean).join(" ")}`
      : "";
    return `${input.teamALabel} vs ${input.teamBLabel} ${fmt} match${tournPhrase}${venuePhrase} on ${dateStr}.`;
  }

  // PR (2026-05-18 Ahrefs Site Audit Round 2 fix) — trim description to
  // ≤155 chars (Ahrefs flagged 15 /tran-dau/* pages at 161-181ch).
  // Strategy: build full text, then if > 155, drop the per-game scores
  // parenthetical "(11-8, 11-6, 11-2)" — keeps the meaningful winner/
  // tournament info, only loses set-by-set detail (which is on the page
  // body anyway).
  const trimToMax = (full: string, withoutScores: string): string => {
    if (full.length <= 155) return full;
    if (withoutScores.length <= 155) return withoutScores;
    return withoutScores.length > 155
      ? withoutScores.slice(0, 152).replace(/\s+\S*$/, "") + "..."
      : withoutScores;
  };

  if (lang === "vi") {
    const tournPhrase = tournamentChunk
      ? ` tại ${[tournamentChunk, eventChunk, round].filter(Boolean).join(" ")}`
      : "";
    const venuePhrase = venueChunk && !tournamentChunk ? ` tại ${venueChunk}` : "";
    const full = `${left} thắng ${right} ${leftWins}-${rightWins} (${scoresList})${tournPhrase}${venuePhrase} ngày ${dateStr}.`;
    const withoutScores = `${left} thắng ${right} ${leftWins}-${rightWins}${tournPhrase}${venuePhrase} ngày ${dateStr}.`;
    return trimToMax(full, withoutScores);
  }
  const tournPhrase = tournamentChunk
    ? ` at ${[tournamentChunk, eventChunk, round].filter(Boolean).join(" ")}`
    : "";
  const venuePhrase = venueChunk && !tournamentChunk ? ` at ${venueChunk}` : "";
  const full = `${left} defeat ${right} ${leftWins}-${rightWins} (${scoresList})${tournPhrase}${venuePhrase} on ${dateStr}.`;
  const withoutScores = `${left} defeat ${right} ${leftWins}-${rightWins}${tournPhrase}${venuePhrase} on ${dateStr}.`;
  return trimToMax(full, withoutScores);
}

/* ─── JSON-LD SportsEvent schema builder ─────────────────────────────── */

export type SourceProvider = "community" | "ppa_tour" | "app_tour" | "mlp" | "other";

export interface MatchSchemaInput {
  url: string;
  description: string;
  /** OG image absolute URL — emitted as schema.image to dampen the
   *  "missing image" Rich Results warning. */
  imageUrl: string;
  teamAPlayers: string[]; // display names — ordered by position
  teamBPlayers: string[];
  teamAScore: number[];
  teamBScore: number[];
  winningTeam: "a" | "b" | null;
  format: string;
  playedAtIso: string;
  durationMinutes: number | null;
  tournamentName: string | null;
  venueName: string;
  venueCity: string;
  courtNumber: string | null;
  /** Drives schema.organizer — pro-tour rows attribute to the tour
   *  body (PPA / APP / MLP). Community matches have no formal
   *  organizer and skip the field. */
  sourceProvider: SourceProvider | null;
}

/** Map source_provider → human-readable organizer name. Returns null
 *  when the row has no formal organizer (community matches). */
function sourceProviderLabel(s: SourceProvider | null): string | null {
  if (s === "ppa_tour") return "PPA Tour";
  if (s === "app_tour") return "APP Tour";
  if (s === "mlp") return "Major League Pickleball";
  return null;
}

const DEFAULT_DURATION_MINUTES = 45;

/**
 * Build a SportsEvent JSON-LD block matching schema.org conventions
 * for a completed match. Surfaces:
 *   - SportsTeam competitors (when doubles), Person (when singles)
 *   - winner pointing back at the winning competitor
 *   - location as a Place (court number) nested inside venue when
 *     both are present
 *   - eventStatus: omitted for past matches (Schema.org doesn't have a valid
 *     EventScheduled — matches the result's actual state
 *   - superEvent linking to the tournament when known
 *   - endDate calculated from played_at + duration_minutes (or a
 *     default 45 min when the source doesn't supply it)
 */
export function buildMatchSchema(
  input: MatchSchemaInput,
): Record<string, unknown> {
  const isDoubles = input.teamAPlayers.length > 1 || input.teamBPlayers.length > 1;

  const buildCompetitor = (
    players: string[],
    teamLabel: string,
  ): Record<string, unknown> => {
    if (isDoubles) {
      return {
        "@type": "SportsTeam",
        name: teamLabel,
        athlete: players.map((n) => ({ "@type": "Person", name: n })),
      };
    }
    return { "@type": "Person", name: players[0] ?? teamLabel };
  };

  const teamALabel = input.teamAPlayers.join(" & ") || "Team A";
  const teamBLabel = input.teamBPlayers.join(" & ") || "Team B";
  const competitorA = buildCompetitor(input.teamAPlayers, teamALabel);
  const competitorB = buildCompetitor(input.teamBPlayers, teamBLabel);

  const startMs = new Date(input.playedAtIso).getTime();
  const durationMin = input.durationMinutes ?? DEFAULT_DURATION_MINUTES;
  const endIso = Number.isFinite(startMs)
    ? new Date(startMs + durationMin * 60_000).toISOString()
    : null;

  // PR (2026-05-18 Ahrefs Site Audit Round 2 fix) — Schema.org's
  // `EventCompleted` is NOT a valid eventStatus value. Valid values:
  // EventScheduled, EventRescheduled, EventPostponed, EventCancelled,
  // EventMovedOnline. Ahrefs flagged 21 /tran-dau/* pages for this.
  // For past matches we omit eventStatus entirely — Google treats
  // absence as "default scheduled then happened" which is correct
  // for our use case (match results, not a live calendar event).
  const isPast = Number.isFinite(startMs) && startMs < Date.now();
  const eventStatus = isPast ? null : "https://schema.org/EventScheduled";

  const out: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${teamALabel} vs ${teamBLabel}`,
    sport: "Pickleball",
    startDate: input.playedAtIso,
    url: input.url,
    description: input.description,
    image: input.imageUrl,
    competitor: [competitorA, competitorB],
    // performer mirrors competitor — Google Rich Results recommends
    // both for sports events; competitor is the schema-canonical
    // property but performer is what generic Event-rich-result
    // crawlers look for.
    performer: [competitorA, competitorB],
  };
  if (eventStatus) out.eventStatus = eventStatus;

  if (endIso) out.endDate = endIso;

  // organizer — derived from source_provider so pro-tour matches credit
  // the tour body. Community matches skip the property (no formal
  // organizer) rather than fabricating one.
  const organizerName = sourceProviderLabel(input.sourceProvider);
  if (organizerName) {
    out.organizer = {
      "@type": "Organization",
      name: organizerName,
    };
  }

  if (input.winningTeam === "a") {
    out.winner = competitorA;
  } else if (input.winningTeam === "b") {
    out.winner = competitorB;
  }

  // Location: prefer Place wrapping (court inside venue) when both are
  // available. When only one signal exists, emit it alone.
  if (input.venueName || input.courtNumber) {
    const venuePart: Record<string, unknown> = input.venueName
      ? {
          "@type": "Place",
          name: input.venueName,
          ...(input.venueCity ? { address: input.venueCity } : {}),
        }
      : {};
    if (input.courtNumber) {
      out.location = {
        "@type": "Place",
        name: input.venueName
          ? `${input.venueName} — ${input.courtNumber}`
          : input.courtNumber,
        ...(input.venueCity ? { address: input.venueCity } : {}),
        ...(input.venueName ? { containedInPlace: venuePart } : {}),
      };
    } else {
      out.location = venuePart;
    }
  }

  // superEvent uses SportsSeries (NOT SportsEvent). Google Rich Results
  // requires SportsEvent to declare startDate + location; we don't have
  // those for the parent tournament without a separate query (and the
  // tournament spans many matches, so a single startDate would lie).
  // SportsSeries semantically matches a tournament's "series of
  // matches" framing and only requires `name`. (Codex finding on
  // PR #40: nested SportsEvent without dates produced two Rich Results
  // errors — startDate missing, location missing.)
  if (input.tournamentName) {
    out.superEvent = {
      "@type": "SportsSeries",
      name: input.tournamentName,
    };
  }

  return out;
}
