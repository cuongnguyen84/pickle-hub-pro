import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { ModerationContext } from "@/lib/social/comment-moderation";

/**
 * Per-match moderation context for the viewer. Single round-trip —
 * one query into user_roles for admin/moderator flags + one into
 * match_participants for participant flag. CommentThread fetches once
 * and resolveDeletePermission() is called per row in render.
 *
 * Anonymous viewers and missing matchId short-circuit to a no-permission
 * context so the hook stays cheap to mount everywhere.
 */
export function useMatchModerationContext(
  matchId: string | undefined,
): ModerationContext {
  const { user } = useAuth();
  const viewerId = user?.id ?? null;

  const { data } = useQuery({
    queryKey: ["match-moderation", matchId ?? null, viewerId] as const,
    enabled: !!matchId && !!viewerId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!matchId || !viewerId) {
        return { isAdmin: false, isModerator: false, isMatchParticipant: false };
      }
      const [rolesRes, participantRes] = await Promise.all([
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", viewerId)
          .in("role", ["admin", "moderator"]),
        supabase
          .from("match_participants")
          .select("player_id")
          .eq("match_id", matchId)
          .eq("player_id", viewerId)
          .maybeSingle(),
      ]);
      if (rolesRes.error) throw rolesRes.error;
      if (participantRes.error) throw participantRes.error;
      const roles = new Set((rolesRes.data ?? []).map((r) => r.role as string));
      return {
        isAdmin: roles.has("admin"),
        isModerator: roles.has("moderator"),
        isMatchParticipant: !!participantRes.data,
      };
    },
  });

  return {
    viewerId,
    isAdmin: data?.isAdmin ?? false,
    isModerator: data?.isModerator ?? false,
    isMatchParticipant: data?.isMatchParticipant ?? false,
  };
}
