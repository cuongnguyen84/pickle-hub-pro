// ============================================================================
// registrationApi.ts — ARCH-02 increment 3: the infrastructure slice of the
// social-event registration flow. Every supabase call RegistrationModal
// makes lives here; the component keeps orchestration, state and toasts.
//
// Contract: each function returns the raw supabase `{ data, error }` result
// untouched — error-code extraction and translation stay in the caller.
// Behavior is pinned by RegistrationModal.money-path.test.tsx; if a change
// here breaks those tests, the change altered the money path.
// ============================================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SendOtpResponse {
  ok?: true;
  expires_at?: string;
  dev_mode_code?: string;
  channel?: "zalo" | "sms" | "dev";
  error?: string;
  code?: string;
}

export interface VerifyOtpResponse {
  ok: true;
  registration_id: string;
  profile_id: string;
  magic_token: string;
  registered_at: string;
  error?: string;
  code?: string;
}

export interface PaymentOrderResponse {
  ok?: true;
  code?: string;
  order_id?: string;
  reference_code?: string;
  amount_vnd?: number;
  player_claimed_paid?: boolean;
  player_claimed_at?: string | null;
  bank?: { code: string; account_number: string; account_name: string };
}

export interface MemberRegistrationRow {
  registration_id: string;
  profile_id: string;
  magic_token: string;
  registered_at: string;
}

export function sendOtp(params: {
  phone: string;
  eventId: string;
  forceChannel?: "sms" | "zalo";
  turnstileToken: string | null;
}) {
  return supabase.functions.invoke<SendOtpResponse>("phone-otp-send", {
    body: {
      phone: params.phone,
      event_id: params.eventId,
      ...(params.forceChannel ? { force_channel: params.forceChannel } : {}),
      // PR69 — Cloudflare Turnstile token. Server rejects with
      // 'captcha_failed' when missing/invalid in production.
      turnstile_token: params.turnstileToken ?? undefined,
    },
  });
}

export function verifyOtp(params: {
  phone: string;
  eventId: string;
  code: string;
  displayName: string;
  selfRatedLevel: number | null;
  slotId: string | undefined;
}) {
  return supabase.functions.invoke<VerifyOtpResponse>("phone-otp-verify", {
    body: {
      phone: params.phone,
      event_id: params.eventId,
      code: params.code,
      display_name: params.displayName,
      self_rated_level: params.selfRatedLevel,
      // Only forward when set — older events without slots stay
      // backwards compatible (server treats missing/empty as "no
      // slot" and falls back to max_players gate).
      slot_id: params.slotId,
    },
  });
}

export function createPaymentOrder(params: {
  registrationId: string;
  magicToken: string;
}) {
  return supabase.functions.invoke<PaymentOrderResponse>("create-payment-order", {
    body: {
      registration_id: params.registrationId,
      magic_token: params.magicToken,
    },
  });
}

export function registerAsMember(params: {
  eventId: string;
  slotId: string | undefined;
}) {
  return supabase.rpc("register_event_as_member", {
    p_event_id: params.eventId,
    p_slot_id: params.slotId,
  });
}

export function saveContactEmail(params: { magicToken: string; email: string }) {
  return supabase.rpc("update_profile_contact_from_magic", {
    p_magic_token: params.magicToken,
    p_email: params.email,
  });
}

/**
 * Per-slot active registration counts, keyed by slot id. Re-fetches
 * whenever the modal opens (open is part of the query key) so the player
 * sees up-to-date numbers.
 */
export function useSlotCounts(eventId: string, open: boolean, hasSlots: boolean) {
  return useQuery<Record<string, number>>({
    queryKey: ["event-slot-counts", eventId, open],
    queryFn: async () => {
      if (!hasSlots) return {};
      const { data, error } = await supabase.rpc("get_event_slot_counts", {
        p_event_id: eventId,
      });
      if (error) {
        console.error("get_event_slot_counts failed", error);
        return {};
      }
      const map: Record<string, number> = {};
      for (const row of (data ?? []) as Array<{
        slot_id: string;
        registered_count: number;
      }>) {
        if (row?.slot_id) map[row.slot_id] = row.registered_count ?? 0;
      }
      return map;
    },
    enabled: hasSlots && open,
    staleTime: 15_000,
  });
}
