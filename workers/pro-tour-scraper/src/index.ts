/**
 * Sprint 6 — pro-tour-scraper Cloudflare Worker
 *
 * Two entry points:
 *   1. fetch  (HTTP POST /scrape)  → on-demand scrape
 *      Body: { tournament_url, triggered_by, user_id?, watchlist_id? }
 *      Auth: HMAC over body using SCRAPER_AUTH_SECRET (admin UI signs).
 *   2. scheduled (cron 0 ASTERISK / 6 ASTERISK ASTERISK ASTERISK)
 *      Loops over pro_tour_watchlist rows due for re-scrape, calls
 *      runScrape() for each, updates next_scrape_at based on frequency.
 *
 * Both paths converge in runScrape() which:
 *   1. Renders the page in Browser Rendering (clicks each round button,
 *      waits for RSC stream to settle, dumps post-hydration HTML).
 *   2. Hands the HTML to parseTournamentHtml() (pure parser in
 *      ../../../src/lib/pro-tour/adapters/rsc-scraper.ts).
 *   3. POSTs the result to the Supabase edge function pro-tour-ingest
 *      using the service role key, which inserts ghost profiles and
 *      matches idempotently.
 *   4. Returns { ok, log_id, matches_extracted, error? } for the caller.
 *
 * ⚠️ Scraper selectors are scaffolding (see rsc-scraper.ts header).
 * Browser Rendering glue is real and runnable; parser will return
 * matches=0 until selectors are filled in against a captured fixture.
 */

import puppeteer from "@cloudflare/puppeteer";
import {
  rscScraperAdapter,
  parseTournamentHtml,
  PRO_TOUR_HOST_PATTERN,
} from "@/lib/pro-tour/adapters/rsc-scraper";
import type { TournamentScrapeResult } from "@/lib/pro-tour/types";

// ─── Browser Rendering timeout budgets ───────────────────────────────────
//
// The CF Browser Rendering binding's launch handshake performs a
// `Browser.getVersion` CDP call. When that call times out we get:
//   "Browser.getVersion timed out. Increase the 'protocolTimeout' setting
//    in launch/connect calls for a higher timeout if needed."
// Important: @cloudflare/puppeteer 0.0.14 does NOT expose protocolTimeout
// via launch options — its `WorkersLaunchOptions` only allows
// `keep_alive`. The internal Connection defaults timeout to 180s already
// (see node_modules/@cloudflare/puppeteer/.../common/Connection.js:155).
// So the timeout we're hitting is from the upstream control plane being
// slow / session exhausted, not from a tight client-side limit.
//
// Mitigations layered here:
//   1. SESSION REUSE — call puppeteer.sessions() first; reuse a free
//      browser via puppeteer.connect(sessionId) instead of paying the
//      full launch handshake every time. CF-recommended pattern.
//   2. KEEP-ALIVE — when we do launch fresh, keep the browser warm for
//      KEEP_ALIVE_MS so the next scrape (cron tick or follow-up admin
//      click) can reuse via (1).
//   3. STAGE TIMEOUTS — page.goto + per-round-click waits + final
//      content dump each have their own ceilings so a stuck stage
//      surfaces a clear error instead of bubbling the opaque CDP timeout.
//   4. STAGE LABELS — every async stage is wrapped to throw with a
//      "[stage] message" prefix, so the admin Logs tab pinpoints
//      exactly where rendering failed.
//
// Total worst-case budget for one scrape (5 rounds, fresh launch, no
// reuse): ~ launch(180s, controlled by upstream) + goto(60s) +
// 5 × click_settle(2s) = ~250s. Cloudflare Workers have a 30s CPU /
// 5min wall-clock cap; this fits but leaves no slack — keep an eye on
// p95 in CF Dashboard once we have ≥10 scrapes of real data.
const KEEP_ALIVE_MS = 60_000;
const PAGE_GOTO_TIMEOUT_MS = 60_000;
const ROUND_SETTLE_MS = 2_000;
const CONTENT_DUMP_TIMEOUT_MS = 30_000;

// Minimal DOM stand-ins for the page.evaluate browser-context callback.
// We deliberately don't load the full DOM lib in tsconfig (Worker
// runtime is not a browser) — these tiny shapes are all the callback
// touches.
interface Clickable {
  textContent: string | null;
  click(): void;
}
interface ClickableRoot {
  querySelectorAll(selector: string): ArrayLike<Clickable>;
}

interface Env {
  MYBROWSER: Fetcher;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SCRAPER_AUTH_SECRET: string;
}

interface ScrapeRequestBody {
  tournament_url: string;
  triggered_by: "manual" | "scheduled";
  user_id?: string;
  watchlist_id?: string;
}

interface ScrapeResult {
  ok: boolean;
  log_id?: string;
  matches_extracted: number;
  players_extracted: number;
  error?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/scrape") {
      return new Response("Not found", { status: 404 });
    }

    // HMAC-style shared-secret check. The admin UI computes the same
    // signature over the body before POSTing; mismatch → 401.
    const sig = request.headers.get("X-Scraper-Signature") ?? "";
    const bodyText = await request.text();
    if (!(await verifySignature(bodyText, sig, env.SCRAPER_AUTH_SECRET))) {
      return new Response("Unauthorized", { status: 401 });
    }

    let body: ScrapeRequestBody;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
    }

    if (!PRO_TOUR_HOST_PATTERN.test(body.tournament_url)) {
      return jsonResponse(
        { ok: false, error: "URL not supported by rsc_scraper adapter" },
        422,
      );
    }

    const result = await runScrape(body, env);
    return jsonResponse(result, result.ok ? 200 : 500);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Pull due rows from the watchlist via Supabase REST. We use the
    // service role key here — the Worker is the only consumer of these
    // endpoints and never exposes the key.
    const due = await fetchDueWatchlistRows(env);
    for (const row of due) {
      ctx.waitUntil(
        runScrape(
          {
            tournament_url: row.tournament_url,
            triggered_by: "scheduled",
            watchlist_id: row.id,
          },
          env,
        ).then((result) => {
          // Codex P2 fix on PR #29: only stamp last_scraped_at +
          // advance next_scrape_at when the scrape actually succeeded.
          // Original version updated unconditionally so a failed scrape
          // would push next_scrape_at +24h (or +7d) and the cron would
          // never retry until that window elapsed — silent regression
          // until an admin noticed pro_tour_ingestion_logs failures
          // piling up. Now: failed scrapes leave next_scrape_at as-is
          // so the next cron tick (every 6h) picks the row up again.
          if (result.ok) {
            return updateWatchlistAfterScrape(env, row.id, row.scrape_frequency);
          }
          console.error(
            `[scheduled] scrape failed for ${row.tournament_url}; ` +
              "next_scrape_at NOT advanced. Will retry next cron tick. " +
              `error: ${result.error ?? "unknown"}`,
          );
          return undefined;
        }),
      );
    }
  },
};

/* ─── Core run ──────────────────────────────────────────────────────── */

async function runScrape(
  body: ScrapeRequestBody,
  env: Env,
): Promise<ScrapeResult> {
  const startMs = Date.now();
  let parsed: TournamentScrapeResult;
  try {
    const html = await renderWithBrowserRendering(env, body.tournament_url);
    parsed = parseTournamentHtml(html, body.tournament_url);
  } catch (err) {
    return {
      ok: false,
      matches_extracted: 0,
      players_extracted: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Hand off to the Supabase edge function. The function signs its own
  // auth (service_role) and writes the ingestion log row + ghost profiles
  // + matches transactionally.
  const ingestRes = await fetch(`${env.SUPABASE_URL}/functions/v1/pro-tour-ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      scrape_result: parsed,
      triggered_by: body.triggered_by,
      triggered_by_user_id: body.user_id ?? null,
      watchlist_id: body.watchlist_id ?? null,
      duration_ms: Date.now() - startMs,
    }),
  });

  if (!ingestRes.ok) {
    return {
      ok: false,
      matches_extracted: parsed.matches.length,
      players_extracted: parsed.players.length,
      error: `Ingest failed: ${ingestRes.status} ${await ingestRes.text()}`,
    };
  }

  const ingest = (await ingestRes.json()) as {
    log_id: string;
    matches_imported: number;
  };
  return {
    ok: true,
    log_id: ingest.log_id,
    matches_extracted: parsed.matches.length,
    players_extracted: parsed.players.length,
  };
}

/* ─── Browser Rendering glue ────────────────────────────────────────── */

/**
 * Wrap an async stage so any thrown error gets a "[stage] " prefix.
 * Consumed by runScrape's catch → result.error so the admin Logs tab
 * shows exactly where the scrape died (launch / goto / round-click /
 * content-dump).
 */
async function withStage<T>(stage: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[${stage}] ${msg}`);
  }
}

/**
 * Race a promise against a timeout that throws with a stage-aware
 * message. Used for page operations whose own timeouts can't be
 * configured (e.g. page.content()).
 */
async function withTimeout<T>(
  stage: string,
  ms: number,
  fn: () => Promise<T>,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race<T>([
      fn(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`[${stage}] hit ${ms}ms ceiling`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Acquire a Browser handle — preferring an existing free session over a
 * fresh launch. Returns the browser plus a `launched` flag so the
 * caller can decide whether to .close() (which kills the session) or
 * .disconnect() (which leaves the session warm for KEEP_ALIVE_MS).
 */
async function acquireBrowser(env: Env): Promise<{
  browser: Awaited<ReturnType<typeof puppeteer.launch>>;
  launched: boolean;
}> {
  // (1) Try to find a free session left over by a previous invocation.
  // Sessions with `connectionId` are currently in use; pick one without
  // it. sessions() failing is non-fatal — we'll just launch a new one.
  try {
    const sessions = await puppeteer.sessions(env.MYBROWSER);
    const free = sessions.find((s) => !s.connectionId);
    if (free) {
      const browser = await withStage("connect-session", () =>
        puppeteer.connect(env.MYBROWSER, free.sessionId),
      );
      return { browser, launched: false };
    }
  } catch (err) {
    console.warn(
      `[acquireBrowser] sessions() lookup failed; falling back to fresh launch. ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  // (2) No free session — launch fresh with keep_alive so the NEXT
  // scrape can reuse via (1). 60s window comfortably covers the gap
  // between a manual admin click and the cron firing on the same row.
  const browser = await withStage("launch", () =>
    puppeteer.launch(env.MYBROWSER, { keep_alive: KEEP_ALIVE_MS }),
  );
  return { browser, launched: true };
}

async function renderWithBrowserRendering(env: Env, url: string): Promise<string> {
  const { browser, launched } = await acquireBrowser(env);
  try {
    const page = await withStage("new-page", () => browser.newPage());

    // `domcontentloaded` is enough for the initial RSC payload to be in
    // the page string. networkidle0 was previously waiting for ALL
    // background fetches (analytics, tracking pixels, lazy player
    // avatars) to settle — those can keep firing for tens of seconds
    // on a streaming site, masking the real "rendered enough" signal.
    await withStage("goto", () =>
      page.goto(url, { waitUntil: "domcontentloaded", timeout: PAGE_GOTO_TIMEOUT_MS }),
    );

    // Iterate round buttons so each panel hydrates into the same DOM
    // dump. Labels per PPA bracket UI: R32, R16, QF, SF, F. Click is
    // fire-and-wait; missing buttons (e.g. top-8 draw with only QF/SF/F)
    // are no-ops. Each click followed by ROUND_SETTLE_MS for the RSC
    // chunk to stream in.
    const rounds = ["R32", "R16", "QF", "SF", "F"];
    for (const label of rounds) {
      await withStage(`round-click:${label}`, async () => {
        // page.evaluate body executes in browser context; tsconfig
        // intentionally excludes the DOM lib (Worker runtime is not
        // browser) so document/HTMLElement are flagged here. Cast to
        // the loose function shape and let the runtime resolve.
        await (page.evaluate as unknown as (
          fn: (needle: string) => void,
          arg: string,
        ) => Promise<void>)((needle) => {
          const root = (globalThis as { document?: ClickableRoot }).document;
          if (!root) return;
          const buttons = Array.from(
            root.querySelectorAll("[role='button'], button"),
          ) as Clickable[];
          const target = buttons.find(
            (b) => b.textContent?.trim() === needle,
          );
          target?.click();
        }, label);
        await new Promise((resolve) => setTimeout(resolve, ROUND_SETTLE_MS));
      });
    }

    return await withTimeout("content-dump", CONTENT_DUMP_TIMEOUT_MS, () =>
      page.content(),
    );
  } finally {
    // If WE launched it, disconnect (not close) so the keep_alive window
    // applies and the next scrape can reuse via puppeteer.sessions().
    // If we connected to an existing session, also disconnect — closing
    // would kill a session another invocation might still want.
    try {
      if (launched) {
        await browser.disconnect();
      } else {
        await browser.disconnect();
      }
    } catch (closeErr) {
      // Disconnect failures are non-fatal — the session times out on
      // its own. Just log so they're visible in CF tail.
      console.warn(
        `[renderWithBrowserRendering] disconnect failed (non-fatal). ${
          closeErr instanceof Error ? closeErr.message : String(closeErr)
        }`,
      );
    }
  }
}

/* ─── Watchlist polling (scheduled handler) ─────────────────────────── */

interface WatchlistRow {
  id: string;
  tournament_url: string;
  scrape_frequency: "daily" | "weekly" | "on_event_end" | "manual";
}

async function fetchDueWatchlistRows(env: Env): Promise<WatchlistRow[]> {
  const url =
    `${env.SUPABASE_URL}/rest/v1/pro_tour_watchlist` +
    `?select=id,tournament_url,scrape_frequency` +
    `&status=eq.active` +
    `&next_scrape_at=lte.${new Date().toISOString()}`;
  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) {
    console.error("watchlist fetch failed:", res.status, await res.text());
    return [];
  }
  return (await res.json()) as WatchlistRow[];
}

function nextScrapeAt(frequency: WatchlistRow["scrape_frequency"]): string | null {
  const now = Date.now();
  if (frequency === "daily") return new Date(now + 24 * 3600_000).toISOString();
  if (frequency === "weekly") return new Date(now + 7 * 24 * 3600_000).toISOString();
  // 'on_event_end' + 'manual' → set to NULL so the cron stops touching them
  // until an admin re-arms via the UI. on_event_end is a Sprint 7+ trigger.
  return null;
}

async function updateWatchlistAfterScrape(
  env: Env,
  id: string,
  frequency: WatchlistRow["scrape_frequency"],
): Promise<void> {
  const next = nextScrapeAt(frequency);
  await fetch(`${env.SUPABASE_URL}/rest/v1/pro_tour_watchlist?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      last_scraped_at: new Date().toISOString(),
      next_scrape_at: next,
    }),
  });
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function verifySignature(
  body: string,
  sig: string,
  secret: string,
): Promise<boolean> {
  if (!sig || !secret) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const sigBytes = hexToBytes(sig);
  if (!sigBytes) return false;
  return crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(body));
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const byte = parseInt(hex.substr(i * 2, 2), 16);
    if (Number.isNaN(byte)) return null;
    bytes[i] = byte;
  }
  return bytes;
}

// Re-export the adapter for symmetry with the in-app type tests.
export { rscScraperAdapter };
