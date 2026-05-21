// ============================================================================
// useClubEventsManage — organizer view: every event in a club + stats
// ----------------------------------------------------------------------------
// Organizer-only surface; RLS allows the club creator + admins to SELECT
// drafts and club_only rows. The hook returns ALL events with per-event
// counts (registered, paid, checked-in).
// ============================================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ManageEventRow {
  id: string;
  slug: string;
  title_vi: string;
  title_en: string | null;
  start_at: string;
  end_at: string;
  location_text: string | null;
  max_players: number;
  price_vnd: number;
  status: "draft" | "published" | "cancelled" | "completed";
  visibility: "public" | "club_only";
  registered: number;
  paid: number;
  checked_in: number;
}

export function useClubEventsManage(clubId: string | undefined) {
  return useQuery<ManageEventRow[]>({
    queryKey: ["club-events-manage", clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data: events, error } = await supabase
        .from("social_events")
        .select(
          `id, slug, title_vi, title_en, start_at, end_at, location_text,
           max_players, price_vnd, status, visibility`,
        )
        .eq("club_id", clubId)
        .order("start_at", { ascending: false })
        .limit(100);
      if (error) {
        console.error("useClubEventsManage: events query error", error);
        return [];
      }
      const list = (events ?? []) as Omit<
        ManageEventRow,
        "registered" | "paid" | "checked_in"
      >[];

      // Fan-out per-event counts. With 100 events this is up to 300
      // lightweight HEAD requests; in practice clubs run a handful.
      const enriched: ManageEventRow[] = await Promise.all(
        list.map(async (e) => {
          const [reg, paid, ci] = await Promise.all([
            supabase
              .from("event_registrations")
              .select("id", { count: "exact", head: true })
              .eq("event_id", e.id)
              .neq("status", "cancelled"),
            supabase
              .from("event_registrations")
              .select("id", { count: "exact", head: true })
              .eq("event_id", e.id)
              .eq("payment_status", "paid"),
            supabase
              .from("event_registrations")
              .select("id", { count: "exact", head: true })
              .eq("event_id", e.id)
              .eq("status", "checked_in"),
          ]);
          return {
            ...e,
            registered: reg.count ?? 0,
            paid: paid.count ?? 0,
            checked_in: ci.count ?? 0,
          };
        }),
      );
      // Sort cancelled rows to the bottom; within each bucket keep the
       // newest start_at first (matches the SQL order). Organizer
       // dashboard surfaces active events on top per UX request.
      enriched.sort((a, b) => {
        const aCancelled = a.status === "cancelled" ? 1 : 0;
        const bCancelled = b.status === "cancelled" ? 1 : 0;
        if (aCancelled !== bCancelled) return aCancelled - bCancelled;
        return new Date(b.start_at).getTime() - new Date(a.start_at).getTime();
      });
      return enriched;
    },
    enabled: Boolean(clubId),
    staleTime: 15_000,
  });
}
