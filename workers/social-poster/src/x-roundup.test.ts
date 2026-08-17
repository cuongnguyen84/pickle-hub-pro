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
    expect(formatMatchLine(match())).toBe('Ben Johns d. Federico Staksrud 11-6, 11-9');
  });

  it('flips the score order when team B won', () => {
    expect(formatMatchLine(match({ winning_team: 'b' })))
      .toBe('Federico Staksrud d. Ben Johns 6-11, 9-11');
  });

  // MLP sides are franchises, one participant each. Surnames-everywhere turned
  // "Brooklyn Pickleball Team" into "Team" and "New Jersey 5s" into "5s".
  it('prints a one-participant side whole, because it is a team not a person', () => {
    const m = match({
      participants: [p('a', 'Columbus Sliders'), p('b', 'Brooklyn Pickleball Team')],
      winning_team: 'b',
      team_a_score: [4, 13],
      team_b_score: [11, 11],
    });
    expect(formatMatchLine(m)).toBe('Brooklyn Pickleball Team d. Columbus Sliders 11-4, 11-13');
  });

  it('prints a singles player whole too', () => {
    const m = match({ participants: [p('a', 'Ben Johns'), p('b', 'Federico Staksrud')] });
    expect(formatMatchLine(m)).toBe('Ben Johns d. Federico Staksrud 11-6, 11-9');
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

  // Production row, St. Louis Shock d. Texas Ranchers: MLP arrays are fixed
  // length, so a 3-0 win leaves an unplayed fourth game as zeros. Printing it
  // stated a game that never happened as fact, on an account that now posts
  // without review.
  it('drops the unplayed games a 3-0 MLP win leaves behind', () => {
    expect(formatScores([11, 11, 11, 0], [2, 4, 5, 0])).toBe('11-2, 11-4, 11-5');
    expect(formatScores([11, 11, 0, 0], [2, 4, 0, 0])).toBe('11-2, 11-4');
  });

  it('keeps a real 0 that is not a trailing pair', () => {
    // A shut-out game is 11-0 and must survive; only 0-0 means "not played".
    expect(formatScores([11, 11], [0, 4])).toBe('11-0, 11-4');
    // A mid-match 0-0 is data corruption, not padding — do not hide it.
    expect(formatScores([11, 0, 11], [2, 0, 5])).toBe('11-2, 0-0, 11-5');
  });

  it('returns nothing when every game is unplayed', () => {
    expect(formatScores([0, 0], [0, 0])).toBe('');
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
