import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type DuprConnectionMethod = "manual" | "sso" | "pending_reconnect";

export interface DuprConnection {
  /** True when the user has an active SSO link. */
  ssoConnected: boolean;
  /** True for users who had manual ratings before PR1 and haven't SSO'd yet. */
  needsReconnect: boolean;
  duprId: string | null;
  duprProfileUrl: string | null;
  singles: number | null;
  doubles: number | null;
  connectedAt: string | null;
  method: DuprConnectionMethod | null;
}

interface ProfileRow {
  dupr_id: string | null;
  dupr_profile_url: string | null;
  dupr_singles: number | null;
  dupr_doubles: number | null;
  dupr_connected_via: DuprConnectionMethod | null;
}

interface TokenRow {
  connected_at: string | null;
  revoked_at: string | null;
}

export function useDuprConnection() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ["dupr-connection", userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<DuprConnection> => {
      if (!userId) {
        return {
          ssoConnected: false,
          needsReconnect: false,
          duprId: null,
          duprProfileUrl: null,
          singles: null,
          doubles: null,
          connectedAt: null,
          method: null,
        };
      }

      const [profileRes, tokenRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("dupr_id, dupr_profile_url, dupr_singles, dupr_doubles, dupr_connected_via")
          .eq("id", userId)
          .maybeSingle<ProfileRow>(),
        supabase
          .from("dupr_user_tokens")
          .select("connected_at, revoked_at")
          .eq("user_id", userId)
          .maybeSingle<TokenRow>(),
      ]);

      const profile = profileRes.data ?? null;
      const token = tokenRes.data ?? null;

      const ssoConnected =
        Boolean(token) &&
        token?.revoked_at === null &&
        profile?.dupr_connected_via === "sso";

      const needsReconnect = profile?.dupr_connected_via === "pending_reconnect";

      return {
        ssoConnected,
        needsReconnect,
        duprId: profile?.dupr_id ?? null,
        duprProfileUrl: profile?.dupr_profile_url ?? null,
        singles: profile?.dupr_singles ?? null,
        doubles: profile?.dupr_doubles ?? null,
        connectedAt: token?.connected_at ?? null,
        method: profile?.dupr_connected_via ?? null,
      };
    },
  });
}

/** Invalidate the connection query — call from SSO success/disconnect handlers. */
export function useInvalidateDuprConnection() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["dupr-connection"] });
}
