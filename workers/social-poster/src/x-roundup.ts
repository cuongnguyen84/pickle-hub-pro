/**
 * Daily pro-tour results roundup — one post, built from `matches` rows.
 *
 * No language model anywhere in this file, and that is the whole point. Scores
 * come out of the database and go into a template, so this post cannot invent a
 * result the way a rewritten news article can (the first live news draft added
 * a seed number, "No. 4 Columbus", that was not in its source). That is what
 * makes publishing it unattended a reasonable thing to do.
 *
 * The account is not X Premium, so 280 characters is a hard ceiling and "every
 * result from today" does not fit on a busy day. Lines are ordered by round —
 * final first — and cut where they stop fitting, per Cuong's call on
 * 2026-08-16. Nothing announces the cut: a "+6 more" with no link to follow is
 * a tease with nowhere to go.
 */

/** matches.source_provider CHECK allows community | ppa_tour | app_tour | mlp | other. */
const PRO_TOUR_PROVIDERS = ['ppa_tour', 'app_tour', 'mlp'] as const;

export const X_MAX_WEIGHTED = 280;

export interface RoundupParticipant {
  team: string;
  position: number | null;
  profile: { display_name: string | null; username: string | null } | null;
}

export interface RoundupMatch {
  id: string;
  tournament_name: string | null;
  tournament_round: string | null;
  round_name: string | null;
  team_a_score: number[] | null;
  team_b_score: number[] | null;
  winning_team: string | null;
  participants: RoundupParticipant[];
}

/**
 * Lower sorts first, i.e. survives the 280-character cut. Anything unrecognised
 * ranks last rather than being dropped, so a provider inventing a new round
 * label loses priority instead of disappearing.
 */
export function roundRank(round: string | null | undefined): number {
  const r = (round ?? '').toLowerCase();
  if (!r) return 90;
  if (r.includes('final') && !r.includes('semi') && !r.includes('quarter')) return 0;
  if (r.includes('semi')) return 1;
  if (r.includes('quarter')) return 2;
  if (r.includes('round of')) return 3;
  if (r.includes('playoff')) return 4;
  if (r.includes('group') || r.includes('pool') || r.includes('round robin')) return 5;
  return 50;
}

/** "Ben Johns" → "Johns". Surnames only; full names do not fit in 280. */
function shortName(p: RoundupParticipant): string {
  const raw = (p.profile?.display_name ?? p.profile?.username ?? '').trim();
  if (!raw) return '';
  const parts = raw.split(/\s+/);
  return parts[parts.length - 1];
}

function side(match: RoundupMatch, team: string): string {
  return match.participants
    .filter((p) => p.team === team)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map(shortName)
    .filter(Boolean)
    .join('/');
}

/** "11-6, 11-9" — same shape the rest of the codebase renders scores in. */
export function formatScores(a: number[] | null, b: number[] | null): string {
  if (!a?.length || !b?.length) return '';
  return a.map((s, i) => `${s}-${b[i] ?? 0}`).join(', ');
}

/**
 * One result line, winner first. Returns '' when the row cannot be rendered
 * honestly — no winner recorded, a side with no resolved players, or no score.
 * Skipping beats guessing: this text is published without review.
 */
export function formatMatchLine(match: RoundupMatch): string {
  if (match.winning_team !== 'a' && match.winning_team !== 'b') return '';
  const winner = side(match, match.winning_team);
  const loser = side(match, match.winning_team === 'a' ? 'b' : 'a');
  if (!winner || !loser) return '';
  const scores =
    match.winning_team === 'a'
      ? formatScores(match.team_a_score, match.team_b_score)
      : formatScores(match.team_b_score, match.team_a_score);
  if (!scores) return '';
  return `${winner} d. ${loser} ${scores}`;
}

const PROVIDER_LABEL: Record<string, string> = {
  mlp: 'MLP',
  ppa_tour: 'PPA Tour',
  app_tour: 'APP Tour',
};

/**
 * Header names the tournament when the day belongs to one, otherwise the tours
 * involved. Either way it is a fact from the rows, not a slogan.
 */
export function buildHeader(matches: RoundupMatch[], providers: string[]): string {
  const names = [...new Set(matches.map((m) => m.tournament_name).filter(Boolean))] as string[];
  if (names.length === 1) return `${names[0]} — results`;
  const tours = [...new Set(providers.map((p) => PROVIDER_LABEL[p] ?? p))];
  return `${tours.join(' / ')} results`;
}

/**
 * Assemble the post. Returns null when there is nothing worth posting, so the
 * caller writes no row at all rather than an empty one.
 */
export function buildRoundupBody(
  matches: RoundupMatch[],
  providers: string[],
  max = X_MAX_WEIGHTED,
): string | null {
  const lines = matches
    .slice()
    .sort((a, b) => roundRank(a.tournament_round ?? a.round_name) - roundRank(b.tournament_round ?? b.round_name))
    .map(formatMatchLine)
    .filter(Boolean);
  if (lines.length === 0) return null;

  const header = buildHeader(matches, providers);
  let body = `${header}\n`;
  let used = 0;
  for (const line of lines) {
    const next = `${body}\n${line}`;
    if (next.length > max) break;
    body = next;
    used += 1;
  }
  return used > 0 ? body : null;
}

export function proTourProviderFilter(): string {
  return `in.(${PRO_TOUR_PROVIDERS.join(',')})`;
}
