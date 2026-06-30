import { describe, it, expect } from 'vitest';
import { assignCourtsToMatches } from '@/lib/round-robin';

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
