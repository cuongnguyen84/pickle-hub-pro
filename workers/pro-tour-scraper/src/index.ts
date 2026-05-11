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

async function renderWithBrowserRendering(env: Env, url: string): Promise<string> {
  const browser = await puppeteer.launch(env.MYBROWSER);
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30_000 });

    // Iterate round buttons so each panel hydrates into the same DOM
    // dump. Round labels per Cuong's spec: R32, R16, QF, SF, F.
    // The click() is fire-and-wait; if the button doesn't exist for
    // this draw size (e.g. small event with only QF/SF/F), the loop
    // is a no-op for that label.
    const rounds = ["R32", "R16", "QF", "SF", "F"];
    for (const label of rounds) {
      await page.evaluate((needle: string) => {
        const buttons = Array.from(
          document.querySelectorAll<HTMLElement>("[role='button'], button"),
        );
        const target = buttons.find((b) => b.textContent?.trim() === needle);
        target?.click();
      }, label);
      // Settle RSC stream — 800ms covers the typical hydration window.
      // Adjust upward if rounds with many matches need more.
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    return await page.content();
  } finally {
    await browser.close();
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
