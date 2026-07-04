import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * System-generated feed cards (feed_highlights table, written by the
 * feed-generate cron): player milestones, weekly leaderboard movers,
 * pro tour digests, AI weekly recaps. Merged into /feed Trending
 * client-side like news/embeds/happenings — the RPC stays untouched.
 */

const WINDOW_DAYS = 14;
const HALF_LIFE_HOURS = 48;
// Between news (1.2) and happenings (1.5): timely, but never more urgent
// than something the viewer can still join or watch live.
const HIGHLIGHT_BONUS = 1.35;

export interface FeedHighlightItem {
  type: "highlight";
  kind: "milestone" | "leaderboard" | "protour" | "recap";
  cursor_id: string;
  id: string;
  title_vi: string;
  title_en: string;
  body_vi: string | null;
  body_en: string | null;
  href: string | null;
  published_at: string;
  score: number;
}

export function useFeedHighlights() {
  return useQuery({
    queryKey: ["feed", "highlights"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<FeedHighlightItem[]> => {
      const windowStart = new Date(
        Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000
      ).toISOString();

      const { data, error } = await supabase
        .from("feed_highlights")
        .select("id, kind, title_vi, title_en, body_vi, body_en, href, published_at")
        .eq("is_active", true)
        .gte("published_at", windowStart)
        .order("published_at", { ascending: false })
        .limit(20);
      if (error) throw error;

      const now = Date.now();
      return (data ?? []).map((row): FeedHighlightItem => {
        const ageHours = Math.max(
          0,
          (now - Date.parse(row.published_at)) / (1000 * 60 * 60)
        );
        return {
          type: "highlight",
          kind: row.kind as FeedHighlightItem["kind"],
          cursor_id: `highlight:${row.id}`,
          id: row.id,
          title_vi: row.title_vi,
          title_en: row.title_en,
          body_vi: row.body_vi,
          body_en: row.body_en,
          href: row.href,
          published_at: row.published_at,
          score: Math.exp(-ageHours / HALF_LIFE_HOURS) + HIGHLIGHT_BONUS,
        };
      });
    },
  });
}
