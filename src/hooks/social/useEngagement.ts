import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
 * Counts + viewer state for one engagement target, via the
 * get_engagement_counts RPC (single-id call per card; React Query
 * dedupes across re-renders). Guests get counts with viewer_kudoed
 * false - the RPC reads auth.uid() server-side.
 */
export function useEngagementCounts(
  targetType: EngagementTargetType,
  targetId: string | undefined,
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["engagement-counts", targetType, targetId ?? null, user?.id ?? null],
    enabled: !!targetId,
    staleTime: 30_000,
    queryFn: async (): Promise<EngagementCounts> => {
      if (!targetId) return ZERO;
      const { data, error } = await supabase.rpc(
        "get_engagement_counts" as never,
        {
          p_target_type: targetType,
          p_target_ids: [targetId],
        } as never,
      );
      if (error) throw error;
      const row = (data as unknown as CountRow[] | null)?.[0];
      if (!row) return ZERO;
      return {
        kudos_count: row.kudos_count ?? 0,
        comment_count: row.comment_count ?? 0,
        viewer_kudoed: !!row.viewer_kudoed,
      };
    },
  });
}

interface ToggleResponse {
  kudoed: boolean;
  count: number;
}

/** Toggle kudos on any non-match target via toggle_target_kudos. */
export function useToggleTargetKudos(targetType: EngagementTargetType) {
  const { user } = useAuth();
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
