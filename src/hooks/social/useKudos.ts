import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import {
  patchFeedPages,
  type FeedPagesShape,
  type FeedRowKudosShape,
} from "@/lib/social/kudos-cache";

/**
 * Phase 4B kudos surface — pairs with the polymorphic public.kudos table
 * (target_type='match'). Two hooks:
 *
 *   - useMatchKudos(matchId)
 *       Per-match (count, kudoed) state. Used by MatchPage's KudosButton.
 *       Feed cards do NOT use this hook — they read kudos_count and
 *       viewer_kudoed inline from the feed RPC return shape, so a 20-card
 *       page costs 1 round-trip instead of 20.
 *
 *   - useKudosMutation()
 *       Toggles via the toggle_match_kudos RPC. Optimistic flip on:
 *         1. ['match-kudos', matchId]   — direct cache (MatchPage)
 *         2. ['feed', 'following', …]   — infinite-query feed pages
 *         3. ['feed', 'trending']       — infinite-query feed pages
 *       On error, the per-key snapshot is restored.
 *       On success, ['feed','trending'] is invalidated because kudos count
 *       feeds back into the trending score (rank may shift).
 */

export interface MatchKudosState {
  count: number;
  kudoed: boolean;
}

/* ─── Query: per-match kudos state ────────────────────────────────────── */
export function useMatchKudos(matchId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["match-kudos", matchId ?? null, user?.id ?? null],
    enabled: !!matchId,
    staleTime: 60_000,
    queryFn: async (): Promise<MatchKudosState> => {
      if (!matchId) return { count: 0, kudoed: false };
      // Two cheap parallel queries. Public-readable so anonymous works too.
      const [countRes, kudoedRes] = await Promise.all([
        supabase
          .from("kudos")
          .select("user_id", { count: "exact", head: true })
          .eq("target_type", "match")
          .eq("target_id", matchId),
        user
          ? supabase
              .from("kudos")
              .select("user_id")
              .eq("target_type", "match")
              .eq("target_id", matchId)
              .eq("user_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (countRes.error) throw countRes.error;
      if (kudoedRes.error) throw kudoedRes.error;
      return {
        count: countRes.count ?? 0,
        kudoed: !!kudoedRes.data,
      };
    },
  });
}

/* ─── Mutation: toggle ────────────────────────────────────────────────── */

interface MutateArgs {
  matchId: string;
  /** Current kudoed state — used to compute optimistic delta. */
  currentKudoed: boolean;
}

interface ToggleResponse {
  kudoed: boolean;
  count: number;
}

/**
 * Walk every infinite-query feed page in cache and patch the matching row.
 * Returns the original snapshots for rollback. We patch BOTH feed query keys
 * (following + trending) because a match can appear in either tab. Pure
 * row-update logic lives in @/lib/social/kudos-cache so it's unit-tested.
 */
function patchFeedCaches(
  qc: ReturnType<typeof useQueryClient>,
  matchId: string,
  delta: { count: number; kudoed: boolean },
) {
  const snapshots: Array<
    [readonly unknown[], FeedPagesShape<FeedRowKudosShape> | undefined]
  > = [];
  const queries = qc.getQueriesData<FeedPagesShape<FeedRowKudosShape>>({
    predicate: (q) => {
      const k = q.queryKey;
      return Array.isArray(k) && k[0] === "feed";
    },
  });
  for (const [key, data] of queries) {
    if (!data?.pages) continue;
    snapshots.push([key, structuredClone(data)]);
    qc.setQueryData(key, patchFeedPages(data, matchId, delta));
  }
  return snapshots;
}

export function useKudosMutation() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { language } = useI18n();

  return useMutation({
    mutationFn: async ({ matchId }: MutateArgs): Promise<ToggleResponse> => {
      if (!user) throw new Error("not_authenticated");
      const { data, error } = await supabase.rpc("toggle_match_kudos", {
        p_match_id: matchId,
      });
      if (error) throw error;
      // RPC returns jsonb {kudoed, count}; supabase-js gives us the parsed object.
      const parsed = data as unknown as ToggleResponse | null;
      if (!parsed || typeof parsed.count !== "number") {
        throw new Error("Malformed RPC response");
      }
      return parsed;
    },
    onMutate: async ({ matchId, currentKudoed }) => {
      // Per-match cache key (MatchPage). We don't know the user partition
      // ahead of time so we cancel the namespace.
      await qc.cancelQueries({ queryKey: ["match-kudos", matchId] });
      const directKey = ["match-kudos", matchId, user?.id ?? null] as const;
      const directPrev = qc.getQueryData<MatchKudosState>(directKey);
      if (directPrev) {
        qc.setQueryData<MatchKudosState>(directKey, {
          count: Math.max(0, directPrev.count + (currentKudoed ? -1 : 1)),
          kudoed: !currentKudoed,
        });
      }

      // Feed pages — patch every cached infinite query under ['feed', ...].
      const feedSnapshots = patchFeedCaches(qc, matchId, {
        count: currentKudoed ? -1 : 1,
        kudoed: !currentKudoed,
      });

      return { directKey, directPrev, feedSnapshots };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.directPrev && ctx.directKey) {
        qc.setQueryData(ctx.directKey, ctx.directPrev);
      }
      if (ctx?.feedSnapshots) {
        for (const [key, data] of ctx.feedSnapshots) {
          qc.setQueryData(key, data);
        }
      }
      console.error("[useKudosMutation] toggle failed", err);
      const fallback =
        language === "vi" ? "Lỗi không xác định" : "Unexpected error";
      toast({
        variant: "destructive",
        title:
          language === "vi"
            ? "Không thể cập nhật lượt thích"
            : "Could not update like",
        description: err instanceof Error ? err.message : fallback,
      });
    },
    onSuccess: (data, { matchId }) => {
      // Truth-up the per-match cache with the server count, in case our
      // optimistic count drifted from concurrent kudos by other viewers.
      qc.setQueryData<MatchKudosState>(
        ["match-kudos", matchId, user?.id ?? null],
        { count: data.count, kudoed: data.kudoed },
      );
      // Trending order can shift with new kudos. Following is a chronological
      // feed so its order isn't kudos-dependent — but counts on its rows
      // are now stale until refetch. Invalidate both, mark cached pages
      // stale, refetch on next focus.
      qc.invalidateQueries({ queryKey: ["feed", "trending"] });
      qc.invalidateQueries({ queryKey: ["feed", "following"] });
    },
  });
}
