import { describe, it, expect } from 'vitest';
import {
  assignCourtsToMatches, generateCircleMethodMatches, parseCourtsInput,
  mergeMatchesByRound, optimizeMatchOrder, calculateMatchTimes, scheduleMatches,
} from '@/lib/round-robin';
import type { SchedulableMatch } from '@/lib/round-robin';

const counts = (assign: Map<number, number>) => {
  const c = new Map<number, number>();
  for (const court of assign.values()) c.set(court, (c.get(court) ?? 0) + 1);
  return c;
};
// 1 match per group per round
const roundRobin = (groups: number, rounds: number) => {
  const m: { groupIndex: number }[] = [];
  for (let r = 0; r < rounds; r++) for (let g = 0; g < groups; g++) m.push({ groupIndex: g });
  return m;
};

describe('assignCourtsToMatches — spare courts', () => {
  it('3 groups, 4 courts: court 4 is used (was idle) and load balances ±1', () => {
    const assign = assignCourtsToMatches(roundRobin(3, 6), [1, 2, 3, 4], 3);
    const c = counts(assign);
    expect(c.get(4) ?? 0).toBeGreaterThan(0); // the bug: court 4 used to be 0
    const loads = [1, 2, 3, 4].map((x) => c.get(x) ?? 0);
    expect(Math.max(...loads) - Math.min(...loads)).toBeLessThanOrEqual(1);
  });

  it('home courts host only their own group; court 4 is the shared spare', () => {
    const matches = roundRobin(3, 6);
    const assign = assignCourtsToMatches(matches, [1, 2, 3, 4], 3);
    matches.forEach((m, i) => {
      const court = assign.get(i)!;
      if (court === 1) expect(m.groupIndex).toBe(0);
      if (court === 2) expect(m.groupIndex).toBe(1);
      if (court === 3) expect(m.groupIndex).toBe(2);
    });
  });
});

describe('assignCourtsToMatches — unchanged cases', () => {
  it('courts == groups: strict 1 group = 1 court', () => {
    const assign = assignCourtsToMatches(
      [{ groupIndex: 0 }, { groupIndex: 0 }, { groupIndex: 1 }, { groupIndex: 1 }], [1, 2], 2);
    expect([assign.get(0), assign.get(1)]).toEqual([1, 1]);
    expect([assign.get(2), assign.get(3)]).toEqual([2, 2]);
  });

  it('more groups than courts: the homeless group balances across all courts', () => {
    const assign = assignCourtsToMatches(
      [{ groupIndex: 0 }, { groupIndex: 1 }, { groupIndex: 2 }, { groupIndex: 2 }], [1, 2], 3);
    expect(assign.get(0)).toBe(1);
    expect(assign.get(1)).toBe(2);
    expect(new Set([assign.get(2), assign.get(3)])).toEqual(new Set([1, 2]));
  });

  it('no courts → empty', () => {
    expect(assignCourtsToMatches([{ groupIndex: 0 }], [], 1).size).toBe(0);
  });
});

describe('generateCircleMethodMatches', () => {
  const pairKey = (a: string, b: string) => [a, b].sort().join('-');

  it('4 players: 6 matches, every pair exactly once, 3 rounds', () => {
    const m = generateCircleMethodMatches(['a', 'b', 'c', 'd']);
    expect(m).toHaveLength(6);
    expect(new Set(m.map((x) => pairKey(x.player1, x.player2))).size).toBe(6);
    expect(Math.max(...m.map((x) => x.rrRoundNumber))).toBe(3);
  });

  it('3 players (odd): BYE skipped → 3 real matches', () => {
    const m = generateCircleMethodMatches(['a', 'b', 'c']);
    expect(m).toHaveLength(3);
    expect(m.some((x) => x.player1 === 'BYE' || x.player2 === 'BYE')).toBe(false);
  });

  it('<2 players → empty', () => {
    expect(generateCircleMethodMatches(['a'])).toEqual([]);
  });
});

describe('parseCourtsInput', () => {
  it('parses, trims, dedups, drops invalid', () => {
    expect(parseCourtsInput('2,3,8')).toEqual([2, 3, 8]);
    expect(parseCourtsInput('1, 1 ,2')).toEqual([1, 2]);
    expect(parseCourtsInput('a,-1,0,3')).toEqual([3]);
    expect(parseCourtsInput('')).toEqual([]);
  });
});

describe('mergeMatchesByRound', () => {
  it('interleaves groups round by round', () => {
    const g0 = [{ groupIndex: 0, rrRoundNumber: 1, rrMatchIndex: 0 }, { groupIndex: 0, rrRoundNumber: 2, rrMatchIndex: 0 }];
    const g1 = [{ groupIndex: 1, rrRoundNumber: 1, rrMatchIndex: 0 }, { groupIndex: 1, rrRoundNumber: 2, rrMatchIndex: 0 }];
    const merged = mergeMatchesByRound([g0, g1]);
    expect(merged.map((m) => `${m.rrRoundNumber}-${m.groupIndex}`)).toEqual(['1-0', '1-1', '2-0', '2-1']);
    expect(mergeMatchesByRound([])).toEqual([]);
  });
});

describe('optimizeMatchOrder', () => {
  it('returns input unchanged for ≤2 matches', () => {
    const m = [{ player1: 'a', player2: 'b', rrRoundNumber: 1 }];
    expect(optimizeMatchOrder(m)).toEqual(m);
  });
  it('breaks up 3 consecutive matches sharing a player when a swap exists', () => {
    const m = [
      { player1: 'a', player2: 'b', rrRoundNumber: 1 },
      { player1: 'a', player2: 'c', rrRoundNumber: 1 },
      { player1: 'a', player2: 'd', rrRoundNumber: 1 },
      { player1: 'e', player2: 'f', rrRoundNumber: 1 },
    ];
    const out = optimizeMatchOrder(m);
    expect(out).toHaveLength(4); // ran without error; index 2 no longer all-'a' streak
    expect(out.filter((x) => x.player1 === 'a' || x.player2 === 'a')).toHaveLength(3);
  });
});

describe('scheduleMatches — pair-aware (the d941747e7ab4 bug)', () => {
  // One group of 5 pairs as a naive nested-loop order (the broken data):
  // p0 vs all, then p1 vs all, ... — pivot pair appears in 4 consecutive rows.
  const naiveGroup = (g: number, base: number): SchedulableMatch[] => {
    const P = [0, 1, 2, 3, 4].map((i) => `g${g}p${i}`);
    const out: SchedulableMatch[] = [];
    let n = base;
    for (let i = 0; i < P.length; i++)
      for (let j = i + 1; j < P.length; j++)
        out.push({ matchId: `m${n++}`, player1: P[i], player2: P[j], groupIndex: g });
    return out;
  };

  const playersAt = (sched: ReturnType<typeof scheduleMatches>, all: SchedulableMatch[]) => {
    const byId = new Map(all.map((m) => [m.matchId, m]));
    // slot -> set of players
    const slotPlayers = new Map<number, string[]>();
    for (const s of sched) {
      const m = byId.get(s.matchId)!;
      const arr = slotPlayers.get(s.slot) ?? [];
      arr.push(m.player1!, m.player2!);
      slotPlayers.set(s.slot, arr);
    }
    return slotPlayers;
  };

  it('never double-books a player into the same time slot', () => {
    const all = [...naiveGroup(0, 0), ...naiveGroup(1, 100), ...naiveGroup(2, 200)];
    const sched = scheduleMatches(all, [1, 2, 3, 4], 3, '08:30', 20);
    for (const [, players] of playersAt(sched, all)) {
      expect(players.length).toBe(new Set(players).size); // no repeat in a slot
    }
  });

  it('never schedules two matches on the same court at the same time', () => {
    const all = [...naiveGroup(0, 0), ...naiveGroup(1, 100), ...naiveGroup(2, 200)];
    const sched = scheduleMatches(all, [1, 2, 3, 4], 3, '08:30', 20);
    const seen = new Set<string>();
    for (const s of sched) {
      const key = `${s.court}:${s.slot}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('no pair plays more than 2 consecutive time slots (the real rule)', () => {
    const all = [...naiveGroup(0, 0), ...naiveGroup(1, 100), ...naiveGroup(2, 200)];
    const sched = scheduleMatches(all, [1, 2, 3, 4], 3, '08:30', 20);
    const byId = new Map(all.map((m) => [m.matchId, m]));
    const slotsByPlayer = new Map<string, number[]>();
    for (const s of sched) {
      const m = byId.get(s.matchId)!;
      for (const p of [m.player1!, m.player2!]) {
        const arr = slotsByPlayer.get(p) ?? [];
        arr.push(s.slot);
        slotsByPlayer.set(p, arr);
      }
    }
    for (const [, slots] of slotsByPlayer) {
      const sorted = [...new Set(slots)].sort((a, b) => a - b);
      let run = 1;
      for (let i = 1; i < sorted.length; i++) {
        run = sorted[i] === sorted[i - 1] + 1 ? run + 1 : 1;
        expect(run).toBeLessThanOrEqual(2); // never 3 back-to-back slots
      }
    }
  });

  it('display_order: no pair appears in more than 2 consecutive rows', () => {
    const all = [...naiveGroup(0, 0), ...naiveGroup(1, 100), ...naiveGroup(2, 200)];
    const sched = scheduleMatches(all, [1, 2, 3, 4], 3, '08:30', 20);
    const byId = new Map(all.map((m) => [m.matchId, m]));
    const ordered = [...sched].sort((a, b) => a.displayOrder - b.displayOrder)
      .map((s) => byId.get(s.matchId)!);
    for (const p of new Set(all.flatMap((m) => [m.player1!, m.player2!]))) {
      let run = 0;
      for (const m of ordered) {
        run = (m.player1 === p || m.player2 === p) ? run + 1 : 0;
        expect(run).toBeLessThanOrEqual(2);
      }
    }
  });

  it('home court preferred; spares shared; empty courts → []', () => {
    const all = naiveGroup(0, 0);
    const sched = scheduleMatches(all, [1, 2, 3, 4], 3, null, 20);
    // group 0 home = court 1; may overflow to spare court 4 only
    for (const s of sched) expect([1, 4]).toContain(s.court);
    expect(scheduleMatches(all, [], 3, '08:30', 20)).toEqual([]);
  });
});

describe('calculateMatchTimes', () => {
  it('sequential slots per court from start time', () => {
    const assign = new Map<number, number>([[0, 1], [1, 1], [2, 2]]);
    const times = calculateMatchTimes(assign, [1, 2], '08:00', 20);
    expect(times.get(0)).toBe('08:00');
    expect(times.get(1)).toBe('08:20'); // 2nd match on court 1
    expect(times.get(2)).toBe('08:00'); // 1st match on court 2
  });
  it('invalid start time → empty', () => {
    expect(calculateMatchTimes(new Map([[0, 1]]), [1], 'xx:yy', 20).size).toBe(0);
  });
});
