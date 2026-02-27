import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useForumLike = (targetType: "post" | "comment", targetId: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: isLiked = false } = useQuery({
    queryKey: ["forum-like", targetType, targetId, user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("forum_likes")
        .select("id")
        .eq("user_id", user.id)
        .eq("target_type", targetType)
        .eq("target_id", targetId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && !!targetId,
  });

  const toggleLike = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (isLiked) {
        const { error } = await supabase
          .from("forum_likes")
          .delete()
          .eq("user_id", user.id)
          .eq("target_type", targetType)
          .eq("target_id", targetId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("forum_likes")
          .insert({ user_id: user.id, target_type: targetType, target_id: targetId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forum-like", targetType, targetId] });
      queryClient.invalidateQueries({ queryKey: ["forum-post"] });
      queryClient.invalidateQueries({ queryKey: ["forum-posts"] });
      queryClient.invalidateQueries({ queryKey: ["forum-comments"] });
    },
  });

  return { isLiked, toggleLike: toggleLike.mutate, isToggling: toggleLike.isPending };
};
