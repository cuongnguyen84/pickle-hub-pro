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
      // Write via SECURITY DEFINER RPC — direct table access is revoked so the
      // presence table can no longer be scraped (M1). user_id is derived from
      // auth.uid() server-side; we only send the session id + current path.
      await supabase.rpc("record_heartbeat", {
        p_session_id: sessionId,
        p_page_path: window.location.pathname,
      });
    };

    // Send immediately on mount
    sendHeartbeat();

    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user?.id]);
}
