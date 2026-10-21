// ============================================================================
// wc-open/parse-pro — the five OPEN/Pro individual events from /pwc2026/live
//
// The organizers' live page server-renders match objects for men's & women's
// singles, men's & women's doubles, and mixed doubles, with live scores. This
// module extracts them, flags Vietnamese entrants, and derives who leads —
// pure and DOM-free so it runs in the worker and in vitest alike.
//
// Two source facts drive the shapes here (see the migration header for the full
// story):
//   * /live carries only `scheduled` and `in_progress` matches. A finished
//     match drops out, and no public page has its final score. So this parser
//     never sees `completed`; the worker synthesizes that by keeping a match it
//     last saw in_progress once it disappears.
//   * There is no reliable per-player nationality. Vietnamese entrants are
//     recognized from the diacritics in their names (see isVietnameseName).
// ============================================================================

import { decodeFlight, ParseGuardError } from "./parse";

export const PRO_CATEGORIES = [
  "pro_singles_mens",
  "pro_singles_womens",
  "pro_doubles_mens",
  "pro_doubles_womens",
  "pro_mixed",
] as const;
export type ProCategory = (typeof PRO_CATEGORIES)[number];

export interface ProGame {
  a: number;
  b: number;
}

export interface WcProMatch {
  matchId: string;
  categoryId: ProCategory;
  divisionName: string | null;
  roundName: string | null;
  roundNum: number | null;
  matchIndex: number | null;
  entryAName: string | null;
  entryASeed: number | null;
  entryBName: string | null;
  entryBSeed: number | null;
  currentA: number | null;
  currentB: number | null;
  games: ProGame[];
  servingSide: "A" | "B" | null;
  leaderSide: "A" | "B" | null;
  status: "scheduled" | "in_progress" | "completed";
  isVietnam: boolean;
  venueName: string | null;
  courtLabel: string | null;
  refereeName: string | null;
  scheduledAt: string | null;
}

// Recognizing Vietnamese entrants from the source, which has no reliable
// per-player nationality. Two signals, because neither alone is enough:
//
//  1. VN-unique diacritics. Matching ANY accent over-matched Spanish/Portuguese
//     names — "García Malbrán" (Argentina) carries an acute that appears across
//     Latin scripts. So we look only for the marks essentially unique to
//     Vietnamese: dot-below (U+0323), hook-above (U+0309) and horn (U+031B),
//     plus đ. These catch Phạm, Trịnh and the ơ/ư names with almost no false
//     positive from other Latin scripts.
//  2. A Vietnamese surname. Many entrants register with NO diacritics
//     ("Nguyen Hoang Minh"), which signal 1 can never catch, and some VN names
//     carry only a shared accent (Hoàng's grave, Lý's acute) we dropped from
//     signal 1. A surname check on the diacritic-stripped tokens covers both,
//     and — an exact word match — does not fire on "Alexandre" for "Le".
//
// Still a heuristic, not an official flag; it drives Vietnam-first sort order,
// never hides a match.
const VN_UNIQUE_MARKS = /[̛̣̉]/; // horn, dot-below, hook-above
const VN_SURNAMES = new Set([
  "nguyen", "tran", "le", "pham", "hoang", "huynh", "phan", "vu", "vo", "dang",
  "bui", "do", "ho", "ngo", "duong", "ly", "dao", "dinh", "trinh", "cao",
  "doan", "ha", "luong", "luu", "mai", "truong", "chau", "quach", "ton", "thai",
  "dam", "khuc", "kieu", "lam", "lai", "ma", "nghiem", "ong", "ta", "ung",
]);

/** Strip diacritics and đ so "Nguyễn" and "Nguyen" compare equal. */
function stripDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/** Best-effort: is this entrant name Vietnamese? Heuristic — see the note above. */
export function isVietnameseName(name: string | null | undefined): boolean {
  if (!name) return false;
  const nfd = name.normalize("NFD");
  if (/[đĐ]/.test(nfd) || VN_UNIQUE_MARKS.test(nfd)) return true;
  return stripDiacritics(name)
    .toLowerCase()
    .split(/[\s/]+/)
    .some((tok) => VN_SURNAMES.has(tok));
}

const CATEGORY_SET = new Set<string>(PRO_CATEGORIES);

/** Balance-match a JSON object starting at `{`. */
function matchObject(s: string, start: number): string | null {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let k = start; k < s.length; k++) {
    const ch = s[k];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return s.slice(start, k + 1);
    }
  }
  return null;
}

interface RawEntry {
  entryId?: string;
  teamName?: string;
  seed?: number;
}
interface RawGame {
  scoreA?: number;
  scoreB?: number;
}
interface RawScore {
  game?: number;
  scoreA?: number;
  scoreB?: number;
}
interface RawMatch {
  id?: string;
  status?: string;
  categoryId?: string;
  divisionName?: string;
  roundName?: string;
  roundNum?: number;
  matchIndex?: number;
  venueName?: string;
  courtLabel?: string;
  refereeName?: string;
  scheduledAt?: string;
  entryA?: RawEntry;
  entryB?: RawEntry;
  liveScore?: {
    currentGame?: { scoreA?: number; scoreB?: number; servingTeam?: string };
    games?: RawGame[];
  };
  // Present on completed matches in the /brackets flight: the final per-game
  // scores and the winning entry's id (see parseWcProBrackets).
  scores?: RawScore[];
  winnerId?: string;
}

/** Which side won, by matching the winning entry id to entry A or B. */
function winnerSide(winnerId: string | undefined, a: RawEntry | undefined, b: RawEntry | undefined): "A" | "B" | null {
  if (!winnerId) return null;
  if (a?.entryId && a.entryId === winnerId) return "A";
  if (b?.entryId && b.entryId === winnerId) return "B";
  return null;
}

function leaderOf(currentA: number | null, currentB: number | null, games: ProGame[]): "A" | "B" | null {
  // Prefer games won when the match has finished games; fall back to the
  // current game. A knockout match is usually a single game to 21, so games[]
  // is empty and the current game decides.
  if (games.length > 0) {
    let a = 0;
    let b = 0;
    for (const g of games) {
      if (g.a > g.b) a++;
      else if (g.b > g.a) b++;
    }
    if (a !== b) return a > b ? "A" : "B";
  }
  if (currentA == null || currentB == null || currentA === currentB) return null;
  return currentA > currentB ? "A" : "B";
}

export interface ProParseResult {
  matches: WcProMatch[];
  /** Count seen per category, so callers can log/guard coverage. */
  perCategory: Record<string, number>;
}

/**
 * Parse the /pwc2026/live HTML into the Pro individual matches. Throws
 * ParseGuardError when none of the five Pro categories is present — that means
 * the source layout moved and the worker should alert, not overwrite.
 */
export function parseWcProLive(html: string): ProParseResult {
  const flight = decodeFlight(html);
  if (!flight) throw new ParseGuardError("no RSC flight chunks found — not the expected page");

  const matches: WcProMatch[] = [];
  const seen = new Set<string>();
  const perCategory: Record<string, number> = {};

  const re = /\{"id":"pro_/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(flight)) !== null) {
    const raw = matchObject(flight, m.index);
    if (!raw) continue;
    let obj: RawMatch;
    try {
      obj = JSON.parse(raw) as RawMatch;
    } catch {
      continue;
    }
    if (!obj.id || !obj.categoryId || !CATEGORY_SET.has(obj.categoryId)) continue;
    if (seen.has(obj.id)) continue;
    if (obj.status !== "scheduled" && obj.status !== "in_progress") continue;
    seen.add(obj.id);

    const cur = obj.liveScore?.currentGame;
    const games: ProGame[] = (obj.liveScore?.games ?? [])
      .filter((g) => typeof g.scoreA === "number" && typeof g.scoreB === "number")
      .map((g) => ({ a: g.scoreA as number, b: g.scoreB as number }));
    const currentA = typeof cur?.scoreA === "number" ? cur.scoreA : null;
    const currentB = typeof cur?.scoreB === "number" ? cur.scoreB : null;
    const aName = obj.entryA?.teamName ?? null;
    const bName = obj.entryB?.teamName ?? null;

    perCategory[obj.categoryId] = (perCategory[obj.categoryId] ?? 0) + 1;
    matches.push({
      matchId: obj.id,
      categoryId: obj.categoryId as ProCategory,
      divisionName: obj.divisionName ?? null,
      roundName: obj.roundName ?? null,
      roundNum: typeof obj.roundNum === "number" ? obj.roundNum : null,
      matchIndex: typeof obj.matchIndex === "number" ? obj.matchIndex : null,
      entryAName: aName,
      entryASeed: typeof obj.entryA?.seed === "number" ? obj.entryA.seed : null,
      entryBName: bName,
      entryBSeed: typeof obj.entryB?.seed === "number" ? obj.entryB.seed : null,
      currentA,
      currentB,
      games,
      servingSide: cur?.servingTeam === "A" || cur?.servingTeam === "B" ? cur.servingTeam : null,
      leaderSide: obj.status === "in_progress" ? leaderOf(currentA, currentB, games) : null,
      status: obj.status,
      isVietnam: isVietnameseName(aName) || isVietnameseName(bName),
      venueName: obj.venueName ?? null,
      courtLabel: obj.courtLabel ?? null,
      refereeName: obj.refereeName ?? null,
      scheduledAt: obj.scheduledAt ?? null,
    });
  }

  const covered = PRO_CATEGORIES.filter((c) => (perCategory[c] ?? 0) > 0).length;
  if (covered === 0) {
    throw new ParseGuardError("no Pro individual matches found — source layout changed");
  }

  return { matches, perCategory };
}

/**
 * Parse a /pwc2026/brackets page into the COMPLETED matches of one Pro event,
 * with their real per-game finals. This is the authoritative result source: the
 * /live page drops a match the instant it ends and never carries a final, but
 * the bracket keeps every finished match with a `scores` array (one entry per
 * game — "15-17, 15-10, 15-9" for a bo3) and a `winnerId`.
 *
 * A brackets page server-renders full data only for the ONE bracket named in
 * its URL, so the caller fetches one page per event and passes the category it
 * asked for; matches of any other category are ignored. Throws ParseGuardError
 * when the requested category is absent — the URL params or layout changed, and
 * the worker must alert rather than treat "no results" as "all matches gone".
 */
export function parseWcProBrackets(html: string, category: ProCategory): WcProMatch[] {
  const flight = decodeFlight(html);
  if (!flight) throw new ParseGuardError("no RSC flight chunks found — not the expected page");

  const out: WcProMatch[] = [];
  const seen = new Set<string>();
  let sawCategory = 0;

  const re = /\{"id":"pro_/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(flight)) !== null) {
    const raw = matchObject(flight, m.index);
    if (!raw) continue;
    let obj: RawMatch;
    try {
      obj = JSON.parse(raw) as RawMatch;
    } catch {
      continue;
    }
    if (!obj.id || obj.categoryId !== category) continue;
    sawCategory++;
    if (obj.status !== "completed") continue; // brackets is our source of finals only
    if (seen.has(obj.id)) continue;

    const games: ProGame[] = (obj.scores ?? [])
      .filter((g) => typeof g.scoreA === "number" && typeof g.scoreB === "number")
      .map((g) => ({ a: g.scoreA as number, b: g.scoreB as number }));
    if (games.length === 0) continue; // completed but no confirmed score yet — skip

    seen.add(obj.id);
    const aName = obj.entryA?.teamName ?? null;
    const bName = obj.entryB?.teamName ?? null;
    out.push({
      matchId: obj.id,
      categoryId: category,
      divisionName: obj.divisionName ?? null,
      roundName: obj.roundName ?? null,
      roundNum: typeof obj.roundNum === "number" ? obj.roundNum : null,
      matchIndex: typeof obj.matchIndex === "number" ? obj.matchIndex : null,
      entryAName: aName,
      entryASeed: typeof obj.entryA?.seed === "number" ? obj.entryA.seed : null,
      entryBName: bName,
      entryBSeed: typeof obj.entryB?.seed === "number" ? obj.entryB.seed : null,
      // A completed match has no live game; its full result is in games[].
      currentA: null,
      currentB: null,
      games,
      servingSide: null,
      leaderSide: winnerSide(obj.winnerId, obj.entryA, obj.entryB) ?? leaderOf(null, null, games),
      status: "completed",
      isVietnam: isVietnameseName(aName) || isVietnameseName(bName),
      venueName: obj.venueName ?? null,
      courtLabel: obj.courtLabel ?? null,
      refereeName: obj.refereeName ?? null,
      scheduledAt: obj.scheduledAt ?? null,
    });
  }

  if (sawCategory === 0) {
    throw new ParseGuardError(`brackets: category ${category} not found — layout or URL params changed`);
  }
  return out;
}

/** The subset worth storing: live matches, plus every Vietnamese match. */
export function matchesToStore(matches: WcProMatch[]): WcProMatch[] {
  return matches.filter((mt) => mt.status === "in_progress" || mt.isVietnam);
}
