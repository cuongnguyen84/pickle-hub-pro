import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  const [concurrentViewers, setConcurrentViewers] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    if (!livestreamId || !enabled) {
      setConcurrentViewers(0);
      setIsConnected(false);
      return;
    }

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

    // Handle presence sync events (called when presence state changes)
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        // Count unique presence keys (viewers)
        const viewerCount = Object.keys(state).length;
        setConcurrentViewers(viewerCount);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        console.log("[Presence] Viewer joined:", key, newPresences);
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        console.log("[Presence] Viewer left:", key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          
          // Track this viewer's presence
          if (!hasTrackedRef.current) {
            await channel.track({
              joined_at: new Date().toISOString(),
              user_agent: navigator.userAgent.slice(0, 100),
            });
            hasTrackedRef.current = true;
          }
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          setIsConnected(false);
        }
      });

    // Cleanup: untrack and unsubscribe when component unmounts or livestream changes
    return () => {
      hasTrackedRef.current = false;
      if (channelRef.current) {
        channelRef.current.untrack();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [livestreamId, enabled]);

  return {
    concurrentViewers,
    isConnected,
  };
}
