import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * A user's approved community photo posts (social_posts) for their
 * public profile page (/nguoi-choi/:username). Only approved posts
 * are listed - pending/rejected/hidden stay in the moderation flow.
 * RLS note: the select_approved policy is granted to the
 * authenticated role, so signed-out visitors get an empty list and
 * the section hides itself (same posture as the feed).
 */

export interface ProfilePost {
  id: string;
  body: string | null;
  image_url: string;
  topic: string | null;
  created_at: string;
}

const LIMIT = 20;

export function useProfilePosts(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", "posts", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<{ posts: ProfilePost[]; total: number }> => {
      const base = () =>
        supabase
          .from("social_posts" as never)
          .select("id, body, image_url, topic, created_at")
          .eq("author_id", userId!)
          .eq("kind", "post")
          .eq("status", "approved");

      const [list, counted] = await Promise.all([
        base().order("created_at", { ascending: false }).limit(LIMIT),
        supabase
          .from("social_posts" as never)
          .select("id", { count: "exact", head: true })
          .eq("author_id", userId!)
          .eq("kind", "post")
          .eq("status", "approved"),
      ]);
      if (list.error) throw list.error;
      const posts = (list.data as ProfilePost[] | null) ?? [];
      return { posts, total: counted.count ?? posts.length };
    },
  });
}
