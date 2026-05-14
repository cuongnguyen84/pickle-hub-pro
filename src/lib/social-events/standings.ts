// ============================================================================
// social-events / standings — pure helper for the Live page's standings zone
// ----------------------------------------------------------------------------
// Computes per-player record (wins / losses / point_diff) from a list of
// completed matches. Used by:
//   - /social/:slug/live  →  "Standings" zone (top 5, highlight me)
//   - PR48 ELO ingestion   →  pre-aggregated win/loss feed
//
// Conventions:
//   - Only `completed` matches with both `team_a_score` and `team_b_score`
//     non-null contribute to the table; in-progress matches are skipped.
//   - A "win" requires `winning_team` to be 'a' or 'b'. If both scores are
//     equal (tie — unusual in pickleball) the match is treated as completed
//     but contributes zero to wins/losses on both sides (point_diff = 0 still
//     accumulates correctly).
//   - Players with no matches do not appear in the output. Callers that
//     need a "0-0" row for every registered player should pre-seed the
//     output map themselves.
//   - Sort order: wins DESC → point_diff DESC → matches_played DESC →
//     player_id ASC. The last key keeps output deterministic across runs.
// ============================================================================

export interface MatchInput {
  id: string;
  team_a_player1_id: string | null;
  team_a_player2_id: string | null;
  team_b_player1_id: string | null;
  team_b_player2_id: string | null;
  team_a_score: number | null;
  team_b_score: number | null;
  status: "scheduled" | "in_progress" | "completed";
  winning_team: "a" | "b" | null;
}

export interface StandingRow {
  player_id: string;
  wins: number;
  losses: number;
  matches_played: number;
  points_for: number;
  points_against: number;
  point_diff: number;
}

function teamPlayers(
  m: MatchInput,
  team: "a" | "b",
): string[] {
  if (team === "a") {
    return [m.team_a_player1_id, m.team_a_player2_id].filter(
      (x): x is string => x != null,
    );
  }
  return [m.team_b_player1_id, m.team_b_player2_id].filter(
    (x): x is string => x != null,
  );
}

function ensure(map: Map<string, StandingRow>, id: string): StandingRow {
  let row = map.get(id);
  if (!row) {
    row = {
      player_id: id,
      wins: 0,
      losses: 0,
      matches_played: 0,
      points_for: 0,
      points_against: 0,
      point_diff: 0,
    };
    map.set(id, row);
  }
  return row;
}

export function computeStandings(matches: MatchInput[]): StandingRow[] {
  const map = new Map<string, StandingRow>();

  for (const m of matches) {
    if (m.status !== "completed") continue;
    if (m.team_a_score == null || m.team_b_score == null) continue;

    const teamA = teamPlayers(m, "a");
    const teamB = teamPlayers(m, "b");
    if (teamA.length === 0 || teamB.length === 0) continue;

    const scoreA = m.team_a_score;
    const scoreB = m.team_b_score;
    const aWin = m.winning_team === "a";
    const bWin = m.winning_team === "b";

    for (const id of teamA) {
      const row = ensure(map, id);
      row.matches_played += 1;
      row.points_for += scoreA;
      row.points_against += scoreB;
      row.point_diff = row.points_for - row.points_against;
      if (aWin) row.wins += 1;
      else if (bWin) row.losses += 1;
    }
    for (const id of teamB) {
      const row = ensure(map, id);
      row.matches_played += 1;
      row.points_for += scoreB;
      row.points_against += scoreA;
      row.point_diff = row.points_for - row.points_against;
      if (bWin) row.wins += 1;
      else if (aWin) row.losses += 1;
    }
  }

  const rows = Array.from(map.values());
  rows.sort((x, y) => {
    if (y.wins !== x.wins) return y.wins - x.wins;
    if (y.point_diff !== x.point_diff) return y.point_diff - x.point_diff;
    if (y.matches_played !== x.matches_played) {
      return y.matches_played - x.matches_played;
    }
    return x.player_id < y.player_id ? -1 : x.player_id > y.player_id ? 1 : 0;
  });
  return rows;
}

/**
 * Find the row for a single player in the precomputed standings array, or
 * null if they have not played a match yet. Linear scan — standings arrays
 * for social events are small (≤32 typical), no index needed.
 */
export function findStanding(
  standings: StandingRow[],
  playerId: string,
): StandingRow | null {
  for (const row of standings) {
    if (row.player_id === playerId) return row;
  }
  return null;
}

export interface RosterEntry {
  profile_id: string;
  level: number | null;
}

/**
 * Merge the match-derived standings with the full roster so registered
 * players who haven't played yet appear as 0-0 rows. Re-sorts with level
 * (descending, nulls last) as a tiebreaker after the standard wins /
 * point_diff / matches_played keys — that way the initial display
 * (no completed matches yet) reads as "strongest player first" instead
 * of a string-id alphabetic order.
 *
 * Pure. Input arrays are not mutated.
 */
export function seedStandingsWithRoster(
  base: StandingRow[],
  roster: RosterEntry[],
): StandingRow[] {
  const baseIds = new Set(base.map((s) => s.player_id));
  const seeded: StandingRow[] = base.slice();
  for (const r of roster) {
    if (!baseIds.has(r.profile_id)) {
      seeded.push({
        player_id: r.profile_id,
        wins: 0,
        losses: 0,
        matches_played: 0,
        points_for: 0,
        points_against: 0,
        point_diff: 0,
      });
    }
  }
  const levelById = new Map(
    roster.map((r) => [r.profile_id, r.level] as const),
  );
  seeded.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.point_diff !== a.point_diff) return b.point_diff - a.point_diff;
    if (b.matches_played !== a.matches_played) {
      return b.matches_played - a.matches_played;
    }
    const la = levelById.get(a.player_id);
    const lb = levelById.get(b.player_id);
    const laN = la == null ? -Infinity : la;
    const lbN = lb == null ? -Infinity : lb;
    if (lbN !== laN) return lbN - laN;
    return a.player_id < b.player_id ? -1 : a.player_id > b.player_id ? 1 : 0;
  });
  return seeded;
}
