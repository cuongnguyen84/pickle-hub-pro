/**
 * Ingest PPA and MLP results into public.matches via the existing
 * pro-tour-ingest edge function.
 *
 *   node scripts/pro-tour/run-ingest.mjs
 *       Rolling window (last 21 days through 2 days ahead). POSTs only when
 *       SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set. Otherwise exits 0
 *       without fetching. This is what the GitHub Actions cron runs.
 *
 *   node scripts/pro-tour/run-ingest.mjs --backfill
 *       Oct–Nov 2026 plan (Chicago through Daytona, MLP Nations Cup).
 *       Prints counts. Does not write.
 *
 *   node scripts/pro-tour/run-ingest.mjs --backfill --execute
 *       Same window, POSTs. Still a no-op (exit 0) when the two secrets
 *       are missing. Do not run this against production from CI.
 *
 *   --dry-run   Fetch and print, never POST, secrets not required.
 *
 * Dedupe is (source_provider, external_match_id) inside pro-tour-ingest,
 * so repeating a run updates scores in place and does not insert a second
 * row. This script does not apply migrations and does not touch blog posts.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePpaScoresFeed, type PpaScoresFeed } from "../../src/lib/pro-tour/adapters/ppa-scores-feed";
import { parseMlpEventMatchups, type MlpEventMatchupsPayload } from "../../src/lib/pro-tour/adapters/mlp-event-matchups";
import {
  BACKFILL_END,
  BACKFILL_START,
  MLP_BACKFILL_EVENTS,
  chunkScrape,
  parseMlpEventUuid,
  parseMlpSchedule,
  parsePpaEventId,
  parsePpaSchedule,
  rangesOverlap,
  rollingWindow,
  secretsReady,
  selectCoverageEvents,
  type CoverageEvent,
  type PlannedMlpEvent,
  type PlannedPpaEvent,
} from "../../src/lib/pro-tour/ingest-plan";
import type { TournamentScrapeResult } from "../../src/lib/pro-tour/types";

function repoRoot(): string {
  // The runner bundles this file, so import.meta.url is not the source path.
  // Prefer the directory that actually contains the coverage catalog.
  const fromSource = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  for (const dir of [process.cwd(), fromSource]) {
    if (existsSync(resolve(dir, "scripts/ops/team_tournament_coverage.json"))) return dir;
  }
  return process.cwd();
}

const ROOT = repoRoot();
const COVERAGE = resolve(ROOT, "scripts/ops/team_tournament_coverage.json");
const PPA_EVENTS = "https://www.ppatour.com/events/";
const MLP_HOME = "https://majorleaguepickleball.co/";
const MLP_MATCHUPS = "https://majorleaguepickleball.co/wp-json/fau-scores-and-stats/v1/event-matchups";
const CHUNK = 40;
const UA = "ThePickleHub-results/1.0";

interface Args {
  backfill: boolean;
  execute: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  return {
    backfill: argv.includes("--backfill"),
    execute: argv.includes("--execute"),
    dryRun: argv.includes("--dry-run"),
  };
}

async function fetchText(url: string, headers: Record<string, string> = {}): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,application/json", ...headers }, signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

function loadCoverage(): CoverageEvent[] {
  const raw = JSON.parse(readFileSync(COVERAGE, "utf8")) as { events?: CoverageEvent[] };
  return raw.events ?? [];
}

async function discoverPpa(windowStart: string, windowEnd: string): Promise<PlannedPpaEvent[]> {
  const byId = new Map<string, PlannedPpaEvent>();
  for (const event of selectCoverageEvents(loadCoverage(), windowStart, windowEnd)) {
    byId.set(event.eventId, event);
  }
  let scheduleHtml = "";
  try {
    scheduleHtml = await fetchText(PPA_EVENTS);
  } catch (err) {
    console.error(`ppa schedule: ${err instanceof Error ? err.message : String(err)}`);
  }
  for (const item of parsePpaSchedule(scheduleHtml)) {
    if (!rangesOverlap(item.start, item.end, windowStart, windowEnd)) continue;
    try {
      const id = parsePpaEventId(await fetchText(item.url));
      if (!id || byId.has(id)) continue;
      byId.set(id, {
        eventId: id,
        tournamentName: item.name,
        sourceUrl: item.url,
        fallbackDate: item.end,
      });
    } catch (err) {
      console.error(`ppa event page ${item.url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return [...byId.values()];
}

async function discoverMlp(windowStart: string, windowEnd: string, backfill: boolean): Promise<PlannedMlpEvent[]> {
  const byUrl = new Map<string, PlannedMlpEvent>();
  const consider = (event: PlannedMlpEvent) => {
    const url = event.url.endsWith("/") ? event.url : `${event.url}/`;
    if (byUrl.has(url)) return;
    if (!rangesOverlap(event.start, event.end, windowStart, windowEnd)) return;
    byUrl.set(url, { ...event, url });
  };
  if (backfill) for (const event of MLP_BACKFILL_EVENTS) consider(event);
  try {
    for (const event of parseMlpSchedule(await fetchText(MLP_HOME))) consider(event);
  } catch (err) {
    console.error(`mlp menu: ${err instanceof Error ? err.message : String(err)}`);
  }
  return [...byUrl.values()];
}

async function postChunk(
  supabaseUrl: string,
  serviceKey: string,
  scrape: TournamentScrapeResult,
  triggeredBy: "manual" | "scheduled",
): Promise<{ matches_imported?: number }> {
  const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/pro-tour-ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({
      scrape_result: scrape,
      triggered_by: triggeredBy,
      triggered_by_user_id: null,
      watchlist_id: null,
      duration_ms: 0,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`pro-tour-ingest ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as { matches_imported?: number };
}

async function publish(
  scrape: TournamentScrapeResult,
  label: string,
  write: boolean,
  supabaseUrl: string,
  serviceKey: string,
  triggeredBy: "manual" | "scheduled",
): Promise<void> {
  if (scrape.matches.length === 0) {
    console.log(`${label}: 0 matches, skipped`);
    return;
  }
  const finals = scrape.matches.filter((m) => m.round_name === "F").length;
  console.log(`${label}: ${scrape.matches.length} matches (${finals} finals), ${scrape.players.length} players`);
  if (!write) return;
  let imported = 0;
  for (const chunk of chunkScrape(scrape, CHUNK)) {
    const body = await postChunk(supabaseUrl, serviceKey, chunk, triggeredBy);
    imported += body.matches_imported ?? 0;
  }
  console.log(`${label}: pro-tour-ingest reported ${imported} new rows (existing ids are updated in place)`);
}

async function ingestPpa(event: PlannedPpaEvent, write: boolean, url: string, key: string, triggeredBy: "manual" | "scheduled"): Promise<void> {
  const label = `ppa ${event.tournamentName}`;
  const raw = await fetchText(`https://www.ppatour.com/api/scores/?event=${event.eventId}`, { Accept: "application/json" });
  const feed = JSON.parse(raw) as PpaScoresFeed;
  const scrape = parsePpaScoresFeed(feed, {
    eventId: event.eventId,
    tournamentName: event.tournamentName,
    sourceUrl: event.sourceUrl,
    fallbackDate: event.fallbackDate,
  });
  await publish(scrape, label, write, url, key, triggeredBy);
}

async function ingestMlp(event: PlannedMlpEvent, write: boolean, url: string, key: string, triggeredBy: "manual" | "scheduled"): Promise<void> {
  const label = `mlp ${event.name}`;
  const page = await fetchText(event.url);
  const uuid = parseMlpEventUuid(page);
  if (!uuid) {
    console.log(`${label}: no scoreTickerEventUuid, skipped`);
    return;
  }
  const raw = await fetchText(`${MLP_MATCHUPS}?event_uuid=${uuid}`, {
    Accept: "application/json",
    Origin: "https://majorleaguepickleball.co",
    Referer: event.url,
  });
  const scrape = parseMlpEventMatchups(JSON.parse(raw) as MlpEventMatchupsPayload, {
    eventUrl: event.url,
    tournamentName: event.name,
  });
  if (!scrape) {
    console.log(`${label}: matchup payload had no list, skipped`);
    return;
  }
  await publish(scrape, label, write, url, key, triggeredBy);
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const write = !args.dryRun && (!args.backfill || args.execute);
  const env = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  if (write && !secretsReady(env)) {
    console.log("pro-results-ingest: no-op (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set)");
    return 0;
  }
  const window = args.backfill ? { start: BACKFILL_START, end: BACKFILL_END } : rollingWindow();
  const mode = args.backfill ? "backfill" : "rolling";
  console.log(`pro-results-ingest: ${mode} ${window.start}..${window.end} ${write ? "write" : "dry-run"}`);

  const triggeredBy = args.backfill ? "manual" : "scheduled";
  const url = env.SUPABASE_URL ?? "";
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  let failures = 0;

  const ppa = await discoverPpa(window.start, window.end);
  for (const event of ppa) {
    try {
      await ingestPpa(event, write, url, key, triggeredBy);
    } catch (err) {
      failures += 1;
      console.error(`${event.tournamentName}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const mlp = await discoverMlp(window.start, window.end, args.backfill);
  for (const event of mlp) {
    try {
      await ingestMlp(event, write, url, key, triggeredBy);
    } catch (err) {
      failures += 1;
      console.error(`${event.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (ppa.length + mlp.length === 0) console.log("pro-results-ingest: no events in window");
  if (failures > 0) {
    console.error(`pro-results-ingest: ${failures} event(s) failed`);
    return 1;
  }
  return 0;
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
}
