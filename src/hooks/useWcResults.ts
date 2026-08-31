// ============================================================================
// useWcResults — every World Cup 2026 Pro match, for the results page.
//
// Distinct from useWcProLive on purpose. That hook feeds the /live board and
// keeps only what a live board needs: in-progress matches plus Vietnamese ones,
// grouped by event. The results page needs the opposite shape — every completed
// match, grouped by the Vietnam-time day it finished — so filtering there and
// re-deriving here would mean reading the same table twice with two different
// definitions of "interesting".
//
// No Realtime subscription here, unlike the live board: a results page does not
// need to repaint on a scored point, and a Realtime channel per article reader
// is a cost with no reader-visible payoff. A 60s refetch is well inside the
// scraper's own 1-minute cadence.
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
  /** Newest last_seen_at across the feed — what the page shows as "cập nhật". */
  dataUpdatedAt: string | null;
}

type RowWithSeen = WcProMatchRow & { last_seen_at: string | null };

const COLS =
  "match_id,category_id,division_name,round_name,round_num,entry_a_name,entry_a_seed," +
  "entry_b_name,entry_b_seed,current_a,current_b,games_json,serving_side,leader_side," +
  "status,is_vietnam,venue_name,court_label,scheduled_at,last_seen_at";

/** Vietnam-time calendar day (GMT+7, no DST) for an ISO timestamp. */
export function vnDayKey(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

async function fetchWcResults(): Promise<WcResultsFeed> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (supabase as any)
    .from("wc_pro_matches")
    .select(COLS)
    .order("last_seen_at", { ascending: false })
    .limit(500);
  if (res.error) throw res.error;
  const rows = (res.data ?? []) as RowWithSeen[];

  const live = rows.filter((r) => r.status === "in_progress");
  const done = rows.filter((r) => r.status === "completed");

  const byDay = new Map<string, WcProMatchRow[]>();
  for (const m of done) {
    const key = vnDayKey(m.last_seen_at ?? m.scheduled_at);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(m);
    else byDay.set(key, [m]);
  }

  return {
    live,
    days: [...byDay.keys()]
      .sort()
      .reverse()
      .map((day) => ({ day, matches: byDay.get(day) ?? [] })),
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
