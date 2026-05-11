// ============================================================================
// useClub — fetch a clubs row + its published events
// ----------------------------------------------------------------------------
// Public — RLS lets any viewer SELECT * FROM clubs.
// ============================================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClubRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  location_text: string | null;
  created_by: string;
  created_at: string;
}

export interface ClubEventRow {
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
}

export interface ClubWithEvents {
  club: ClubRow;
  upcoming: ClubEventRow[];
  past: ClubEventRow[];
}

export function useClub(slug: string | undefined) {
  return useQuery<ClubWithEvents | null>({
    queryKey: ["club", slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data: club, error: clubErr } = await supabase
        .from("clubs")
        .select("id, slug, name, description, logo_url, location_text, created_by, created_at")
        .eq("slug", slug)
        .maybeSingle();
      if (clubErr) {
        console.error("useClub: lookup error", { slug, error: clubErr });
        return null;
      }
      if (!club) return null;

      const nowIso = new Date().toISOString();
      const clubRow = club as unknown as ClubRow;

      // Public events only — RLS hides drafts/club_only from non-organizer
      // viewers automatically, so the public landing shows whatever is
      // visible to the current viewer. Splitting upcoming vs past via
      // start_at boundary client-side keeps the query simple.
      const { data: events } = await supabase
        .from("social_events")
        .select(
          `id, slug, title_vi, title_en, start_at, end_at, location_text,
           max_players, price_vnd, status, visibility`,
        )
        .eq("club_id", clubRow.id)
        .neq("status", "draft")
        .order("start_at", { ascending: true })
        .limit(50);

      const all = ((events ?? []) as ClubEventRow[]);
      return {
        club: clubRow,
        upcoming: all.filter((e) => e.start_at >= nowIso && e.status !== "cancelled"),
        past: all.filter((e) => e.start_at < nowIso || e.status === "completed"),
      };
    },
    enabled: Boolean(slug),
    staleTime: 60_000,
  });
}
