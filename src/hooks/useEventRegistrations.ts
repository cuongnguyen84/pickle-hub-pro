// ============================================================================
// useEventRegistrations — list registrations for one event
// ----------------------------------------------------------------------------
// Public viewers (RLS) only see rows whose event is published+public.
// Organizers see all rows. The hook returns whichever rows RLS permits.
// ============================================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EventRegistrationRow {
  id: string;
  event_id: string;
  profile_id: string | null;
  phone: string | null;
  display_name: string;
  self_rated_level: number | null;
  status: "registered" | "checked_in" | "cancelled" | "no_show";
  payment_status: "unpaid" | "paid" | "refunded";
  paid_at: string | null;
  notes: string | null;
  registered_at: string;
}

export function useEventRegistrations(eventId: string | undefined) {
  return useQuery<EventRegistrationRow[]>({
    queryKey: ["event-registrations", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from("event_registrations")
        .select(
          `id, event_id, profile_id, phone, display_name, self_rated_level,
           status, payment_status, paid_at, notes, registered_at`,
        )
        .eq("event_id", eventId)
        .neq("status", "cancelled")
        .order("registered_at", { ascending: true });
      if (error) {
        console.error("useEventRegistrations: lookup error", { eventId, error });
        return [];
      }
      return (data ?? []) as EventRegistrationRow[];
    },
    enabled: Boolean(eventId),
    staleTime: 15_000,
  });
}
