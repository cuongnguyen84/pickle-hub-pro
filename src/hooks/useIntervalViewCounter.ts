import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseIntervalViewCounterOptions {
  targetType: "livestream" | "video";
  targetId: string | undefined;
  viewerUserId: string | null;
  organizationId: string | null | undefined;
  source?: "embed";
  /** Whether this is a replay view (ended livestream) */
  isReplay?: boolean;
  /** How often (ms) to accumulate a view event. Default: 30s */
  intervalMs?: number;
  /** How often (ms) to flush the batch to the server. Default: 60s */
  flushIntervalMs?: number;
  /** Max events per session to prevent inflation. Default: 20 (~10 min) */
  maxEventsPerSession?: number;
}

interface PendingEvent {
  target_type: "livestream" | "video";
  target_id: string;
  viewer_user_id: string | null;
  organization_id: string | null;
  source?: "embed";
}

/**
 * Records view events by accumulating them client-side every `intervalMs` (default 30s)
 * and flushing the batch to the edge function every `flushIntervalMs` (default 60s).
 * Caps at `maxEventsPerSession` (default 20) to prevent view inflation.
 */
export function useIntervalViewCounter({
  targetType,
  targetId,
  viewerUserId,
  organizationId,
  source,
  intervalMs = 30_000,
  flushIntervalMs = 60_000,
  maxEventsPerSession = 20,
}: UseIntervalViewCounterOptions) {
  const pendingRef = useRef<PendingEvent[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flushRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalSentRef = useRef(0);

  useEffect(() => {
    if (!targetId) return;

    // Reset session counter when target changes
    totalSentRef.current = 0;

    const event: PendingEvent = {
      target_type: targetType,
      target_id: targetId,
      viewer_user_id: viewerUserId ?? null,
      organization_id: organizationId ?? null,
      ...(source ? { source } : {}),
    };

    // Accumulate one event every intervalMs (only if under cap)
    tickRef.current = setInterval(() => {
      if (totalSentRef.current + pendingRef.current.length < maxEventsPerSession) {
        pendingRef.current.push({ ...event });
      }
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
        totalSentRef.current += batch.length;
      } catch (err) {
        // Put events back on failure (but respect cap)
        const remaining = batch.slice(0, maxEventsPerSession - totalSentRef.current);
        pendingRef.current.unshift(...remaining);
        console.error("[useIntervalViewCounter] flush error:", err);
      }
    };

    flushRef.current = setInterval(flush, flushIntervalMs);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (flushRef.current) clearInterval(flushRef.current);

      // Flush remaining events on unmount
      if (pendingRef.current.length > 0) {
        const remaining = pendingRef.current.slice(0, maxEventsPerSession - totalSentRef.current);
        pendingRef.current = [];
        if (remaining.length > 0) {
          supabase.functions
            .invoke("batch-view-events", { body: { events: remaining } })
            .catch(() => {});
        }
      }
    };
  }, [targetType, targetId, viewerUserId, organizationId, source, intervalMs, flushIntervalMs, maxEventsPerSession]);
}
