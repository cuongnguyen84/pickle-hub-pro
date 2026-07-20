// ARCH-03 — pins the Team Match playoff propagation, in particular the
// third-place slot claim that DB-00 confirmed as a live lost-update race
// (DB-02a fixed the same shape for DoublesElimination and never covered
// this path).
//
// The supabase client is replaced with a recording fluent builder: every
// chained call is captured, and a per-test script decides what each query
// resolves to. That lets us replay the exact interleaving that used to drop
// a semifinal loser — the first slot claim losing the race — without a
// database.

import { describe, it, expect, beforeEach, vi } from 'vitest';

interface RecordedQuery {
  table: string;
  ops: Array<{ fn: string; args: unknown[] }>;
}

const queries: RecordedQuery[] = [];
let respond: (q: RecordedQuery) => { data: unknown; error: unknown };

vi.mock('@/integrations/supabase/client', () => {
  const makeBuilder = (table: string) => {
    const record: RecordedQuery = { table, ops: [] };
    queries.push(record);
    const builder: unknown = new Proxy(
      {},
      {
        get(_target, prop) {
          if (typeof prop !== 'string') return undefined;
          if (prop === 'then') {
            // Awaiting any point in the chain resolves it, like postgrest-js.
            return (onFulfilled: (v: unknown) => unknown) =>
              Promise.resolve(respond(record)).then(onFulfilled);
          }
          return (...args: unknown[]) => {
            record.ops.push({ fn: prop, args });
            return builder;
          };
        },
      },
    );
    return builder;
  };
  return { supabase: { from: (table: string) => makeBuilder(table) } };
});

import { advancePlayoffResult, claimEmptySlot } from '../teamMatchAdvancement';

/** Chained op lookup, e.g. `argOf(q, 'is')` → ['team_a_id', null]. */
const argOf = (q: RecordedQuery, fn: string) => q.ops.find((o) => o.fn === fn)?.args;
const has = (q: RecordedQuery, fn: string) => q.ops.some((o) => o.fn === fn);
const isUpdate = (q: RecordedQuery) => has(q, 'update');

const SEMI = {
  next_match_id: 'final-1',
  next_match_slot: 1,
  is_playoff: true,
  is_repechage: false,
  playoff_round: 2,
  team_a_id: 'team-winner',
  team_b_id: 'team-loser',
};

beforeEach(() => {
  queries.length = 0;
  respond = () => ({ data: null, error: null });
});

describe('claimEmptySlot', () => {
  it('guards every claim with `.is(field, null)` so a concurrent write cannot be clobbered', async () => {
    respond = () => ({ data: { id: 'tp-1' }, error: null });

    await claimEmptySlot('tp-1', 'team-loser', { team_a_id: null, team_b_id: null });

    const updates = queries.filter(isUpdate);
    expect(updates).toHaveLength(1);
    expect(argOf(updates[0], 'is')).toEqual(['team_a_id', null]);
    expect(argOf(updates[0], 'update')).toEqual([{ team_a_id: 'team-loser' }]);
  });

  it('falls through to the second slot when the first claim loses the race', async () => {
    // The other semifinal took team_a_id between our read and our write:
    // the guarded update matches zero rows and returns no data.
    let call = 0;
    respond = () => (++call === 1 ? { data: null, error: null } : { data: { id: 'tp-1' }, error: null });

    const seated = await claimEmptySlot('tp-1', 'team-loser', { team_a_id: null, team_b_id: null });

    expect(seated).toBe('tp-1');
    const updates = queries.filter(isUpdate);
    expect(updates).toHaveLength(2);
    expect(argOf(updates[1], 'is')).toEqual(['team_b_id', null]);
    expect(argOf(updates[1], 'update')).toEqual([{ team_b_id: 'team-loser' }]);
  });

  it('returns null rather than overwriting when both slots are already taken', async () => {
    const seated = await claimEmptySlot('tp-1', 'team-loser', {
      team_a_id: 'other-a',
      team_b_id: 'other-b',
    });

    expect(seated).toBeNull();
    expect(queries.filter(isUpdate)).toHaveLength(0);
  });

  it('does not seat the same team twice when a match is re-scored', async () => {
    const seated = await claimEmptySlot('tp-1', 'team-loser', {
      team_a_id: 'team-loser',
      team_b_id: null,
    });

    expect(seated).toBe('tp-1');
    expect(queries.filter(isUpdate)).toHaveLength(0);
  });
});

describe('advancePlayoffResult', () => {
  it('does nothing for a match that is not a decided playoff', async () => {
    await advancePlayoffResult({ ...SEMI, is_playoff: false }, {
      winnerId: 'team-winner',
      tournamentId: 't1',
    });
    await advancePlayoffResult(SEMI, { winnerId: null, tournamentId: 't1' });
    await advancePlayoffResult({ ...SEMI, next_match_id: null }, {
      winnerId: 'team-winner',
      tournamentId: 't1',
    });

    expect(queries).toHaveLength(0);
  });

  it('writes the winner into the fixed next-round slot', async () => {
    await advancePlayoffResult({ ...SEMI, playoff_round: 3, next_match_slot: 2 }, {
      winnerId: 'team-winner',
      tournamentId: 't1',
    });

    const advance = queries.filter(isUpdate)[0];
    expect(argOf(advance, 'update')).toEqual([{ team_b_id: 'team-winner' }]);
    expect(argOf(advance, 'eq')).toEqual(['id', 'final-1']);
    // Disjoint columns per sibling match — a claim guard would be dead weight.
    expect(has(advance, 'is')).toBe(false);
  });

  it('seats the semifinal loser in the third-place match even when its first slot is lost to the sibling semifinal', async () => {
    respond = (q) => {
      if (q.table === 'team_match_matches' && !isUpdate(q) && has(q, 'maybeSingle')) {
        // Third-place lookup, then the post-claim re-read.
        return { data: { id: 'tp-1', team_a_id: null, team_b_id: null }, error: null };
      }
      if (isUpdate(q) && argOf(q, 'is')?.[0] === 'team_a_id') {
        return { data: null, error: null }; // sibling semifinal won this slot
      }
      if (isUpdate(q) && argOf(q, 'is')?.[0] === 'team_b_id') {
        return { data: { id: 'tp-1' }, error: null };
      }
      return { data: null, error: null };
    };

    await advancePlayoffResult(SEMI, { winnerId: 'team-winner', tournamentId: 't1' });

    const claims = queries.filter((q) => isUpdate(q) && has(q, 'is'));
    expect(claims.map((q) => argOf(q, 'update'))).toEqual([
      [{ team_a_id: 'team-loser' }],
      [{ team_b_id: 'team-loser' }],
    ]);
    // The regression: never an unguarded write to the third-place match.
    const unguardedThirdPlace = queries.filter(
      (q) => isUpdate(q) && !has(q, 'is') && argOf(q, 'eq')?.[1] === 'tp-1',
    );
    expect(unguardedThirdPlace).toHaveLength(0);
  });

  it('skips the third-place match for the repechage branch', async () => {
    respond = () => ({ data: null, error: null });

    await advancePlayoffResult({ ...SEMI, is_repechage: true }, {
      winnerId: 'team-winner',
      tournamentId: 't1',
    });

    expect(queries.some((q) => argOf(q, 'eq')?.[0] === 'is_third_place')).toBe(false);
  });

  it('throws when the next-round advance fails instead of silently continuing', async () => {
    respond = () => ({ data: null, error: new Error('rls denied') });

    await expect(
      advancePlayoffResult(SEMI, { winnerId: 'team-winner', tournamentId: 't1' }),
    ).rejects.toThrow('rls denied');
  });
});
