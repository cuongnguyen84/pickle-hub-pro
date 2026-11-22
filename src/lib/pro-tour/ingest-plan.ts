/**
 * Pure planning for the pro-results ingest: which catalog events fall in
 * a window, and how to read the public PPA schedule / MLP menu HTML.
 * Network and database writes live in scripts/pro-tour/ingest-results.ts.
 */

import type { ScrapedMatch, TournamentScrapeResult } from "./types";

export interface CoverageEvent {
  key?: string;
  title?: string;
  name?: string;
  start_date?: string;
  end_date?: string;
  event_id?: string;
  result_source?: string;
  source?: string;
  enabled?: boolean;
}

export interface PlannedPpaEvent {
  eventId: string;
  tournamentName: string;
  sourceUrl: string;
  fallbackDate: string;
}

export interface PlannedMlpEvent {
  url: string;
  name: string;
  start: string;
  end: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const BACKFILL_START = "2026-10-01";
export const BACKFILL_END = "2026-11-30";

/** Rolling window the cron uses: recently finished plus a couple of days ahead. */
export const ROLLING_LOOKBACK_DAYS = 21;
export const ROLLING_LOOKAHEAD_DAYS = 2;

/**
 * MLP events the public menu may drop once the season page is rebuilt.
 * The Oct–Nov 2026 backfill always includes these, deduped by URL.
 */
export const MLP_BACKFILL_EVENTS: PlannedMlpEvent[] = [
  {
    url: "https://majorleaguepickleball.co/events-2026/mlp-nations-cup/",
    name: "MLP Nations Cup",
    start: "2026-10-30",
    end: "2026-11-01",
  },
];

export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && aEnd >= bStart;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function todayUtc(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function rollingWindow(now = new Date()): { start: string; end: string } {
  const today = todayUtc(now);
  return {
    start: addDays(today, -ROLLING_LOOKBACK_DAYS),
    end: addDays(today, ROLLING_LOOKAHEAD_DAYS),
  };
}

export function coverageTournamentName(event: CoverageEvent): string {
  const name = (event.name || event.title || event.key || "").trim();
  return name || "PPA Tour";
}

/** Catalog rows that have a PPA scores-feed id and overlap the window. */
export function selectCoverageEvents(
  events: CoverageEvent[],
  windowStart: string,
  windowEnd: string,
): PlannedPpaEvent[] {
  const out: PlannedPpaEvent[] = [];
  const seen = new Set<string>();
  for (const event of events) {
    if (event.enabled === false) continue;
    const id = event.event_id ?? "";
    if (!UUID.test(id) || seen.has(id)) continue;
    if (!event.start_date || !event.end_date || !ISO.test(event.start_date) || !ISO.test(event.end_date)) continue;
    if (!rangesOverlap(event.start_date, event.end_date, windowStart, windowEnd)) continue;
    const src = event.result_source ?? "";
    if (!src.includes("/api/scores/")) continue;
    seen.add(id);
    out.push({
      eventId: id,
      tournamentName: coverageTournamentName(event),
      sourceUrl: event.source || src,
      fallbackDate: event.end_date,
    });
  }
  return out;
}

export interface ScheduledPpaEvent {
  name: string;
  start: string;
  end: string;
  url: string;
}

function walkJsonLd(node: unknown, out: ScheduledPpaEvent[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walkJsonLd(item, out);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (
    obj["@type"] === "SportsEvent" &&
    typeof obj.startDate === "string" &&
    typeof obj.url === "string" &&
    obj.url.includes("ppatour.com/events/")
  ) {
    const start = obj.startDate.slice(0, 10);
    const end = (typeof obj.endDate === "string" ? obj.endDate : obj.startDate).slice(0, 10);
    if (ISO.test(start) && ISO.test(end)) {
      out.push({
        name: typeof obj.name === "string" && obj.name.trim() ? obj.name.trim() : "PPA Tour",
        start,
        end,
        url: obj.url,
      });
    }
  }
  if (obj.item) walkJsonLd(obj.item, out);
  if (obj.itemListElement) walkJsonLd(obj.itemListElement, out);
}

/** SportsEvent entries from the ppatour.com/events JSON-LD schedule. */
export function parsePpaSchedule(html: string): ScheduledPpaEvent[] {
  const out: ScheduledPpaEvent[] = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  for (const block of html.matchAll(re)) {
    try {
      walkJsonLd(JSON.parse(block[1]), out);
    } catch {
      // A non-event JSON-LD block (breadcrumb, org) is ignored.
    }
  }
  return out;
}

/** eventId from an event page, escaped or not. */
export function parsePpaEventId(html: string): string | null {
  const m = html.match(/eventId\\?":\\?"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return m?.[1] ?? null;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function iso(year: number, month: number, day: number): string | null {
  if (!month || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCMonth() !== month - 1) return null;
  return dt.toISOString().slice(0, 10);
}

/** "Oct 30-Nov 1", "Aug 28-30", "July 30 – Aug 2" → inclusive dates in `year`. */
export function parseMlpDateLabel(label: string, year: number): { start: string; end: string } | null {
  const text = label.replace(/\s+/g, " ").trim();
  const m = text.match(/([A-Za-z]+)\s+(\d{1,2})(?:\s*[-–—]\s*(?:([A-Za-z]+)\s+)?(\d{1,2}))?/);
  if (!m) return null;
  const month1 = MONTHS[m[1].toLowerCase()];
  const day1 = Number(m[2]);
  const month2 = m[3] ? MONTHS[m[3].toLowerCase()] : month1;
  const day2 = m[4] ? Number(m[4]) : day1;
  if (!month1 || !month2) return null;
  const endYear = month2 < month1 ? year + 1 : year;
  const start = iso(year, month1, day1);
  const end = iso(endYear, month2, day2);
  if (!start || !end || end < start) return null;
  return { start, end };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#8211;|&#8212;|&ndash;|&mdash;/g, "-")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Event links in the MLP site menu, deduped by URL. */
export function parseMlpSchedule(html: string): PlannedMlpEvent[] {
  const re = /href="(https:\/\/majorleaguepickleball\.co\/events-(\d{4})\/[a-z0-9-]+\/?)"><b>([^<]+)<\/b>\s*([^<]*)</gi;
  const byUrl = new Map<string, PlannedMlpEvent>();
  for (const m of html.matchAll(re)) {
    const url = m[1].endsWith("/") ? m[1] : `${m[1]}/`;
    if (byUrl.has(url)) continue;
    const year = Number(m[2]);
    const name = decodeEntities(m[3]).replace(/:\s*$/, "").trim();
    const dates = parseMlpDateLabel(decodeEntities(m[4]), year);
    if (!name || !dates) continue;
    byUrl.set(url, {
      url,
      name: /^mlp\b/i.test(name) ? name : `MLP ${name}`,
      start: dates.start,
      end: dates.end,
    });
  }
  return [...byUrl.values()];
}

export function parseMlpEventUuid(html: string): string | null {
  const m = html.match(/scoreTickerEventUuid\\?":\\?"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return m?.[1] ?? null;
}

export function secretsReady(env: { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string }): boolean {
  return Boolean(env.SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

/** Split a scrape into ingest-sized batches. Every batch carries the players its matches name. */
export function chunkScrape(result: TournamentScrapeResult, size: number): TournamentScrapeResult[] {
  const step = Math.max(1, size);
  const chunks: TournamentScrapeResult[] = [];
  for (let i = 0; i < result.matches.length; i += step) {
    const matches: ScrapedMatch[] = result.matches.slice(i, i + step);
    const ids = new Set(matches.flatMap((m) => [...m.team_one.player_external_ids, ...m.team_two.player_external_ids]));
    chunks.push({
      ...result,
      matches,
      players: result.players.filter((p) => ids.has(p.external_id)),
    });
  }
  return chunks;
}
