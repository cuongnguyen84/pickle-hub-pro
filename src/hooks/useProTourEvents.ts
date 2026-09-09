// ============================================================================
// useProTourEvents / useProTourEvent — the pro-tour event registry, from the
// `pro_tour_events` table (admin-managed, public read). One tiny query,
// cached 5 minutes; the strip and the results page share the cache.
// ============================================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  metaFromRow,
  type ProTourEventMeta,
  type ProTourEventRow,
} from "@/content/pro-tour-events";

async function fetchAllEvents(): Promise<ProTourEventMeta[]> {
  const { data, error } = await supabase
    .from("pro_tour_events")
    .select("*")
    .order("start_date", { ascending: false })
    .limit(100);
  if (error) throw error;
  return ((data ?? []) as ProTourEventRow[]).map(metaFromRow);
}

export function useProTourEvents() {
  return useQuery<ProTourEventMeta[]>({
    queryKey: ["pro-tour-events"],
    queryFn: fetchAllEvents,
    staleTime: 300_000,
  });
}

export function useProTourEvent(slug: string | undefined) {
  const all = useProTourEvents();
  return {
    ...all,
    meta: slug ? all.data?.find((e) => e.slug === slug) : undefined,
  };
}
