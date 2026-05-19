import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type FollowTargetType = "organization" | "tournament";

// Check if user is following a target
export function useFollow(
  targetType: FollowTargetType,
  targetId: string,
  userId?: string
) {
  return useQuery({
    queryKey: ["follow", targetType, targetId, userId],
    queryFn: async () => {
      if (!userId) return false;

      const { data, error } = await supabase
        .from("follows")
        .select("id")
        .eq("target_type", targetType)
        .eq("target_id", targetId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
    enabled: !!userId && !!targetId,
  });
}

// Get all follows for a user
export function useUserFollows(userId?: string) {
  return useQuery({
    queryKey: ["user-follows", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("follows")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

// Get follow count for a target
export function useFollowCount(targetType: FollowTargetType, targetId: string) {
  return useQuery({
    queryKey: ["follow-count", targetType, targetId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("target_type", targetType)
        .eq("target_id", targetId);

      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!targetId,
  });
}

// Toggle follow mutation
export function useToggleFollow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      targetType,
      targetId,
      userId,
      isCurrentlyFollowing,
    }: {
      targetType: FollowTargetType;
      targetId: string;
      userId: string;
      isCurrentlyFollowing: boolean;
    }) => {
      if (isCurrentlyFollowing) {
        // Unfollow
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("target_type", targetType)
          .eq("target_id", targetId)
          .eq("user_id", userId);

        if (error) throw error;
        return { followed: false };
      } else {
        // Follow
        const { error } = await supabase.from("follows").insert({
          target_type: targetType,
          target_id: targetId,
          user_id: userId,
        });

        if (error) throw error;
        return { followed: true };
      }
    },
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ["follow", variables.targetType, variables.targetId],
      });
      queryClient.invalidateQueries({
        queryKey: ["user-follows", variables.userId],
      });
      queryClient.invalidateQueries({
        queryKey: ["follow-count", variables.targetType, variables.targetId],
      });
    },
  });
}
