// ARCH-04 pre-work: characterization of the Flex standings rules as they
// behave today, BEFORE the shared-scoring-core extraction. These tests pin
// current behavior — including quirks — they do not bless it.
// Swift mirror: apple/Tests/FlexStandingsTests.swift (shared-rule cases
// case-for-case identical).

import { describe, it, expect } from "vitest";
import type { FlexMatch, FlexGroupItem } from "@/hooks/useFlexTournament";
import {
  computePlayerStats,
  computeTeamStats,
  computePairStats,
  flexRankSort,
} from "../flexStats";

const P1 = "player-1";
const P2 = "player-2";
const P3 = "player-3";
const P4 = "player-4";
const T1 = "team-1";
const T2 = "team-2";

let seq = 0;
const match = (over: Partial<FlexMatch>): FlexMatch => ({
  id: `m-${++seq}`,
  tournament_id: "t",
  group_id: "g",
  parent_match_id: null,
  name: "",
  match_type: "singles",
  slot_a1_player_id: null,
  slot_a2_player_id: null,
  slot_b1_player_id: null,
  slot_b2_player_id: null,
  slot_a_team_id: null,
  slot_b_team_id: null,
  score_a: 0,
  score_b: 0,
  winner_side: null,
  counts_for_standings: true,
  display_order: 0,
  created_at: "",
  updated_at: "",
  ...over,
});

const playerItem = (playerId: string): FlexGroupItem => ({
  id: `gi-${playerId}`,
  group_id: "g",
  item_type: "player",
  player_id: playerId,
  team_id: null,
  display_order: 0,
  created_at: "",
});

const singles = (a: string, b: string, sa: number, sb: number): FlexMatch =>
  match({
    match_type: "singles",
    slot_a1_player_id: a,
    slot_b1_player_id: b,
    score_a: sa,
    score_b: sb,
    winner_side: sa > sb ? "a" : sb > sa ? "b" : null,
  });

describe("computePlayerStats", () => {
  const items = [playerItem(P1), playerItem(P2)];

  it("each match is 1 win or 1 loss; pointDiff is the signed absolute margin", () => {
    const stats = computePlayerStats({
      matches: [singles(P1, P2, 11, 7), singles(P1, P2, 5, 11)],
      groupItems: items,
      includeDoublesInSingles: true,
    });
    expect(stats.get(P1)).toEqual({ wins: 1, losses: 1, pointDiff: 4 - 6 });
    expect(stats.get(P2)).toEqual({ wins: 1, losses: 1, pointDiff: 6 - 4 });
  });

  it("skips matches without a winner and matches excluded from standings", () => {
    const stats = computePlayerStats({
      matches: [
        singles(P1, P2, 9, 9), // tie → winner_side null → skipped
        match({ ...singles(P1, P2, 11, 3), counts_for_standings: false }),
      ],
      groupItems: items,
      includeDoublesInSingles: true,
    });
    expect(stats.size).toBe(0);
  });

  it("doubles credit every player on the winning side, and is excluded when includeDoublesInSingles is off", () => {
    const doubles = match({
      match_type: "doubles",
      slot_a1_player_id: P1,
      slot_a2_player_id: P3,
      slot_b1_player_id: P2,
      slot_b2_player_id: P4,
      score_a: 11,
      score_b: 6,
      winner_side: "a",
    });
    const allItems = [P1, P2, P3, P4].map(playerItem);

    const included = computePlayerStats({ matches: [doubles], groupItems: allItems, includeDoublesInSingles: true });
    expect(included.get(P1)).toEqual({ wins: 1, losses: 0, pointDiff: 5 });
    expect(included.get(P3)).toEqual({ wins: 1, losses: 0, pointDiff: 5 });
    expect(included.get(P2)).toEqual({ wins: 0, losses: 1, pointDiff: -5 });

    const excluded = computePlayerStats({ matches: [doubles], groupItems: allItems, includeDoublesInSingles: false });
    expect(excluded.size).toBe(0);
  });

  it("players outside the group get no entry even when they played", () => {
    const stats = computePlayerStats({
      matches: [singles(P1, P3, 11, 8)],
      groupItems: [playerItem(P1)],
      includeDoublesInSingles: true,
    });
    expect(stats.get(P1)).toEqual({ wins: 1, losses: 0, pointDiff: 3 });
    expect(stats.has(P3)).toBe(false);
  });
});

describe("computeTeamStats", () => {
  const teamMatch = (sa: number, sb: number): FlexMatch =>
    match({
      slot_a_team_id: T1,
      slot_b_team_id: T2,
      score_a: sa,
      score_b: sb,
      winner_side: sa > sb ? "a" : sb > sa ? "b" : null,
    });

  it("each team match is 1 win or 1 loss with the signed margin", () => {
    const stats = computeTeamStats([teamMatch(3, 1), teamMatch(0, 2)], new Set([T1, T2]));
    expect(stats.get(T1)).toEqual({ wins: 1, losses: 1, pointDiff: 2 - 2 });
    expect(stats.get(T2)).toEqual({ wins: 1, losses: 1, pointDiff: 0 });
  });

  it("skips non-team matches, no-winner matches, non-standings matches, and teams outside the group", () => {
    const stats = computeTeamStats(
      [
        singles(P1, P2, 11, 7),
        teamMatch(2, 2),
        match({ ...teamMatch(4, 0), counts_for_standings: false }),
        teamMatch(3, 0),
      ],
      new Set([T1]),
    );
    expect(stats.get(T1)).toEqual({ wins: 1, losses: 0, pointDiff: 3 });
    expect(stats.has(T2)).toBe(false);
  });
});

describe("computePairStats", () => {
  const doubles = (a: [string, string], b: [string, string], sa: number, sb: number): FlexMatch =>
    match({
      match_type: "doubles",
      slot_a1_player_id: a[0],
      slot_a2_player_id: a[1],
      slot_b1_player_id: b[0],
      slot_b2_player_id: b[1],
      score_a: sa,
      score_b: sb,
      winner_side: sa > sb ? "a" : sb > sa ? "b" : null,
    });

  it("keys each pair by sorted ids so the same duo accumulates regardless of slot order", () => {
    const stats = computePairStats(
      [doubles([P1, P2], [P3, P4], 11, 5), doubles([P2, P1], [P3, P4], 11, 9)],
      new Set([P1, P2, P3, P4]),
    );
    const key = [P1, P2].sort().join("|");
    expect(stats.get(key)).toEqual({
      wins: 2,
      losses: 0,
      pointDiff: 6 + 2,
      player1_id: [P1, P2].sort()[0],
      player2_id: [P1, P2].sort()[1],
    });
  });

  it("counts a pair when at least one member is in the group; incomplete sides are skipped", () => {
    const halfIn = computePairStats(
      [doubles([P1, P3], [P2, P4], 11, 4)],
      new Set([P1]),
    );
    expect(halfIn.size).toBe(1); // side A counted (P1 in group), side B not

    const soloSide = computePairStats(
      [match({ match_type: "doubles", slot_a1_player_id: P1, slot_b1_player_id: P2, slot_b2_player_id: P3, score_a: 11, score_b: 6, winner_side: "a" })],
      new Set([P1, P2, P3]),
    );
    // side A has only one player → no pair entry for it
    expect([...soloSide.keys()]).toEqual([[P2, P3].sort().join("|")]);
  });

  it("skips singles matches entirely — even with two players per side", () => {
    // Full pairs on both sides so only the match_type guard can exclude it.
    const fourPlayerSingles = match({
      match_type: "singles",
      slot_a1_player_id: P1,
      slot_a2_player_id: P2,
      slot_b1_player_id: P3,
      slot_b2_player_id: P4,
      score_a: 11,
      score_b: 7,
      winner_side: "a",
    });
    const stats = computePairStats([fourPlayerSingles], new Set([P1, P2, P3, P4]));
    expect(stats.size).toBe(0);
  });

  it("skips non-standings and no-winner doubles", () => {
    const stats = computePairStats(
      [
        match({ ...doubles([P1, P2], [P3, P4], 11, 5), counts_for_standings: false }),
        doubles([P1, P2], [P3, P4], 8, 8), // tie → winner_side null
      ],
      new Set([P1, P2, P3, P4]),
    );
    expect(stats.size).toBe(0);
  });
});

describe("flexRankSort", () => {
  it("sorts by wins desc, then point diff desc", () => {
    const rows = [
      { id: "c", wins: 1, pointDiff: 9 },
      { id: "a", wins: 2, pointDiff: -3 },
      { id: "b", wins: 1, pointDiff: 12 },
    ];
    expect([...rows].sort(flexRankSort).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("returns 0 on an exact (wins, pointDiff) tie — no hidden tertiary ordering", () => {
    expect(flexRankSort({ wins: 1, pointDiff: 5 }, { wins: 1, pointDiff: 5 })).toBe(0);
  });
});
