// @vitest-environment jsdom
// Unit coverage for the referee-helpers data layer: the PIN RPC wrappers and
// the email/list/insert/delete helpers shared by the 4 referee tables. The
// supabase client is faked with a small chainable stub.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { rpcMock, fromMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpcMock(...a),
    from: (...a: unknown[]) => fromMock(...a),
  },
}));

import {
  getRefereePin,
  setRefereePin,
  clearRefereePin,
  redeemRefereePin,
  lookupUserByEmail,
  fetchRefereesWithProfiles,
  isExistingReferee,
  addRefereeByEmailHelper,
  removeRefereeHelper,
} from '@/lib/referee-helpers';

beforeEach(() => vi.clearAllMocks());

// Builds a thenable query stub whose chain methods all return itself and which
// resolves to `result` for the terminal awaited call (select/eq/insert/delete).
function queryStub(result: { data?: unknown; error?: unknown }) {
  const stub: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'insert', 'delete', 'maybeSingle']) {
    stub[m] = vi.fn(() => stub);
  }
  // maybeSingle / terminal awaits resolve the promise
  stub.maybeSingle = vi.fn(() => Promise.resolve(result));
  stub.then = (onF: (v: unknown) => unknown) => Promise.resolve(result).then(onF);
  return stub;
}

describe('referee PIN RPC wrappers', () => {
  it('getRefereePin returns the first row or null', async () => {
    rpcMock.mockResolvedValue({ data: [{ pin: '123456', is_active: true }], error: null });
    expect(await getRefereePin('quick_table', 'p1')).toEqual({ pin: '123456', is_active: true });
    expect(rpcMock).toHaveBeenCalledWith('get_referee_pin', { p_format: 'quick_table', p_parent_id: 'p1' });

    rpcMock.mockResolvedValue({ data: [], error: null });
    expect(await getRefereePin('flex_tournament', 'p2')).toBeNull();
  });

  it('getRefereePin throws on error', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('nope') });
    await expect(getRefereePin('team_match', 'p1')).rejects.toThrow('nope');
  });

  it('setRefereePin returns the generated PIN', async () => {
    rpcMock.mockResolvedValue({ data: '987654', error: null });
    expect(await setRefereePin('doubles_elimination', 'p1')).toBe('987654');
    expect(rpcMock).toHaveBeenCalledWith('set_referee_pin', {
      p_format: 'doubles_elimination',
      p_parent_id: 'p1',
    });
  });

  it('clearRefereePin resolves and throws on error', async () => {
    rpcMock.mockResolvedValue({ error: null });
    await expect(clearRefereePin('quick_table', 'p1')).resolves.toBeUndefined();
    rpcMock.mockResolvedValue({ error: new Error('x') });
    await expect(clearRefereePin('quick_table', 'p1')).rejects.toThrow('x');
  });

  it('redeemRefereePin returns the status string', async () => {
    rpcMock.mockResolvedValue({ data: 'ok', error: null });
    expect(await redeemRefereePin('team_match', 'p1', '111222')).toBe('ok');
    expect(rpcMock).toHaveBeenCalledWith('redeem_referee_pin', {
      p_format: 'team_match',
      p_parent_id: 'p1',
      p_pin: '111222',
    });
    rpcMock.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(redeemRefereePin('team_match', 'p1', '111222')).rejects.toThrow('boom');
  });
});

describe('lookupUserByEmail', () => {
  it('lowercases + trims and returns the first match', async () => {
    rpcMock.mockResolvedValue({ data: [{ id: 'u1', display_name: 'A', email: 'a@b.c' }], error: null });
    const r = await lookupUserByEmail('  A@B.C ');
    expect(rpcMock).toHaveBeenCalledWith('lookup_user_by_email', { lookup_email: 'a@b.c' });
    expect(r?.id).toBe('u1');
  });

  it('returns null when no match', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    expect(await lookupUserByEmail('x@y.z')).toBeNull();
  });
});

describe('fetchRefereesWithProfiles', () => {
  it('enriches referee rows with display_name', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'quick_table_referees') {
        return queryStub({ data: [{ id: 'r1', user_id: 'u1', created_at: 't' }], error: null });
      }
      // public_profiles
      return queryStub({ data: [{ id: 'u1', display_name: 'Alice' }], error: null });
    });
    const rows = await fetchRefereesWithProfiles('quick_table_referees', 'table_id', 'p1');
    expect(rows[0].display_name).toBe('Alice');
  });

  it('short-circuits when there are no referees', async () => {
    fromMock.mockReturnValue(queryStub({ data: [], error: null }));
    expect(await fetchRefereesWithProfiles('team_match_referees', 'tournament_id', 'p1')).toEqual([]);
  });
});

describe('isExistingReferee', () => {
  it('returns true when a row exists', async () => {
    fromMock.mockReturnValue(queryStub({ data: { id: 'r1' } }));
    expect(await isExistingReferee('flex_tournament_referees', 'tournament_id', 'p1', 'u1')).toBe(true);
  });
  it('returns false when none', async () => {
    fromMock.mockReturnValue(queryStub({ data: null }));
    expect(await isExistingReferee('flex_tournament_referees', 'tournament_id', 'p1', 'u1')).toBe(false);
  });
});

describe('addRefereeByEmailHelper', () => {
  it('reports not-found when the email has no user', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    const r = await addRefereeByEmailHelper('quick_table_referees', 'table_id', 'p1', 'x@y.z');
    expect(r).toEqual({ ok: false, reason: 'not-found' });
  });

  it('reports already-exists when the user is already a referee', async () => {
    rpcMock.mockResolvedValue({ data: [{ id: 'u1', display_name: 'A', email: 'a@b.c' }], error: null });
    fromMock.mockReturnValue(queryStub({ data: { id: 'r1' } })); // isExistingReferee → true
    const r = await addRefereeByEmailHelper('quick_table_referees', 'table_id', 'p1', 'a@b.c');
    expect(r.reason).toBe('already-exists');
  });

  it('inserts and returns ok for a new referee', async () => {
    rpcMock.mockResolvedValue({ data: [{ id: 'u1', display_name: 'A', email: 'a@b.c' }], error: null });
    let call = 0;
    fromMock.mockImplementation(() => {
      call += 1;
      // first from() = isExistingReferee (no row), second = insert (no error)
      return call === 1 ? queryStub({ data: null }) : queryStub({ error: null });
    });
    const r = await addRefereeByEmailHelper('quick_table_referees', 'table_id', 'p1', 'a@b.c');
    expect(r).toMatchObject({ ok: true, displayName: 'A', userId: 'u1' });
  });

  it('reports error when the lookup throws', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('db down') });
    const r = await addRefereeByEmailHelper('quick_table_referees', 'table_id', 'p1', 'a@b.c');
    expect(r.reason).toBe('error');
  });
});

describe('removeRefereeHelper', () => {
  it('resolves ok on success', async () => {
    fromMock.mockReturnValue(queryStub({ error: null }));
    expect(await removeRefereeHelper('team_match_referees', 'r1')).toEqual({ ok: true });
  });
  it('returns error object on failure', async () => {
    fromMock.mockReturnValue(queryStub({ error: new Error('fail') }));
    const r = await removeRefereeHelper('team_match_referees', 'r1');
    expect(r.ok).toBe(false);
  });
});
