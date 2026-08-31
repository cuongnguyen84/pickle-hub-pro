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
import {
  parseWcProLive,
  parseWcProBrackets,
  matchesToStore,
  type WcProMatch,
  type ProCategory,
} from "../../../src/lib/wc-open/parse-pro";

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
  error?: string;
}

/**
 * One scrape cycle: fetch → parse (guarded) → diff → upsert only what changed.
 * Match ingestion is added here once the source exposes tie results (Sep 3);
 * until then this keeps the 64-team draw fresh.
 */
export async function runScrape(env: Env): Promise<ScrapeResult> {
  let parsed;
  try {
    const html = await fetchDelegations();
    parsed = parseWcOpenDelegations(html);
  } catch (e) {
    const err = e as Error;
    if (err instanceof ParseGuardError) {
      // The source layout changed. Do NOT write — alert and keep last-good rows.
      await alert(env, `parse guard: ${err.message}. Kept existing rows.`);
    }
    return { ok: false, teamsSeen: 0, teamsWritten: 0, error: err.message };
  }

  const existing = await sbSelectTeams(env);
  const changed = parsed.teams.filter((t) => teamChanged(t, existing.get(t.slug)));
  if (changed.length > 0) {
    await sbUpsertTeams(env, changed);
  }
  return { ok: true, teamsSeen: parsed.teams.length, teamsWritten: changed.length };
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

async function sbSelectProMatches(env: Env): Promise<Map<string, ExistingProRow>> {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/wc_pro_matches?select=match_id,status,current_a,current_b,games_json,leader_side,is_vietnam`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  );
  if (!res.ok) throw new Error(`select pro ${res.status}`);
  const rows = (await res.json()) as ExistingProRow[];
  return new Map(rows.map((r) => [r.match_id, r]));
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

async function sbUpsertProMatches(env: Env, rows: ReturnType<typeof proRowBody>[]): Promise<void> {
  if (rows.length === 0) return;
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/wc_pro_matches?on_conflict=match_id`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`upsert pro ${res.status}: ${await res.text()}`);
}

function idInList(matchIds: string[]): string {
  return matchIds.map((id) => `"${id}"`).join(",");
}

/** Mark stored matches `completed`, keeping their last-observed score. */
async function sbMarkProCompleted(env: Env, matchIds: string[], nowIso: string): Promise<void> {
  if (matchIds.length === 0) return;
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/wc_pro_matches?match_id=in.(${idInList(matchIds)})`,
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

/** Delete stored matches — used for scheduled ones that vanished unplayed. */
async function sbDeleteProMatches(env: Env, matchIds: string[]): Promise<void> {
  if (matchIds.length === 0) return;
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/wc_pro_matches?match_id=in.(${idInList(matchIds)})`,
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
 * We store the live + Vietnamese subset from /live and the Vietnamese completed
 * matches from /brackets (the board shows live + Vietnamese; keeping only VN
 * completed also bounds the table well under PostgREST's 1000-row cap). A row
 * the sources no longer justify is pruned: a finished VN match is replaced by
 * its real bracket result; everything else that vanished is deleted so scoreless
 * snapshots and foreign completed rows never accumulate.
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
    return { ok: false, matchesSeen: 0, matchesWritten: 0, completed: 0, error: err.message };
  }

  // The authoritative finals. A page failure is non-fatal but blocks pruning.
  const { completed: bracketDone, errors: bracketErrors } = await fetchProBracketsCompleted();
  if (bracketErrors.length) await alert(env, `brackets: ${bracketErrors.join("; ")}`);
  const canPrune = bracketErrors.length === 0;
  const bracketDoneIds = new Set(bracketDone.map((m) => m.matchId));
  const bracketVN = bracketDone.filter((m) => m.isVietnam);
  const bracketVNIds = new Set(bracketVN.map((m) => m.matchId));

  const nowIso = new Date().toISOString();
  const existing = await sbSelectProMatches(env);

  // Live rows: the in_progress/Vietnamese subset, minus any the brackets already
  // report finished (brackets wins — no flip back to in_progress for a cycle).
  const liveStore = matchesToStore(parsed.matches).filter((m) => !bracketDoneIds.has(m.matchId));
  const liveChanged = liveStore.filter((m) => proRowChanged(m, existing.get(m.matchId)));
  // Completed rows: the Vietnamese finals from the brackets, with real scores.
  const bracketChanged = bracketVN.filter((m) => proRowChanged(m, existing.get(m.matchId)));
  await sbUpsertProMatches(
    env,
    [...liveChanged, ...bracketChanged].map((m) => proRowBody(m, nowIso)),
  );

  // Prune rows the sources no longer justify. `gone` = rows /live no longer
  // lists and the brackets did not keep as a VN result.
  const liveIds = new Set(parsed.matches.map((m) => m.matchId));
  const gone = [...existing.values()].filter((r) => !liveIds.has(r.match_id) && !bracketVNIds.has(r.match_id));
  // A vanished VN in_progress row whose bracket hasn't synced its final yet:
  // freeze the last score as a stopgap; the next cycle replaces it with the
  // real bracket result. Everything else gone is deleted — foreign in_progress
  // and completed rows (never shown), and scheduled rows that never played.
  // But never delete a completed row when a bracket page failed: it may be a VN
  // result we simply couldn't re-fetch this cycle.
  const isFreeze = (r: ExistingProRow) =>
    r.status === "in_progress" && r.is_vietnam && !bracketDoneIds.has(r.match_id);
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
    completed: bracketVN.length,
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

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Outside the match window there is nothing new — skip the fetch entirely.
    if (!withinMatchWindow(new Date())) return;
    ctx.waitUntil(
      Promise.allSettled([runScrape(env), runScrapePro(env)]).then((results) => {
        for (const r of results) {
          if (r.status === "fulfilled" && !r.value.ok) console.error("wc-open-scraper cron:", r.value.error);
          if (r.status === "rejected") console.error("wc-open-scraper cron threw:", r.reason);
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
