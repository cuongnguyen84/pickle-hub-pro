// ============================================================================
// useUpcomingSocialEvents — public list of upcoming social events
// ----------------------------------------------------------------------------
// Used by the /social collection page. Public RLS only returns
// status='published' + visibility='public' rows. Sort by start_at asc so
// the nearest event surfaces first.
// ============================================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UpcomingEventRow {
  id: string;
  slug: string;
  title_vi: string;
  title_en: string | null;
  description_vi: string | null;
  start_at: string;
  end_at: string;
  location_text: string | null;
  max_players: number;
  price_vnd: number;
  registered_count: number;
  club: { id: string; slug: string; name: string; logo_url: string | null } | null;
}

export function useUpcomingSocialEvents(limit = 30) {
  return useQuery<UpcomingEventRow[]>({
    queryKey: ["upcoming-social-events", limit],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("social_events")
        .select(
          `id, slug, title_vi, title_en, description_vi,
           start_at, end_at, location_text, max_players, price_vnd,
           club:clubs!social_events_club_id_fkey ( id, slug, name, logo_url )`,
        )
        .eq("status", "published")
        .eq("visibility", "public")
        .gte("end_at", nowIso)
        .order("start_at", { ascending: true })
        .limit(limit);
      if (error) {
        console.error("useUpcomingSocialEvents: lookup error", error);
        return [];
      }
      const rows = (data ?? []) as unknown as Omit<UpcomingEventRow, "registered_count">[];
      // Fan-out per-event registration counts for capacity progress bars.
      // Public landing already does this per page; collection view does
      // the same in parallel so the cards can show "12/16 đã đăng ký".
      return Promise.all(
        rows.map(async (r) => {
          const { count } = await supabase
            .from("event_registrations")
            .select("id", { count: "exact", head: true })
            .eq("event_id", r.id)
            .neq("status", "cancelled");
          return { ...r, registered_count: count ?? 0 };
        }),
      );
    },
    staleTime: 30_000,
  });
}
