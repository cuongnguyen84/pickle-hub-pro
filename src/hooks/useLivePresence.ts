import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { uniqueChannelSuffix } from "@/lib/uniqueChannelId";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ============================================================================
// Presence topic PHẢI giống hệt nhau giữa mọi client thì mới đếm chéo được —
// bug cũ: topic có suffix ngẫu nhiên per-client → mỗi người một "phòng" riêng,
// ai cũng chỉ thấy 1 viewer. Suffix chỉ được nằm ở presence KEY (định danh
// từng thiết bị), còn topic cố định `livestream_presence:<id>`.
//
// Registry per-client (refcount): nhiều component cùng trang (hero + card +
// watch page) dùng chung 1 channel — tránh lỗi subscribe trùng topic trên
// cùng socket của supabase-js.
// ============================================================================

interface SharedPresence {
  channel: RealtimeChannel | null;
  refs: number;
  count: number;
  connected: boolean;
  listeners: Set<() => void>;
  retryCount: number;
  retryTimer: ReturnType<typeof setTimeout> | null;
  disposed: boolean;
}

const sharedEntries = new Map<string, SharedPresence>();

const MAX_RETRIES = 10;
const getRetryDelay = (attempt: number) => Math.min(2000 * Math.pow(1.5, attempt), 30000);

/** Đếm viewer thật — bỏ admin đang mở bảng theo dõi (key `admin_watcher_*`). */
function countViewers(channel: RealtimeChannel): number {
  return Object.keys(channel.presenceState()).filter((k) => !k.startsWith("admin_watcher_")).length;
}

function notify(entry: SharedPresence) {
  entry.listeners.forEach((fn) => fn());
}

function connect(livestreamId: string, entry: SharedPresence, userId: string | null) {
  // Key duy nhất per thiết bị/tab — 2 account hay 2 tab đều là 2 viewer.
  const viewerId = `viewer_${uniqueChannelSuffix()}`;
  const channel = supabase.channel(`livestream_presence:${livestreamId}`, {
    config: {
      presence: {
        key: viewerId,
      },
    },
  });
  entry.channel = channel;

  channel
    .on("presence", { event: "sync" }, () => {
      try {
        entry.count = countViewers(channel);
        notify(entry);
      } catch (err) {
        console.warn("[Presence] Sync error:", err);
      }
    })
    .subscribe(async (status, err) => {
      if (status === "SUBSCRIBED") {
        entry.connected = true;
        entry.retryCount = 0;
        notify(entry);
        try {
          await channel.track({
            joined_at: new Date().toISOString(),
            user_id: userId,
            user_agent: navigator.userAgent.slice(0, 100),
          });
        } catch (trackErr) {
          console.warn("[Presence] Track error (non-critical):", trackErr);
        }
      } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
        entry.connected = false;
        notify(entry);
        if (entry.disposed) return; // mình chủ động rời — không retry
        console.warn("[Presence] Channel error:", status, err);
        const attempt = entry.retryCount < MAX_RETRIES ? entry.retryCount : MAX_RETRIES;
        const delay = entry.retryCount < MAX_RETRIES ? getRetryDelay(attempt) : 60000;
        entry.retryCount++;
        if (entry.retryTimer) clearTimeout(entry.retryTimer);
        entry.retryTimer = setTimeout(() => {
          if (entry.disposed) return;
          try {
            supabase.removeChannel(channel);
          } catch {
            // ignore
          }
          connect(livestreamId, entry, userId);
        }, delay);
      }
    });
}

function acquire(livestreamId: string, userId: string | null): SharedPresence {
  const existing = sharedEntries.get(livestreamId);
  if (existing) {
    existing.refs++;
    return existing;
  }
  const entry: SharedPresence = {
    channel: null,
    refs: 1,
    count: 0,
    connected: false,
    listeners: new Set(),
    retryCount: 0,
    retryTimer: null,
    disposed: false,
  };
  sharedEntries.set(livestreamId, entry);
  connect(livestreamId, entry, userId);
  return entry;
}

function release(livestreamId: string, entry: SharedPresence) {
  entry.refs--;
  if (entry.refs > 0) return;
  entry.disposed = true;
  if (entry.retryTimer) {
    clearTimeout(entry.retryTimer);
    entry.retryTimer = null;
  }
  sharedEntries.delete(livestreamId);
  if (entry.channel) {
    try {
      entry.channel.untrack();
      supabase.removeChannel(entry.channel);
    } catch (err) {
      console.warn("[Presence] Cleanup error (non-critical):", err);
    }
    entry.channel = null;
  }
}

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

  // user?.id cố ý KHÔNG nằm trong deps — join 1 lần với user tại thời điểm đó,
  // đổi account giữa chừng không cần re-join (payload user_id chỉ để admin xem).
  useEffect(() => {
    if (!livestreamId || !enabled) {
      setConcurrentViewers(0);
      setIsConnected(false);
      return;
    }
    const entry = acquire(livestreamId, user?.id ?? null);
    const listener = () => {
      setConcurrentViewers(entry.count);
      setIsConnected(entry.connected);
    };
    entry.listeners.add(listener);
    listener();
    return () => {
      entry.listeners.delete(listener);
      release(livestreamId, entry);
      setIsConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livestreamId, enabled]);

  return {
    concurrentViewers,
    isConnected,
  };
}
