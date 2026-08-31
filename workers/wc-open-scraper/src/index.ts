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
import { parseWcProLive, matchesToStore, type WcProMatch } from "../../../src/lib/wc-open/parse-pro";

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
}

async function sbSelectProMatches(env: Env): Promise<Map<string, ExistingProRow>> {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/wc_pro_matches?select=match_id,status,current_a,current_b,games_json,leader_side`,
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

/** Mark a stored match `completed`, keeping its last-observed score. */
async function sbMarkProCompleted(env: Env, matchIds: string[], nowIso: string): Promise<void> {
  if (matchIds.length === 0) return;
  const inList = matchIds.map((id) => `"${id}"`).join(",");
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/wc_pro_matches?match_id=in.(${inList})`,
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

export interface ProScrapeResult {
  ok: boolean;
  matchesSeen: number;
  matchesWritten: number;
  completed: number;
  error?: string;
}

/**
 * One Pro cycle: fetch /live → parse the five Pro events (guarded) → store the
 * live + Vietnamese subset, diffing so only changed rows upsert. Then the
 * history step: any row we still hold as scheduled/in_progress that is no
 * longer in the source has finished, so mark it completed and keep its last
 * score (the source never carries a completed match's final score).
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

  const toStore = matchesToStore(parsed.matches);
  const nowIso = new Date().toISOString();
  const existing = await sbSelectProMatches(env);

  // Upsert the live + Vietnamese subset, only where something changed.
  const changed = toStore.filter((m) => proRowChanged(m, existing.get(m.matchId)));
  await sbUpsertProMatches(env, changed.map((m) => proRowBody(m, nowIso)));

  // History: rows we hold as not-yet-completed that the source no longer lists
  // have finished — freeze them as completed with their last-seen score.
  const sourceIds = new Set(toStore.map((m) => m.matchId));
  const nowCompleted = [...existing.values()]
    .filter((r) => r.status !== "completed" && !sourceIds.has(r.match_id))
    .map((r) => r.match_id);
  await sbMarkProCompleted(env, nowCompleted, nowIso);

  return {
    ok: true,
    matchesSeen: parsed.matches.length,
    matchesWritten: changed.length,
    completed: nowCompleted.length,
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
