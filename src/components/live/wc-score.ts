// Shared scoreline formatter for the World Cup Pro matches, used by both the
// /live board (WorldCupProPanel) and the home-page card (WorldCupLiveCard).
//
// The full scoreline: every finished game, plus the last game still in view.
// For a live match that trailing game is the one being played. For a completed
// match it's the last game we observed before the source dropped it — the
// bracket source now carries a completed match's real per-game finals, so a
// finished bo3 reads "14-16, 16-14, 15-6" rather than losing a game, and a
// single-game knockout still shows its score instead of rendering blank.

// Relative, not "@/": functions/_lib/render/wc-results.ts imports scoreLine
// and the Pages Functions build has no path aliases.
import type { WcProMatchRow } from "../../hooks/useWcProLive";

/** The games to show for a match, per side. Finished games plus the last game
 * still in view (the one being played when live, or the last one observed
 * before a completed match was dropped). See scoreLine for the string form. */
export function scoreGames(m: WcProMatchRow): { a: number; b: number }[] {
  const games = (m.games_json ?? []).map((g) => ({ a: g.a, b: g.b }));
  if ((m.status === "in_progress" || m.status === "completed") && m.current_a != null && m.current_b != null) {
    const last = games[games.length - 1];
    const dupOfLast = last != null && last.a === m.current_a && last.b === m.current_b;
    // A live match at 0-0 is the game just starting — keep it. On a completed
    // match a trailing 0-0 is noise (the source zeroed the game as it dropped it).
    const emptyOnDone = m.status === "completed" && m.current_a === 0 && m.current_b === 0;
    if (!dupOfLast && !emptyOnDone) games.push({ a: m.current_a, b: m.current_b });
  }
  return games;
}

/** The full scoreline as a string, e.g. "14-16, 16-14, 15-6". */
export function scoreLine(m: WcProMatchRow): string {
  return scoreGames(m).map((g) => `${g.a}-${g.b}`).join(", ");
}
