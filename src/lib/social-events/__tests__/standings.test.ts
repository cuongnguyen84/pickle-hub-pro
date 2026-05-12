import { describe, it, expect } from "vitest";
import {
  computeStandings,
  findStanding,
  seedStandingsWithRoster,
  type MatchInput,
  type RosterEntry,
} from "../standings";

// ============================================================================
// Helpers — concise match builders so cases read like prose.
// ============================================================================

function match(
  id: string,
  a: [string, string | null],
  b: [string, string | null],
  scoreA: number,
  scoreB: number,
  status: MatchInput["status"] = "completed",
  winning?: "a" | "b" | null,
): MatchInput {
  return {
    id,
    team_a_player1_id: a[0],
    team_a_player2_id: a[1],
    team_b_player1_id: b[0],
    team_b_player2_id: b[1],
    team_a_score: status === "completed" ? scoreA : null,
    team_b_score: status === "completed" ? scoreB : null,
    status,
    winning_team:
      winning !== undefined
        ? winning
        : status !== "completed"
          ? null
          : scoreA > scoreB
            ? "a"
            : scoreA < scoreB
              ? "b"
              : null,
  };
}

describe("computeStandings", () => {
  it("returns empty when no matches", () => {
    expect(computeStandings([])).toEqual([]);
  });

  it("ignores scheduled matches", () => {
    const m = match("m1", ["p1", "p2"], ["p3", "p4"], 0, 0, "scheduled");
    expect(computeStandings([m])).toEqual([]);
  });

  it("ignores in_progress matches", () => {
    const m = match("m1", ["p1", "p2"], ["p3", "p4"], 5, 3, "in_progress");
    expect(computeStandings([m])).toEqual([]);
  });

  it("ignores completed match with null score", () => {
    const m: MatchInput = {
      id: "m1",
      team_a_player1_id: "p1",
      team_a_player2_id: "p2",
      team_b_player1_id: "p3",
      team_b_player2_id: "p4",
      team_a_score: null,
      team_b_score: 11,
      status: "completed",
      winning_team: "b",
    };
    expect(computeStandings([m])).toEqual([]);
  });

  it("counts a single match as 4 rows, all matches_played=1", () => {
    const m = match("m1", ["p1", "p2"], ["p3", "p4"], 11, 7);
    const rows = computeStandings([m]);
    expect(rows).toHaveLength(4);
    rows.forEach((r) => expect(r.matches_played).toBe(1));
  });

  it("awards wins to winning_team='a' players", () => {
    const m = match("m1", ["p1", "p2"], ["p3", "p4"], 11, 7);
    const rows = computeStandings([m]);
    const p1 = findStanding(rows, "p1")!;
    const p3 = findStanding(rows, "p3")!;
    expect(p1.wins).toBe(1);
    expect(p1.losses).toBe(0);
    expect(p3.wins).toBe(0);
    expect(p3.losses).toBe(1);
  });

  it("awards wins to winning_team='b' players", () => {
    const m = match("m1", ["p1", "p2"], ["p3", "p4"], 5, 11);
    const rows = computeStandings([m]);
    const p1 = findStanding(rows, "p1")!;
    const p3 = findStanding(rows, "p3")!;
    expect(p1.wins).toBe(0);
    expect(p3.wins).toBe(1);
  });

  it("treats tied score as no win for either side but counts the match", () => {
    const m = match("m1", ["p1", "p2"], ["p3", "p4"], 9, 9, "completed", null);
    const rows = computeStandings([m]);
    rows.forEach((r) => {
      expect(r.wins).toBe(0);
      expect(r.losses).toBe(0);
      expect(r.matches_played).toBe(1);
    });
  });

  it("sums points_for / points_against / point_diff across matches", () => {
    const m1 = match("m1", ["p1", "p2"], ["p3", "p4"], 11, 7);
    const m2 = match("m2", ["p1", "p3"], ["p2", "p4"], 5, 11);
    const rows = computeStandings([m1, m2]);
    const p1 = findStanding(rows, "p1")!;
    // p1 in m1: 11 for, 7 against. p1 in m2: 5 for, 11 against.
    expect(p1.points_for).toBe(16);
    expect(p1.points_against).toBe(18);
    expect(p1.point_diff).toBe(-2);
    expect(p1.wins).toBe(1);
    expect(p1.losses).toBe(1);
  });

  it("supports a player teamed with a null partner (bye-style)", () => {
    const m = match("m1", ["p1", null], ["p2", "p3"], 11, 5);
    const rows = computeStandings([m]);
    expect(findStanding(rows, "p1")?.wins).toBe(1);
    expect(findStanding(rows, "p2")?.losses).toBe(1);
    expect(findStanding(rows, "p3")?.losses).toBe(1);
  });

  it("skips matches with no players on team A", () => {
    const m = match("m1", [null as unknown as string, null], ["p1", "p2"], 0, 11);
    // Both team A slots are null → teamA.length = 0 → skip
    expect(computeStandings([m])).toEqual([]);
  });

  it("skips matches with no players on team B", () => {
    const m = match("m1", ["p1", "p2"], [null as unknown as string, null], 11, 0);
    expect(computeStandings([m])).toEqual([]);
  });

  it("sorts by wins descending", () => {
    const matches = [
      match("m1", ["p1", "x"], ["p2", "y"], 11, 5), // p1 wins
      match("m2", ["p1", "x"], ["p2", "y"], 11, 5), // p1 wins
      match("m3", ["p3", "z"], ["p1", "x"], 11, 5), // p3 wins, p1 loss
    ];
    const rows = computeStandings(matches);
    expect(rows[0].player_id).toBe("p1");
    expect(rows[0].wins).toBe(2);
  });

  it("breaks tie on wins by point_diff", () => {
    const matches = [
      match("m1", ["p1", "px"], ["p2", "py"], 11, 9), // p1 wins by 2
      match("m2", ["p3", "pz"], ["p4", "pw"], 11, 3), // p3 wins by 8
    ];
    const rows = computeStandings(matches);
    expect(rows[0].player_id).toBe("p3"); // higher point_diff first
    expect(rows[1].player_id).toBe("pz");
  });

  it("breaks tie on wins + point_diff by matches_played", () => {
    const matches = [
      match("m1", ["p1", "px"], ["p2", "py"], 11, 9), // p1 wins by 2, played 1
      match("m2", ["p3", "pz"], ["p4", "pw"], 11, 9), // p3 wins by 2, played 1
      match("m3", ["p3", "pz"], ["p4", "pw"], 9, 11), // p3 loss, balance 0
    ];
    const rows = computeStandings(matches);
    // p1 wins=1 diff=+2 mp=1; p3 wins=1 diff=0 mp=2
    expect(rows[0].player_id).toBe("p1");
  });

  it("breaks ties deterministically by player_id ASC", () => {
    const matches = [
      match("m1", ["p2", "xx"], ["p1", "xy"], 0, 11),
      // p1 wins 1, diff +11, mp 1 — same record as p2 losing? No, p1 wins.
      // To force a true full tie:
      match("m2", ["p3", "yz"], ["p4", "yw"], 11, 5),
      match("m3", ["p5", "zz"], ["p6", "zw"], 11, 5),
    ];
    const rows = computeStandings(matches);
    // p1, p3, p5 all have wins=1, point_diff varies. p1 has +11, p3 has +6, p5 has +6.
    // For a strict tie test, simpler:
    const tiedMatches = [
      match("ma", ["a1", "aa"], ["b1", "bb"], 11, 6),
      match("mb", ["a2", "ax"], ["b2", "by"], 11, 6),
    ];
    const tiedRows = computeStandings(tiedMatches);
    // Winners: a1, aa, a2, ax — all 1W 0L diff +5 mp 1. Sorted by id ASC.
    const winnerIds = tiedRows
      .filter((r) => r.wins === 1)
      .map((r) => r.player_id);
    expect(winnerIds).toEqual([...winnerIds].sort());
    void rows; // exercise the upper case as well
  });

  it("includes both winners of a single match in the result", () => {
    const m = match("m1", ["p1", "p2"], ["p3", "p4"], 11, 3);
    const rows = computeStandings([m]);
    expect(findStanding(rows, "p1")?.wins).toBe(1);
    expect(findStanding(rows, "p2")?.wins).toBe(1);
    expect(findStanding(rows, "p3")?.losses).toBe(1);
    expect(findStanding(rows, "p4")?.losses).toBe(1);
  });

  it("accumulates matches_played correctly across rounds", () => {
    const matches = [
      match("m1", ["p1", "p2"], ["p3", "p4"], 11, 5),
      match("m2", ["p1", "p3"], ["p2", "p4"], 11, 5),
      match("m3", ["p1", "p4"], ["p2", "p3"], 5, 11),
    ];
    const rows = computeStandings(matches);
    expect(findStanding(rows, "p1")?.matches_played).toBe(3);
    expect(findStanding(rows, "p2")?.matches_played).toBe(3);
    expect(findStanding(rows, "p3")?.matches_played).toBe(3);
    expect(findStanding(rows, "p4")?.matches_played).toBe(3);
  });

  it("returns rows only for players who actually played", () => {
    const m = match("m1", ["p1", "p2"], ["p3", "p4"], 11, 5);
    const rows = computeStandings([m]);
    expect(rows.find((r) => r.player_id === "p99")).toBeUndefined();
  });

  it("does not award a win when winning_team is null but scores differ", () => {
    // Defensive: malformed row where winning_team was never set despite
    // unequal scores. Treat as 0/0 for wins/losses but still count match.
    const m: MatchInput = {
      id: "m1",
      team_a_player1_id: "p1",
      team_a_player2_id: "p2",
      team_b_player1_id: "p3",
      team_b_player2_id: "p4",
      team_a_score: 11,
      team_b_score: 5,
      status: "completed",
      winning_team: null,
    };
    const rows = computeStandings([m]);
    rows.forEach((r) => {
      expect(r.wins).toBe(0);
      expect(r.losses).toBe(0);
      expect(r.matches_played).toBe(1);
    });
  });

  it("handles a 3-round 8-player Mexicano shape", () => {
    const matches = [
      match("r1c1", ["a", "b"], ["c", "d"], 11, 7),
      match("r1c2", ["e", "f"], ["g", "h"], 11, 9),
      match("r2c1", ["a", "e"], ["b", "f"], 11, 5),
      match("r2c2", ["c", "g"], ["d", "h"], 11, 5),
      match("r3c1", ["a", "g"], ["e", "c"], 11, 7),
      match("r3c2", ["b", "h"], ["f", "d"], 7, 11),
    ];
    const rows = computeStandings(matches);
    // Each player plays 3 matches.
    rows.forEach((r) => expect(r.matches_played).toBe(3));
    // a wins all 3
    expect(findStanding(rows, "a")?.wins).toBe(3);
  });
});

describe("findStanding", () => {
  it("returns null when standings is empty", () => {
    expect(findStanding([], "p1")).toBeNull();
  });

  it("returns null when player not found", () => {
    const m = match("m1", ["p1", "p2"], ["p3", "p4"], 11, 5);
    const rows = computeStandings([m]);
    expect(findStanding(rows, "stranger")).toBeNull();
  });

  it("returns the matching row when found", () => {
    const m = match("m1", ["p1", "p2"], ["p3", "p4"], 11, 5);
    const rows = computeStandings([m]);
    const r = findStanding(rows, "p1");
    expect(r?.wins).toBe(1);
  });
});

describe("seedStandingsWithRoster", () => {
  const roster: RosterEntry[] = [
    { profile_id: "p1", level: 4.5 },
    { profile_id: "p2", level: 3.5 },
    { profile_id: "p3", level: 4.0 },
    { profile_id: "p4", level: null },
  ];

  it("returns 0-0 rows for everyone when no matches have completed", () => {
    const out = seedStandingsWithRoster([], roster);
    expect(out).toHaveLength(4);
    out.forEach((r) => {
      expect(r.wins).toBe(0);
      expect(r.losses).toBe(0);
      expect(r.matches_played).toBe(0);
    });
  });

  it("sorts seeded 0-0 rows by level desc, nulls last", () => {
    const out = seedStandingsWithRoster([], roster);
    expect(out.map((r) => r.player_id)).toEqual(["p1", "p3", "p2", "p4"]);
  });

  it("preserves base standings ordering when wins differ", () => {
    const matches = [
      match("m1", ["p1", "p2"], ["p3", "p4"], 11, 7), // p1 + p2 win
    ];
    const base = computeStandings(matches);
    const out = seedStandingsWithRoster(base, roster);
    // p1 has 1 win, p2 has 1 win, p3 + p4 each have 0 wins.
    // Among winners, p1 (level 4.5) ranks above p2 (level 3.5) per the
    // level tiebreaker. Among losers, p3 (level 4.0) ranks above p4 (null).
    expect(out.map((r) => r.player_id)).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("doesn't duplicate players already in the base standings", () => {
    const matches = [match("m1", ["p1", "p2"], ["p3", "p4"], 11, 5)];
    const base = computeStandings(matches);
    const out = seedStandingsWithRoster(base, roster);
    expect(out).toHaveLength(4); // not 8
    expect(new Set(out.map((r) => r.player_id)).size).toBe(4);
  });

  it("does not mutate input arrays", () => {
    const matches = [match("m1", ["p1", "p2"], ["p3", "p4"], 11, 5)];
    const base = computeStandings(matches);
    const baseSnapshot = JSON.parse(JSON.stringify(base));
    const rosterSnapshot = JSON.parse(JSON.stringify(roster));
    seedStandingsWithRoster(base, roster);
    expect(base).toEqual(baseSnapshot);
    expect(roster).toEqual(rosterSnapshot);
  });

  it("supports an empty roster (passthrough on base)", () => {
    const matches = [match("m1", ["p1", "p2"], ["p3", "p4"], 11, 5)];
    const base = computeStandings(matches);
    const out = seedStandingsWithRoster(base, []);
    // No seeding happened; the sort with no level info falls back to
    // player_id ASC after the wins/diff/mp keys (winners still rank
    // above losers).
    expect(out).toHaveLength(base.length);
    expect(out.filter((r) => r.wins === 1).map((r) => r.player_id)).toEqual([
      "p1",
      "p2",
    ]);
  });
});
