import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FeedParticipant } from "@/lib/social/feed-formatters";

/**
 * Wraps get_following_feed RPC. Returns matches where the viewer or anyone
 * they follow is a participant. Cursor-paginated by played_at DESC.
 *
 * Disabled until viewerId is known — anonymous users hit Trending instead
 * (resolved upstream in Feed.tsx via resolveDefaultTab()).
 */

export interface FeedMatch {
  match_id: string;
  slug: string;
  played_at: string;
  format: string;
  match_type: string;
  verification_status: string;
  venue_name: string | null;
  team_a_score: number[];
  team_b_score: number[];
  winning_team: "a" | "b" | string;
  participants: FeedParticipant[];
  /** Phase 4B — total kudos count on the match (from feed RPC inline). */
  kudos_count: number;
  /** Phase 4B — true when the viewer has kudoed this match. False for
   *  anonymous viewers (trending RPC sets it false when p_viewer_id is NULL). */
  viewer_kudoed: boolean;
  /** Phase 4C — total non-deleted comments on the match (from feed RPC inline). */
  comment_count: number;
}

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

/**
 * Composite cursor — paginates on (played_at, match_id) so matches that
 * share an identical played_at don't get silently skipped at the page
 * boundary (Codex P1 fix on PR #16).
 */
export interface FeedCursor {
  played_at: string;
  match_id: string;
}

export function useFollowingFeed(viewerId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ["feed", "following", viewerId ?? null] as const,
    initialPageParam: null as FeedCursor | null,
    enabled: !!viewerId,
    staleTime: 30_000,
    queryFn: async ({ pageParam }) => {
      if (!viewerId) return [] as FeedMatch[];
      const { data, error } = await supabase.rpc("get_following_feed", {
        p_viewer_id: viewerId,
        p_limit: PAGE_SIZE,
        p_cursor_played_at: pageParam?.played_at ?? null,
        p_cursor_match_id: pageParam?.match_id ?? null,
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
