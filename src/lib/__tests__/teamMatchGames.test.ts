import { describe, expect, it } from 'vitest';
import { buildTeamMatchGames, type TeamMatchGameTemplate } from '../teamMatchGames';

const tpl = (n: number): TeamMatchGameTemplate[] =>
  Array.from({ length: n }, (_, i) => ({
    game_type: ['WD', 'MD', 'MX', 'WS'][i % 4],
    scoring_type: 'rally21',
    display_name: `Game ${i + 1}`,
  }));

describe('buildTeamMatchGames', () => {
  it('creates one pending 0-0 slot per template, in order', () => {
    const games = buildTeamMatchGames(tpl(3), 'm1', false);
    expect(games).toHaveLength(3);
    expect(games.map((g) => g.order_index)).toEqual([0, 1, 2]);
    expect(games.every((g) => g.match_id === 'm1')).toBe(true);
    expect(games.every((g) => g.score_a === 0 && g.score_b === 0)).toBe(true);
    expect(games.every((g) => g.status === 'pending')).toBe(true);
    expect(games.every((g) => !g.is_dreambreaker)).toBe(true);
  });

  it('appends the Dreambreaker when enabled and the template count is even', () => {
    const games = buildTeamMatchGames(tpl(4), 'm1', true);
    expect(games).toHaveLength(5);
    const db = games[4];
    expect(db.is_dreambreaker).toBe(true);
    expect(db.order_index).toBe(4);
    expect(db.game_type).toBe('MS');
    expect(db.scoring_type).toBe('rally21');
    expect(db.display_name).toBe('Dreambreaker');
    expect(db.score_a).toBe(0);
  });

  it('skips the Dreambreaker on an odd template count — the match cannot end level', () => {
    expect(buildTeamMatchGames(tpl(5), 'm1', true)).toHaveLength(5);
  });

  it('skips the Dreambreaker when the tournament has it disabled', () => {
    expect(buildTeamMatchGames(tpl(4), 'm1', false)).toHaveLength(4);
  });

  it('never emits a lone Dreambreaker for an empty template set', () => {
    expect(buildTeamMatchGames([], 'm1', true)).toEqual([]);
  });
});
