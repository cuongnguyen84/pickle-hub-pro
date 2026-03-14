import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseIntervalViewCounterOptions {
  targetType: "livestream" | "video";
  targetId: string | undefined;
  viewerUserId: string | null;
  organizationId: string | null | undefined;
  source?: "embed";
  intervalMs?: number;
}

/**
 * Records a view event every `intervalMs` (default 3s) of continuous viewing.
 * First event fires after the first interval, then repeats until unmount.
 */
export function useIntervalViewCounter({
  targetType,
  targetId,
  viewerUserId,
  organizationId,
  source,
  intervalMs = 3000,
}: UseIntervalViewCounterOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!targetId) return;

    const recordView = async () => {
      try {
        await supabase.from("view_events").insert({
          target_type: targetType,
          target_id: targetId,
          viewer_user_id: viewerUserId ?? null,
          organization_id: organizationId ?? null,
          ...(source ? { source } : {}),
        });
      } catch (err) {
        console.error(`[useIntervalViewCounter] Error recording ${targetType} view:`, err);
      }
    };

    // First view after intervalMs, then repeat
    intervalRef.current = setInterval(recordView, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [targetType, targetId, viewerUserId, organizationId, source, intervalMs]);
}
