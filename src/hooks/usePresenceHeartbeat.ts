import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const SESSION_KEY = "tph_presence_session_id";
const HEARTBEAT_INTERVAL_MS = 60_000;

function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function usePresenceHeartbeat() {
  const { user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const sessionId = getOrCreateSessionId();

    const sendHeartbeat = async () => {
      if (document.hidden) return;
      await supabase.from("presence_heartbeats").upsert(
        {
          session_id: sessionId,
          user_id: user?.id ?? null,
          last_seen_at: new Date().toISOString(),
          page_path: window.location.pathname,
        },
        { onConflict: "session_id" }
      );
    };

    // Send immediately on mount
    sendHeartbeat();

    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user?.id]);
}
