import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ForumComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  is_best_answer: boolean;
  like_count: number;
  created_at: string;
  image_urls?: string[];
  parent_id?: string | null;
  author_name?: string;
  author_avatar?: string;
  parent_author_name?: string;
  parent_content?: string;
}

export const useForumPost = (postId: string | undefined) => {
  return useQuery({
    queryKey: ["forum-post", postId],
    queryFn: async () => {
      if (!postId) return null;
      const { data, error } = await supabase
        .from("forum_posts")
        .select("*")
        .eq("id", postId)
        .single();
      if (error) throw error;

      // Get author profile
      const { data: profile } = await supabase.rpc("get_public_profile", { profile_id: data.user_id });
      const author = profile?.[0];

      // Get category
      let category = null;
      if (data.category_id) {
        const { data: cat } = await supabase
          .from("forum_categories")
          .select("name, slug")
          .eq("id", data.category_id)
          .single();
        category = cat;
      }

      return {
        ...data,
        author_name: author?.display_name || "Unknown",
        author_avatar: author?.avatar_url || null,
        category_name: category?.name || null,
        category_slug: category?.slug || null,
      };
    },
    enabled: !!postId,
  });
};

export const useForumComments = (postId: string | undefined) => {
  return useQuery({
    queryKey: ["forum-comments", postId],
    queryFn: async () => {
      if (!postId) return [];
      const { data, error } = await supabase
        .from("forum_comments")
        .select("*")
        .eq("post_id", postId)
        .order("is_best_answer", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;

      const userIds = [...new Set(data.map((c: any) => c.user_id))];
      const { data: profiles } = await supabase.rpc("get_public_profiles", { profile_ids: userIds });
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      return data.map((comment: any) => {
        const profile = profileMap.get(comment.user_id);
        const parentComment = comment.parent_id ? data.find((c: any) => c.id === comment.parent_id) : null;
        const parentProfile = parentComment ? profileMap.get(parentComment.user_id) : null;
        return {
          ...comment,
          author_name: profile?.display_name || "Unknown",
          author_avatar: profile?.avatar_url || null,
          parent_author_name: parentProfile?.display_name || (parentComment ? "Unknown" : undefined),
          parent_content: parentComment?.content || undefined,
        } as ForumComment;
      });
    },
    enabled: !!postId,
  });
};

export const useCreateForumComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (comment: { post_id: string; user_id: string; content: string; parent_id?: string | null; image_urls?: string[] }) => {
      const { data, error } = await supabase
        .from("forum_comments")
        .insert(comment as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["forum-comments", variables.post_id] });
      queryClient.invalidateQueries({ queryKey: ["forum-post", variables.post_id] });
      queryClient.invalidateQueries({ queryKey: ["forum-posts"] });
    },
  });
};

export const useToggleBestAnswer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, isBestAnswer, postId }: { commentId: string; isBestAnswer: boolean; postId: string }) => {
      // Unmark all others first if marking
      if (!isBestAnswer) {
        await supabase
          .from("forum_comments")
          .update({ is_best_answer: false })
          .eq("post_id", postId);
      }
      const { error } = await supabase
        .from("forum_comments")
        .update({ is_best_answer: !isBestAnswer })
        .eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["forum-comments", variables.postId] });
    },
  });
};

export const useDeleteForumComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, postId }: { commentId: string; postId: string }) => {
      const { error } = await supabase.from("forum_comments").delete().eq("id", commentId);
      if (error) throw error;
      return postId;
    },
    onSuccess: (postId) => {
      queryClient.invalidateQueries({ queryKey: ["forum-comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["forum-post", postId] });
      queryClient.invalidateQueries({ queryKey: ["forum-posts"] });
    },
  });
};

export const useToggleHidePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, isHidden }: { postId: string; isHidden: boolean }) => {
      const { error } = await supabase
        .from("forum_posts")
        .update({ is_hidden: !isHidden } as any)
        .eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forum-posts"] });
      queryClient.invalidateQueries({ queryKey: ["forum-post"] });
    },
  });
};
