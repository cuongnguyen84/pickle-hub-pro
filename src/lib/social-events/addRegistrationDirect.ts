// ============================================================================
// addRegistrationDirect — wrapper around the add-registration-direct edge fn
// ----------------------------------------------------------------------------
// Two flows under one helper:
//
//   - mode='proxy'   → player A registers a friend B. Caller passes A's
//                       magic_token (from localStorage); the edge fn verifies
//                       A is registered to the same event.
//
//   - mode='manual'  → organizer adds someone outside OTP. Caller passes
//                       the current supabase session access_token; the edge
//                       fn verifies via supabase.auth.getUser() + the
//                       verify_event_organizer RPC.
//
// Returns the parsed { success, magic_token, recovery_url, reference_code,
// ... } payload on success, or throws an Error whose .message is the
// server-supplied `code` (e.g. "rate_limit_exceeded") so the calling modal
// can translate it via i18n.
// ============================================================================

import { supabase } from "@/integrations/supabase/client";

export type DirectRegistrationMode = "proxy" | "manual";

export type ManualPaymentInitialStatus =
  | "unpaid"
  | "claimed_paid"
  | "waived";

export interface AddRegistrationDirectInput {
  eventId: string;
  guestPhone: string;       // already E.164 (+84...)
  guestName: string;
  guestSelfRating?: number | null;
  mode: DirectRegistrationMode;
  // Required when mode='proxy': proxy registrant's magic_token (from localStorage).
  proxyMagicToken?: string;
  // Required when mode='manual': current supabase access_token.
  organizerAuthToken?: string;
  // manual-only.
  initialPaymentStatus?: ManualPaymentInitialStatus;
  internalNotes?: string | null;
}

export interface AddRegistrationDirectResult {
  success: true;
  ok: true;
  mode: DirectRegistrationMode;
  registration_id: string;
  magic_token: string;
  reference_code: string | null;
  recovery_url: string;
  guest_name: string;
  guest_phone: string;
  event_name: string;
  event_slug: string | null;
  payment_status: "unpaid" | "pending_payment" | "paid";
  player_claimed_paid: boolean;
  registered_at: string;
}

export interface AddRegistrationDirectError {
  error: string;
  code: string;
}

/**
 * Call add-registration-direct. Throws an Error whose .message is the
 * server-supplied error code so the calling modal can translate it.
 */
export async function addRegistrationDirect(
  input: AddRegistrationDirectInput,
): Promise<AddRegistrationDirectResult> {
  const body: Record<string, unknown> = {
    event_id: input.eventId,
    guest_phone: input.guestPhone,
    guest_name: input.guestName,
    mode: input.mode,
  };
  if (input.guestSelfRating != null && Number.isFinite(input.guestSelfRating)) {
    body.guest_self_rating = input.guestSelfRating;
  }
  if (input.mode === "proxy") {
    body.proxy_magic_token = input.proxyMagicToken;
  } else {
    body.organizer_auth_token = input.organizerAuthToken;
    if (input.initialPaymentStatus) {
      body.initial_payment_status = input.initialPaymentStatus;
    }
    if (input.internalNotes != null && input.internalNotes.trim().length > 0) {
      body.internal_notes = input.internalNotes.trim();
    }
  }

  const { data, error } = await supabase.functions.invoke<
    AddRegistrationDirectResult | AddRegistrationDirectError
  >("add-registration-direct", { body });

  if (error) {
    // supabase.functions.invoke wraps non-2xx into `error`. We re-read
    // the response body to surface the structured `code` field.
    const ctx = (error as { context?: Response }).context;
    let bodyCode: string | undefined;
    if (ctx) {
      try {
        const txt = await ctx.text();
        const parsed = JSON.parse(txt);
        bodyCode = parsed?.code;
      } catch {
        // not JSON, fall through
      }
    }
    throw new Error(bodyCode ?? error.message ?? "network_error");
  }
  if (!data) throw new Error("network_error");
  if ((data as AddRegistrationDirectError).code && !(data as AddRegistrationDirectResult).success) {
    throw new Error((data as AddRegistrationDirectError).code);
  }
  return data as AddRegistrationDirectResult;
}
