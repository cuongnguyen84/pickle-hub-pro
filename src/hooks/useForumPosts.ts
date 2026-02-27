import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ForumPost {
  id: string;
  user_id: string;
  category_id: string | null;
  title: string;
  content: string;
  image_urls: string[];
  tags: string[];
  is_pinned: boolean;
  is_qa: boolean;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
  author_name?: string;
  author_avatar?: string;
  category_name?: string;
  category_slug?: string;
}

interface UseForumPostsOptions {
  categorySlug?: string;
  tag?: string;
  limit?: number;
}

export const useForumPosts = ({ categorySlug, tag, limit = 20 }: UseForumPostsOptions = {}) => {
  return useQuery({
    queryKey: ["forum-posts", categorySlug, tag, limit],
    queryFn: async () => {
      let query = supabase
        .from("forum_posts")
        .select("*")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);

      if (categorySlug) {
        const { data: cat } = await supabase
          .from("forum_categories")
          .select("id")
          .eq("slug", categorySlug)
          .single();
        if (cat) {
          query = query.eq("category_id", cat.id);
        }
      }

      if (tag) {
        query = query.contains("tags", [tag]);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch author profiles and categories
      const posts = data as ForumPost[];
      const userIds = [...new Set(posts.map((p) => p.user_id))];
      const categoryIds = [...new Set(posts.map((p) => p.category_id).filter(Boolean))] as string[];

      const [profilesRes, categoriesRes] = await Promise.all([
        userIds.length > 0
          ? supabase.rpc("get_public_profiles", { profile_ids: userIds })
          : { data: [] },
        categoryIds.length > 0
          ? supabase.from("forum_categories").select("id, name, slug").in("id", categoryIds)
          : { data: [] },
      ]);

      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));
      const categoryMap = new Map((categoriesRes.data || []).map((c: any) => [c.id, c]));

      return posts.map((post) => {
        const profile = profileMap.get(post.user_id);
        const category = post.category_id ? categoryMap.get(post.category_id) : null;
        return {
          ...post,
          author_name: profile?.display_name || "Unknown",
          author_avatar: profile?.avatar_url || null,
          category_name: category?.name || null,
          category_slug: category?.slug || null,
        };
      });
    },
  });
};

export const useCreateForumPost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (post: {
      title: string;
      content: string;
      category_id?: string;
      tags?: string[];
      image_urls?: string[];
      is_qa?: boolean;
      user_id: string;
    }) => {
      const { data, error } = await supabase
        .from("forum_posts")
        .insert(post)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forum-posts"] });
    },
  });
};

export const useDeleteForumPost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from("forum_posts").delete().eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forum-posts"] });
    },
  });
};

export const useTogglePinPost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, isPinned }: { postId: string; isPinned: boolean }) => {
      const { error } = await supabase
        .from("forum_posts")
        .update({ is_pinned: !isPinned })
        .eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forum-posts"] });
      queryClient.invalidateQueries({ queryKey: ["forum-post"] });
    },
  });
};
