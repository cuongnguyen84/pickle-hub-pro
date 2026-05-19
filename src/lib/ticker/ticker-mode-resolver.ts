/**
 * Pure helpers for the 3-mode global ticker.
 *
 * Mode resolution is priority-based — the resolver picks the highest
 * mode that has data; lower modes only render as a fallback. Extracted
 * here so the decision tree + the per-item formatting are unit-testable
 * without rendering Index.tsx.
 *
 * Modes (descending priority):
 *   - LIVE    — livestream is live OR scheduled within the next ~24h
 *   - MATCHES — pro-tour matches played within the last 3 days
 *   - BLOG    — published blog posts (always-on fallback)
 *   - EMPTY   — none of the above (extremely rare; ticker shows a
 *               friendly "check back soon" line)
 */

export type TickerMode = "live" | "matches" | "blog" | "empty";
export type Language = "vi" | "en";

/** A single rendered ticker item. The bar shows N of these in sequence. */
export interface TickerItem {
  id: string;
  /** Bold prefix — eg. "PPA Finals - Final" or "REPLAY" or "BLOG". */
  lead: string;
  /** Body text — match summary, blog title, livestream title. */
  body: string;
  /** Trailing context (right side of separator) — eg. organisation
   *  name, blog excerpt. Optional. */
  trail?: string;
  /** Where clicking the item navigates. Required so every item is a
   *  meaningful affordance (the previous ticker was non-clickable). */
  href: string;
}

/* ─── Round-name canonical labels ────────────────────────────────────── */

const ROUND_LABEL: Record<string, { en: string; vi: string }> = {
  F: { en: "Final", vi: "Chung kết" },
  SF: { en: "Semifinal", vi: "Bán kết" },
  QF: { en: "Quarterfinal", vi: "Tứ kết" },
  R16: { en: "Round of 16", vi: "Vòng 1/8" },
  R32: { en: "Round of 32", vi: "Vòng 1/16" },
  R64: { en: "Round of 64", vi: "Vòng 1/32" },
  "3P": { en: "Bronze", vi: "Tranh hạng 3" },
};

export function formatRoundLabel(roundCode: string | null | undefined, language: Language): string {
  if (!roundCode) return "";
  const hit = ROUND_LABEL[roundCode];
  if (hit) return hit[language];
  // Unrecognized code (W/L/GS or a future label) — return verbatim
  // rather than swallowing the signal entirely.
  return roundCode;
}

/* ─── Tournament name normaliser ─────────────────────────────────────── */
//
// Pro-tour rows arrive as "PPA Tour: 2026 PPA Finals" / "APP Tour: 2026
// Major" etc. The "Tour:" prefix is redundant in the ticker context where
// horizontal space is scarce — strip it so "PPA Tour: 2026 PPA Finals"
// becomes "2026 PPA Finals" which still reads clearly.

const TOUR_PREFIX_RE = /^(PPA|APP|MLP)\s+Tour:\s*/i;

export function stripTournamentPrefix(name: string | null | undefined): string {
  if (!name) return "";
  return name.replace(TOUR_PREFIX_RE, "").trim();
}

/* ─── Player name → last name only ────────────────────────────────────── */
//
// Doubles team display in the ticker: "Johns/Tardio" rather than
// "Ben Johns / Gabriel Tardio". Last word of the display name handles
// most cases including multi-part Vietnamese names ("Nguyen Van A" →
// "A"). For mononym players ("Pelé", "Cher"), returns the whole name.

export function lastNameFromDisplayName(name: string | null | undefined): string {
  if (!name) return "";
  const trimmed = name.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1];
}

/* ─── Set-win counter ────────────────────────────────────────────────── */
//
// Counts how many games each side won. A team wins a game when their
// score is strictly greater than the opponent's at the same index.
// Treats element 0 as "game played, lost 0-X" (per spec — the source
// payload uses 0 for a played-but-zero-score game and "" for an unplayed
// game; the parser already filters out "" so anything we see here was
// played).
//
// Note on PCREs / win-by-2: pickleball typically requires a 2-point
// margin to win. We do NOT enforce that — the source platform already
// declared the winner via match.winning_team and per-game isWinner,
// and we only care about "how many games did each team take".

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
    // Tie → neither side wins the game (rare; not a real pickleball
    // outcome but we don't manufacture data the source didn't supply)
  }
  return { a, b };
}

/* ─── Ticker mode resolver ───────────────────────────────────────────── */

export interface ResolveInput {
  liveCount: number;
  upcomingCount: number;
  matchCount: number;
  blogCount: number;
}

export function resolveTickerMode(input: ResolveInput): TickerMode {
  if (input.liveCount > 0 || input.upcomingCount > 0) return "live";
  if (input.matchCount > 0) return "matches";
  if (input.blogCount > 0) return "blog";
  return "empty";
}

/* ─── Pro-tour match → ticker item formatter ────────────────────────── */

export interface ProMatchTickerInput {
  match_id: string;
  slug: string;
  tournament_name: string | null;
  round_name: string | null;
  team_a_score: number[];
  team_b_score: number[];
  winning_team: "a" | "b" | null;
  /** team_a_lastnames / team_b_lastnames already extracted from
   *  participants. The hook layer does the participant join + slugify
   *  → keep this formatter pure (no DB shapes). */
  team_a_lastnames: string[];
  team_b_lastnames: string[];
}

export function formatProMatchTicker(
  m: ProMatchTickerInput,
  language: Language,
): TickerItem {
  const tournamentShort = stripTournamentPrefix(m.tournament_name);
  const roundLabel = formatRoundLabel(m.round_name, language);
  const lead = [tournamentShort, roundLabel].filter(Boolean).join(" - ");

  const wins = countSetWins(m.team_a_score, m.team_b_score);
  const teamA = m.team_a_lastnames.length > 0
    ? m.team_a_lastnames.join("/")
    : language === "vi" ? "Đội A" : "Team A";
  const teamB = m.team_b_lastnames.length > 0
    ? m.team_b_lastnames.join("/")
    : language === "vi" ? "Đội B" : "Team B";

  // Score reads team_a:team_b as recorded — winner side comes first
  // visually because pickleball broadcasts always lead with the winner
  // ("Johns/Tardio 3:0 Staksrud/Daescu"). Swap the side ordering only
  // when team B is the explicit winner; for team A wins or unresolved
  // matches keep the natural A/B ordering.
  //
  // Codex P2 fix on PR #38: previously `aWon = winning_team === "a"`
  // evaluated to `false` for `winning_team === null` AND for
  // `winning_team === "b"` alike — both branches would then flip the
  // display so team B led. That's correct for B wins but wrong for the
  // null case: an unresolved match has no winner to lead with, and
  // forcing "B 0:0 A" silently mislabels the row. Now: only B-wins
  // trigger the swap; null/missing keeps A first.
  const swapForBWinner = m.winning_team === "b";
  const leftLabel = swapForBWinner ? teamB : teamA;
  const rightLabel = swapForBWinner ? teamA : teamB;
  const leftWins = swapForBWinner ? wins.b : wins.a;
  const rightWins = swapForBWinner ? wins.a : wins.b;

  const body = `${leftLabel} ${leftWins}:${rightWins} ${rightLabel}`;

  return {
    id: `match-${m.match_id}`,
    lead,
    body,
    href: `/tran-dau/${m.slug}`,
  };
}
