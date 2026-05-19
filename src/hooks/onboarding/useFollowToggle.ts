import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ToggleArgs {
  followedId: string;
  /** true → INSERT, false → DELETE */
  follow: boolean;
}

/**
 * Toggle social_follows row for the current viewer.
 *
 * RLS policy on social_follows: WITH CHECK auth.uid() = follower_id for
 * INSERT, USING auth.uid() = follower_id for DELETE — so the user JWT is
 * sufficient (no service_role needed).
 *
 * On success, invalidates the suggested-follows query so the wizard list
 * stays consistent if the user re-renders.
 */
export function useFollowToggle(viewerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ followedId, follow }: ToggleArgs) => {
      if (follow) {
        const { error } = await supabase.from("social_follows").insert({
          follower_id: viewerId,
          followed_id: followedId,
        });
        // 23505 = unique_violation — already followed, treat as no-op success.
        if (error && (error as { code?: string }).code !== "23505") {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from("social_follows")
          .delete()
          .eq("follower_id", viewerId)
          .eq("followed_id", followedId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suggested-follows", viewerId] });
    },
  });
}
