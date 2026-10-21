// ============================================================================
// useWcResults — the World Cup 2026 Pro matches, shaped for the results page.
//
// Distinct from useWcProLive on purpose. That hook feeds the /live board and
// keeps only what a live board needs: in-progress matches plus Vietnamese ones,
// grouped by event. The results page needs the opposite shape — every completed
// match, grouped by the Vietnam day it was played — so filtering there and
// re-deriving here would mean reading the same table twice under two different
// definitions of "interesting".
//
// No Realtime subscription here, unlike the live board: a results page does not
// need to repaint on a scored point, and a Realtime channel per article reader
// is a cost with no reader-visible payoff. A 60s refetch sits inside the
// scraper's own 1-minute cadence.
//
// Mirror of functions/_lib/render/wc-results.ts, which renders the same feed
// for bots. Change one, change the other: a fact visible to a reader and absent
// from the crawl is a page that tells Google less than it tells a person.
// ============================================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { WcProMatchRow } from "@/hooks/useWcProLive";

export interface WcResultsDay {
  /** YYYY-MM-DD in Vietnam time. "" when the row carries no usable timestamp. */
  day: string;
  matches: WcProMatchRow[];
}

export interface WcResultsFeed {
  live: WcProMatchRow[];
  days: WcResultsDay[];
  completedCount: number;
  vietnamCount: number;
  /** True when the budget forced older days down to Vietnamese matches only. */
  trimmed: boolean;
  /** Newest last_seen_at across the feed — the page's "cập nhật lần cuối". */
  dataUpdatedAt: string | null;
}

type RowWithSeen = WcProMatchRow & { last_seen_at: string | null };

const COLS =
  "match_id,category_id,division_name,round_name,round_num,entry_a_name,entry_a_seed," +
  "entry_b_name,entry_b_seed,current_a,current_b,games_json,serving_side,leader_side," +
  "status,is_vietnam,venue_name,court_label,scheduled_at,last_seen_at";

// PostgREST returns at most 1000 rows and reports the truncation only in
// Content-Range, so an unpaginated read looks fine while returning a prefix.
// Since the scraper started keeping every completed match the table passes that
// mid-tournament, and the prefix it would return is the newest rows — silently
// amputating the archive this page exists for.
const PAGE = 1000;
/** Hard ceiling on rows read, so a runaway feed cannot hang the article. */
const MAX_ROWS = 6000;
/** Completed rows rendered in full before the budget starts protecting only
 *  Vietnamese matches. Mirrors DISPLAY_CAP in the SSR module. */
export const DISPLAY_CAP = 600;

/** Vietnam-time calendar day for a real UTC timestamp (GMT+7, no DST). */
export function vnDayFromUtc(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * The Vietnam day a match belongs to. scheduled_at is the organizers' Vietnam
 * wall-clock stored verbatim (see the wc_pro_matches migration), so its date is
 * taken as-is — shifting it by +7 would push every evening match onto the next
 * day. last_seen_at is a genuine UTC instant and only a fallback: it records
 * when we noticed the result, not when the match was played.
 */
export function matchDayKey(row: {
  scheduled_at: string | null;
  last_seen_at?: string | null;
}): string {
  const sched = row.scheduled_at;
  if (sched && !Number.isNaN(Date.parse(sched))) return sched.slice(0, 10);
  return vnDayFromUtc(row.last_seen_at);
}

/**
 * Group completed matches by playing day, newest first, spending a row budget.
 *
 * Whole days render until the budget is gone; after that a day contributes only
 * its Vietnamese matches. Never drops a Vietnamese result — that is the archive
 * this page exists for, and it is the smallest slice, so protecting it is
 * nearly free. Mirrors selectDaysForDisplay in the SSR module: change one,
 * change the other, or a reader and a crawler see different tables.
 */
export function selectDaysForDisplay(
  done: WcProMatchRow[],
  cap: number,
): { days: WcResultsDay[]; trimmed: boolean } {
  const byDay = new Map<string, WcProMatchRow[]>();
  for (const m of done) {
    const key = matchDayKey(m);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(m);
    else byDay.set(key, [m]);
  }
  const ordered = [...byDay.keys()].sort().reverse();

  const days: WcResultsDay[] = [];
  let spent = 0;
  let trimmed = false;
  for (const day of ordered) {
    const all = byDay.get(day) ?? [];
    if (spent + all.length <= cap) {
      days.push({ day, matches: all });
      spent += all.length;
      continue;
    }
    const vn = all.filter((m) => m.is_vietnam);
    if (vn.length !== all.length) trimmed = true;
    if (vn.length > 0) days.push({ day, matches: vn });
    spent += vn.length;
  }
  return { days, trimmed };
}

/** Exported for tests: the grouping is the part with rules in it. */
export async function fetchWcResults(): Promise<WcResultsFeed> {
  const rows: RowWithSeen[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (supabase as any)
      .from("wc_pro_matches")
      .select(COLS)
      .order("last_seen_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (res.error) throw res.error;
    const page = (res.data ?? []) as RowWithSeen[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }

  const live = rows.filter((r) => r.status === "in_progress");
  const done = rows.filter((r) => r.status === "completed");
  const { days, trimmed } = selectDaysForDisplay(done, DISPLAY_CAP);

  return {
    live,
    days,
    trimmed,
    completedCount: done.length,
    vietnamCount: done.filter((m) => m.is_vietnam).length,
    dataUpdatedAt:
      rows.map((r) => r.last_seen_at).filter((v): v is string => !!v).sort().pop() ?? null,
  };
}

export function useWcResults() {
  return useQuery({
    queryKey: ["wc-results"],
    queryFn: fetchWcResults,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
