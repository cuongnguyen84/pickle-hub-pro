import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelSuffix } from "@/lib/uniqueChannelId";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface ViewerInfo {
  viewerId: string;
  userId: string | null;
  joinedAt: string;
  gated: boolean;
}

interface ViewerProfile {
  viewerId: string;
  userId: string | null;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  joinedAt: string;
  /** Stuck at the login gate. Missing field (legacy client) = false. */
  gated: boolean;
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

    const profileMap: Record<string, { display_name: string | null; email: string | null; avatar_url: string | null }> = {};

    if (userIds.length > 0) {
      // display_name + avatar_url from profiles. KHÔNG select `email` ở đây:
      // migration PII lockdown (20260706120000) REVOKE cột email khỏi role
      // `authenticated`, nên chỉ cần liệt kê email là cả câu SELECT fail
      // (permission denied) → mất luôn display_name → viewer thành "Ẩn danh".
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", userIds);

      if (profiles) {
        for (const p of profiles) {
          profileMap[p.id] = { display_name: p.display_name, email: null, avatar_url: p.avatar_url };
        }
      }

      // email qua RPC admin-only (SECURITY DEFINER, gated bằng is_admin()).
      const { data: emails } = await supabase.rpc("admin_get_profile_emails", { p_ids: userIds });
      if (emails) {
        for (const e of emails) {
          if (profileMap[e.id]) profileMap[e.id].email = e.email;
          else profileMap[e.id] = { display_name: e.display_name, email: e.email, avatar_url: null };
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
        gated: v.gated,
      };
    });
  }, []);

  useEffect(() => {
    if (!livestreamId || !enabled) {
      setViewers([]);
      setIsConnected(false);
      return undefined;
    }

    // Topic PHẢI trùng với topic viewer (useLivePresence) thì admin mới thấy
    // được người xem — chỉ presence key là duy nhất per phiên admin.
    const channelName = `livestream_presence:${livestreamId}`;
    const adminKey = `admin_watcher_${uniqueChannelSuffix()}`;
    let cancelled = false;

    (async () => {
      // realtime-js dedupe theo topic; removeChannel là async — phải đợi gỡ hẳn
      // instance cũ, nếu không channel() trả lại instance đã subscribe và .on()
      // throw "cannot add callbacks after subscribe()".
      const stale = supabase.getChannels().find((c) => c.topic === `realtime:${channelName}`);
      if (stale) {
        try {
          await supabase.removeChannel(stale);
        } catch {
          // ignore
        }
      }
      if (cancelled) return;
      if (supabase.getChannels().some((c) => c.topic === `realtime:${channelName}`)) {
        // Topic vẫn kẹt (unsubscribe timed out) — bỏ qua, admin mở lại panel sau.
        return;
      }

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
          const presence = (presences as Array<{ user_id?: string | null; joined_at?: string; gated?: boolean }>)[0];
          rawViewers.push({
            viewerId: key,
            userId: presence?.user_id ?? null,
            joinedAt: presence?.joined_at ?? new Date().toISOString(),
            // Optional-chain on purpose: tabs running the pre-gated client
            // send no `gated` field — treat legacy as watching, never filter.
            gated: presence?.gated === true,
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
    })();

    return () => {
      cancelled = true;
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
