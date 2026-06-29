import { describe, it, expect } from 'vitest';
import {
  computeSeedingPlan,
  generateSeedingGeneral,
  generateBracketPairings,
  resolveBracketConflicts,
} from '@/lib/quick-table-seeding-v2';
import type { SeededPlayer } from '@/lib/quick-table-playoff';
import type { QuickTablePlayer, QuickTableGroup } from '@/hooks/useQuickTable';

const P = (o: Partial<QuickTablePlayer>): QuickTablePlayer => o as QuickTablePlayer;
const Grp = (id: string, name: string): QuickTableGroup => ({ id, name } as QuickTableGroup);

describe('computeSeedingPlan — formula nextPow2(G*A) - G*A', () => {
  it('A=2 (top-2 + best 3rd)', () => {
    expect(computeSeedingPlan(3, { advancePerGroup: 2 })).toMatchObject({ bracketSize: 8, wildcardCount: 2, feasible: true });
    expect(computeSeedingPlan(6, { advancePerGroup: 2 })).toMatchObject({ bracketSize: 16, wildcardCount: 4, feasible: true });
    expect(computeSeedingPlan(7, { advancePerGroup: 2 })).toMatchObject({ bracketSize: 16, wildcardCount: 2, feasible: true });
    expect(computeSeedingPlan(5, { advancePerGroup: 2 })).toMatchObject({ bracketSize: 16, wildcardCount: 6, feasible: false });
  });

  it('A=1 (winners + best runner-up) — luôn khả thi', () => {
    expect(computeSeedingPlan(3, { advancePerGroup: 1 })).toMatchObject({ bracketSize: 4, wildcardCount: 1, feasible: true });
    expect(computeSeedingPlan(6, { advancePerGroup: 1 })).toMatchObject({ bracketSize: 8, wildcardCount: 2, feasible: true });
    expect(computeSeedingPlan(5, { advancePerGroup: 1 })).toMatchObject({ bracketSize: 8, wildcardCount: 3, feasible: true });
  });
});

describe('generateSeedingGeneral — A=1, 3 bảng (nhất bảng + 1 nhì xuất sắc nhất)', () => {
  const groups = [Grp('A', 'A'), Grp('B', 'B'), Grp('C', 'C')];
  const players: QuickTablePlayer[] = [
    P({ id: 'A1', name: 'A1', group_id: 'A', matches_won: 2, point_diff: 10, points_for: 33 }),
    P({ id: 'A2', name: 'A2', group_id: 'A', matches_won: 1, point_diff: 2, points_for: 25 }),
    P({ id: 'A3', name: 'A3', group_id: 'A', matches_won: 0, point_diff: -12, points_for: 15 }),
    P({ id: 'B1', name: 'B1', group_id: 'B', matches_won: 2, point_diff: 8, points_for: 31 }),
    P({ id: 'B2', name: 'B2', group_id: 'B', matches_won: 1, point_diff: 5, points_for: 27 }),
    P({ id: 'B3', name: 'B3', group_id: 'B', matches_won: 0, point_diff: -13, points_for: 14 }),
    P({ id: 'C1', name: 'C1', group_id: 'C', matches_won: 2, point_diff: 6, points_for: 30 }),
    P({ id: 'C2', name: 'C2', group_id: 'C', matches_won: 1, point_diff: 1, points_for: 24 }),
    P({ id: 'C3', name: 'C3', group_id: 'C', matches_won: 0, point_diff: -9, points_for: 16 }),
  ];

  it('bracket = 4, gồm 3 winner + 1 runner-up tốt nhất (B2), không BYE', () => {
    const { seeded, plan } = generateSeedingGeneral(groups, players, [], { advancePerGroup: 1 });
    expect(plan.bracketSize).toBe(4);
    expect(seeded).toHaveLength(4);
    expect(seeded.filter(s => s.tier === 'winner').map(s => s.playerId).sort()).toEqual(['A1', 'B1', 'C1']);
    const wildcards = seeded.filter(s => s.tier === 'wildcard');
    expect(wildcards).toHaveLength(1);
    expect(wildcards[0].playerId).toBe('B2');
    expect(seeded.some(s => s.tier === 'bye')).toBe(false);
  });
});

describe('generateSeedingGeneral — A=2, 5 bảng (ngoại lệ: pad BYE)', () => {
  const groups = ['A', 'B', 'C', 'D', 'E'].map(n => Grp(n, n));
  const players: QuickTablePlayer[] = [];
  groups.forEach((g, gi) => {
    for (let pos = 0; pos < 3; pos++) {
      players.push(P({
        id: `${g.id}${pos + 1}`, name: `${g.id}${pos + 1}`, group_id: g.id,
        matches_won: 2 - pos, point_diff: 10 - pos * 3 - gi, points_for: 30 - pos * 4,
      }));
    }
  });

  it('10 trực tiếp + 5 hạng-3 = 15, pad 1 BYE -> bracket 16', () => {
    const { seeded, plan } = generateSeedingGeneral(groups, players, [], { advancePerGroup: 2 });
    expect(plan.bracketSize).toBe(16);
    expect(plan.feasible).toBe(false);
    expect(seeded).toHaveLength(16);
    expect(seeded.filter(s => s.tier === 'winner')).toHaveLength(5);
    expect(seeded.filter(s => s.tier === 'runner_up')).toHaveLength(5);
    expect(seeded.filter(s => s.tier === 'wildcard')).toHaveLength(5);
    expect(seeded.filter(s => s.tier === 'bye')).toHaveLength(1);
  });
});

describe('generateBracketPairings — seed 1 và seed 2 ở hai nửa đối diện', () => {
  it('bracket 8: seed#1 gặp seed#8, seed#2 gặp seed#7', () => {
    const seeded = Array.from({ length: 8 }, (_, i) => ({
      playerId: `s${i + 1}`, name: `s${i + 1}`, seed: i + 1, sourceGroupId: `g${i}`,
      wins: 0, pointDiff: 0, pointsFor: 0, tier: 'winner' as const,
    }));
    const pairings = generateBracketPairings(seeded);
    expect(pairings).toHaveLength(4);
    const m1 = pairings.find(p => p.player1.playerId === 's1' || p.player2.playerId === 's1')!;
    expect([m1.player1.playerId, m1.player2.playerId].sort()).toEqual(['s1', 's8']);
    const m2 = pairings.find(p => p.player1.playerId === 's2' || p.player2.playerId === 's2')!;
    expect([m2.player1.playerId, m2.player2.playerId].sort()).toEqual(['s2', 's7']);
  });
});

describe('wildcard cùng bảng KHÔNG gặp nhau ở vòng playoff đầu tiên', () => {
  // 6 bảng, 3 người/bảng → 12 trực tiếp + 4 wildcard = bracket 16.
  // 1 bảng có thể góp tới 3 người (nhất + nhì + hạng-3 vớt) → dễ đụng cùng bảng vòng 1.
  const groups = ['A', 'B', 'C', 'D', 'E', 'F'].map(n => Grp(n, n));
  const players: QuickTablePlayer[] = [];
  groups.forEach((g, gi) => {
    for (let pos = 0; pos < 3; pos++) {
      players.push(P({
        id: `${g.id}${pos + 1}`, name: `${g.id}${pos + 1}`, group_id: g.id,
        matches_won: 2 - pos, point_diff: 12 - pos * 3 - gi, points_for: 30 - pos * 4 - gi,
      }));
    }
  });

  it('sau resolveBracketConflicts: không cặp vòng 1 nào cùng sourceGroupId (trừ BYE)', () => {
    const { seeded } = generateSeedingGeneral(groups, players, [], { advancePerGroup: 2 });
    const pairings = generateBracketPairings(seeded);
    const { pairings: resolved, hasConflicts } = resolveBracketConflicts(pairings);
    expect(hasConflicts).toBe(false);
    for (const m of resolved) {
      if (m.player1.tier === 'bye' || m.player2.tier === 'bye') continue;
      expect(m.player1.sourceGroupId).not.toBe(m.player2.sourceGroupId);
    }
  });
});

describe('resolveBracketConflicts — anchor mạnh gặp floater yếu nhất khác bảng', () => {
  const mk = (seed: number, grp: string): SeededPlayer => ({
    playerId: `s${seed}`, name: `s${seed}`, seed, sourceGroupId: grp,
    wins: 0, pointDiff: 0, pointsFor: 0, tier: seed <= 3 ? 'winner' : seed <= 6 ? 'runner_up' : 'wildcard',
  });

  it('không xung đột → giữ NGUYÊN cặp mặc định (seed1 vs seed8, seed2 vs seed7, ...)', () => {
    // 8 seed, mỗi seed 1 bảng khác nhau → không thể trùng.
    const seeded = Array.from({ length: 8 }, (_, i) => mk(i + 1, `g${i + 1}`));
    const { pairings, hasConflicts } = resolveBracketConflicts(generateBracketPairings(seeded));
    expect(hasConflicts).toBe(false);
    const opp = (s: number) => {
      const m = pairings.find(p => p.player1.seed === s || p.player2.seed === s)!;
      return m.player1.seed === s ? m.player2.seed : m.player1.seed;
    };
    expect(opp(1)).toBe(8);
    expect(opp(2)).toBe(7);
    expect(opp(3)).toBe(6);
    expect(opp(4)).toBe(5);
  });

  it('seed1 trùng bảng với seed8 → seed1 gặp floater YẾU NHẤT khác bảng (seed7), KHÔNG phải seed mạnh', () => {
    // seed1 và seed8 cùng bảng A; còn lại khác bảng.
    const seeded = [
      mk(1, 'A'), mk(2, 'B'), mk(3, 'C'), mk(4, 'D'),
      mk(5, 'E'), mk(6, 'F'), mk(7, 'G'), mk(8, 'A'),
    ];
    const { pairings, hasConflicts } = resolveBracketConflicts(generateBracketPairings(seeded));
    expect(hasConflicts).toBe(false);
    const m1 = pairings.find(p => p.player1.seed === 1 || p.player2.seed === 1)!;
    const oppOf1 = m1.player1.seed === 1 ? m1.player2.seed : m1.player1.seed;
    expect(oppOf1).toBe(7); // floater yếu nhất khác bảng (8 bị loại do cùng bảng), KHÔNG phải 4/5/6
    for (const m of pairings) expect(m.player1.sourceGroupId).not.toBe(m.player2.sourceGroupId);
  });
});
