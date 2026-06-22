import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Keeps the homepage feed's live-state ordering fresh in realtime.
 *
 * The home priority cluster re-orders by whether any court is live
 * (useLivestreams("live")). That query is otherwise only refetched on
 * mount / pull-to-refresh, so a stream starting or ending mid-session
 * would not re-order the feed until reload.
 *
 * This subscribes to the base `livestreams` table and invalidates every
 * ["livestreams", …] query on any insert/update/delete, so the live
 * section pops in / out and the editorial feature slides down/up without
 * a page reload. The `public_livestreams` view the data hooks read from
 * is backed by this table, so a status flip surfaces on the next refetch.
 *
 * Realtime here is a progressive enhancement — if the channel can't be
 * established the feed still works on mount and on pull-to-refresh.
 */
export function useLiveStatusRealtime(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(
          `home-live-status:${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "livestreams" },
          () => {
            queryClient.invalidateQueries({ queryKey: ["livestreams"] });
          },
        )
        .subscribe();
    } catch (err) {
      console.warn("[Home] live-status realtime setup failed:", err);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
