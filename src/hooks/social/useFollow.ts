import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";

/**
 * social_follows table (Sprint 1 Option A migration):
 *   - follower_id  UUID  → profiles.id
 *   - followed_id  UUID  → profiles.id   (note: NOT "following_id")
 *   - created_at   TIMESTAMPTZ
 *   - PK (follower_id, followed_id)
 *   - CHECK (follower_id != followed_id)
 *
 * RLS:
 *   - SELECT public read (anyone)
 *   - INSERT WITH CHECK (auth.uid() = follower_id)
 *   - DELETE USING (auth.uid() = follower_id)
 *
 * This hook pair (useFollowStatus + useFollowMutation) is the canonical
 * follow API for FollowButton, PlayerHeroCard, Onboarding suggested
 * follows, and any future consumer (Search results, Feed, etc.).
 */

interface MutateArgs {
  /** profile id of the user being followed/unfollowed */
  followedId: string;
  /** target action — true = follow, false = unfollow */
  follow: boolean;
  /**
   * Optional. When provided, invalidates the player-stats RPC cache so the
   * follower_count badge on /nguoi-choi/<username> refreshes immediately.
   */
  followedUsername?: string;
}

/**
 * Per-target follow boolean for the current viewer. Returns false (and
 * skips the network call) when:
 *   - not signed in
 *   - targetUserId not provided yet
 *   - viewer === target (own profile — FollowButton hides itself anyway)
 */
export function useFollowStatus(targetUserId: string | undefined) {
  const { user } = useAuth();
  const enabled =
    !!user && !!targetUserId && user.id !== targetUserId;
  return useQuery({
    queryKey: ["follow-status", user?.id ?? null, targetUserId ?? null],
    queryFn: async (): Promise<boolean> => {
      if (!user || !targetUserId) return false;
      const { data, error } = await supabase
        .from("social_follows")
        .select("followed_id")
        .eq("follower_id", user.id)
        .eq("followed_id", targetUserId)
        .maybeSingle();
      if (error) throw error;
      return data !== null;
    },
    enabled,
    staleTime: 60_000,
  });
}

/**
 * Toggle follow with optimistic update + rollback on error.
 *
 * onMutate flips the cached follow-status boolean immediately so the UI
 * doesn't wait for the network round-trip. On failure the snapshot is
 * restored and a bilingual toast is shown.
 *
 * onSuccess invalidates:
 *   - the per-target follow-status (re-confirms the new state)
 *   - the player-stats RPC for the target's username (refreshes
 *     follower_count on /nguoi-choi/<username>) — only when caller passes
 *     followedUsername
 *   - the suggested-follows query for the viewer (so onboarding step 4
 *     can re-render the toggle list correctly)
 */
export function useFollowMutation() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { language } = useI18n();

  return useMutation({
    mutationFn: async ({ followedId, follow }: MutateArgs) => {
      if (!user) throw new Error("not_authenticated");
      if (follow) {
        const { error } = await supabase
          .from("social_follows")
          .insert({ follower_id: user.id, followed_id: followedId });
        // 23505 = unique_violation — already followed, treat as no-op success.
        if (error && (error as { code?: string }).code !== "23505") {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from("social_follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("followed_id", followedId);
        if (error) throw error;
      }
    },
    onMutate: async ({ followedId, follow }) => {
      const key = ["follow-status", user?.id ?? null, followedId];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<boolean>(key);
      qc.setQueryData(key, follow);
      return { prev, key };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
      const fallback =
        language === "vi" ? "Lỗi không xác định" : "Unexpected error";
      toast({
        variant: "destructive",
        title:
          language === "vi"
            ? "Không thể cập nhật theo dõi"
            : "Couldn't update follow",
        description: err instanceof Error ? err.message : fallback,
      });
    },
    onSuccess: (_data, { followedId, followedUsername }) => {
      qc.invalidateQueries({
        queryKey: ["follow-status", user?.id ?? null, followedId],
      });
      if (followedUsername) {
        qc.invalidateQueries({
          queryKey: ["player-stats", followedUsername],
        });
      }
      qc.invalidateQueries({
        queryKey: ["suggested-follows", user?.id ?? null],
      });
    },
  });
}
