import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseIntervalViewCounterOptions {
  targetType: "livestream" | "video";
  targetId: string | undefined;
  viewerUserId: string | null;
  organizationId: string | null | undefined;
  source?: "embed";
  intervalMs?: number;
  flushIntervalMs?: number;
}

interface PendingEvent {
  target_type: "livestream" | "video";
  target_id: string;
  viewer_user_id: string | null;
  organization_id: string | null;
  source?: "embed";
}

/**
 * Records view events by accumulating them client-side every `intervalMs` (default 10s)
 * and flushing the batch to the edge function every `flushIntervalMs` (default 30s).
 */
export function useIntervalViewCounter({
  targetType,
  targetId,
  viewerUserId,
  organizationId,
  source,
  intervalMs = 10000,
  flushIntervalMs = 30000,
}: UseIntervalViewCounterOptions) {
  const pendingRef = useRef<PendingEvent[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flushRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!targetId) return;

    const event: PendingEvent = {
      target_type: targetType,
      target_id: targetId,
      viewer_user_id: viewerUserId ?? null,
      organization_id: organizationId ?? null,
      ...(source ? { source } : {}),
    };

    // Accumulate one event every intervalMs
    tickRef.current = setInterval(() => {
      pendingRef.current.push({ ...event });
    }, intervalMs);

    // Flush batch every flushIntervalMs
    const flush = async () => {
      if (pendingRef.current.length === 0) return;
      const batch = [...pendingRef.current];
      pendingRef.current = [];

      try {
        await supabase.functions.invoke("batch-view-events", {
          body: { events: batch },
        });
      } catch (err) {
        // Put events back on failure
        pendingRef.current.unshift(...batch);
        console.error("[useIntervalViewCounter] flush error:", err);
      }
    };

    flushRef.current = setInterval(flush, flushIntervalMs);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (flushRef.current) clearInterval(flushRef.current);

      // Flush remaining events on unmount
      if (pendingRef.current.length > 0) {
        const remaining = [...pendingRef.current];
        pendingRef.current = [];
        supabase.functions
          .invoke("batch-view-events", { body: { events: remaining } })
          .catch(() => {});
      }
    };
  }, [targetType, targetId, viewerUserId, organizationId, source, intervalMs, flushIntervalMs]);
}
