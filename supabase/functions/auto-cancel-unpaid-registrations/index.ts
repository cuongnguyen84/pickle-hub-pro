// ============================================================================
// auto-cancel-unpaid-registrations — Social Events MVP (PR67) cron function
// ----------------------------------------------------------------------------
// Hourly job: finds registrations where the player hasn't claimed payment
// within the event's prepayment deadline, flips them to status='cancelled'
// + cancelled_reason='auto_cancelled_unpaid_deadline', and sends a push
// notification to authed users (skips ghost profiles).
//
// Auth model:
//   Caller MUST send `x-cron-secret: <CRON_SECRET>` matching the
//   CRON_SECRET env var. Set via Supabase secrets. The pg_cron job
//   registered in the Dashboard passes this header when it POSTs.
//
// verify_jwt = false at the gateway (cron jobs don't carry a user JWT).
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/auth.ts";

const CANCELLED_REASON = "auto_cancelled_unpaid_deadline";

interface CandidateRow {
  registration_id: string;
  profile_id: string | null;
  event_id: string;
  event_title_vi: string;
  event_title_en: string | null;
  registered_at: string;
  prepayment_deadline_hours: number;
  is_ghost: boolean | null;
  player_claimed_paid: boolean | null;
}

function logEvent(payload: Record<string, unknown>): void {
  console.log(
    JSON.stringify({ function: "auto-cancel-unpaid-registrations", ...payload }),
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  // ─── Cron-secret gate ────────────────────────────────────────────────────
  const expectedSecret = Deno.env.get("CRON_SECRET") ?? "";
  if (!expectedSecret) {
    logEvent({ step: "cron_secret_not_configured" });
    return jsonResponse({ error: "cron_secret_not_configured" }, 500);
  }
  const presented = req.headers.get("x-cron-secret") ?? "";
  if (presented !== expectedSecret) {
    logEvent({ step: "auth_rejected" });
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // ─── 1. Find candidates ──────────────────────────────────────────────────
  // event_registrations.payment_status='pending_payment' + status='registered'
  // joined to social_events.requires_prepayment + the deadline arithmetic.
  // We skip registrations whose linked payment_order has player_claimed_paid
  // = true — the player declared payment + the organizer just hasn't
  // verified yet. The organizer keeps manual control over those.
  const nowIso = new Date().toISOString();
  const { data: pending, error: pendingErr } = await supabase
    .from("event_registrations")
    .select(
      `id, profile_id, event_id, registered_at,
       event:social_events!event_registrations_event_id_fkey(
         title_vi, title_en, requires_prepayment, prepayment_deadline_hours
       ),
       profile:profiles!event_registrations_profile_id_fkey(is_ghost),
       order:payment_orders!payment_orders_registration_id_fkey(player_claimed_paid)`,
    )
    .eq("payment_status", "pending_payment")
    .eq("status", "registered");

  if (pendingErr) {
    logEvent({ step: "fetch_pending_error", error: pendingErr.message });
    return jsonResponse({ error: "fetch_failed" }, 500);
  }

  type RawRow = {
    id: string;
    profile_id: string | null;
    event_id: string;
    registered_at: string;
    event: {
      title_vi: string;
      title_en: string | null;
      requires_prepayment: boolean;
      prepayment_deadline_hours: number;
    } | null;
    profile: { is_ghost: boolean } | null;
    order: { player_claimed_paid: boolean } | null;
  };

  const candidates: CandidateRow[] = [];
  for (const r of (pending ?? []) as RawRow[]) {
    if (!r.event?.requires_prepayment) continue;
    if (r.order?.player_claimed_paid) continue;
    const deadlineMs =
      new Date(r.registered_at).getTime() +
      r.event.prepayment_deadline_hours * 60 * 60 * 1000;
    if (deadlineMs >= Date.now()) continue;
    candidates.push({
      registration_id: r.id,
      profile_id: r.profile_id,
      event_id: r.event_id,
      event_title_vi: r.event.title_vi,
      event_title_en: r.event.title_en,
      registered_at: r.registered_at,
      prepayment_deadline_hours: r.event.prepayment_deadline_hours,
      is_ghost: r.profile?.is_ghost ?? null,
      player_claimed_paid: r.order?.player_claimed_paid ?? false,
    });
  }

  logEvent({ step: "candidates_found", count: candidates.length });

  // ─── 2. Cancel each candidate ────────────────────────────────────────────
  let cancelledCount = 0;
  const errors: { registration_id: string; error: string }[] = [];

  for (const c of candidates) {
    const { error: updErr } = await supabase
      .from("event_registrations")
      .update({
        status: "cancelled",
        cancelled_at: nowIso,
        cancelled_reason: CANCELLED_REASON,
      })
      .eq("id", c.registration_id)
      .eq("status", "registered")
      .eq("payment_status", "pending_payment");

    if (updErr) {
      logEvent({
        step: "update_failed",
        registration_id: c.registration_id,
        error: updErr.message,
      });
      errors.push({ registration_id: c.registration_id, error: updErr.message });
      continue;
    }

    cancelledCount += 1;

    // ─── 3. Notify authed users (skip ghosts who have no push tokens) ─────
    if (c.profile_id && c.is_ghost === false) {
      try {
        const eventTitle = c.event_title_vi || c.event_title_en || "Sự kiện";
        await supabase.functions.invoke("send-push-notification", {
          body: {
            user_ids: [c.profile_id],
            title: "Đăng ký đã bị huỷ",
            body:
              `Đăng ký event "${eventTitle}" đã tự động bị huỷ do quá hạn thanh toán.`,
            data: {
              type: "auto_cancel_unpaid",
              event_id: c.event_id,
              registration_id: c.registration_id,
            },
          },
        });
      } catch (e) {
        // Push failure is non-fatal — the registration was successfully
        // cancelled. Log loudly so we notice.
        logEvent({
          step: "push_send_failed",
          profile_id: c.profile_id,
          error: String(e),
        });
      }
    }
  }

  logEvent({
    step: "complete",
    cancelled: cancelledCount,
    errors: errors.length,
  });

  return jsonResponse({
    ok: true,
    cancelled_count: cancelledCount,
    errors,
  });
});
