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
const configs: Record<string, { table: string; filter?: string }> = {};
const topics: string[] = [];

vi.mock('@/integrations/supabase/client', () => {
  const makeChannel = (topic: string) => {
    topics.push(topic);
    const channel = {
      topic,
      on: vi.fn((_event: string, config: { table: string; filter?: string }, cb: Handler) => {
        // Two channels are opened per hook; key by topic prefix + table.
        const key = `${topic.split(':')[0]}:${config.table}`;
        handlers[key] = cb;
        configs[key] = config;
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

const channelArgs = (): string[][] => topics.map((t) => [t]);
const configFor = (prefix: string, table: string) => configs[`${prefix}:${table}`];
const matchesConfig = () => configFor('team-match-matches', 'team_match_matches');
const resetChannels = () => {
  for (const k of Object.keys(handlers)) delete handlers[k];
  for (const k of Object.keys(configs)) delete configs[k];
  topics.length = 0;
};

const queryClient = new QueryClient();
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query',
  );
  return { ...actual, useQueryClient: () => queryClient };
});

import { useTeamMatchRealtime, useTeamMatchMatchRealtime } from '../useTeamMatchRealtime';

const TOURNEY = 'tourney-1';
const gamesHandler = () => handlers['team-match-games:team_match_games'];

let invalidateSpy: ReturnType<typeof vi.spyOn>;

const invalidatedKeys = (): string[] =>
  (invalidateSpy.mock.calls as unknown as Array<[{ queryKey: unknown }]>).map((c) =>
    JSON.stringify(c[0].queryKey),
  );

beforeEach(() => {
  resetChannels();
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

  it('subscribes with a server-side tournament filter on the matches table', () => {
    const matchesChannel = channelArgs().find(([topic]) => topic.startsWith('team-match-matches:'));
    expect(matchesChannel?.[0]).toContain(TOURNEY);
    expect(matchesConfig()?.filter).toBe(`tournament_id=eq.${TOURNEY}`);
  });

  it('opens no channel at all without a tournament id', () => {
    resetChannels();
    renderHook(() => useTeamMatchRealtime(undefined));
    expect(channelArgs()).toHaveLength(0);
  });
});

describe('useTeamMatchMatchRealtime', () => {
  beforeEach(() => {
    resetChannels();
    invalidateSpy.mockClear();
    renderHook(() => useTeamMatchMatchRealtime('match-1'));
  });

  it('scopes both channels to the single match server-side', () => {
    expect(configFor('team-match-match', 'team_match_matches')?.filter).toBe('id=eq.match-1');
    expect(configFor('team-match-games-match', 'team_match_games')?.filter).toBe(
      'match_id=eq.match-1',
    );
  });

  it('invalidates the match on a match change', () => {
    handlers['team-match-match:team_match_matches']({ eventType: 'UPDATE' });
    expect(invalidatedKeys()).toEqual([JSON.stringify(['team-match-match', 'match-1'])]);
  });

  it('invalidates games and match on a game change', () => {
    handlers['team-match-games-match:team_match_games']({ eventType: 'UPDATE' });
    expect(invalidatedKeys()).toEqual([
      JSON.stringify(['team-match-games', 'match-1']),
      JSON.stringify(['team-match-match', 'match-1']),
    ]);
  });

  it('opens no channel at all without a match id', () => {
    resetChannels();
    renderHook(() => useTeamMatchMatchRealtime(undefined));
    expect(channelArgs()).toHaveLength(0);
  });
});
