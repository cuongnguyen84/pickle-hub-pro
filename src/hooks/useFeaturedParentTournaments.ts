import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  ParentTournament,
  ParentTournamentWithPreview,
  SubEventPreview,
} from "@/hooks/useParentTournament";

interface FeaturedParentTournamentRow extends ParentTournament {
  quick_tables: Array<SubEventPreview & { created_at: string }>;
}

const STATUS_PRIORITY: Record<string, number> = {
  group_stage: 0,
  playoff: 1,
  setup: 2,
  completed: 3,
};

export function toFeaturedParentTournament(
  row: FeaturedParentTournamentRow,
): ParentTournamentWithPreview {
  const { quick_tables, ...parent } = row;
  const events = [...(quick_tables || [])].sort((a, b) => {
    const statusDiff =
      (STATUS_PRIORITY[a.status] ?? 99) - (STATUS_PRIORITY[b.status] ?? 99);
    if (statusDiff !== 0) return statusDiff;
    return Date.parse(b.created_at) - Date.parse(a.created_at);
  });
  return {
    ...parent,
    subEventCount: events.length,
    previewSubEvents: events.slice(0, 3).map(({ id, name, status, share_id }) => ({
      id,
      name,
      status,
      share_id,
    })),
  };
}

export function useFeaturedParentTournaments(limit = 6) {
  return useQuery({
    queryKey: ["featured-parent-tournaments", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parent_tournaments")
        .select(`
          id,
          creator_user_id,
          name,
          description,
          banner_url,
          event_date,
          location,
          share_id,
          is_featured,
          created_at,
          updated_at,
          quick_tables (
            id,
            name,
            status,
            share_id,
            created_at
          )
        `)
        .eq("is_featured", true)
        .eq("quick_tables.is_public", true)
        .order("event_date", { ascending: true, nullsFirst: false })
        .limit(limit);

      if (error) throw error;
      return ((data || []) as FeaturedParentTournamentRow[])
        .map(toFeaturedParentTournament);
    },
    staleTime: 60_000,
  });
}
