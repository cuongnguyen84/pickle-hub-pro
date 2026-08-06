import {
  PPA_WPR_MEN,
  PPA_WPR_WOMEN,
  PPA_WPR_VIET_HIGHLIGHTS,
  type PpaBoardKey,
} from "@/content/ppa-rankings";

/**
 * Client search over the WPR editorial excerpt.
 *
 * Pre-mortem P0 guards (proposal rankings-dupr-wpr-tabs):
 * - searches the UNION of both boards + the VN highlights, never just the
 *   board the user happens to have selected;
 * - diacritic-folded matching so Telex input ("Trương") matches source
 *   spelling ("Truong") and vice versa;
 * - pure function so the "Trương" → Hien Truong contract has a unit test.
 */

export interface WprSearchRow {
  board: PpaBoardKey;
  rank: number;
  name: string;
  points: number;
  countryCode: string;
}

const dedupe = (rows: WprSearchRow[]): WprSearchRow[] => {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = `${r.board}#${r.rank}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const WPR_SEARCH_INDEX: WprSearchRow[] = dedupe([
  ...PPA_WPR_MEN.map((p) => ({ board: "men" as const, rank: p.rank, name: p.name, points: p.points, countryCode: p.countryCode })),
  ...PPA_WPR_WOMEN.map((p) => ({ board: "women" as const, rank: p.rank, name: p.name, points: p.points, countryCode: p.countryCode })),
  ...PPA_WPR_VIET_HIGHLIGHTS,
]);

// Same fold as src/lib/social/slug.ts — NFD + strip combining marks; đ/Đ by hand.
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

/** Empty/whitespace query returns [] — caller decides what "no query" shows. */
export function filterWpr(query: string, rows: WprSearchRow[] = WPR_SEARCH_INDEX): WprSearchRow[] {
  const q = fold(query);
  if (!q) return [];
  return rows.filter((r) => fold(r.name).includes(q));
}
