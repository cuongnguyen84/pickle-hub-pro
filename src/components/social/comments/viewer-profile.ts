import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ViewerProfile {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

const EMPTY: ViewerProfile = {
  username: null,
  display_name: null,
  avatar_url: null,
};

/**
 * Lightweight viewer-profile fetch used by the comment composer to seed
 * optimistic rows with the author's name + avatar before the server
 * confirms. Anonymous viewers can't comment so the empty fallback only
 * matters for the brief moment between sign-in and profile hydration.
 *
 * Cached for 5 min — these values rarely change, and they're only read
 * at submit time so a stale display name is no worse than the actual
 * server-side rendering.
 */
export function useViewerProfile(): ViewerProfile {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["viewer-profile", user?.id ?? null] as const,
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ViewerProfile> => {
      if (!user) return EMPTY;
      const { data, error } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return EMPTY;
      return {
        username: data.username ?? null,
        display_name: data.display_name ?? null,
        avatar_url: data.avatar_url ?? null,
      };
    },
  });
  return data ?? EMPTY;
}
