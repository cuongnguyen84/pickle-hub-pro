import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Hook to track real-time concurrent viewers for a livestream using Supabase Presence.
 * 
 * This provides the actual number of people currently watching a livestream,
 * which increases when viewers join and decreases when they leave.
 * 
 * @param livestreamId - The ID of the livestream to track
 * @param enabled - Whether to enable presence tracking (default: true)
 * @returns Object with concurrentViewers count and isConnected status
 */
export function useLivePresence(livestreamId: string, enabled: boolean = true) {
  const { user } = useAuth();
  const [concurrentViewers, setConcurrentViewers] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const hasTrackedRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [2000, 4000, 8000]; // Exponential backoff

  const cleanup = useCallback(() => {
    hasTrackedRef.current = false;
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (channelRef.current) {
      try {
        channelRef.current.untrack();
        supabase.removeChannel(channelRef.current);
      } catch (err) {
        console.warn("[Presence] Cleanup error (non-critical):", err);
      }
      channelRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (!livestreamId || !enabled) {
      setConcurrentViewers(0);
      setIsConnected(false);
      return;
    }

    const setupChannel = () => {
      // Create a unique viewer ID for this session
      const viewerId = `viewer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Channel name for this livestream's presence
      const channelName = `livestream_presence:${livestreamId}`;
      
      const channel = supabase.channel(channelName, {
        config: {
          presence: {
            key: viewerId,
          },
        },
      });

      channelRef.current = channel;

      // Subscription timeout - don't wait forever
      const subscriptionTimeout = setTimeout(() => {
        if (!hasTrackedRef.current) {
          console.warn("[Presence] Subscription timeout, proceeding without presence");
          // Don't fail the whole page, just mark as not connected
          setIsConnected(false);
        }
      }, 10000);

      // Handle presence sync events (called when presence state changes)
      channel
        .on("presence", { event: "sync" }, () => {
          try {
            const state = channel.presenceState();
            // Count unique presence keys (viewers)
            const viewerCount = Object.keys(state).length;
            setConcurrentViewers(viewerCount);
          } catch (err) {
            console.warn("[Presence] Sync error:", err);
          }
        })
        .on("presence", { event: "join" }, ({ key }) => {
          console.log("[Presence] Viewer joined:", key);
        })
        .on("presence", { event: "leave" }, ({ key }) => {
          console.log("[Presence] Viewer left:", key);
        })
        .subscribe(async (status, err) => {
          clearTimeout(subscriptionTimeout);
          
          if (status === "SUBSCRIBED") {
            setIsConnected(true);
            retryCountRef.current = 0; // Reset retry count on success
            
            // Track this viewer's presence
            if (!hasTrackedRef.current) {
              try {
                await channel.track({
                  joined_at: new Date().toISOString(),
                  user_id: user?.id ?? null,
                  user_agent: navigator.userAgent.slice(0, 100),
                });
                hasTrackedRef.current = true;
              } catch (trackErr) {
                console.warn("[Presence] Track error (non-critical):", trackErr);
              }
            }
          } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
            console.warn("[Presence] Channel error:", status, err);
            setIsConnected(false);
            
            // Attempt to retry connection
            if (retryCountRef.current < MAX_RETRIES) {
              const delay = RETRY_DELAYS[retryCountRef.current] || 8000;
              console.log(`[Presence] Retrying in ${delay}ms (attempt ${retryCountRef.current + 1}/${MAX_RETRIES})`);
              
              retryTimeoutRef.current = setTimeout(() => {
                retryCountRef.current++;
                cleanup();
                setupChannel();
              }, delay);
            }
          }
        });
    };

    setupChannel();

    // Cleanup: untrack and unsubscribe when component unmounts or livestream changes
    return cleanup;
  }, [livestreamId, enabled, cleanup]);

  return {
    concurrentViewers,
    isConnected,
  };
}
