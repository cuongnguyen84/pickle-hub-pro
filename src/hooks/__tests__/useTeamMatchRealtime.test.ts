// @vitest-environment jsdom
// ARCH-03 — pins the games-channel scoping.
//
// `team_match_games` has no tournament_id, so postgres_changes cannot filter
// it server-side: every client watching any team match receives every game
// write on the site. The handler drops payloads belonging to other
// tournaments; these tests pin that it drops the right ones and — more
// importantly — never drops its OWN, including the DELETE case where supabase
// sends `new` as an empty object rather than undefined.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';

type Handler = (payload: Record<string, unknown>) => void;

const handlers: Record<string, Handler> = {};

vi.mock('@/integrations/supabase/client', () => {
  const makeChannel = (topic: string) => {
    const channel = {
      topic,
      on: vi.fn((_event: string, config: { table: string }, cb: Handler) => {
        // Two channels are opened per hook; key by table + topic prefix.
        handlers[`${topic.split(':')[0]}:${config.table}`] = cb;
        return channel;
      }),
      subscribe: vi.fn(() => channel),
    };
    return channel;
  };
  return {
    supabase: {
      channel: vi.fn((topic: string) => makeChannel(topic)),
      removeChannel: vi.fn(),
    },
  };
});

const queryClient = new QueryClient();
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query',
  );
  return { ...actual, useQueryClient: () => queryClient };
});

import { useTeamMatchRealtime } from '../useTeamMatchRealtime';

const TOURNEY = 'tourney-1';
const gamesHandler = () => handlers['team-match-games:team_match_games'];

let invalidateSpy: ReturnType<typeof vi.spyOn>;

const invalidatedKeys = (): string[] =>
  (invalidateSpy.mock.calls as unknown as Array<[{ queryKey: unknown }]>).map((c) =>
    JSON.stringify(c[0].queryKey),
  );

beforeEach(() => {
  for (const k of Object.keys(handlers)) delete handlers[k];
  queryClient.clear();
  invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(() => Promise.resolve());
  queryClient.setQueryData(['team-match-matches', TOURNEY], [{ id: 'match-mine' }]);
  renderHook(() => useTeamMatchRealtime(TOURNEY));
  invalidateSpy.mockClear();
});

describe('useTeamMatchRealtime games channel', () => {
  it('invalidates for a game belonging to this tournament', () => {
    gamesHandler()({ eventType: 'UPDATE', new: { match_id: 'match-mine' }, old: {} });

    expect(invalidatedKeys()).toContain(JSON.stringify(['team-match-games', 'match-mine']));
    expect(invalidatedKeys()).toContain(JSON.stringify(['team-match-matches', TOURNEY]));
  });

  it('drops a game from another tournament instead of refetching this bracket', () => {
    gamesHandler()({ eventType: 'UPDATE', new: { match_id: 'match-elsewhere' }, old: {} });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('reads match_id from `old` on DELETE, where `new` is an empty object', () => {
    gamesHandler()({ eventType: 'DELETE', new: {}, old: { match_id: 'match-mine' } });

    expect(invalidatedKeys()).toContain(JSON.stringify(['team-match-games', 'match-mine']));
  });

  it('does not swallow events that arrive before the matches list has loaded', () => {
    queryClient.removeQueries({ queryKey: ['team-match-matches', TOURNEY] });
    invalidateSpy.mockClear();

    gamesHandler()({ eventType: 'INSERT', new: { match_id: 'match-unknown' }, old: {} });

    expect(invalidatedKeys()).toContain(JSON.stringify(['team-match-games', 'match-unknown']));
  });

  it('ignores a payload carrying no match_id at all', () => {
    gamesHandler()({ eventType: 'UPDATE', new: {}, old: {} });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
