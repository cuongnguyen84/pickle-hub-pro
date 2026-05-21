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
  payment_status: "unpaid" | "paid" | "refunded" | "pending_payment";
  paid_at: string | null;
  notes: string | null;
  registered_at: string;
  // PR feat/proxy-and-manual-registration — surface source so the public
  // roster can render a small "đăng ký hộ" badge next to proxy rows, and
  // the organizer roster can additionally render a "BTC thêm" badge for
  // manual rows. Internal notes are organizer-only (column-level — RLS
  // still returns the row to public viewers, the UI just hides the field).
  registration_source: "self" | "proxy" | "manual";
  registered_by_profile_id: string | null;
  internal_notes: string | null;
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
           status, payment_status, paid_at, notes, registered_at,
           registration_source, registered_by_profile_id, internal_notes`,
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
