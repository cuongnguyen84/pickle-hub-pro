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
 *   1. Renders the page via the Cloudflare Browser Rendering REST API
 *      (POST /accounts/:id/browser-rendering/content) which returns
 *      the post-hydration HTML string.
 *   2. Hands the HTML to parseTournamentHtml() (pure parser in
 *      ../../../src/lib/pro-tour/adapters/rsc-scraper.ts).
 *   3. POSTs the result to the Supabase edge function pro-tour-ingest
 *      using the service role key, which inserts ghost profiles and
 *      matches idempotently.
 *   4. Returns { ok, log_id, matches_extracted, error? } for the caller.
 *
 * Why REST API instead of @cloudflare/puppeteer:
 *   The puppeteer Workers binding kept timing out at the launch
 *   handshake — `Browser.getVersion timed out` — even with session
 *   reuse + keep_alive (PR #32). Root cause: @cloudflare/puppeteer
 *   0.0.14's WorkersLaunchOptions doesn't expose `protocolTimeout`
 *   (only `keep_alive`), and the upstream control-plane handshake on
 *   cold-start regularly exceeded the internal default. The REST API
 *   is server-side: Cloudflare manages the browser lifecycle and we
 *   just receive HTML, no client-side CDP timeout to hit.
 *
 *   Trade-off: REST /content is single-shot (no `actions`/click array
 *   available as of 2026-05). The previous puppeteer path clicked each
 *   round button (R32→F) so all five round panels hydrated into the
 *   same DOM dump. REST API only captures the initial server-rendered
 *   payload, which on the PPA bracket page contains the most-advanced
 *   rounds (Final + Semis = 3 matches in the men's-doubles top-8
 *   sample). Earlier rounds (R32, R16, QF) need a follow-up strategy:
 *     a) per-round REST calls if the bracket UI exposes a query
 *        parameter for the round selector,
 *     b) reintroduce puppeteer Workers binding behind a feature flag
 *        for tournaments where missing earlier rounds matters,
 *     c) accept the limitation for Sprint 6 baseline (the most-recent
 *        rounds are the ones admins actually want for the social feed).
 *   Tracking option (a) discovery as a Sprint 7 follow-up.
 */

import {
  rscScraperAdapter,
  parseTournamentHtml,
  PRO_TOUR_HOST_PATTERN,
} from "@/lib/pro-tour/adapters/rsc-scraper";
import {
  parseMlpEventHtml,
  MLP_EVENT_HOST_PATTERN,
} from "@/lib/pro-tour/adapters/mlp-event-scraper";
import type { TournamentScrapeResult } from "@/lib/pro-tour/types";

/** Combined URL acceptance regex — admin UI / /scrape gatekeeper.
 *  Each adapter's own pattern stays the source of truth for that
 *  adapter's dispatch; this union is just for the up-front URL check. */
function isSupportedTournamentUrl(url: string): boolean {
  return PRO_TOUR_HOST_PATTERN.test(url) || MLP_EVENT_HOST_PATTERN.test(url);
}

// ─── Browser Rendering REST API budgets ───────────────────────────────────
//
// The Cloudflare REST API runs the browser server-side and streams
// HTML back. We pass `gotoOptions.timeout` so the navigation phase has
// a generous ceiling, and `waitForTimeout` so the RSC chunks have time
// to stream in before content capture. Total wall-clock for one
// successful render is typically 5–15s; failure modes we've observed:
//   - 408 Request Timeout from CF (bumps over actionTimeout)
//   - 5xx with retry-able body (CF sometimes returns "browser failed
//     to launch" under load — a single retry usually clears it)
//   - 200 with success=false in the JSON envelope (origin error)
//
// We keep the Worker itself well under CF's 30s CPU / 5min wall-clock
// limits. RENDER_FETCH_TIMEOUT_MS is the outer guard that aborts the
// upstream fetch if it hangs.
const PAGE_GOTO_TIMEOUT_MS = 60_000;
const RSC_SETTLE_TIMEOUT_MS = 5_000;
// MLP path needs: 60s goto cap + 25s dwell + addScriptTag scroll/click time.
// Pad the outer fetch ceiling so we don't abort mid-wait.
const RENDER_FETCH_TIMEOUT_MS = 130_000;

interface Env {
  /** Legacy Browser Rendering binding from the puppeteer-based
   *  approach. Kept in wrangler.toml as a commented-out fallback so a
   *  future revision can reintroduce puppeteer for full-bracket
   *  multi-round coverage. The REST-API path doesn't use it. */
  MYBROWSER?: Fetcher;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SCRAPER_AUTH_SECRET: string;
  /** Cloudflare account id (non-secret, in [vars]). */
  CLOUDFLARE_ACCOUNT_ID: string;
  /** Cloudflare API token with permission Account → Browser Rendering: Edit
   *  (set via `wrangler secret put CLOUDFLARE_API_TOKEN`). */
  CLOUDFLARE_API_TOKEN: string;
}

interface ScrapeRequestBody {
  tournament_url: string;
  triggered_by: "manual" | "scheduled";
  user_id?: string;
  watchlist_id?: string;
  /** Optional pre-created pro_tour_ingestion_logs row id. When supplied,
   *  Worker resolves to this row (instead of inserting a new log) and
   *  also writes a 'failed' update directly on render failure so the
   *  admin Logs tab always shows the outcome. */
  log_id?: string;
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

    if (!isSupportedTournamentUrl(body.tournament_url)) {
      return jsonResponse(
        {
          ok: false,
          error:
            "URL not supported. Accepted: brackets.pickleballtournaments.com (PPA / APP) " +
            "or majorleaguepickleball.co/events-<year>/<slug>/ (MLP).",
        },
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
    // Dispatch on URL host: MLP event pages use a different DOM structure
    // (WordPress + React island) than the Next.js RSC brackets, so the
    // parser pair is selected up-front rather than via runtime sniffing.
    parsed = MLP_EVENT_HOST_PATTERN.test(body.tournament_url)
      ? parseMlpEventHtml(html, body.tournament_url)
      : parseTournamentHtml(html, body.tournament_url);

    // Diagnostic for the MLP "0 matches" case: when the React island
    // didn't mount before capture, the captured HTML has no
    // `<article class="sec">` containers. Report this to the admin via
    // the log's error_message field so they don't see a confusing
    // "success / 0 trận" with no other signal. Idempotent: matches are
    // still imported when present.
    if (
      MLP_EVENT_HOST_PATTERN.test(body.tournament_url) &&
      parsed.matches.length === 0 &&
      body.log_id
    ) {
      const articleHits = (html.match(/<article\b[^>]*\bsec\b/gi) ?? []).length;
      const teamLogoHits = (html.match(/alt="[^"]*Team Logo"/gi) ?? []).length;
      const hasLoading = /loading\.\.\./i.test(html);
      const msg =
        `MLP parser found 0 matchups. HTML length: ${html.length}, ` +
        `<article.sec> hits: ${articleHits}, team logos: ${teamLogoHits}, ` +
        `loading-state: ${hasLoading}. ` +
        (articleHits === 0
          ? "React island likely did not mount before capture — try bumping waitForTimeout."
          : "Articles present but parser didn't extract them — regex/structure mismatch.");
      await markLogFailed(env, body.log_id, msg, Date.now() - startMs).catch(
        (e) => console.error(`[runScrape] empty-match markLogFailed: ${e}`),
      );
      return {
        ok: false,
        matches_extracted: 0,
        players_extracted: 0,
        error: msg,
      };
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // When the trigger function pre-created a log row, update it directly
    // so the admin Logs tab shows the failure. Without this, render
    // failures left the row stuck on 'running' indefinitely because the
    // ingest function is only called on the success path.
    if (body.log_id) {
      await markLogFailed(env, body.log_id, errMsg, Date.now() - startMs).catch(
        (e) => console.error(`[runScrape] markLogFailed: ${e}`),
      );
    }
    return {
      ok: false,
      matches_extracted: 0,
      players_extracted: 0,
      error: errMsg,
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
      log_id: body.log_id ?? null,
    }),
  });

  if (!ingestRes.ok) {
    const errMsg = `Ingest failed: ${ingestRes.status} ${await ingestRes.text()}`;
    if (body.log_id) {
      await markLogFailed(env, body.log_id, errMsg, Date.now() - startMs).catch(
        (e) => console.error(`[runScrape] markLogFailed: ${e}`),
      );
    }
    return {
      ok: false,
      matches_extracted: parsed.matches.length,
      players_extracted: parsed.players.length,
      error: errMsg,
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

/* ─── Browser Rendering REST API ─────────────────────────────────────── */

/**
 * Wrap an async stage so any thrown error gets a "[stage] " prefix.
 * Consumed by runScrape's catch → result.error so the admin Logs tab
 * shows exactly where the scrape died (env-validate / render-fetch /
 * render-parse).
 */
async function withStage<T>(stage: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[${stage}] ${msg}`);
  }
}

/** Cloudflare API envelope shape, common to all REST endpoints. */
interface CfApiEnvelope<T> {
  success: boolean;
  result?: T;
  errors?: Array<{ code: number; message: string }>;
  messages?: Array<{ code: number; message: string }>;
}

/**
 * Render the bracket page via Cloudflare Browser Rendering REST API.
 *
 * Endpoint: POST /accounts/:account_id/browser-rendering/content
 * Auth:     Bearer <CLOUDFLARE_API_TOKEN>  (Account → Browser Rendering: Edit)
 *
 * The endpoint is single-shot — no click actions available — so we
 * capture the initial server-rendered HTML, which on the PPA bracket
 * page already includes the most-advanced rounds (Final + Semis,
 * 3 matches typical for an 8-team draw). Earlier rounds (R32/R16/QF)
 * are not in this dump; see the file header comment for the trade-off
 * discussion + Sprint 7 follow-up options.
 */
async function renderWithBrowserRendering(env: Env, url: string): Promise<string> {
  await withStage("env-validate", async () => {
    if (!env.CLOUDFLARE_ACCOUNT_ID) {
      throw new Error(
        "CLOUDFLARE_ACCOUNT_ID env var missing — set in wrangler.toml [vars]",
      );
    }
    if (!env.CLOUDFLARE_API_TOKEN) {
      throw new Error(
        "CLOUDFLARE_API_TOKEN secret missing — run `wrangler secret put CLOUDFLARE_API_TOKEN`",
      );
    }
  });

  const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/browser-rendering/content`;

  // Browser Rendering REST /content endpoint does NOT accept an `actions`
  // field (verified 2026-05: returns 400 "unrecognized_keys ['actions']").
  // That means we can't drive the MLP day-navigation arrows server-side.
  //
  // MLP day-coverage strategy for MVP:
  //   The MLP event page's React island defaults to the current GMT+7
  //   day on each load. The cron Worker runs every 6h, so over a
  //   regular-season week the default day rotates through each
  //   tournament day and the per-day matchups get ingested incrementally.
  //   Admins can also manually click "Scrape now" to force an early
  //   capture of the current day. Earlier (already-archived) days that
  //   the page no longer defaults to require either:
  //     a) Switching to a different Cloudflare endpoint that supports
  //        page interactions (e.g. the Browser Rendering puppeteer
  //        Workers binding — has its own timeout issues, see file
  //        header comment), or
  //     b) MLP exposing a date query param on the URL (not currently).
  //   Tracking (a)/(b) as a Sprint 8 follow-up.
  //
  // Body shape per Cloudflare API docs (2026-05):
  //   url             — the page to render
  //   gotoOptions     — Puppeteer page.goto() options
  //   waitForTimeout  — dwell time after navigation for client-side
  //                     hydration to flush into the DOM
  const isMlp = /majorleaguepickleball\.co/i.test(url);
  const requestBody: Record<string, unknown> = {
    url,
    gotoOptions: {
      // MLP page's React island fetches matchup data after main load
      // finishes, so for MLP we wait for the network to settle —
      // `networkidle2` allows the React-Query loader to fire, then
      // ≤2 in-flight requests indicates the schedule is ready. PPA RSC
      // keeps `domcontentloaded` because its RSC chunks land during
      // DOM construction.
      waitUntil: isMlp ? ("networkidle2" as const) : ("domcontentloaded" as const),
      timeout: PAGE_GOTO_TIMEOUT_MS,
    },
    // Settle window. MLP gets a longer dwell so any deferred article.sec
    // mount lands in the captured DOM.
    waitForTimeout: isMlp ? 20_000 : RSC_SETTLE_TIMEOUT_MS,
  };
  if (isMlp) {
    // MLP's Schedule & Scores section is lazy-mounted via an intersection
    // observer + a deferred React-Query fetch — the React island only
    // fires when the section scrolls into view. PR #168 set a tall
    // viewport (1920×8000), but in practice CF Browser Rendering's
    // initial scroll position is still at the top of the page and the
    // observer needs the actual scroll event to trigger. Test on
    // 2026-05-26 with HTML length 339KB and 0 article.sec hits confirmed
    // the section stayed in "Loading..." state.
    //
    // Fix: keep the tall viewport AND inject a script that:
    //   1. Scrolls progressively down the page (kicks the intersection
    //      observer and any IntersectionObserver-backed lazy components).
    //   2. Clicks the "SEE ALL" button when it appears — the SEE ALL
    //      view expands all matchups into the main DOM in one shot,
    //      which is what our parser is tuned for.
    //
    // waitForTimeout below gives the injected script ~25s of wall clock
    // to find + click the button and let React commit the matchup rows.
    requestBody.viewport = {
      width: 1920,
      height: 8000,
      deviceScaleFactor: 1,
    };
    requestBody.addScriptTag = [
      {
        content: `
          (function(){
            // Step 1 — wake the intersection observer by scrolling down.
            let y = 0;
            const scrollInterval = setInterval(() => {
              y += 500;
              window.scrollTo(0, y);
              if (y > document.body.scrollHeight) clearInterval(scrollInterval);
            }, 200);

            // Step 2 — poll for the SEE ALL button and click it.
            const seeAllInterval = setInterval(() => {
              const btn = Array.from(document.querySelectorAll('button, a')).find(
                el => el.textContent && el.textContent.trim().toUpperCase() === 'SEE ALL'
              );
              if (btn) {
                btn.click();
                clearInterval(seeAllInterval);
              }
            }, 500);
            // Stop polling after 10s — gives React time to commit.
            setTimeout(() => clearInterval(seeAllInterval), 10000);
          })();
        `,
      },
    ];
    // Longer dwell so the injected script has time to scroll + click +
    // React commits the matchup rows.
    requestBody.waitForTimeout = 25_000;
  }

  // AbortController guards against the upstream fetch hanging beyond
  // our outer ceiling — independent of CF's own internal timeouts.
  const controller = new AbortController();
  const abortTimer = setTimeout(
    () => controller.abort(new Error(`render-fetch hit ${RENDER_FETCH_TIMEOUT_MS}ms ceiling`)),
    RENDER_FETCH_TIMEOUT_MS,
  );

  let res: Response;
  try {
    res = await withStage("render-fetch", () =>
      fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      }),
    );
  } finally {
    clearTimeout(abortTimer);
  }

  // Read body text first so we can include it in error messages even
  // when the JSON shape is unexpected (CF sometimes returns plaintext
  // 5xx bodies on infrastructure failures).
  const responseText = await res.text();

  if (!res.ok) {
    throw new Error(
      `[render-http] ${res.status} ${res.statusText}: ${responseText.slice(0, 500)}`,
    );
  }

  return await withStage("render-parse", async () => {
    let envelope: CfApiEnvelope<string>;
    try {
      envelope = JSON.parse(responseText) as CfApiEnvelope<string>;
    } catch (err) {
      throw new Error(
        `Cloudflare response is not JSON (first 200 chars): ${responseText.slice(0, 200)}`,
      );
    }
    if (!envelope.success) {
      const errMsgs = (envelope.errors ?? [])
        .map((e) => `${e.code}: ${e.message}`)
        .join("; ");
      throw new Error(
        `Cloudflare API success=false. Errors: ${errMsgs || "(none reported)"}`,
      );
    }
    if (typeof envelope.result !== "string" || envelope.result.length === 0) {
      throw new Error(
        `Cloudflare API returned success=true but result is empty/non-string`,
      );
    }
    return envelope.result;
  });
}

/* ─── Watchlist polling (scheduled handler) ─────────────────────────── */

interface WatchlistRow {
  id: string;
  tournament_url: string;
  scrape_frequency: "daily" | "weekly" | "on_event_end" | "manual";
}

async function fetchDueWatchlistRows(env: Env): Promise<WatchlistRow[]> {
  // Match active rows where next_scrape_at is in the past OR is NULL.
  // Codex P1 fix on PR #160: the original `next_scrape_at=lte.<now>` filter
  // silently excluded freshly-inserted rows (the admin UI doesn't set
  // next_scrape_at on INSERT), so newly added tournaments were never
  // picked up by cron until an admin manually scraped them. The PostgREST
  // `or=(...)` syntax treats NULL as "never scraped, so due now".
  const nowIso = new Date().toISOString();
  const url =
    `${env.SUPABASE_URL}/rest/v1/pro_tour_watchlist` +
    `?select=id,tournament_url,scrape_frequency` +
    `&status=eq.active` +
    `&or=(next_scrape_at.is.null,next_scrape_at.lte.${nowIso})`;
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

/**
 * Update an existing pro_tour_ingestion_logs row to status='failed'.
 * Called from runScrape when render or ingest fails AND the trigger
 * function pre-created a log row. Without this, render failures would
 * leave the row stuck on 'running' indefinitely.
 */
async function markLogFailed(
  env: Env,
  logId: string,
  errorMessage: string,
  durationMs: number,
): Promise<void> {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/pro_tour_ingestion_logs?id=eq.${logId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        status: "failed",
        error_message: errorMessage.slice(0, 4000),
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
      }),
    },
  );
  if (!res.ok) {
    console.error(
      `markLogFailed PATCH ${logId} failed: ${res.status} ${(await res.text()).slice(0, 300)}`,
    );
  }
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
