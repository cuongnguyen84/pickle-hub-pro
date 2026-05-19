/**
 * Pure formatter helpers used by the /feed page surface and FeedMatchCard.
 *
 * Extracted so the bilingual + score-row logic is unit-testable without
 * needing JSDOM or React Testing Library — the project's vitest config is
 * node-only.
 */

export type Language = "vi" | "en";

export type MatchFormat = "singles" | "doubles" | "mixed" | string;
export type MatchType =
  | "rec"
  | "open_play"
  | "tournament"
  | "league"
  | "practice"
  | string;
export type MatchStatus =
  | "verified"
  | "pending"
  | "disputed"
  | "rejected"
  | "expired"
  | string;

export interface FeedParticipant {
  player_id: string;
  team: "a" | "b";
  position: number | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_ghost: boolean | null;
  dupr_doubles: number | null;
}

/** Bilingual format-chip label. Singles vs Doubles vs Mixed. */
export function formatFormatLabel(
  format: MatchFormat,
  language: Language,
): string {
  if (language === "vi") {
    if (format === "singles") return "ĐƠN";
    if (format === "doubles") return "ĐÔI";
    if (format === "mixed") return "ĐÔI NAM-NỮ";
    return format.toUpperCase();
  }
  if (format === "singles") return "SINGLES";
  if (format === "doubles") return "DOUBLES";
  if (format === "mixed") return "MIXED";
  return format.toUpperCase();
}

/** Bilingual match-type chip. */
export function formatTypeLabel(
  matchType: MatchType,
  language: Language,
): string {
  if (language === "vi") {
    if (matchType === "rec") return "GIAO LƯU";
    if (matchType === "open_play") return "OPEN PLAY";
    if (matchType === "tournament") return "GIẢI ĐẤU";
    if (matchType === "league") return "GIẢI LEAGUE";
    if (matchType === "practice") return "TẬP LUYỆN";
    return matchType.toUpperCase();
  }
  if (matchType === "rec") return "CASUAL";
  if (matchType === "open_play") return "OPEN PLAY";
  if (matchType === "tournament") return "TOURNAMENT";
  if (matchType === "league") return "LEAGUE";
  if (matchType === "practice") return "PRACTICE";
  return matchType.toUpperCase();
}

/** Bilingual verification status badge label. */
export function formatStatusLabel(
  status: MatchStatus,
  language: Language,
): string {
  if (language === "vi") {
    if (status === "verified") return "● ĐÃ XÁC THỰC";
    if (status === "pending") return "CHỜ XÁC THỰC";
    if (status === "disputed") return "⚠ TRANH CHẤP";
    return status.toUpperCase();
  }
  if (status === "verified") return "● VERIFIED";
  if (status === "pending") return "PENDING";
  if (status === "disputed") return "⚠ DISPUTED";
  return status.toUpperCase();
}

/** CSS class suffix the FeedMatchCard uses on the badge element. */
export function statusBadgeClass(status: MatchStatus): string {
  if (status === "verified") return "verified";
  if (status === "pending") return "pending";
  if (status === "disputed") return "disputed";
  return "pending";
}

/**
 * Editorial date format used in the eyebrow strip.
 * Desktop reads full month, mobile compresses to D/M.
 *
 * VI desktop: "5 THÁNG 5 · 19:30"
 * EN desktop: "MAY 5 · 7:30 PM"
 * VI mobile:  "5/5 · 19:30"
 * EN mobile:  "5/5 · 7:30 PM"
 */
export function formatMatchWhen(
  isoString: string,
  language: Language,
  variant: "desktop" | "mobile" = "desktop",
): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");

  const VI_MONTHS = [
    "THÁNG 1", "THÁNG 2", "THÁNG 3", "THÁNG 4", "THÁNG 5", "THÁNG 6",
    "THÁNG 7", "THÁNG 8", "THÁNG 9", "THÁNG 10", "THÁNG 11", "THÁNG 12",
  ];
  const EN_MONTHS = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
  ];

  if (variant === "mobile") {
    const time =
      language === "en" ? formatTime12h(hours, minutes) : `${hours}:${minutes}`;
    return `${day}/${month} · ${time}`;
  }

  if (language === "vi") {
    return `${day} ${VI_MONTHS[d.getMonth()]} · ${hours}:${minutes}`;
  }
  return `${EN_MONTHS[d.getMonth()]} ${day} · ${formatTime12h(hours, minutes)}`;
}

function formatTime12h(hours24: number, minutes: string): string {
  const period = hours24 >= 12 ? "PM" : "AM";
  const h12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${h12}:${minutes} ${period}`;
}

/** Group participants into team A and team B, ordered by position. */
export function groupTeams(
  participants: FeedParticipant[] | null | undefined,
): { teamA: FeedParticipant[]; teamB: FeedParticipant[] } {
  const teamA: FeedParticipant[] = [];
  const teamB: FeedParticipant[] = [];
  for (const p of participants ?? []) {
    if (p.team === "a") teamA.push(p);
    else if (p.team === "b") teamB.push(p);
  }
  const byPos = (a: FeedParticipant, b: FeedParticipant) =>
    (a.position ?? 0) - (b.position ?? 0);
  teamA.sort(byPos);
  teamB.sort(byPos);
  return { teamA, teamB };
}

/**
 * Build the screen-reader summary used as aria-label on each card.
 * Reads the match in narrative order: format, teams, score, venue, date.
 */
export function buildAriaLabel(args: {
  language: Language;
  teamA: FeedParticipant[];
  teamB: FeedParticipant[];
  scoreA: number[];
  scoreB: number[];
  winningTeam: "a" | "b";
  venueName: string | null;
  playedAt: string;
  format: MatchFormat;
}): string {
  const namesA = args.teamA
    .map((p) => p.display_name ?? p.username ?? "")
    .filter(Boolean)
    .join(args.language === "vi" ? " và " : " and ");
  const namesB = args.teamB
    .map((p) => p.display_name ?? p.username ?? "")
    .filter(Boolean)
    .join(args.language === "vi" ? " và " : " and ");

  const scorePairs = args.scoreA
    .map((a, i) => {
      const b = args.scoreB[i] ?? 0;
      return args.language === "vi" ? `${a}-${b}` : `${a}–${b}`;
    })
    .join(", ");

  const when = formatMatchWhen(args.playedAt, args.language, "desktop");
  const venue = args.venueName ?? "";

  if (args.language === "vi") {
    const verb = args.winningTeam === "a" ? "thắng" : "thua";
    return `Trận đấu ${args.format === "singles" ? "đơn" : "đôi"}: ${namesA} ${verb} ${namesB}, tỉ số ${scorePairs}. ${venue ? `Tại ${venue}, ` : ""}${when}.`;
  }
  const verb = args.winningTeam === "a" ? "won against" : "lost to";
  return `${args.format === "singles" ? "Singles" : "Doubles"} match: ${namesA} ${verb} ${namesB}, score ${scorePairs}.${venue ? ` At ${venue},` : ""} ${when}.`;
}
