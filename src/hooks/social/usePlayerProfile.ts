import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/** Public-facing slice of profiles surfaced by /nguoi-choi/:username. */
export type PlayerProfile = Pick<
  ProfileRow,
  | "id"
  | "username"
  | "display_name"
  | "avatar_url"
  | "bio"
  | "city"
  | "country"
  | "skill_level"
  | "favorite_venue_id"
  | "dupr_id"
  | "dupr_singles"
  | "dupr_doubles"
  | "dupr_synced_at"
  | "is_pro"
  | "is_verified"
  | "is_ghost"
  | "created_at"
>;

/**
 * Fetch the public profile for /nguoi-choi/:username.
 *
 * Returns null when the username doesn't exist or maps to a ghost row
 * (caller renders 404 in either case). 5-minute staleTime — profile data
 * rarely changes during a single browsing session.
 */
export function usePlayerProfile(username: string | undefined) {
  return useQuery({
    queryKey: ["player-profile", username],
    queryFn: async () => {
      if (!username) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, bio, city, country, skill_level, favorite_venue_id, dupr_id, dupr_singles, dupr_doubles, dupr_synced_at, is_pro, is_verified, is_ghost, created_at",
        )
        .eq("username", username)
        .maybeSingle();
      if (error) throw error;
      // Ghost rows (placeholder profiles created via PlayerSelector for
      // non-app teammates) are not user-facing.
      if (!data || data.is_ghost) return null;
      return data as PlayerProfile;
    },
    enabled: !!username,
    staleTime: 5 * 60_000,
  });
}
