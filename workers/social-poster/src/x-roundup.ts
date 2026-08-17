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

function fullName(p: RoundupParticipant): string {
  return (p.profile?.display_name ?? p.profile?.username ?? '').trim();
}

/** "Ben Johns" → "Johns". Only used for pairs, where 280 leaves no room. */
function surname(p: RoundupParticipant): string {
  const raw = fullName(p);
  if (!raw) return '';
  const parts = raw.split(/\s+/);
  return parts[parts.length - 1];
}

/**
 * One participant on a side means one entity — an MLP franchise, or a singles
 * player — and its name is printed whole. Two or more means a doubles pair, and
 * only then are surnames used, because "Waters/Khlif" is unambiguous where a
 * truncated franchise is not.
 *
 * Surnames everywhere was the first version and it mangled exactly the rows it
 * was pointed at: "Brooklyn Pickleball Team" became "Team", "New Jersey 5s"
 * became "5s". Last-word is a rule about people, and MLP sides are not people.
 */
function side(match: RoundupMatch, team: string): string {
  const members = match.participants
    .filter((p) => p.team === team)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  if (members.length === 1) return fullName(members[0]);
  return members.map(surname).filter(Boolean).join('/');
}

/**
 * "11-6, 11-9" — same shape the rest of the codebase renders scores in.
 *
 * Trailing 0-0 pairs are dropped. An MLP match is best-of-four plus a
 * DreamBreaker and the score arrays are fixed length, so a team that wins 3-0
 * leaves [11,11,11,0] / [2,4,5,0] behind. Printing that produced
 * "11-2, 11-4, 11-5, 0-0" — a fourth game that was never played, stated as
 * fact. Only trailing pairs are trimmed: a 0-0 in the middle would be data
 * corruption, and hiding it would misrepresent the match rather than tidy it.
 */
export function formatScores(a: number[] | null, b: number[] | null): string {
  if (!a?.length || !b?.length) return '';
  const games = a.map((s, i) => [s, b[i] ?? 0] as const);
  while (games.length > 0) {
    const last = games[games.length - 1];
    if (last[0] === 0 && last[1] === 0) games.pop();
    else break;
  }
  if (games.length === 0) return '';
  return games.map(([x, y]) => `${x}-${y}`).join(', ');
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
