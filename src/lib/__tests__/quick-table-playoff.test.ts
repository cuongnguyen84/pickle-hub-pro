import { describe, it, expect } from 'vitest';
import {
  generateGlobalSeeding,
  generateSeededPairings,
  resolveGroupConflicts,
  computeBest3rdAdjustedStats,
  type SeededPlayer,
  type BracketPairing,
} from '../quick-table-playoff';
import type { QuickTablePlayer, QuickTableMatch, QuickTableGroup } from '@/hooks/useQuickTable';

// Helper to create a mock player
function mockPlayer(
  overrides: Partial<QuickTablePlayer> & { id: string; group_id: string; name: string }
): QuickTablePlayer {
  return {
    table_id: 'table-1',
    team: null,
    seed: null,
    matches_played: 3,
    matches_won: 0,
    points_for: 0,
    points_against: 0,
    point_diff: 0,
    is_qualified: null,
    is_wildcard: null,
    playoff_seed: null,
    round1_result: null,
    round2_result: null,
    round1_point_diff: null,
    is_bye: null,
    display_order: 0,
    created_at: '',
    ...overrides,
  };
}

function mockGroup(id: string, name: string): QuickTableGroup {
  return { id, table_id: 'table-1', name, display_order: 0, created_at: '' };
}

function mockMatch(
  overrides: Partial<QuickTableMatch> & { player1_id: string; player2_id: string }
): QuickTableMatch {
  return {
    id: `match-${Math.random().toString(36).slice(2, 8)}`,
    table_id: 'table-1',
    group_id: null,
    is_playoff: false,
    playoff_round: null,
    playoff_match_number: null,
    bracket_position: null,
    large_playoff_round: null,
    score1: null,
    score2: null,
    winner_id: null,
    status: 'completed',
    next_match_id: null,
    next_match_slot: null,
    display_order: 0,
    created_at: '',
    updated_at: '',
    court_id: null,
    start_at: null,
    rr_round_number: null,
    rr_match_index: null,
    ...overrides,
  };
}

function makeSeededPlayer(seed: number, groupId: string): SeededPlayer {
  return {
    playerId: `p-${seed}`,
    name: `Player ${seed}`,
    seed,
    sourceGroupId: groupId,
    wins: 16 - seed,
    pointDiff: (16 - seed) * 5,
    pointsFor: (16 - seed) * 10,
    tier: seed <= 6 ? 'winner' : seed <= 12 ? 'runner_up' : 'wildcard',
  };
}

// Build 6 groups with 4 players each for full seeding tests
function build6GroupScenario() {
  const groupIds = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'];
  const groups = groupIds.map((id, i) => mockGroup(id, String.fromCharCode(65 + i)));

  const players: QuickTablePlayer[] = [];
  const matches: QuickTableMatch[] = [];

  for (let gi = 0; gi < 6; gi++) {
    const gId = groupIds[gi];
    // 4 players per group, ranked by wins desc
    for (let pi = 0; pi < 4; pi++) {
      const wins = 3 - pi; // 3, 2, 1, 0
      const pf = (3 - pi) * 21;
      const pa = pi * 21;
      players.push(
        mockPlayer({
          id: `g${gi + 1}-p${pi + 1}`,
          group_id: gId,
          name: `G${gi + 1} P${pi + 1}`,
          matches_won: wins,
          points_for: pf,
          points_against: pa,
          point_diff: pf - pa,
        })
      );
    }

    // Create matches within group (round-robin of 4)
    const groupPlayerIds = [`g${gi + 1}-p1`, `g${gi + 1}-p2`, `g${gi + 1}-p3`, `g${gi + 1}-p4`];
    for (let a = 0; a < 4; a++) {
      for (let b = a + 1; b < 4; b++) {
        // Higher-ranked player wins
        const score1 = a < b ? 21 : 0;
        const score2 = a < b ? 0 : 21;
        matches.push(
          mockMatch({
            group_id: gId,
            player1_id: groupPlayerIds[a],
            player2_id: groupPlayerIds[b],
            score1,
            score2,
            winner_id: a < b ? groupPlayerIds[a] : groupPlayerIds[b],
          })
        );
      }
    }
  }

  return { groups, players, matches };
}

describe('generateGlobalSeeding', () => {
  it('should produce 16 seeded players for 6 groups', () => {
    const { groups, players, matches } = build6GroupScenario();
    const seeded = generateGlobalSeeding(groups, players, matches);

    expect(seeded).toHaveLength(16);
  });

  it('seeds 1-6 should be group winners, 7-12 runners-up, 13-16 wildcards', () => {
    const { groups, players, matches } = build6GroupScenario();
    const seeded = generateGlobalSeeding(groups, players, matches);

    for (let i = 0; i < 6; i++) {
      expect(seeded[i].tier).toBe('winner');
      expect(seeded[i].seed).toBe(i + 1);
    }
    for (let i = 6; i < 12; i++) {
      expect(seeded[i].tier).toBe('runner_up');
      expect(seeded[i].seed).toBe(i + 1);
    }
    for (let i = 12; i < 16; i++) {
      expect(seeded[i].tier).toBe('wildcard');
      expect(seeded[i].seed).toBe(i + 1);
    }
  });
});

describe('generateSeededPairings', () => {
  it('should pair 1v16, 2v15, ..., 8v9', () => {
    const seeded: SeededPlayer[] = [];
    for (let i = 1; i <= 16; i++) {
      seeded.push(makeSeededPlayer(i, `g${((i - 1) % 6) + 1}`));
    }

    const pairings = generateSeededPairings(seeded);

    expect(pairings).toHaveLength(8);
    expect(pairings[0].player1.seed).toBe(1);
    expect(pairings[0].player2.seed).toBe(16);
    expect(pairings[7].player1.seed).toBe(8);
    expect(pairings[7].player2.seed).toBe(9);
  });
});

describe('resolveGroupConflicts', () => {
  it('should return no conflicts when all pairs are from different groups', () => {
    const pairings: BracketPairing[] = [];
    for (let i = 0; i < 8; i++) {
      pairings.push({
        player1: makeSeededPlayer(i + 1, `g${i + 1}`),
        player2: makeSeededPlayer(16 - i, `g${16 - i}`),
        matchNumber: i + 1,
      });
    }

    const result = resolveGroupConflicts(pairings);

    expect(result.hasConflicts).toBe(false);
    expect(result.unresolvedPairs).toHaveLength(0);
  });

  it('should auto-resolve a single conflict by swapping lower seeds', () => {
    // Seed 1 and Seed 16 both from group g1
    const pairings: BracketPairing[] = [
      {
        player1: makeSeededPlayer(1, 'g1'),
        player2: makeSeededPlayer(16, 'g1'), // same group conflict
        matchNumber: 1,
      },
      {
        player1: makeSeededPlayer(2, 'g2'),
        player2: makeSeededPlayer(15, 'g3'), // no conflict
        matchNumber: 2,
      },
      ...Array.from({ length: 6 }, (_, i) => ({
        player1: makeSeededPlayer(i + 3, `g${i + 3}`),
        player2: makeSeededPlayer(13 - i, `g${13 - i}`),
        matchNumber: i + 3,
      })),
    ];

    const result = resolveGroupConflicts(pairings);

    expect(result.hasConflicts).toBe(false);
    // Seed 16 should have been swapped away from pair 0
    expect(result.pairings[0].player1.sourceGroupId).not.toBe(
      result.pairings[0].player2.sourceGroupId
    );
  });

  it('should auto-resolve multiple conflicts', () => {
    // Two conflicts: pair 0 (both g1), pair 1 (both g2)
    const pairings: BracketPairing[] = [
      {
        player1: makeSeededPlayer(1, 'g1'),
        player2: makeSeededPlayer(16, 'g1'),
        matchNumber: 1,
      },
      {
        player1: makeSeededPlayer(2, 'g2'),
        player2: makeSeededPlayer(15, 'g2'),
        matchNumber: 2,
      },
      {
        player1: makeSeededPlayer(3, 'g3'),
        player2: makeSeededPlayer(14, 'g4'),
        matchNumber: 3,
      },
      {
        player1: makeSeededPlayer(4, 'g4'),
        player2: makeSeededPlayer(13, 'g3'),
        matchNumber: 4,
      },
      {
        player1: makeSeededPlayer(5, 'g5'),
        player2: makeSeededPlayer(12, 'g6'),
        matchNumber: 5,
      },
      {
        player1: makeSeededPlayer(6, 'g6'),
        player2: makeSeededPlayer(11, 'g5'),
        matchNumber: 6,
      },
      {
        player1: makeSeededPlayer(7, 'g1'),
        player2: makeSeededPlayer(10, 'g4'),
        matchNumber: 7,
      },
      {
        player1: makeSeededPlayer(8, 'g2'),
        player2: makeSeededPlayer(9, 'g3'),
        matchNumber: 8,
      },
    ];

    const result = resolveGroupConflicts(pairings);

    expect(result.hasConflicts).toBe(false);
    for (const p of result.pairings) {
      expect(p.player1.sourceGroupId).not.toBe(p.player2.sourceGroupId);
    }
  });

  it('should flag unresolvable conflicts when all swap targets create new conflicts', () => {
    // Extreme edge case: all players from same group
    const pairings: BracketPairing[] = Array.from({ length: 8 }, (_, i) => ({
      player1: makeSeededPlayer(i + 1, 'g1'),
      player2: makeSeededPlayer(16 - i, 'g1'),
      matchNumber: i + 1,
    }));

    const result = resolveGroupConflicts(pairings);

    expect(result.hasConflicts).toBe(true);
    expect(result.unresolvedPairs.length).toBeGreaterThan(0);
  });
});

describe('computeBest3rdAdjustedStats', () => {
  it('should only count matches against top-2 players', () => {
    const thirdPlayer = mockPlayer({
      id: 'p3',
      group_id: 'g1',
      name: 'Third',
      matches_won: 1,
    });

    const top2 = new Set(['p1', 'p2']);

    const matches: QuickTableMatch[] = [
      // Match vs p1 (top 2): p3 wins 21-15
      mockMatch({ player1_id: 'p3', player2_id: 'p1', score1: 21, score2: 15, group_id: 'g1' }),
      // Match vs p2 (top 2): p3 loses 10-21
      mockMatch({ player1_id: 'p2', player2_id: 'p3', score1: 21, score2: 10, group_id: 'g1' }),
      // Match vs p4 (NOT top 2): p3 wins 21-5 — should be EXCLUDED
      mockMatch({ player1_id: 'p3', player2_id: 'p4', score1: 21, score2: 5, group_id: 'g1' }),
    ];

    const result = computeBest3rdAdjustedStats(thirdPlayer, matches, top2);

    // vs p1: +6, vs p2: -11 => total = -5
    expect(result.adjustedPointDiff).toBe(-5);
    // vs p1: 21, vs p2: 10 => total = 31
    expect(result.adjustedPointsFor).toBe(31);
    // Only won vs p1
    expect(result.adjustedWins).toBe(1);
  });

  it('should correctly sort 6 third-place players with equal wins by adjusted point diff', () => {
    // All third-place players have 1 win overall, but different adjusted stats
    const top2Sets = new Map<string, Set<string>>([
      ['g1', new Set(['g1-p1', 'g1-p2'])],
      ['g2', new Set(['g2-p1', 'g2-p2'])],
      ['g3', new Set(['g3-p1', 'g3-p2'])],
      ['g4', new Set(['g4-p1', 'g4-p2'])],
      ['g5', new Set(['g5-p1', 'g5-p2'])],
      ['g6', new Set(['g6-p1', 'g6-p2'])],
    ]);

    const thirdPlayers = [
      { id: 'g1-p3', groupId: 'g1', adjDiff: 10 },
      { id: 'g2-p3', groupId: 'g2', adjDiff: -5 },
      { id: 'g3-p3', groupId: 'g3', adjDiff: 15 },
      { id: 'g4-p3', groupId: 'g4', adjDiff: 3 },
      { id: 'g5-p3', groupId: 'g5', adjDiff: -2 },
      { id: 'g6-p3', groupId: 'g6', adjDiff: 8 },
    ];

    const allMatches: QuickTableMatch[] = [];
    for (const tp of thirdPlayers) {
      const top2 = top2Sets.get(tp.groupId);
      if (!top2) continue;
      const [top1Id, top2Id] = Array.from(top2);

      // Create matches so that adjusted point diff matches the desired value
      // Match vs top1: score = 21 vs (21 - adjDiff), effectively controlling diff
      const halfDiff = Math.floor(tp.adjDiff / 2);
      const s1_1 = 21;
      const s1_2 = 21 - halfDiff;
      const remainDiff = tp.adjDiff - halfDiff;
      const s2_1 = 21;
      const s2_2 = 21 - remainDiff;

      allMatches.push(
        mockMatch({
          player1_id: tp.id,
          player2_id: top1Id,
          score1: s1_1,
          score2: s1_2,
          group_id: tp.groupId,
        }),
        mockMatch({
          player1_id: tp.id,
          player2_id: top2Id,
          score1: s2_1,
          score2: s2_2,
          group_id: tp.groupId,
        })
      );
    }

    // Compute adjusted stats and sort
    const withAdjusted = thirdPlayers.map(tp => {
      const player = mockPlayer({
        id: tp.id,
        group_id: tp.groupId,
        name: tp.id,
        matches_won: 1,
      });
      const top2 = top2Sets.get(tp.groupId) || new Set<string>();
      const stats = computeBest3rdAdjustedStats(player, allMatches, top2);
      return { ...tp, stats };
    });

    withAdjusted.sort((a, b) => {
      if (b.stats.adjustedPointDiff !== a.stats.adjustedPointDiff) {
        return b.stats.adjustedPointDiff - a.stats.adjustedPointDiff;
      }
      return b.stats.adjustedPointsFor - a.stats.adjustedPointsFor;
    });

    // Expected order by adjDiff: g3(15), g1(10), g6(8), g4(3), g5(-2), g2(-5)
    expect(withAdjusted[0].id).toBe('g3-p3');
    expect(withAdjusted[1].id).toBe('g1-p3');
    expect(withAdjusted[2].id).toBe('g6-p3');
    expect(withAdjusted[3].id).toBe('g4-p3');

    // Top 4 qualify
    const qualified = withAdjusted.slice(0, 4).map(p => p.id);
    expect(qualified).toContain('g3-p3');
    expect(qualified).toContain('g1-p3');
    expect(qualified).toContain('g6-p3');
    expect(qualified).toContain('g4-p3');
    expect(qualified).not.toContain('g5-p3');
    expect(qualified).not.toContain('g2-p3');
  });
});
