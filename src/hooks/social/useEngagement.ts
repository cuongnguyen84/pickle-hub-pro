import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthOptional } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import type { EngagementTargetType } from "@/lib/social/engagement";

export interface EngagementCounts {
  kudos_count: number;
  comment_count: number;
  viewer_kudoed: boolean;
}

const ZERO: EngagementCounts = {
  kudos_count: 0,
  comment_count: 0,
  viewer_kudoed: false,
};

interface CountRow {
  target_id: string;
  kudos_count: number;
  comment_count: number;
  viewer_kudoed: boolean;
}

/**
 * Batched counts loader (2026-11-24): a feed page mounts one bar per
 * card, so per-card RPCs would mean ~20 POSTs on first paint. All
 * count requests for the same target type made in one tick are merged
 * into ONE get_engagement_counts call with the full id array.
 */
interface PendingCount {
  resolve: (v: EngagementCounts) => void;
  reject: (e: unknown) => void;
}
const countBatches = new Map<
  string,
  { ids: Set<string>; waiters: Map<string, PendingCount[]>; timer: ReturnType<typeof setTimeout> | null }
>();

function fetchCountsBatched(
  targetType: EngagementTargetType,
  targetId: string,
): Promise<EngagementCounts> {
  const key = targetType;
  let batch = countBatches.get(key);
  if (!batch) {
    batch = { ids: new Set(), waiters: new Map(), timer: null };
    countBatches.set(key, batch);
  }
  const b = batch;
  return new Promise<EngagementCounts>((resolve, reject) => {
    b.ids.add(targetId);
    const arr = b.waiters.get(targetId) ?? [];
    arr.push({ resolve, reject });
    b.waiters.set(targetId, arr);
    if (!b.timer) {
      b.timer = setTimeout(() => {
        countBatches.delete(key);
        const ids = [...b.ids];
        supabase
          .rpc("get_engagement_counts" as never, {
            p_target_type: targetType,
            p_target_ids: ids,
          } as never)
          .then(({ data, error }) => {
            if (error) throw error;
            const rows = (data as unknown as CountRow[] | null) ?? [];
            const byId = new Map(rows.map((r) => [r.target_id, r]));
            for (const id of ids) {
              const row = byId.get(id);
              const value: EngagementCounts = row
                ? {
                    kudos_count: row.kudos_count ?? 0,
                    comment_count: row.comment_count ?? 0,
                    viewer_kudoed: !!row.viewer_kudoed,
                  }
                : ZERO;
              b.waiters.get(id)?.forEach((w) => w.resolve(value));
            }
          })
          .catch((err) => {
            for (const id of ids) {
              b.waiters.get(id)?.forEach((w) => w.reject(err));
            }
          });
      }, 0);
    }
  });
}

/**
 * Counts + viewer state for one engagement target. Guests get counts
 * with viewer_kudoed false - the RPC reads auth.uid() server-side.
 */
export function useEngagementCounts(
  targetType: EngagementTargetType,
  targetId: string | undefined,
) {
  const user = useAuthOptional()?.user ?? null;
  return useQuery({
    queryKey: ["engagement-counts", targetType, targetId ?? null, user?.id ?? null],
    enabled: !!targetId,
    staleTime: 30_000,
    queryFn: async (): Promise<EngagementCounts> => {
      if (!targetId) return ZERO;
      return fetchCountsBatched(targetType, targetId);
    },
  });
}

interface ToggleResponse {
  kudoed: boolean;
  count: number;
}

/** Toggle kudos on any non-match target via toggle_target_kudos. */
export function useToggleTargetKudos(targetType: EngagementTargetType) {
  const user = useAuthOptional()?.user ?? null;
  const qc = useQueryClient();
  const { toast } = useToast();
  const { language } = useI18n();

  return useMutation({
    mutationFn: async (targetId: string): Promise<ToggleResponse> => {
      if (!user) throw new Error("not_authenticated");
      const { data, error } = await supabase.rpc(
        "toggle_target_kudos" as never,
        { p_target_type: targetType, p_target_id: targetId } as never,
      );
      if (error) throw error;
      const parsed = data as unknown as ToggleResponse | null;
      if (!parsed || typeof parsed.count !== "number") {
        throw new Error("Malformed RPC response");
      }
      return parsed;
    },
    onMutate: async (targetId) => {
      const key = ["engagement-counts", targetType, targetId, user?.id ?? null];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<EngagementCounts>(key);
      if (prev) {
        qc.setQueryData<EngagementCounts>(key, {
          kudos_count: Math.max(
            0,
            prev.kudos_count + (prev.viewer_kudoed ? -1 : 1),
          ),
          comment_count: prev.comment_count,
          viewer_kudoed: !prev.viewer_kudoed,
        });
      }
      return { key, prev };
    },
    onError: (err, _targetId, ctx) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev);
      console.error("[useToggleTargetKudos] toggle failed", err);
      toast({
        variant: "destructive",
        title:
          language === "vi"
            ? "Không thể cập nhật lượt thích"
            : "Could not update like",
        description:
          err instanceof Error
            ? err.message
            : language === "vi"
              ? "Lỗi không xác định"
              : "Unexpected error",
      });
    },
    onSuccess: (data, targetId) => {
      const key = ["engagement-counts", targetType, targetId, user?.id ?? null];
      qc.setQueryData<EngagementCounts>(key, (old) => ({
        kudos_count: data.count,
        comment_count: old?.comment_count ?? 0,
        viewer_kudoed: data.kudoed,
      }));
    },
  });
}
