import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Community photo posts (public.social_posts) for the /feed Trending
 * merge, shaped like the other client-merged feed sources.
 *
 * The table landed ahead of the generated Supabase types (migration
 * 20261123100000, applied 2026-11-23), so the read goes through an
 * `as never` table cast - the same pattern this codebase uses for
 * new-schema access - with the row shape declared locally. RLS is the
 * real boundary: approved posts are readable by any signed-in user,
 * authors also read their own posts in any status, admins read all.
 * The query still asks only for the rows the stream can show (own +
 * approved) so a pending post from someone else never reaches the
 * client merge even before RLS trims it.
 */

export const SOCIAL_POST_TOPICS = [
  { key: "tim-ban-danh", vi: "Tìm bạn đánh", en: "Looking for partners" },
  { key: "hoi-ky-thuat", vi: "Hỏi kỹ thuật", en: "Technique questions" },
  { key: "khoe-vot", vi: "Khoe vợt", en: "Paddle showcase" },
  { key: "ket-qua", vi: "Kết quả", en: "Results" },
  { key: "open-play", vi: "Open play", en: "Open play" },
] as const;

export type SocialPostTopicKey =
  (typeof SOCIAL_POST_TOPICS)[number]["key"];

export interface FeedSocialPostItem {
  type: "social_post";
  cursor_id: string;
  id: string;
  author_id: string;
  author_name: string;
  author_username: string | null;
  body: string | null;
  image_url: string;
  topic: string | null;
  status: "pending" | "approved" | "rejected" | "hidden";
  published_at: string;
}

interface SocialPostRow {
  id: string;
  author_id: string;
  body: string | null;
  image_url: string;
  topic: string | null;
  status: FeedSocialPostItem["status"];
  created_at: string;
}

const WINDOW_DAYS = 30;

export function useSocialPosts(options?: { enabled?: boolean }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["feed", "social-posts", user?.id ?? "anon"],
    enabled: (options?.enabled ?? true) && !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<FeedSocialPostItem[]> => {
      const windowStart = new Date(
        Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();

      const { data, error } = await supabase
        .from("social_posts" as never)
        .select("id, author_id, body, image_url, topic, status, created_at")
        .eq("kind", "post")
        .or(`status.eq.approved,author_id.eq.${user!.id}`)
        .gte("created_at", windowStart)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;

      const rows = (data as SocialPostRow[] | null) ?? [];

      // Author display names in one batch (id/display_name/username
      // only - never contact fields).
      const authorIds = [...new Set(rows.map((row) => row.author_id))];
      const names = new Map<
        string,
        { display_name: string | null; username: string | null }
      >();
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, username")
          .in("id", authorIds);
        for (const profile of profiles ?? []) {
          names.set(profile.id, {
            display_name: profile.display_name,
            username: profile.username,
          });
        }
      }

      return rows.map((row): FeedSocialPostItem => ({
        type: "social_post",
        cursor_id: `post:${row.id}`,
        id: row.id,
        author_id: row.author_id,
        author_name: names.get(row.author_id)?.display_name ?? "ThePickleHub",
        author_username: names.get(row.author_id)?.username ?? null,
        body: row.body,
        image_url: row.image_url,
        topic: row.topic,
        status: row.status,
        published_at: row.created_at,
      }));
    },
  });
}
