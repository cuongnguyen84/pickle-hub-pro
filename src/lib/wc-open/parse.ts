// ============================================================================
// wc-open/parse — extract the OPEN national-team draw from sporttora.com
//
// The organizers' site (sporttora.com/pwc2026) is a Next.js App Router app.
// The delegations page server-renders the whole OPEN draw into React Server
// Component "flight" chunks embedded as `self.__next_f.push([1,"<escaped>"])`
// script calls. There is no public JSON API, and the RSC flight fetched with
// an `RSC: 1` header comes back WITHOUT this data (it lazy-loads), so the
// server-rendered HTML is the source. See docs/proposals for the decision.
//
// This module is deliberately pure and DOM-free so it runs identically in the
// Cloudflare Worker and in vitest, and so it can be tested offline against a
// captured fixture. It reads HTML in, gives structured data out, and THROWS a
// ParseGuardError when the shape it depends on is gone — the worker turns that
// into an alert instead of writing garbage over good rows.
//
// What it is NOT: a general Next.js flight parser. It knows exactly the three
// shapes this one page emits (tierDraws groups, the country name table, the
// optional seed list) and nothing more. When the organizers change their
// component tree, the guard fires; that is the intended failure, not a bug to
// paper over with a looser regex.
// ============================================================================

export interface WcOpenTeam {
  slug: string; // organizers' stable key, e.g. "viet_nam"
  group: string; // "A".."P"
  nameVi: string;
  nameEn: string;
  countryCode: string | null;
  seed: number | null;
}

export interface WcOpenParseResult {
  source: string;
  teams: WcOpenTeam[];
  /** Group count and team count, surfaced so callers can log/guard on them. */
  groupCount: number;
  teamCount: number;
}

export class ParseGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseGuardError";
  }
}

// The OPEN competition is a fixed 16 groups × 4 teams. These are not style
// choices — they are the contract this page has emitted since the Aug 16 draw,
// and the numbers the guard checks against. If the real tournament ever changes
// them, this constant changes in the same commit as the guard message.
const EXPECTED_GROUPS = 16;
const EXPECTED_TEAMS = 64;

/**
 * Reassemble the RSC flight text from the `self.__next_f.push([1,"…"])` chunks
 * in the page. Each chunk is a JSON-string-escaped fragment; concatenating the
 * decoded fragments yields the flight payload the browser would have streamed.
 */
export function decodeFlight(html: string): string {
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let joined = "";
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    // Wrap the captured body back into a JSON string literal so JSON.parse
    // performs the exact unescaping Next.js's own client does.
    joined += JSON.parse(`"${m[1]}"`);
  }
  return joined;
}

/** Balance-match a JSON array/object starting at `start` (which must be [ or {). */
function matchBalanced(s: string, start: number): string | null {
  const open = s[start];
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let k = start; k < s.length; k++) {
    const ch = s[k];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') {
      inStr = true;
    } else if (ch === open) {
      depth++;
    } else if (ch === close) {
      depth--;
      if (depth === 0) return s.slice(start, k + 1);
    }
  }
  return null;
}

interface RawGroup {
  key: string;
  blocks: string[];
}

/** Pull the OPEN tier's `groups:[{key, blocks}]` array out of tierDraws. */
function extractGroups(flight: string): RawGroup[] {
  const tierIdx = flight.indexOf('"tier":"open"');
  if (tierIdx < 0) {
    throw new ParseGuardError('OPEN tier marker ("tier":"open") not found — source layout changed');
  }
  const groupsKey = '"groups":';
  const gi = flight.indexOf(groupsKey, tierIdx);
  if (gi < 0) {
    throw new ParseGuardError('OPEN groups array not found after tier marker');
  }
  const raw = matchBalanced(flight, gi + groupsKey.length);
  if (!raw) {
    throw new ParseGuardError("OPEN groups array is not balanced — truncated payload?");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new ParseGuardError(`OPEN groups array did not parse as JSON: ${(e as Error).message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new ParseGuardError("OPEN groups payload is not an array");
  }
  return parsed as RawGroup[];
}

interface CountryName {
  vi: string;
  en: string;
  cc: string | null;
}

/**
 * Build slug → {vi, en, cc} from the repeated
 * `"<slug>":{"vi":"…","countryCode":"XX","en":"…"}` entries in the flight.
 * The organizers ship both languages, so bilingual names are free — we never
 * translate a country name ourselves.
 */
function extractNames(flight: string): Map<string, CountryName> {
  const names = new Map<string, CountryName>();
  const re =
    /"([a-z_]+)":\{"vi":"((?:[^"\\]|\\.)*)","countryCode":"([A-Za-z]{2,3})","en":"((?:[^"\\]|\\.)*)"\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(flight)) !== null) {
    names.set(m[1], {
      vi: JSON.parse(`"${m[2]}"`),
      cc: m[3],
      en: JSON.parse(`"${m[4]}"`),
    });
  }
  return names;
}

/** Optional: seed number per country, from the OPEN bracket's seeds array. */
function extractSeeds(flight: string): Map<string, number> {
  const seeds = new Map<string, number>();
  const catIdx = flight.indexOf('"categoryId":"open_team_coed"');
  if (catIdx < 0) return seeds;
  const seedsKey = '"seeds":';
  const si = flight.indexOf(seedsKey, catIdx);
  if (si < 0) return seeds;
  const raw = matchBalanced(flight, si + seedsKey.length);
  if (!raw) return seeds;
  try {
    const arr = JSON.parse(raw) as Array<{ entryId?: string; seed?: number }>;
    for (const s of arr) {
      if (typeof s.entryId === "string" && typeof s.seed === "number") {
        seeds.set(s.entryId.replace("open_team_coed__", ""), s.seed);
      }
    }
  } catch {
    // Seeds are a nice-to-have; a parse failure here must not sink the draw.
  }
  return seeds;
}

/**
 * Parse the delegations HTML into the OPEN draw. Throws ParseGuardError when
 * the group or team count is not what the OPEN competition must have — the
 * caller (worker) alerts and skips the write rather than overwriting real rows
 * with a half-parsed draw.
 */
export function parseWcOpenDelegations(
  html: string,
  source = "sporttora.com/pwc2026/delegations",
): WcOpenParseResult {
  const flight = decodeFlight(html);
  if (!flight) {
    throw new ParseGuardError("no RSC flight chunks found — not the expected page");
  }

  const groups = extractGroups(flight);
  const names = extractNames(flight);
  const seeds = extractSeeds(flight);

  const teams: WcOpenTeam[] = [];
  for (const g of groups) {
    if (!g || typeof g.key !== "string" || !Array.isArray(g.blocks)) {
      throw new ParseGuardError("a group is missing its key or blocks");
    }
    for (const slug of g.blocks) {
      const name = names.get(slug);
      teams.push({
        slug,
        group: g.key,
        nameVi: name?.vi ?? slug,
        nameEn: name?.en ?? slug,
        countryCode: name?.cc ?? null,
        seed: seeds.get(slug) ?? null,
      });
    }
  }

  // Guard on the shape we depend on. These fire when the organizers restructure
  // the page — the intended, loud failure.
  if (groups.length !== EXPECTED_GROUPS) {
    throw new ParseGuardError(
      `expected ${EXPECTED_GROUPS} OPEN groups, parsed ${groups.length} — source layout changed`,
    );
  }
  if (teams.length !== EXPECTED_TEAMS) {
    throw new ParseGuardError(
      `expected ${EXPECTED_TEAMS} OPEN teams, parsed ${teams.length} — source layout changed`,
    );
  }

  return {
    source,
    teams,
    groupCount: groups.length,
    teamCount: teams.length,
  };
}
