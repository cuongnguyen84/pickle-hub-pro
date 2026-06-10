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
  | "is_public_profile"
  | "created_at"
>;

/**
 * Fetch the public profile for /nguoi-choi/:username.
 *
 * Returns null when the slug doesn't resolve or maps to a ghost row
 * (caller renders 404 in either case). 5-minute staleTime — profile data
 * rarely changes during a single browsing session.
 *
 * PR79 Phase 2F follow-up — the `:username` route param accepts EITHER
 * a human-readable username OR the 8-/12-char hex profile_slug derived
 * from profileIdToSlug(). SocialEventRoster, SocialEventLive, and
 * ClubCard all build /u/<hex> links that 301 to /nguoi-choi/<hex>;
 * this hook must resolve both shapes or those in-app player links
 * 404 in the SPA. Single PostgREST .or() clause: one query, username
 * exact match preferred, profile_slug prefix-LIKE as fallback.
 */
export function usePlayerProfile(usernameOrSlug: string | undefined) {
  return useQuery({
    queryKey: ["player-profile", usernameOrSlug],
    queryFn: async () => {
      if (!usernameOrSlug) return null;
      const isHexSlug = /^[0-9a-f]{8,12}$/i.test(usernameOrSlug);

      // Sprint A2 — opt-in gate. /nguoi-choi/:username shows the row only
      // if is_public_profile=true OR the viewer is the owner. Owner bypass
      // lets a user preview their own profile before flipping the toggle.
      const { data: authData } = await supabase.auth.getUser();
      const ownUserId = authData.user?.id ?? null;

      const SELECT_COLS =
        "id, username, display_name, avatar_url, bio, city, country, skill_level, favorite_venue_id, dupr_id, dupr_singles, dupr_doubles, dupr_synced_at, is_pro, is_verified, is_ghost, is_public_profile, created_at";

      // Exact username always wins. Only fall back to a profile_slug prefix match
      // (for /u/<hex> short links) when there is no exact-username hit — and make
      // that fallback deterministic with an explicit order, so a username that
      // happens to look like hex can never resolve to a different user's row.
      const exact = await supabase
        .from("profiles")
        .select(SELECT_COLS)
        .eq("username", usernameOrSlug)
        .limit(1)
        .maybeSingle();
      if (exact.error) throw exact.error;
      let data = exact.data;

      if (!data && isHexSlug) {
        const fallback = await supabase
          .from("profiles")
          .select(SELECT_COLS)
          .like("profile_slug", `${usernameOrSlug}%`)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (fallback.error) throw fallback.error;
        data = fallback.data;
      }
      // Ghost rows (placeholder profiles created via PlayerSelector for
      // non-app teammates) are not user-facing.
      if (!data || data.is_ghost) return null;
      // Sprint A2 — gate non-owners on the opt-in flag.
      if (!data.is_public_profile && data.id !== ownUserId) return null;
      return data as PlayerProfile;
    },
    enabled: !!usernameOrSlug,
    staleTime: 5 * 60_000,
  });
}
