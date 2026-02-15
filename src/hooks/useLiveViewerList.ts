import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface ViewerInfo {
  viewerId: string;
  userId: string | null;
  joinedAt: string;
}

interface ViewerProfile {
  viewerId: string;
  userId: string | null;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  joinedAt: string;
}

/**
 * Admin-only hook to get the full list of viewers on a livestream via Presence.
 * Enriches viewer data with profile info (display_name, email).
 */
export function useLiveViewerList(livestreamId: string, enabled: boolean = true) {
  const [viewers, setViewers] = useState<ViewerProfile[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const enrichViewers = useCallback(async (rawViewers: ViewerInfo[]) => {
    const userIds = rawViewers
      .map((v) => v.userId)
      .filter((id): id is string => !!id);

    let profileMap: Record<string, { display_name: string | null; email: string; avatar_url: string | null }> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, email, avatar_url")
        .in("id", userIds);

      if (profiles) {
        for (const p of profiles) {
          profileMap[p.id] = p;
        }
      }
    }

    return rawViewers.map((v): ViewerProfile => {
      const profile = v.userId ? profileMap[v.userId] : null;
      return {
        viewerId: v.viewerId,
        userId: v.userId,
        displayName: profile?.display_name ?? null,
        email: profile?.email ?? null,
        avatarUrl: profile?.avatar_url ?? null,
        joinedAt: v.joinedAt,
      };
    });
  }, []);

  useEffect(() => {
    if (!livestreamId || !enabled) {
      setViewers([]);
      setIsConnected(false);
      return;
    }

    const channelName = `livestream_presence:${livestreamId}`;
    const adminKey = `admin_watcher_${Date.now()}`;

    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: adminKey,
        },
      },
    });

    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, async () => {
        const state = channel.presenceState();
        const rawViewers: ViewerInfo[] = [];

        for (const [key, presences] of Object.entries(state)) {
          // Skip admin watcher entries
          if (key.startsWith("admin_watcher_")) continue;
          const presence = (presences as any[])[0];
          rawViewers.push({
            viewerId: key,
            userId: presence?.user_id ?? null,
            joinedAt: presence?.joined_at ?? new Date().toISOString(),
          });
        }

        const enriched = await enrichViewers(rawViewers);
        setViewers(enriched);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // Track admin presence so we join the channel properly
          try {
            await channel.track({ role: "admin", joined_at: new Date().toISOString() });
          } catch (e) {
            console.warn("[ViewerList] Admin track error:", e);
          }
          setIsConnected(true);
        }
      });

    return () => {
      if (channelRef.current) {
        channelRef.current.untrack().catch(() => {});
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [livestreamId, enabled, enrichViewers]);

  return { viewers, isConnected, viewerCount: viewers.length };
}
