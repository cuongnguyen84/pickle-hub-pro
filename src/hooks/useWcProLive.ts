// ============================================================================
// useWcProLive — the five OPEN/Pro individual events for the /live panel
//
// Reads wc_pro_matches (live matches + every Vietnamese match, kept fresh by the
// wc-open-scraper worker) and subscribes to Supabase Realtime so a scored point
// repaints the board with no refresh. Grouped by the five Pro categories, with
// in-progress matches first, then Vietnamese matches, newest-seen first.
//
// Like useWcOpenLive, the table is newer than the generated Supabase types, so
// the query casts the table name (the repo's existing pattern for pre-regen
// tables); the row shape is declared locally.
// ============================================================================

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelSuffix } from "@/lib/uniqueChannelId";

export const PRO_EVENT_ORDER = [
  "pro_singles_mens",
  "pro_singles_womens",
  "pro_doubles_mens",
  "pro_doubles_womens",
  "pro_mixed",
] as const;
export type ProEvent = (typeof PRO_EVENT_ORDER)[number];

export interface WcProMatchRow {
  match_id: string;
  category_id: ProEvent;
  division_name: string | null;
  round_name: string | null;
  round_num: number | null;
  entry_a_name: string | null;
  entry_a_seed: number | null;
  entry_b_name: string | null;
  entry_b_seed: number | null;
  current_a: number | null;
  current_b: number | null;
  games_json: { a: number; b: number }[] | null;
  serving_side: "A" | "B" | null;
  leader_side: "A" | "B" | null;
  status: "scheduled" | "in_progress" | "completed";
  is_vietnam: boolean;
  venue_name: string | null;
  court_label: string | null;
  scheduled_at: string | null;
}

export interface WcProEventGroup {
  event: ProEvent;
  live: WcProMatchRow[];
  vietnam: WcProMatchRow[];
}

export interface WcProFeed {
  events: WcProEventGroup[];
  liveCount: number;
}

const QUERY_KEY = ["wc-pro-live"] as const;

// in-progress first, then completed (recent result), then scheduled; within a
// status, most recently played first via match index.
const STATUS_RANK: Record<string, number> = { in_progress: 0, completed: 1, scheduled: 2 };

async function fetchWcProFeed(): Promise<WcProFeed> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (supabase as any)
    .from("wc_pro_matches")
    .select(
      "match_id,category_id,division_name,round_name,round_num,entry_a_name,entry_a_seed,entry_b_name,entry_b_seed,current_a,current_b,games_json,serving_side,leader_side,status,is_vietnam,venue_name,court_label,scheduled_at",
    )
    .order("last_seen_at", { ascending: false });
  if (res.error) throw res.error;
  const rows = (res.data ?? []) as WcProMatchRow[];

  const events: WcProEventGroup[] = PRO_EVENT_ORDER.map((event) => {
    const forEvent = rows.filter((r) => r.category_id === event);
    const sortByState = (a: WcProMatchRow, b: WcProMatchRow) =>
      (STATUS_RANK[a.status] ?? 3) - (STATUS_RANK[b.status] ?? 3);
    return {
      event,
      live: forEvent.filter((r) => r.status === "in_progress"),
      // Vietnamese matches that aren't already shown in the live column.
      vietnam: forEvent.filter((r) => r.is_vietnam && r.status !== "in_progress").sort(sortByState),
    };
  }).filter((g) => g.live.length > 0 || g.vietnam.length > 0);

  return { events, liveCount: rows.filter((r) => r.status === "in_progress").length };
}

/** Live Pro-event data for /live, repainting on every scraped score change. */
export function useWcProLive() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchWcProFeed,
    refetchInterval: 60_000,
    staleTime: 20_000,
  });

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`wc-pro-live:${uniqueChannelSuffix()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "wc_pro_matches" }, () =>
          queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
        );
      channel.subscribe();
    } catch (err) {
      console.warn("[wc-pro-live] realtime setup failed:", err);
    }
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}
