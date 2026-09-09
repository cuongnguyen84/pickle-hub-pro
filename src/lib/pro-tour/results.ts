// ============================================================================
// groupProResults — turn the flat `matches` rows a pro-tour tournament has
// (source_provider = 'ppa_tour', one row per bracket match, participants
// embedded) into the events → rounds → matches tree the results page and
// the bot renderer both draw. Pure; no I/O, so it is unit-tested directly and
// shared by the SPA hook and functions/_lib/render/pro-tour-event.ts.
//
// Round codes are the bounded vocabulary the scraper writes
// (src/lib/pro-tour/adapters/rsc-scraper.ts canonicalRoundName): F, 3P, SF,
// QF, R16, R32, R64, then the coarse bracket-section codes W / L / GS when the
// source used a label we do not recognise. Unknown codes fall to the end.
// ============================================================================

import { isVietnameseName } from "../wc-open/parse-pro";

export interface ProResultParticipant {
  team: string | null;
  position: number | null;
  profile: { display_name: string | null; username: string | null } | null;
}

/** The columns the results query selects. */
export interface ProResultRow {
  id: string;
  slug: string;
  tournament_name: string | null;
  tournament_event: string | null;
  round_name: string | null;
  team_a_score: number[] | null;
  team_b_score: number[] | null;
  winning_team: string | null;
  played_at: string | null;
  court_number: string | null;
  notes: string | null;
  match_participants: ProResultParticipant[] | null;
}

export interface ProResultPlayer {
  name: string;
  username: string | null;
  isVietnam: boolean;
}

export interface ProResultMatch {
  id: string;
  slug: string;
  round: string;
  teamA: ProResultPlayer[];
  teamB: ProResultPlayer[];
  games: { a: number; b: number }[];
  winner: "a" | "b" | null;
  courtNumber: string | null;
  playedAt: string | null;
  /** Source says the match is in progress right now (notes {"live":true},
   *  stamped by the scraper, cleared on the finishing pass). */
  isLive: boolean;
  /** Either side has a Vietnamese player (name heuristic, see parse-pro). */
  hasVietnam: boolean;
}

export interface ProResultRound {
  code: string;
  labelEn: string;
  labelVi: string;
  matches: ProResultMatch[];
}

export type ProEventKey =
  | "mens_singles"
  | "womens_singles"
  | "mens_doubles"
  | "womens_doubles"
  | "mixed_doubles"
  | "other";

export interface ProResultEvent {
  key: ProEventKey;
  /** The source's own event label, e.g. "Pro Men's Doubles". */
  name: string;
  labelEn: string;
  labelVi: string;
  rounds: ProResultRound[];
  matchCount: number;
  /** Qualifier draws sink below every main draw on the page. */
  isQualifier: boolean;
  /** Winner of the final, when exactly one match is labelled F. */
  champion: ProResultPlayer[] | null;
}

export interface ProResults {
  events: ProResultEvent[];
  total: number;
  vietnamCount: number;
}

const ROUND_ORDER: Record<string, { rank: number; en: string; vi: string }> = {
  F: { rank: 0, en: "Final", vi: "Chung kết" },
  "3P": { rank: 1, en: "Bronze medal match", vi: "Tranh hạng 3" },
  SF: { rank: 2, en: "Semifinals", vi: "Bán kết" },
  QF: { rank: 3, en: "Quarterfinals", vi: "Tứ kết" },
  R16: { rank: 4, en: "Round of 16", vi: "Vòng 16" },
  R32: { rank: 5, en: "Round of 32", vi: "Vòng 32" },
  R64: { rank: 6, en: "Round of 64", vi: "Vòng 64" },
  R128: { rank: 7, en: "Round of 128", vi: "Vòng 128" },
  W: { rank: 8, en: "Early rounds", vi: "Vòng đầu" },
  L: { rank: 9, en: "Consolation bracket", vi: "Nhánh thua" },
  GS: { rank: 10, en: "Group stage", vi: "Vòng bảng" },
};

const EVENT_LABEL: Record<ProEventKey, { rank: number; en: string; vi: string }> = {
  mens_singles: { rank: 0, en: "Men's Singles", vi: "Đơn nam" },
  womens_singles: { rank: 1, en: "Women's Singles", vi: "Đơn nữ" },
  mens_doubles: { rank: 2, en: "Men's Doubles", vi: "Đôi nam" },
  womens_doubles: { rank: 3, en: "Women's Doubles", vi: "Đôi nữ" },
  mixed_doubles: { rank: 4, en: "Mixed Doubles", vi: "Đôi nam nữ" },
  other: { rank: 5, en: "Other", vi: "Khác" },
};

export function classifyEvent(name: string | null | undefined): ProEventKey {
  const s = (name ?? "").toLowerCase();
  if (/mixed|mx\b|xd\b/.test(s)) return "mixed_doubles";
  const women = /women|ladies|female|\bwd\b|\bws\b/.test(s);
  const men = /\bmen|male|\bmd\b|\bms\b/.test(s) && !women;
  const singles = /singles?|\bms\b|\bws\b/.test(s);
  const doubles = /doubles?|\bmd\b|\bwd\b/.test(s);
  if (women && singles) return "womens_singles";
  if (women && doubles) return "womens_doubles";
  if (men && singles) return "mens_singles";
  if (men && doubles) return "mens_doubles";
  return "other";
}

export function roundLabel(code: string, lang: "en" | "vi"): string {
  const r = ROUND_ORDER[code];
  if (r) return lang === "vi" ? r.vi : r.en;
  return code;
}

function toPlayers(parts: ProResultParticipant[] | null, team: "a" | "b"): ProResultPlayer[] {
  return (parts ?? [])
    .filter((p) => (p.team ?? "").toLowerCase() === team)
    .sort((x, y) => (x.position ?? 0) - (y.position ?? 0))
    .map((p) => {
      const name = p.profile?.display_name?.trim() || "—";
      return { name, username: p.profile?.username ?? null, isVietnam: isVietnameseName(name) };
    });
}

function toGames(a: number[] | null, b: number[] | null): { a: number; b: number }[] {
  const n = Math.max(a?.length ?? 0, b?.length ?? 0);
  const out: { a: number; b: number }[] = [];
  for (let i = 0; i < n; i++) {
    const ga = a?.[i] ?? 0;
    const gb = b?.[i] ?? 0;
    // A trailing 0-0 is an unplayed game slot from a best-of-N template.
    if (ga === 0 && gb === 0 && i === n - 1 && out.length > 0) continue;
    out.push({ a: ga, b: gb });
  }
  return out;
}

export function scoreLine(m: Pick<ProResultMatch, "games">): string {
  return m.games.map((g) => `${g.a}-${g.b}`).join(", ");
}

export function playersLine(players: ProResultPlayer[]): string {
  return players.length ? players.map((p) => p.name).join(" / ") : "—";
}

/** Keep the professional draws. The watchlist is curated so this is a
 * safety net: if an amateur bracket ever lands, and any Pro-labelled event
 * exists, the amateur one is dropped. With no Pro label anywhere, keep all. */
function proOnly(rows: ProResultRow[]): ProResultRow[] {
  const pro = rows.filter((r) => /\bpro\b/i.test(r.tournament_event ?? ""));
  return pro.length > 0 ? pro : rows;
}

export function groupProResults(rowsIn: ProResultRow[]): ProResults {
  const rows = proOnly(rowsIn);
  const byEvent = new Map<string, ProResultRow[]>();
  for (const r of rows) {
    const name = r.tournament_event?.trim() || "Pro";
    const list = byEvent.get(name) ?? [];
    list.push(r);
    byEvent.set(name, list);
  }

  let vietnamCount = 0;
  const events: ProResultEvent[] = [...byEvent.entries()].map(([name, list]) => {
    const key = classifyEvent(name);
    const byRound = new Map<string, ProResultMatch[]>();
    for (const r of list) {
      const code = (r.round_name ?? "UNKNOWN").trim() || "UNKNOWN";
      const teamA = toPlayers(r.match_participants, "a");
      const teamB = toPlayers(r.match_participants, "b");
      // Bye/walkover rows with no participants on either side render as
      // "- vs -": noise, not results. Skip them (a one-sided bye keeps
      // its named side and stays).
      if (teamA.length === 0 && teamB.length === 0) continue;
      const hasVietnam = [...teamA, ...teamB].some((p) => p.isVietnam);
      if (hasVietnam) vietnamCount++;
      const winner = r.winning_team === "a" || r.winning_team === "b" ? r.winning_team : null;
      const m: ProResultMatch = {
        id: r.id,
        slug: r.slug,
        round: code,
        isLive: r.winning_team == null && /"live"\s*:\s*true/.test(r.notes ?? ""),
        teamA,
        teamB,
        games: toGames(r.team_a_score, r.team_b_score),
        winner,
        courtNumber: r.court_number,
        playedAt: r.played_at,
        hasVietnam,
      };
      const arr = byRound.get(code) ?? [];
      arr.push(m);
      byRound.set(code, arr);
    }
    const rounds: ProResultRound[] = [...byRound.entries()]
      .map(([code, matches]) => ({
        code,
        labelEn: roundLabel(code, "en"),
        labelVi: roundLabel(code, "vi"),
        // Stable order inside a round: by played_at then slug (ids are
        // uuids, so this is deterministic without pretending it is bracket
        // order — the source does not give us the slot number).
        matches: matches.sort(
          (x, y) =>
            Number(y.isLive) - Number(x.isLive) ||
            (x.playedAt ?? "").localeCompare(y.playedAt ?? "") ||
            x.slug.localeCompare(y.slug),
        ),
      }))
      .sort((x, y) => (ROUND_ORDER[x.code]?.rank ?? 99) - (ROUND_ORDER[y.code]?.rank ?? 99));

    const finals = byRound.get("F") ?? [];
    const champion =
      finals.length === 1 && finals[0].winner ? (finals[0].winner === "a" ? finals[0].teamA : finals[0].teamB) : null;

    // Main draw and its qualifier classify to the same key; without the
    // suffix the page shows two sections both headed "Men's Singles"
    // (Cuong's screenshot, 2026-09-09). The source label is the tiebreak.
    const isQualifier = /qualif/i.test(name);
    return {
      key,
      name,
      isQualifier,
      labelEn: EVENT_LABEL[key].en + (isQualifier ? " — Qualifier" : ""),
      labelVi: EVENT_LABEL[key].vi + (isQualifier ? " — Vòng loại" : ""),
      rounds,
      matchCount: rounds.reduce((n, r) => n + r.matches.length, 0),
      champion,
    };
  });

  events.sort(
    (x, y) =>
      // Qualifiers (typically finished after day one) sink below every
      // main draw (Cuong, 2026-09-09).
      Number(x.isQualifier) - Number(y.isQualifier) ||
      EVENT_LABEL[x.key].rank - EVENT_LABEL[y.key].rank ||
      x.name.localeCompare(y.name),
  );

  const total = events.reduce((n, e) => n + e.matchCount, 0);
  return { events, total, vietnamCount };
}

/* ─── Player search ──────────────────────────────────────────────────── */

// Same fold as src/lib/wpr-search.ts / social/slug.ts — NFD + strip
// combining marks; đ/Đ by hand. Telex input ("truong") matches "Trương".
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

/** Filter a grouped result tree down to matches where any player name
 * contains the query (diacritic-insensitive). Empty query → input returned
 * as-is. Counts (matchCount/total/vietnamCount) are recomputed from the
 * kept matches so the header numbers stay honest. */
export function filterProResults(results: ProResults, query: string): ProResults {
  const q = fold(query);
  if (!q) return results;
  let total = 0;
  let vietnamCount = 0;
  const events: ProResultEvent[] = [];
  for (const ev of results.events) {
    const rounds: ProResultRound[] = [];
    for (const round of ev.rounds) {
      const matches = round.matches.filter((m) =>
        [...m.teamA, ...m.teamB].some((pl) => fold(pl.name).includes(q)),
      );
      if (matches.length > 0) rounds.push({ ...round, matches });
    }
    if (rounds.length === 0) continue;
    const matchCount = rounds.reduce((n, r) => n + r.matches.length, 0);
    total += matchCount;
    vietnamCount += rounds.reduce(
      (n, r) => n + r.matches.filter((m) => m.hasVietnam).length,
      0,
    );
    events.push({ ...ev, rounds, matchCount });
  }
  return { events, total, vietnamCount };
}

/** Every in-progress match across all events, tagged with its event label —
 * the page pins these at the very top while they run. */
export function collectLiveMatches(
  results: ProResults,
  lang: "en" | "vi",
): Array<ProResultMatch & { eventLabel: string }> {
  const out: Array<ProResultMatch & { eventLabel: string }> = [];
  for (const ev of results.events) {
    for (const round of ev.rounds) {
      for (const m of round.matches) {
        if (m.isLive) out.push({ ...m, eventLabel: lang === "vi" ? ev.labelVi : ev.labelEn });
      }
    }
  }
  return out.sort((x, y) => (x.playedAt ?? "").localeCompare(y.playedAt ?? "") || x.slug.localeCompare(y.slug));
}
