import { describe, it, expect } from 'vitest';
import {
  buildRoundupBody,
  formatMatchLine,
  formatScores,
  roundRank,
  X_MAX_WEIGHTED,
  type RoundupMatch,
} from './x-roundup';

const p = (team: string, name: string, position = 0) => ({
  team,
  position,
  profile: { display_name: name, username: null },
});

const match = (over: Partial<RoundupMatch> = {}): RoundupMatch => ({
  id: 'm1',
  tournament_name: 'MLP Newport Beach',
  tournament_round: 'Quarterfinal',
  round_name: null,
  team_a_score: [11, 11],
  team_b_score: [6, 9],
  winning_team: 'a',
  participants: [p('a', 'Ben Johns'), p('b', 'Federico Staksrud')],
  ...over,
});

describe('formatMatchLine', () => {
  it('puts the winner first with their scores first', () => {
    expect(formatMatchLine(match())).toBe('Johns d. Staksrud 11-6, 11-9');
  });

  it('flips the score order when team B won', () => {
    expect(formatMatchLine(match({ winning_team: 'b' })))
      .toBe('Staksrud d. Johns 6-11, 9-11');
  });

  it('joins a doubles pair with a slash, in position order', () => {
    const m = match({
      participants: [
        p('a', 'Anna Leigh Waters', 0),
        p('a', 'Noe Khlif', 1),
        p('b', 'Hayden Patriquin', 0),
        p('b', 'Anna Bright', 1),
      ],
    });
    expect(formatMatchLine(m)).toBe('Waters/Khlif d. Patriquin/Bright 11-6, 11-9');
  });

  // Every case below would otherwise publish something false or malformed to a
  // brand account with no human in the loop. Skipping the row is the only safe
  // answer — there is nobody downstream to notice.
  it('skips a match with no recorded winner', () => {
    expect(formatMatchLine(match({ winning_team: null }))).toBe('');
  });

  it('skips a match whose players did not resolve to names', () => {
    expect(formatMatchLine(match({ participants: [p('a', '')] }))).toBe('');
  });

  it('skips a match with no score', () => {
    expect(formatMatchLine(match({ team_a_score: [], team_b_score: [] }))).toBe('');
  });
});

describe('formatScores', () => {
  it('renders game pairs, and nothing at all when a side is missing', () => {
    expect(formatScores([11, 4], [9, 11])).toBe('11-9, 4-11');
    expect(formatScores(null, [9])).toBe('');
    expect(formatScores([], [])).toBe('');
  });
});

describe('roundRank', () => {
  it('orders finals ahead of everything, unknown labels last but not dropped', () => {
    expect(roundRank('Final')).toBeLessThan(roundRank('Semifinal'));
    expect(roundRank('Semifinal')).toBeLessThan(roundRank('Quarterfinal'));
    expect(roundRank('Quarterfinal')).toBeLessThan(roundRank('Group Stage'));
    expect(roundRank('Bracket Play B')).toBeLessThan(roundRank(null));
  });

  it('does not read "semifinal" as a final', () => {
    expect(roundRank('Semifinal')).not.toBe(roundRank('Final'));
  });
});

describe('buildRoundupBody', () => {
  it('returns null when nothing is renderable, so no empty row is written', () => {
    expect(buildRoundupBody([], [])).toBeNull();
    expect(buildRoundupBody([match({ winning_team: null })], ['mlp'])).toBeNull();
  });

  it('names the tournament when the day belongs to one', () => {
    const body = buildRoundupBody([match()], ['mlp']);
    expect(body).toContain('MLP Newport Beach — results');
  });

  it('falls back to tour names when the day spans tournaments', () => {
    const body = buildRoundupBody(
      [match(), match({ id: 'm2', tournament_name: 'PPA Dallas' })],
      ['mlp', 'ppa_tour'],
    );
    expect(body).toContain('MLP / PPA Tour results');
  });

  // The account is not X Premium, so 280 is a wall, not a guideline.
  it('never exceeds the limit and keeps the later rounds when it has to cut', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      match({
        id: `m${i}`,
        tournament_round: i === 29 ? 'Final' : 'Group Stage',
        participants: [p('a', `Winner${i}`), p('b', `Loser${i}`)],
      }),
    );
    const body = buildRoundupBody(many, ['mlp'])!;
    expect(body.length).toBeLessThanOrEqual(X_MAX_WEIGHTED);
    // The final was last in the input and must survive the cut anyway.
    expect(body).toContain('Winner29');
    expect(body.split('\n').filter(Boolean).length).toBeLessThan(30);
  });
});
