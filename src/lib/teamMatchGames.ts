// Pure game-slot construction for Team Match (MLP-style) — ARCH-03.
//
// Extracted from useTeamMatchMatches.updateMatchResultMutation, where the
// same ~45 lines were copy-pasted twice (third-place match and next playoff
// match). Two copies of a rule drift; one tested function does not.
//
// Rules (pinned by src/lib/__tests__/teamMatchGames.test.ts):
// - One game per template, in template order, order_index 0..n-1.
// - The Dreambreaker is appended ONLY when the tournament enables it AND the
//   template count is EVEN — an odd count already cannot end level, so a
//   decider would be dead weight. It is always MS / rally21.
// - Every slot starts pending at 0-0; scores are referee input, never seeded.

export interface TeamMatchGameTemplate {
  game_type: string;
  scoring_type: string;
  display_name: string;
}

export interface TeamMatchGameInsert {
  match_id: string;
  order_index: number;
  game_type: 'WD' | 'MD' | 'MX' | 'WS' | 'MS';
  scoring_type: 'rally21' | 'sideout11';
  display_name: string;
  is_dreambreaker: boolean;
  score_a: number;
  score_b: number;
  status: string;
}

export function buildTeamMatchGames(
  templates: TeamMatchGameTemplate[],
  matchId: string,
  hasDreambreaker: boolean,
): TeamMatchGameInsert[] {
  const games: TeamMatchGameInsert[] = templates.map((template, index) => ({
    match_id: matchId,
    order_index: index,
    game_type: template.game_type as TeamMatchGameInsert['game_type'],
    scoring_type: template.scoring_type as TeamMatchGameInsert['scoring_type'],
    display_name: template.display_name,
    is_dreambreaker: false,
    score_a: 0,
    score_b: 0,
    status: 'pending',
  }));

  // Even template count can end level → append the decider.
  if (hasDreambreaker && templates.length > 0 && templates.length % 2 === 0) {
    games.push({
      match_id: matchId,
      order_index: templates.length,
      game_type: 'MS',
      scoring_type: 'rally21',
      display_name: 'Dreambreaker',
      is_dreambreaker: true,
      score_a: 0,
      score_b: 0,
      status: 'pending',
    });
  }

  return games;
}
