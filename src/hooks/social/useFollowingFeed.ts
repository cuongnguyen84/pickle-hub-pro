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
  /** Sprint 6 — source provenance (community vs pro tour). community is
   *  the existing user-recorded match path; ppa_tour / app_tour / mlp /
   *  other are scrape-imported. FeedMatchCard renders a PPA-style badge
   *  + tournament caption when source_provider !== 'community'. */
  source_provider: "community" | "ppa_tour" | "app_tour" | "mlp" | "other";
  /** Source URL on the original site (e.g. brackets.pickleballtournaments.com).
   *  Null for community matches. */
  source_url: string | null;
  /** Tournament name displayed at the top of the card for pro matches —
   *  e.g. "PPA Tour: 2026 PPA Finals". Null for community matches. */
  tournament_name: string | null;
  /** Event subtitle — e.g. "Mens Doubles Pro Main Draw". Null otherwise. */
  tournament_event: string | null;
  /** Round label — e.g. "R32", "QF", "F". Null otherwise. */
  round_name: string | null;
  /** Free-form notes JSON. MLP matchups encode team logos + per-game lineups here. */
  notes: string | null;
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
  source_provider: string | null;
  source_url: string | null;
  tournament_name: string | null;
  tournament_event: string | null;
  round_name: string | null;
  notes: string | null;
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
    source_provider: (row.source_provider ?? "community") as FeedMatch["source_provider"],
    source_url: row.source_url,
    tournament_name: row.tournament_name,
    tournament_event: row.tournament_event,
    round_name: row.round_name,
    notes: row.notes,
  };
}
