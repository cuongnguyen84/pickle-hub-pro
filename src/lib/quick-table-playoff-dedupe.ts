/** One row per bracket slot. Match numbers restart every round, so the key
 *  includes the division and the round — otherwise round 2's match 1 hides. */
export function uniquePlayoffMatches<T extends {
  playoff_division?: number | null;
  playoff_round?: number | null;
  playoff_match_number?: number | null;
}>(matches: T[]): T[] {
  const seen = new Set<string>();
  const out = matches.filter((m) => {
    const key = `${m.playoff_division ?? 0}:${m.playoff_round ?? 0}:${m.playoff_match_number ?? 0}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return out.sort((a, b) =>
    (a.playoff_division ?? 0) - (b.playoff_division ?? 0)
    || (a.playoff_round ?? 0) - (b.playoff_round ?? 0)
    || (a.playoff_match_number ?? 0) - (b.playoff_match_number ?? 0));
}
