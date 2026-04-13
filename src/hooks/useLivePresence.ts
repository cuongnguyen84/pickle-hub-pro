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
  const healthCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const MAX_RETRIES = 10;
  const getRetryDelay = (attempt: number) => Math.min(2000 * Math.pow(1.5, attempt), 30000);

  const cleanup = useCallback(() => {
    hasTrackedRef.current = false;
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (healthCheckRef.current) {
      clearInterval(healthCheckRef.current);
      healthCheckRef.current = null;
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
      
      // Channel name for this livestream's presence (unique to avoid resubscribe errors)
      const channelName = `livestream_presence:${livestreamId}:${Date.now()}`;

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
            
            // Attempt to retry connection with exponential backoff
            if (retryCountRef.current < MAX_RETRIES) {
              const delay = getRetryDelay(retryCountRef.current);
              console.log(`[Presence] Retrying in ${delay}ms (attempt ${retryCountRef.current + 1}/${MAX_RETRIES})`);
              
              retryTimeoutRef.current = setTimeout(() => {
                retryCountRef.current++;
                cleanup();
                setupChannel();
              }, delay);
            } else {
              // After max retries, try again after 60s as a last resort
              console.warn("[Presence] Max retries exhausted, will retry in 60s");
              retryTimeoutRef.current = setTimeout(() => {
                retryCountRef.current = 0;
                cleanup();
                setupChannel();
              }, 60000);
            }
          }
        });
    };

    setupChannel();

    // Health check: if disconnected for too long, force reconnect
    healthCheckRef.current = setInterval(() => {
      if (channelRef.current) {
        try {
          const state = channelRef.current.presenceState();
          const viewerCount = Object.keys(state).length;
          setConcurrentViewers(viewerCount);
        } catch {
          // Channel may be in bad state, will be handled by error callback
        }
      }
    }, 15000);

    // Cleanup: untrack and unsubscribe when component unmounts or livestream changes
    return cleanup;
  }, [livestreamId, enabled, cleanup]);

  return {
    concurrentViewers,
    isConnected,
  };
}
