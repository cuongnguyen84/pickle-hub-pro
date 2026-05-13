// ============================================================================
// useSocialEvent — fetch a social_events row by slug, with public-friendly RLS
// ----------------------------------------------------------------------------
// Used by:
//   - /su-kien/:slug landing page (PR2)
//   - /su-kien/:slug/danh-sach roster (PR3)
//   - /su-kien/:slug/xep-cap matchmaking (PR3)
//
// RLS lets anonymous viewers see published+public events. Draft + club_only
// events are visible only to the organizer and admins — the row simply
// won't return for other viewers, and the page surfaces a 404.
// ============================================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SocialEventRow {
  id: string;
  slug: string;
  club_id: string | null;
  title_vi: string;
  title_en: string | null;
  description_vi: string | null;
  description_en: string | null;
  start_at: string;
  end_at: string;
  location_text: string | null;
  location_lat: number | null;
  location_lng: number | null;
  court_count: number;
  max_players: number;
  level_min: number | null;
  level_max: number | null;
  price_vnd: number;
  allow_guests: boolean;
  cancellation_hours: number;
  /** PR67 — when true + price_vnd > 0, registrations auto-cancel after
   *  prepayment_deadline_hours unless the player claims payment. */
  requires_prepayment: boolean;
  prepayment_deadline_hours: number;
  zalo_group_url: string | null;
  status: "draft" | "published" | "cancelled" | "completed";
  visibility: "public" | "club_only";
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SocialEventWithClub extends SocialEventRow {
  club: { id: string; slug: string; name: string; logo_url: string | null } | null;
  registered_count: number;
}

export function useSocialEvent(slug: string | undefined) {
  return useQuery<SocialEventWithClub | null>({
    queryKey: ["social-event", slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from("social_events")
        .select(
          `id, slug, club_id, title_vi, title_en, description_vi, description_en,
           start_at, end_at, location_text, location_lat, location_lng,
           court_count, max_players, level_min, level_max,
           price_vnd, allow_guests, cancellation_hours,
           requires_prepayment, prepayment_deadline_hours, zalo_group_url,
           status, visibility, created_by, created_at, updated_at,
           club:clubs!social_events_club_id_fkey ( id, slug, name, logo_url )`,
        )
        .eq("slug", slug)
        .maybeSingle();
      if (error) {
        // RLS blocks return as data=null, error=null. A real error means
        // schema drift or network — log so we don't silently 404.
        console.error("useSocialEvent: lookup error", { slug, error });
        return null;
      }
      if (!data) return null;

      // Roster count is read from a separate query — counting via RLS on
      // event_registrations works for organizers (full visibility) and
      // for public viewers (the SELECT policy on event_registrations
      // permits reading rows whose event is published+public).
      const { count } = await supabase
        .from("event_registrations")
        .select("id", { count: "exact", head: true })
        .eq("event_id", (data as { id: string }).id)
        .neq("status", "cancelled");

      return {
        ...(data as unknown as SocialEventRow),
        club: ((data as unknown as { club: SocialEventWithClub["club"] }).club) ?? null,
        registered_count: count ?? 0,
      };
    },
    enabled: Boolean(slug),
    staleTime: 30_000,
  });
}
