// ============================================================================
// useProTourEventResults — every bracket match the pro-tour pipeline has for
// one tournament (matches.source_provider = 'ppa_tour'), grouped for the
// /live/pro/<slug> page. Polls once a minute while the event is on (the
// scraper runs on a cron, so a finished round shows up within minutes),
// hourly otherwise.
// ============================================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { eventPhase, type ProTourEventMeta } from "@/content/pro-tour-events";
import { groupProResults, type ProResultRow, type ProResults } from "@/lib/pro-tour/results";

export const PRO_RESULTS_SELECT =
  "id,slug,tournament_name,tournament_event,round_name,team_a_score,team_b_score,winning_team,played_at,court_number,notes," +
  "match_participants(team,position,profile:profiles!match_participants_player_id_fkey(display_name,username))";

export async function fetchProTourEventRows(meta: ProTourEventMeta): Promise<ProResultRow[]> {
  const { data, error } = await supabase
    .from("matches")
    .select(PRO_RESULTS_SELECT)
    .eq("source_provider", "ppa_tour")
    .eq("is_public", true)
    .ilike("tournament_name", meta.namePattern)
    .order("played_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as unknown as ProResultRow[];
}

export function useProTourEventResults(meta: ProTourEventMeta | undefined) {
  const live = meta ? eventPhase(meta) === "live" : false;
  return useQuery<ProResults>({
    queryKey: ["pro-tour-event-results", meta?.slug],
    enabled: !!meta,
    queryFn: async () => groupProResults(await fetchProTourEventRows(meta!)),
    refetchInterval: live ? 60_000 : 3_600_000,
    staleTime: 30_000,
  });
}
