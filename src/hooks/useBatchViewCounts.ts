import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Batch fetch view counts for multiple targets in a single query.
 * Returns a map of targetId -> count.
 */
export function useBatchViewCounts(
  targetType: "video" | "livestream",
  targetIds: string[]
): Record<string, number> {
  const { data } = useQuery({
    queryKey: ["batch-view-counts", targetType, targetIds],
    queryFn: async () => {
      if (targetIds.length === 0) return {};

      const { data, error } = await supabase
        .from("view_counts")
        .select("target_id, count")
        .eq("target_type", targetType)
        .in("target_id", targetIds);

      if (error) throw error;

      const map: Record<string, number> = {};
      for (const row of data ?? []) {
        map[row.target_id] = row.count;
      }
      return map;
    },
    enabled: targetIds.length > 0,
    staleTime: 30 * 1000,
  });

  return data ?? {};
}
