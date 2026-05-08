import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { FeedMatch, FeedCursor } from "./useFollowingFeed";
import type { FeedParticipant } from "@/lib/social/feed-formatters";

/**
 * Wraps get_trending_feed RPC. Public-readable so it always fetches —
 * anonymous viewers land here by default.
 *
 * Phase 4B activates engagement weighting: trending score now factors real
 * kudos counts. The hook also passes p_viewer_id when a viewer is signed
 * in so per-row viewer_kudoed comes back populated; anonymous viewers
 * always get viewer_kudoed=false.
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
  kudos_count: number | null;
  viewer_kudoed: boolean | null;
  comment_count: number | null;
}

const PAGE_SIZE = 20;

export function useTrendingFeed() {
  const { user } = useAuth();
  // Partition the cache by viewer so anonymous and signed-in viewers don't
  // share the same trending pages — viewer_kudoed differs per viewer.
  return useInfiniteQuery({
    queryKey: ["feed", "trending", user?.id ?? null] as const,
    initialPageParam: null as FeedCursor | null,
    staleTime: 5 * 60_000,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("get_trending_feed", {
        p_limit: PAGE_SIZE,
        p_cursor_played_at: pageParam?.played_at ?? null,
        p_cursor_match_id: pageParam?.match_id ?? null,
        p_viewer_id: user?.id ?? null,
      });
      if (error) throw error;
      return (data ?? []).map(normalizeRow);
    },
    getNextPageParam: (lastPage): FeedCursor | undefined => {
      if (!lastPage || lastPage.length < PAGE_SIZE) return undefined;
      const last = lastPage[lastPage.length - 1];
      return { played_at: last.played_at, match_id: last.match_id };
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
    kudos_count: row.kudos_count ?? 0,
    viewer_kudoed: row.viewer_kudoed ?? false,
    comment_count: row.comment_count ?? 0,
  };
}
