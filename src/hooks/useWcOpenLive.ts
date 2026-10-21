// ============================================================================
// useWcOpenLive — World Cup 2026 OPEN national-team feed for the /live panel
//
// Reads the wc_open_* tables (seeded + kept fresh by the wc-open-scraper
// worker) and subscribes to Supabase Realtime so the panel repaints the moment
// a scraped update lands, with no refresh. Scope is OPEN + national team only.
//
// The wc_open_* tables are newer than src/integrations/supabase/types.ts, which
// is regenerated separately, so the queries cast the table name — the same
// `.from("<table>" as any)` pattern useAuditLog and AdminReports already use
// for tables that predate a types regen. Row shapes are declared locally and
// asserted at the query boundary, so the rest of the module stays fully typed.
// ============================================================================

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelSuffix } from "@/lib/uniqueChannelId";

export interface WcOpenTeamRow {
  slug: string;
  group_letter: string;
  seed: number | null;
  name_vi: string;
  name_en: string;
  country_code: string | null;
}

export interface WcOpenMatchRow {
  match_id: string;
  group_letter: string;
  round: string | null;
  home_slug: string;
  away_slug: string;
  home_score: number | null;
  away_score: number | null;
  status: "scheduled" | "live" | "final";
  court: string | null;
  start_time: string | null;
}

export interface WcOpenGroup {
  letter: string;
  teams: WcOpenTeamRow[];
  matches: WcOpenMatchRow[];
}

export interface WcOpenFeed {
  groups: WcOpenGroup[];
  /** True when any tie is currently being played — drives the "Live" pill. */
  hasLive: boolean;
  /** True before the team competition starts: teams seeded, no matches yet. */
  drawOnly: boolean;
}

const QUERY_KEY = ["wc-open-live"] as const;

async function fetchWcOpenFeed(): Promise<WcOpenFeed> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teamsRes = await (supabase as any)
    .from("wc_open_teams")
    .select("slug,group_letter,seed,name_vi,name_en,country_code")
    .order("group_letter", { ascending: true })
    .order("seed", { ascending: true, nullsFirst: false })
    .order("name_en", { ascending: true });
  if (teamsRes.error) throw teamsRes.error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matchesRes = await (supabase as any)
    .from("wc_open_matches")
    .select("match_id,group_letter,round,home_slug,away_slug,home_score,away_score,status,court,start_time")
    .order("start_time", { ascending: true, nullsFirst: false });
  if (matchesRes.error) throw matchesRes.error;

  const teams = (teamsRes.data ?? []) as WcOpenTeamRow[];
  const matches = (matchesRes.data ?? []) as WcOpenMatchRow[];

  const byGroup = new Map<string, WcOpenGroup>();
  for (const t of teams) {
    let g = byGroup.get(t.group_letter);
    if (!g) {
      g = { letter: t.group_letter, teams: [], matches: [] };
      byGroup.set(t.group_letter, g);
    }
    g.teams.push(t);
  }
  for (const m of matches) {
    byGroup.get(m.group_letter)?.matches.push(m);
  }

  const groups = [...byGroup.values()].sort((a, b) => a.letter.localeCompare(b.letter));
  return {
    groups,
    hasLive: matches.some((m) => m.status === "live"),
    drawOnly: matches.length === 0,
  };
}

/**
 * The /live World Cup panel data. Subscribes to Realtime on all three
 * wc_open_* tables; any change invalidates the query so the panel refetches
 * and repaints. The subscription is best-effort — a failed channel setup just
 * means the panel updates on the next natural refetch instead of instantly.
 */
export function useWcOpenLive() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchWcOpenFeed,
    // Cheap poll as a floor under Realtime, so a dropped socket still catches up.
    refetchInterval: 90_000,
    staleTime: 30_000,
  });

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase.channel(`wc-open-live:${uniqueChannelSuffix()}`);
      for (const table of ["wc_open_teams", "wc_open_matches", "wc_open_standings"]) {
        channel = channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
        );
      }
      channel.subscribe();
    } catch (err) {
      console.warn("[wc-open-live] realtime setup failed:", err);
    }
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}
