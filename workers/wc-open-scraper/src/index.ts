// ============================================================================
// wc-open-scraper — World Cup 2026 OPEN national-team live feed
//
// Fetches the organizers' public delegations/schedule pages, parses the OPEN
// draw (and, once the team competition starts on 2026-09-03, the ties), and
// writes them to Supabase so the /live World Cup panel can render them and
// repaint over Supabase Realtime. The parser lives in
// src/lib/wc-open/parse.ts and is unit-tested against a fixture; this file is
// only the transport + diff + write shell around it.
//
// ── Two entry points ───────────────────────────────────────────────────────
//   scheduled (cron)  runs only inside the match window (see WITHIN_WINDOW).
//                     Outside it, the worker wakes, sees it is not match time,
//                     and returns without touching the network — cheap, and
//                     polite to the source.
//   fetch (POST /scrape)  on-demand, HMAC-signed with SCRAPER_AUTH_SECRET,
//                     for seeding and manual refresh. Mirrors pro-tour-scraper.
//
// ── Politeness + safety ────────────────────────────────────────────────────
//   * A real, identifiable User-Agent (UA) so the source can see who we are.
//   * Diff-before-write: rows only change when the scraped value differs, so
//     Realtime fires (and readers repaint) solely on genuine updates.
//   * ParseGuardError short-circuits the write: a changed source layout raises
//     an alert (Telegram) and leaves the last-good rows in place rather than
//     overwriting them with a half-parsed draw.
//
// This worker is NOT deployed until Cuong approves the /live panel — see
// wrangler.toml, where the cron trigger is commented out for that reason.
// ============================================================================

import { parseWcOpenDelegations, ParseGuardError, type WcOpenTeam } from "../../../src/lib/wc-open/parse";
import { parseWcOpenTies, type WcOpenTie } from "../../../src/lib/wc-open/parse-ties";
import {
  parseWcProLive,
  parseWcProBrackets,
  matchesToStore,
  type WcProMatch,
  type ProCategory,
} from "../../../src/lib/wc-open/parse-pro";

import {
  diagnose,
  emptyDigest,
  fingerprint,
  formatAlert,
  formatDigest,
  hourKeyOf,
  type DigestState,
} from "./report";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SCRAPER_AUTH_SECRET: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

const DELEGATIONS_URL = "https://www.sporttora.com/pwc2026/delegations";
const LIVE_URL = "https://www.sporttora.com/pwc2026/live";
const UA =
  "ThePickleHubBot/1.0 (+https://www.thepicklehub.net; World Cup live feed; contact thecuong@gmail.com)";

/**
 * The five Pro brackets. Each page server-renders full data only for the one
 * bracket named in its URL, so we fetch one per event. `cat` is <gender>____<type>
 * (mixed is gender "mixed_gender", type "mixed"); `bracket` is the draw id
 * repeated (`<id>____<id>`). This is the authoritative source of completed
 * matches WITH their real per-game finals — /live never carries a final.
 */
function bracketUrl(cat: string, bracket: string): string {
  return `https://www.sporttora.com/pwc2026/brackets?tier=pro&cat=${cat}&bracket=${bracket}`;
}
const BRACKET_URLS: { category: ProCategory; url: string }[] = [
  { category: "pro_singles_mens", url: bracketUrl("mens____singles", "pro_singles_mens____pro_singles_mens") },
  { category: "pro_singles_womens", url: bracketUrl("womens____singles", "pro_singles_womens____pro_singles_womens") },
  { category: "pro_doubles_mens", url: bracketUrl("mens____doubles", "pro_doubles_mens____pro_doubles_mens") },
  { category: "pro_doubles_womens", url: bracketUrl("womens____doubles", "pro_doubles_womens____pro_doubles_womens") },
  { category: "pro_mixed", url: bracketUrl("mixed_gender____mixed", "pro_mixed____pro_mixed") },
];

/**
 * Play window across BOTH competitions: the individual (Pro) events run from
 * Aug 30, the team competition Sep 3–6. So the window is Aug 30 – Sep 6, 2026,
 * roughly 07:00–21:00 Vietnam time (UTC+7 → 00:00–14:00 UTC). Outside it there
 * is nothing live to scrape and the cron returns early.
 */
function withinMatchWindow(now: Date): boolean {
  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth(); // 0-based; August = 7, September = 8
  const d = now.getUTCDate();
  const h = now.getUTCHours();
  if (y !== 2026 || h < 0 || h > 14) return false;
  const isAug = mo === 7 && d >= 30; // Aug 30–31
  const isSep = mo === 8 && d <= 6; // Sep 1–6
  return isAug || isSep;
}

async function fetchDelegations(): Promise<string> {
  const res = await fetch(DELEGATIONS_URL, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    cf: { cacheTtl: 0 },
  });
  if (!res.ok) throw new Error(`delegations fetch ${res.status}`);
  return res.text();
}

interface ExistingTeam {
  slug: string;
  group_letter: string;
  seed: number | null;
  name_vi: string;
  name_en: string;
  country_code: string | null;
}

async function sbSelectTeams(env: Env): Promise<Map<string, ExistingTeam>> {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/wc_open_teams?select=slug,group_letter,seed,name_vi,name_en,country_code`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  );
  if (!res.ok) throw new Error(`select teams ${res.status}`);
  const rows = (await res.json()) as ExistingTeam[];
  return new Map(rows.map((r) => [r.slug, r]));
}

/** A team row differs from what we last stored, so it is worth an upsert. */
function teamChanged(next: WcOpenTeam, prev: ExistingTeam | undefined): boolean {
  if (!prev) return true;
  return (
    prev.group_letter !== next.group ||
    prev.seed !== next.seed ||
    prev.name_vi !== next.nameVi ||
    prev.name_en !== next.nameEn ||
    prev.country_code !== next.countryCode
  );
}

async function sbUpsertTeams(env: Env, teams: WcOpenTeam[]): Promise<void> {
  const body = teams.map((t) => ({
    slug: t.slug,
    group_letter: t.group,
    seed: t.seed,
    name_vi: t.nameVi,
    name_en: t.nameEn,
    country_code: t.countryCode,
    updated_at: new Date().toISOString(),
  }));
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/wc_open_teams?on_conflict=slug`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`upsert teams ${res.status}: ${await res.text()}`);
}

async function alert(env: Env, text: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: `[wc-open-scraper] ${text}` }),
    });
  } catch {
    // best-effort; never let alerting throw over the real error
  }
}

export interface ScrapeResult {
  ok: boolean;
  teamsSeen: number;
  teamsWritten: number;
  tiesSeen: number;
  tiesWritten: number;
  /** Ties in play this cycle — for the digest and the on-demand response. */
  tiesLive: number;
  error?: string;
}

// ── OPEN team ties (wc_open_matches) ───────────────────────────────────────

interface ExistingTieRow {
  match_id: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  court: string | null;
  start_time: string | null;
}

async function sbSelectOpenMatches(env: Env): Promise<Map<string, ExistingTieRow>> {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/wc_open_matches?select=match_id,home_score,away_score,status,court,start_time`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  );
  if (!res.ok) throw new Error(`select open matches ${res.status}`);
  const rows = (await res.json()) as ExistingTieRow[];
  return new Map(rows.map((r) => [r.match_id, r]));
}

/** PostgREST returns timestamptz as "2026-09-03T08:00:00+00:00"; the source
 *  emits "2026-09-03T08:00:00". Compare on the instant, not the spelling. */
function sameInstant(a: string | null, b: string | null): boolean {
  if (a == null || b == null) return a === b;
  return Date.parse(a.endsWith("Z") || a.includes("+") ? a : `${a}Z`) ===
    Date.parse(b.endsWith("Z") || b.includes("+") ? b : `${b}Z`);
}

function tieChanged(next: WcOpenTie, prev: ExistingTieRow | undefined): boolean {
  if (!prev) return true;
  return (
    prev.home_score !== next.homeScore ||
    prev.away_score !== next.awayScore ||
    prev.status !== next.status ||
    prev.court !== next.court ||
    !sameInstant(prev.start_time, next.startTime)
  );
}

async function sbUpsertOpenMatches(env: Env, ties: WcOpenTie[]): Promise<void> {
  if (ties.length === 0) return;
  const body = ties.map((t) => ({
    match_id: t.matchId,
    group_letter: t.group,
    round: t.round,
    home_slug: t.homeSlug,
    away_slug: t.awaySlug,
    home_score: t.homeScore,
    away_score: t.awayScore,
    status: t.status,
    court: t.court,
    start_time: t.startTime,
    updated_at: new Date().toISOString(),
  }));
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/wc_open_matches?on_conflict=match_id`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`upsert open matches ${res.status}: ${await res.text()}`);
}

/**
 * One scrape cycle over the delegations page: fetch once, then two guarded
 * parses over the same HTML — the 64-team draw, and (since the team
 * competition started on 2026-09-03) the 96 group-stage ties. Each parse
 * diffs against Supabase and upserts only what changed, so Realtime fires
 * solely on genuine updates. A tie parse-guard alerts but does not undo the
 * team write — the draw staying fresh is not hostage to the schedule markup.
 */
export async function runScrape(env: Env): Promise<ScrapeResult> {
  let html: string;
  let parsed;
  try {
    html = await fetchDelegations();
    parsed = parseWcOpenDelegations(html);
  } catch (e) {
    const err = e as Error;
    if (err instanceof ParseGuardError) {
      // The source layout changed. Do NOT write — alert and keep last-good rows.
      await alert(env, `parse guard: ${err.message}. Kept existing rows.`);
    }
    return { ok: false, teamsSeen: 0, teamsWritten: 0, tiesSeen: 0, tiesWritten: 0, tiesLive: 0, error: err.message };
  }

  const existing = await sbSelectTeams(env);
  const changed = parsed.teams.filter((t) => teamChanged(t, existing.get(t.slug)));
  if (changed.length > 0) {
    await sbUpsertTeams(env, changed);
  }

  let tiesSeen = 0;
  let tiesWritten = 0;
  let tiesLive = 0;
  let tieError: string | undefined;
  try {
    const tiesParsed = parseWcOpenTies(html);
    tiesSeen = tiesParsed.ties.length;
    tiesLive = tiesParsed.liveTieCount;
    const existingTies = await sbSelectOpenMatches(env);
    const changedTies = tiesParsed.ties.filter((t) => tieChanged(t, existingTies.get(t.matchId)));
    await sbUpsertOpenMatches(env, changedTies);
    tiesWritten = changedTies.length;
  } catch (e) {
    const err = e as Error;
    tieError = `ties: ${err.message}`;
    if (err instanceof ParseGuardError) {
      await alert(env, `tie parse guard: ${err.message}. Kept existing tie rows.`);
    }
  }

  return {
    ok: tieError == null,
    teamsSeen: parsed.teams.length,
    teamsWritten: changed.length,
    tiesSeen,
    tiesWritten,
    tiesLive,
    error: tieError,
  };
}

// ── Pro individual events ──────────────────────────────────────────────────

interface ExistingProRow {
  match_id: string;
  status: string;
  current_a: number | null;
  current_b: number | null;
  games_json: unknown;
  leader_side: string | null;
  is_vietnam: boolean;
}

// PostgREST caps a response at 1000 rows and says so only in Content-Range, so
// an unpaginated read looks successful while silently returning a prefix. That
// was harmless while the table held Vietnamese results alone (~90 rows); now
// that every completed Pro match is stored the table passes 1000 mid-tournament,
// and a truncated `existing` map would make the worker re-upsert every unseen
// row on every single cron tick.
const PAGE = 1000;

async function sbSelectProMatches(env: Env): Promise<Map<string, ExistingProRow>> {
  const out = new Map<string, ExistingProRow>();
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/wc_pro_matches?select=match_id,status,current_a,current_b,games_json,leader_side,is_vietnam&order=match_id.asc`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          Range: `${from}-${from + PAGE - 1}`,
        },
      },
    );
    if (!res.ok) throw new Error(`select pro ${res.status}`);
    const rows = (await res.json()) as ExistingProRow[];
    for (const r of rows) out.set(r.match_id, r);
    if (rows.length < PAGE) return out;
  }
}

/** Split work into request-sized batches. */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function proRowChanged(next: WcProMatch, prev: ExistingProRow | undefined): boolean {
  if (!prev) return true;
  return (
    prev.status !== next.status ||
    prev.current_a !== next.currentA ||
    prev.current_b !== next.currentB ||
    prev.leader_side !== next.leaderSide ||
    JSON.stringify(prev.games_json ?? []) !== JSON.stringify(next.games)
  );
}

function proRowBody(m: WcProMatch, nowIso: string) {
  return {
    match_id: m.matchId,
    category_id: m.categoryId,
    division_name: m.divisionName,
    round_name: m.roundName,
    round_num: m.roundNum,
    match_index: m.matchIndex,
    entry_a_name: m.entryAName,
    entry_a_seed: m.entryASeed,
    entry_b_name: m.entryBName,
    entry_b_seed: m.entryBSeed,
    current_a: m.currentA,
    current_b: m.currentB,
    games_json: m.games,
    serving_side: m.servingSide,
    leader_side: m.leaderSide,
    status: m.status,
    is_vietnam: m.isVietnam,
    venue_name: m.venueName,
    court_label: m.courtLabel,
    referee_name: m.refereeName,
    scheduled_at: m.scheduledAt,
    last_seen_at: nowIso,
    updated_at: nowIso,
  };
}

// Batched: the first tick after a redeploy writes every row it has never seen,
// which is now the whole bracket rather than the Vietnamese slice of it.
const UPSERT_BATCH = 200;

async function sbUpsertProMatches(env: Env, rows: ReturnType<typeof proRowBody>[]): Promise<void> {
  for (const batch of chunk(rows, UPSERT_BATCH)) {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/wc_pro_matches?on_conflict=match_id`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) throw new Error(`upsert pro ${res.status}: ${await res.text()}`);
  }
}

function idInList(matchIds: string[]): string {
  return matchIds.map((id) => `"${id}"`).join(",");
}

// A match id runs ~50 characters, so an unbounded in.() list would build a URL
// past what Cloudflare will send once the table holds every completed match.
const ID_BATCH = 100;

/** Mark stored matches `completed`, keeping their last-observed score. */
async function sbMarkProCompleted(env: Env, matchIds: string[], nowIso: string): Promise<void> {
  for (const batch of chunk(matchIds, ID_BATCH)) {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/wc_pro_matches?match_id=in.(${idInList(batch)})`,
      {
        method: "PATCH",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ status: "completed", updated_at: nowIso }),
      },
    );
    if (!res.ok) throw new Error(`mark completed ${res.status}: ${await res.text()}`);
  }
}

/** Delete stored matches — used for scheduled ones that vanished unplayed. */
async function sbDeleteProMatches(env: Env, matchIds: string[]): Promise<void> {
  for (const batch of chunk(matchIds, ID_BATCH)) {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/wc_pro_matches?match_id=in.(${idInList(batch)})`,
      {
        method: "DELETE",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: "return=minimal",
        },
      },
    );
    if (!res.ok) throw new Error(`delete pro ${res.status}: ${await res.text()}`);
  }
}

/**
 * Fetch every Pro bracket and collect its completed matches with real finals.
 * One page per event, sequentially, so peak memory stays at one ~4 MB page.
 * A per-page failure (fetch error or guard) is recorded and skipped, never
 * fatal — the caller uses `errors.length` to decide whether it may prune.
 */
async function fetchProBracketsCompleted(): Promise<{ completed: WcProMatch[]; errors: string[] }> {
  const completed: WcProMatch[] = [];
  const errors: string[] = [];
  for (const { category, url } of BRACKET_URLS) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, cf: { cacheTtl: 0 } });
      if (!res.ok) {
        errors.push(`${category} fetch ${res.status}`);
        continue;
      }
      completed.push(...parseWcProBrackets(await res.text(), category));
    } catch (e) {
      errors.push(`${category}: ${(e as Error).message}`);
    }
  }
  return { completed, errors };
}

export interface ProScrapeResult {
  ok: boolean;
  matchesSeen: number;
  matchesWritten: number;
  completed: number;
  /** Matches on court on this cycle — the number the hourly digest leads with. */
  live: number;
  error?: string;
}

/**
 * One Pro cycle. Two sources, each authoritative for what it carries:
 *   * /live — the live current score of in_progress matches + the scheduled
 *     upcoming ones. It drops a match the instant it ends and never carries a
 *     final, so it is the source of live/scheduled rows only.
 *   * /brackets (one page per event) — every COMPLETED match with its real
 *     per-game finals and winner. This is the source of results.
 *
 * We store the live + scheduled rows from /live and EVERY completed match from
 * /brackets. Until 2026-08-31 only Vietnamese finals were kept, which bounded
 * the table under PostgREST's 1000-row cap for free but left the public results
 * page unable to honestly claim it carried the tournament — a page that says
 * "results" and holds one nation's is a page that has to explain itself. The
 * cap is now handled where it belongs: paginated reads here, batched writes,
 * and a display budget on the page rather than a hole in the data.
 *
 * A row the sources no longer justify is pruned: a finished match is replaced
 * by its real bracket result; everything else that vanished is deleted so
 * scoreless snapshots and never-played scheduled rows do not accumulate.
 */
export async function runScrapePro(env: Env): Promise<ProScrapeResult> {
  let parsed;
  try {
    const res = await fetch(LIVE_URL, { headers: { "User-Agent": UA, Accept: "text/html" }, cf: { cacheTtl: 0 } });
    if (!res.ok) throw new Error(`live fetch ${res.status}`);
    parsed = parseWcProLive(await res.text());
  } catch (e) {
    const err = e as Error;
    if (err instanceof ParseGuardError) {
      await alert(env, `pro parse guard: ${err.message}. Kept existing rows.`);
    }
    return { ok: false, matchesSeen: 0, matchesWritten: 0, completed: 0, live: 0, error: err.message };
  }

  // The authoritative finals. A page failure is non-fatal but blocks pruning.
  const { completed: bracketDone, errors: bracketErrors } = await fetchProBracketsCompleted();
  if (bracketErrors.length) await alert(env, `brackets: ${bracketErrors.join("; ")}`);
  const canPrune = bracketErrors.length === 0;
  const bracketDoneIds = new Set(bracketDone.map((m) => m.matchId));

  const nowIso = new Date().toISOString();
  const existing = await sbSelectProMatches(env);

  // Live rows: the in_progress/Vietnamese subset, minus any the brackets already
  // report finished (brackets wins — no flip back to in_progress for a cycle).
  const liveStore = matchesToStore(parsed.matches).filter((m) => !bracketDoneIds.has(m.matchId));
  const liveChanged = liveStore.filter((m) => proRowChanged(m, existing.get(m.matchId)));
  // Completed rows: every bracket final, with its real per-game score. Was the
  // Vietnamese subset until 2026-08-31 — see the header for why that changed.
  const bracketChanged = bracketDone.filter((m) => proRowChanged(m, existing.get(m.matchId)));
  await sbUpsertProMatches(
    env,
    [...liveChanged, ...bracketChanged].map((m) => proRowBody(m, nowIso)),
  );

  // Prune rows the sources no longer justify. `gone` = rows /live no longer
  // lists and the brackets did not keep as a VN result.
  const liveIds = new Set(parsed.matches.map((m) => m.matchId));
  const gone = [...existing.values()].filter((r) => !liveIds.has(r.match_id) && !bracketDoneIds.has(r.match_id));
  // A vanished in_progress row whose bracket hasn't synced its final yet: freeze
  // the last score as a stopgap; the next cycle replaces it with the real
  // bracket result. Everything else gone is deleted — scheduled rows that never
  // played, and rows the brackets no longer carry at all. Never delete a
  // completed row when a bracket page failed: it may be a real result we simply
  // couldn't re-fetch this cycle.
  //
  // The freeze is no longer restricted to Vietnamese matches. It exists so a
  // match that ends between the live feed dropping it and the bracket
  // publishing it does not blink out of the results page for a minute; that
  // reasoning never had anything to do with nationality, it was only scoped
  // that way because nothing else was being kept.
  const isFreeze = (r: ExistingProRow) =>
    r.status === "in_progress" && !bracketDoneIds.has(r.match_id);
  const freeze = gone.filter(isFreeze).map((r) => r.match_id);
  const toDelete = gone
    .filter((r) => !isFreeze(r) && !(r.status === "completed" && !canPrune))
    .map((r) => r.match_id);
  await sbMarkProCompleted(env, freeze, nowIso);
  await sbDeleteProMatches(env, toDelete);

  return {
    ok: true,
    matchesSeen: parsed.matches.length,
    matchesWritten: liveChanged.length + bracketChanged.length,
    completed: bracketDone.length,
    live: parsed.matches.filter((m) => m.status === "in_progress").length,
  };
}

async function verifyHmac(secret: string, body: string, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  // constant-time-ish compare
  if (hex.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

// ── Reporting state ────────────────────────────────────────────────────────
// The cron is stateless between minutes, so the hourly accumulator and the
// alert cooldowns live in wc_scraper_ops. Every call here is best-effort:
// reporting must never be the reason a scrape cycle fails.

const ALERT_COOLDOWN_MIN = 30;
/** Last minute of the play window in UTC — force the final digest out then, or
 *  the 14:00 hour would sit unsent until the next day's first cycle. */
const WINDOW_LAST_HOUR_UTC = 14;

async function opsGet<T>(env: Env, key: string): Promise<T | null> {
  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/wc_scraper_ops?key=eq.${encodeURIComponent(key)}&select=value`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { value: T }[];
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

async function opsSet(env: Env, key: string, value: unknown): Promise<void> {
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/wc_scraper_ops?on_conflict=key`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
    });
  } catch {
    // best-effort
  }
}

/** Total stored matches, read from the Content-Range header rather than pulling
 *  rows. Once an hour, so exact counting is affordable. */
async function countProMatches(env: Env): Promise<number | null> {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/wc_pro_matches?select=match_id`, {
      method: "HEAD",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
    });
    const total = res.headers.get("content-range")?.split("/")[1];
    return total && total !== "*" ? Number(total) : null;
  } catch {
    return null;
  }
}

/**
 * Send an alert for a failed cycle, at most once per fingerprint per cooldown.
 * A source outage repeats identically every minute; without this the channel
 * fills with sixty copies of the same sentence an hour and stops being read.
 */
async function alertOnce(env: Env, error: string): Promise<void> {
  const fp = fingerprint(error);
  const key = `alert:${fp}`;
  const last = await opsGet<{ at: string }>(env, key);
  const lastAt = last?.at ? Date.parse(last.at) : 0;
  if (Date.now() - lastAt < ALERT_COOLDOWN_MIN * 60_000) return;
  await alert(env, formatAlert(error, diagnose(error), ALERT_COOLDOWN_MIN));
  await opsSet(env, key, { at: new Date().toISOString(), error });
}

/**
 * Fold one cycle into the hourly accumulator and flush when the hour turns (or
 * when the play window is about to close, so the last hour is not held until
 * tomorrow).
 */
async function recordCycle(
  env: Env,
  now: Date,
  teams: ScrapeResult,
  pro: ProScrapeResult,
): Promise<void> {
  const hourKey = hourKeyOf(now);
  const stored = (await opsGet<DigestState>(env, "digest")) ?? emptyDigest(hourKey);

  if (stored.hourKey !== hourKey) {
    if (stored.cycles > 0) await alert(env, formatDigest(stored, await countProMatches(env)));
    Object.assign(stored, emptyDigest(hourKey));
  }

  stored.cycles += 1;
  if (!teams.ok || !pro.ok) stored.errorCycles += 1;
  stored.proWritten += pro.matchesWritten;
  // Tie rows fold into the same "dòng đội tuyển" digest line as team rows —
  // both are the national-team competition.
  stored.teamsWritten += teams.teamsWritten + teams.tiesWritten;
  stored.liveNow = pro.live;
  stored.completedNow = pro.completed;
  if (stored.completedAtStart == null && pro.ok) stored.completedAtStart = pro.completed;
  for (const e of [teams.error, pro.error]) {
    if (e && !stored.errors.includes(e) && stored.errors.length < 5) stored.errors.push(e);
  }

  // Window closes at 14:59 UTC; flush here so the final hour arrives tonight
  // rather than with tomorrow morning's first cycle.
  const windowClosing = now.getUTCHours() === WINDOW_LAST_HOUR_UTC && now.getUTCMinutes() >= 58;
  if (windowClosing) {
    await alert(env, formatDigest(stored, await countProMatches(env)));
    await opsSet(env, "digest", emptyDigest(hourKeyOf(new Date(now.getTime() + 3_600_000))));
    return;
  }
  await opsSet(env, "digest", stored);
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Paused through Saturday Sep 5 (Cuong, 03/09: Pro finals done, no matches
    // until the team competition resumes). 17:00 UTC Sep 5 == 00:00 Sep 6 VN,
    // so the first cron on Sunday picks the team ties up again by itself. The
    // prod cron trigger was also detached on 03/09 — redeploying restores it
    // and this guard keeps it quiet until then. On-demand POST /scrape is not
    // gated, so a signed manual run still works during the pause.
    if (Date.now() < Date.UTC(2026, 8, 5, 17)) return;
    // Outside the match window there is nothing new — skip the fetch entirely.
    if (!withinMatchWindow(new Date())) return;
    const now = new Date();
    ctx.waitUntil(
      Promise.allSettled([runScrape(env), runScrapePro(env)]).then(async ([t, p]) => {
        for (const r of [t, p]) {
          if (r.status === "fulfilled" && !r.value.ok) console.error("wc-open-scraper cron:", r.value.error);
          if (r.status === "rejected") console.error("wc-open-scraper cron threw:", r.reason);
        }
        const teams: ScrapeResult =
          t.status === "fulfilled"
            ? t.value
            : { ok: false, teamsSeen: 0, teamsWritten: 0, tiesSeen: 0, tiesWritten: 0, tiesLive: 0, error: String(t.reason) };
        const pro: ProScrapeResult =
          p.status === "fulfilled"
            ? p.value
            : { ok: false, matchesSeen: 0, matchesWritten: 0, completed: 0, live: 0, error: String(p.reason) };

        // Alerts first: a failing cycle should reach a phone now, not at the
        // top of the hour. Reporting is wrapped so it can never turn a partial
        // scrape into a thrown cron.
        try {
          for (const e of [pro.error, teams.error]) if (e) await alertOnce(env, e);
          await recordCycle(env, now, teams, pro);
        } catch (err) {
          console.error("wc-open-scraper report:", err);
        }
      }),
    );
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/scrape") {
      return new Response("Not found", { status: 404 });
    }
    const body = await request.text();
    const ok = await verifyHmac(env.SCRAPER_AUTH_SECRET, body, request.headers.get("x-signature"));
    if (!ok) return new Response("Unauthorized", { status: 401 });

    const [teams, pro] = await Promise.all([runScrape(env), runScrapePro(env)]);
    return new Response(JSON.stringify({ teams, pro }), {
      status: teams.ok && pro.ok ? 200 : 502,
      headers: { "Content-Type": "application/json" },
    });
  },
};
