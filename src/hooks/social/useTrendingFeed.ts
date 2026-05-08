import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FeedMatch } from "./useFollowingFeed";
import type { FeedParticipant } from "@/lib/social/feed-formatters";

/**
 * Wraps get_trending_feed RPC. Public-readable so it always fetches —
 * anonymous viewers land here by default.
 *
 * Phase 4A renders effectively as recency-only because the engagement
 * tables (match_kudos / match_comments) don't exist yet; the Trending
 * RPC accepts the multipliers as parameters today so 4B/4C can plug in
 * the JOINs without changing this hook.
 */

interface RpcRow {
  match_id: string;
  slug: string;
  played_at: string;
  format: string;
  match_type: string;
  verification_status: string;
  venue_name: string | null;
  team_a_score: number[];
  team_b_score: number[];
  winning_team: string;
  participants: unknown;
}

const PAGE_SIZE = 20;

export function useTrendingFeed() {
  return useInfiniteQuery({
    queryKey: ["feed", "trending"] as const,
    initialPageParam: null as string | null,
    staleTime: 5 * 60_000,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("get_trending_feed", {
        p_limit: PAGE_SIZE,
        p_cursor_played_at: pageParam,
      });
      if (error) throw error;
      return (data ?? []).map(normalizeRow);
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.length < PAGE_SIZE) return undefined;
      return lastPage[lastPage.length - 1].played_at;
    },
  });
}

function normalizeRow(row: RpcRow): FeedMatch {
  return {
    match_id: row.match_id,
    slug: row.slug,
    played_at: row.played_at,
    format: row.format,
    match_type: row.match_type,
    verification_status: row.verification_status,
    venue_name: row.venue_name,
    team_a_score: row.team_a_score ?? [],
    team_b_score: row.team_b_score ?? [],
    winning_team: row.winning_team,
    participants: Array.isArray(row.participants)
      ? (row.participants as FeedParticipant[])
      : [],
  };
}
