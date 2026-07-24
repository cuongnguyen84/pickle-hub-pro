export type DashboardPhase =
  | "group"
  | "playoff"
  | "winners"
  | "losers"
  | "final"
  | "match";

export interface DashboardMatch {
  id: string;
  courtNumber: number;
  courtName: string | null;
  teamA: string;
  teamB: string;
  scoreA: number | null;
  scoreB: number | null;
  status: string;
  startTime: string | null;
  displayOrder: number;
  groupName: string | null;
  roundNumber: number | null;
  phase: DashboardPhase | null;
  matchNumber: number | null;
}

export interface CourtData {
  courtNumber: number;
  courtName: string | null;
  liveMatch: DashboardMatch | null;
  nextMatch: DashboardMatch | null;
}

const LIVE_STATUSES = new Set(["live", "playing", "in_progress"]);
const UPCOMING_STATUSES = new Set(["pending", "lineup", "scheduled", "ready"]);

export const isDashboardMatchLive = (match: DashboardMatch): boolean =>
  LIVE_STATUSES.has(match.status)
  || (
    match.status === "pending"
    && ((match.scoreA ?? 0) > 0 || (match.scoreB ?? 0) > 0)
  );

export const isDashboardMatchUpcoming = (match: DashboardMatch): boolean =>
  UPCOMING_STATUSES.has(match.status) && !isDashboardMatchLive(match);

const uniqueSortedPositiveNumbers = (values: number[]): number[] =>
  Array.from(new Set(values.filter((value) => Number.isInteger(value) && value > 0)))
    .sort((a, b) => a - b);

interface BuildCourtDataOptions {
  type: "quick-table" | "doubles-elimination";
  configuredCourts?: number[];
  courtCount?: number;
}

/**
 * Builds the dashboard court cards without inventing missing court numbers.
 *
 * Quick Tables can be assigned sparse physical court numbers (for example
 * 7, 8, 9 and 13). Those values are identifiers, not a court count, so the
 * dashboard must never expand them into the range 1..13.
 */
export const buildCourtData = (
  matches: DashboardMatch[],
  options: BuildCourtDataOptions,
): CourtData[] => {
  const matchesByCourt = new Map<number, DashboardMatch[]>();

  matches.forEach((match) => {
    if (match.courtNumber <= 0) return;
    const courtMatches = matchesByCourt.get(match.courtNumber) ?? [];
    courtMatches.push(match);
    matchesByCourt.set(match.courtNumber, courtMatches);
  });

  matchesByCourt.forEach((courtMatches) => {
    courtMatches.sort((a, b) => a.displayOrder - b.displayOrder);
  });

  const assignedCourtNumbers = Array.from(matchesByCourt.keys());
  let courtNumbers: number[];

  if (options.type === "quick-table") {
    const configured = uniqueSortedPositiveNumbers(options.configuredCourts ?? []);
    courtNumbers = configured.length > 0
      ? configured
      : uniqueSortedPositiveNumbers(assignedCourtNumbers);
  } else {
    const generatedCourtNumbers = Array.from(
      { length: Math.max(0, options.courtCount ?? 0) },
      (_, index) => index + 1,
    );
    courtNumbers = uniqueSortedPositiveNumbers([
      ...generatedCourtNumbers,
      ...assignedCourtNumbers,
    ]);
  }

  return courtNumbers.map((courtNumber) => {
    const courtMatches = matchesByCourt.get(courtNumber) ?? [];
    const liveMatch = courtMatches.find(isDashboardMatchLive) ?? null;
    const nextMatch = courtMatches.find((match) =>
      match.id !== liveMatch?.id && isDashboardMatchUpcoming(match)
    ) ?? null;
    const namedMatch = liveMatch ?? nextMatch ?? courtMatches[0];

    return {
      courtNumber,
      courtName: namedMatch?.courtName ?? null,
      liveMatch,
      nextMatch,
    };
  });
};
