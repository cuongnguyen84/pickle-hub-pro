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
  /** Base payload tracked at join — reused verbatim on re-track so
   * joined_at never resets when only `gated` changes. */
  payload: { joined_at: string; user_id: string | null; user_agent: string } | null;
  /** Latest gate state for this client; SUBSCRIBED handler reads it so a
   * reconnect after the gate fired still reports gated: true. */
  gated: boolean;
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

async function connect(livestreamId: string, entry: SharedPresence, userId: string | null) {
  if (entry.disposed) return;
  const topic = `livestream_presence:${livestreamId}`;

  // realtime-js dedupe theo topic: nếu instance CŨ còn trong list (removeChannel
  // là async), supabase.channel() trả lại đúng instance đã subscribe → .on()
  // throw "cannot add presence callbacks after subscribe()" (đã dính prod
  // 2026-07-08). Gỡ hẳn instance cũ (đợi xong) trước khi tạo mới.
  const stale = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`);
  if (stale) {
    try {
      await supabase.removeChannel(stale);
    } catch {
      // ignore
    }
  }
  if (entry.disposed) return;
  if (supabase.getChannels().some((c) => c.topic === `realtime:${topic}`)) {
    // unsubscribe 'timed out' — topic vẫn kẹt, thử lại sau 1s.
    entry.retryTimer = setTimeout(() => {
      void connect(livestreamId, entry, userId);
    }, 1000);
    return;
  }

  // Key duy nhất per thiết bị/tab — 2 account hay 2 tab đều là 2 viewer.
  const viewerId = `viewer_${uniqueChannelSuffix()}`;
  const channel = supabase.channel(topic, {
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
          // Reuse the original payload on reconnect so joined_at is stable;
          // gated reads the LATEST value (gate may have fired mid-retry).
          entry.payload ??= {
            joined_at: new Date().toISOString(),
            user_id: userId,
            user_agent: navigator.userAgent.slice(0, 100),
          };
          await channel.track({ ...entry.payload, gated: entry.gated });
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
          void connect(livestreamId, entry, userId);
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
    payload: null,
    gated: false,
  };
  sharedEntries.set(livestreamId, entry);
  void connect(livestreamId, entry, userId);
  return entry;
}

/**
 * Update this client's `gated` presence meta via channel.track() on the
 * ALREADY-subscribed shared channel. Deliberately NOT part of the subscribe
 * effect: putting `gated` in its deps would release()/acquire() the channel
 * on every gate flip — the exact re-subscribe churn behind the 2026-07-08
 * collision incident. track() on a live channel merely replaces this key's
 * presence meta; no re-join happens.
 */
function setGated(livestreamId: string, gated: boolean) {
  const entry = sharedEntries.get(livestreamId);
  if (!entry || entry.disposed || entry.gated === gated) return;
  entry.gated = gated;
  if (entry.channel && entry.connected && entry.payload) {
    entry.channel
      .track({ ...entry.payload, gated })
      .catch((err) => console.warn("[Presence] Gated re-track error (non-critical):", err));
  }
  // Not yet subscribed → the SUBSCRIBED handler picks up entry.gated.
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
 * @param gated - Optional: this viewer is stuck at the login gate. Only pass
 *   from the surface that owns the gate (WatchLive); consumers that omit it
 *   never overwrite the shared entry's gate state.
 * @returns Object with concurrentViewers count and isConnected status
 */
export function useLivePresence(
  livestreamId: string,
  enabled: boolean = true,
  gated?: boolean,
) {
  const { user } = useAuth();
  const [concurrentViewers, setConcurrentViewers] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  // user?.id cố ý KHÔNG nằm trong deps — join 1 lần với user tại thời điểm đó,
  // đổi account giữa chừng không cần re-join (payload user_id chỉ để admin xem).
  useEffect(() => {
    if (!livestreamId || !enabled) {
      setConcurrentViewers(0);
      setIsConnected(false);
      return undefined;
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

  // Separate effect ON PURPOSE — `gated` must never enter the subscribe
  // effect's deps (see setGated). undefined = consumer doesn't manage gating.
  useEffect(() => {
    if (!livestreamId || !enabled || gated === undefined) return;
    setGated(livestreamId, gated);
  }, [livestreamId, enabled, gated]);

  return {
    concurrentViewers,
    isConnected,
  };
}
