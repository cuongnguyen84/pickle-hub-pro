// ============================================================================
// mark-payment-claimed — Social Events PR49 (Payment)
// ----------------------------------------------------------------------------
// POST { order_id, magic_token }
//
// The player presses "Tôi đã chuyển tiền" after they hit Send in their
// banking app. We don't auto-reconcile (no bank API); the organizer
// matches the transfer by reference code at the venue.
//
// Core logic lives in handler.ts (Deno-free, vitest-covered — QA-08);
// this file is the transport + supabase-js adapter. The organizer push
// fires exactly once, on the winning false→true claim transition.
//
// verify_jwt=false; service role used internally.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { jsonResponse } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  processMarkPaymentClaimed,
  type ClaimOrderRow,
  type ClaimStore,
  type RegistrationContext,
} from "./handler.ts";

function logEvent(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ function: "mark-payment-claimed", ...payload }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed", code: "method_not_allowed" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "invalid_json", code: "invalid_json" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const store: ClaimStore = {
    async getOrder(id) {
      const { data, error } = await supabase
        .from("payment_orders")
        .select(
          "id, registration_id, amount_vnd, reference_code, player_claimed_paid, player_claimed_at",
        )
        .eq("id", id)
        .maybeSingle();
      return { row: data as ClaimOrderRow | null, error: error?.message ?? null };
    },
    async getMagicToken(registrationId) {
      const { data } = await supabase
        .from("registration_secrets")
        .select("magic_token")
        .eq("registration_id", registrationId)
        .maybeSingle();
      return (data?.magic_token as string) ?? null;
    },
    async claimOrder(orderId, claimedAt) {
      const { data, error } = await supabase
        .from("payment_orders")
        .update({ player_claimed_paid: true, player_claimed_at: claimedAt })
        .eq("id", orderId)
        .eq("player_claimed_paid", false)
        .select("id, player_claimed_paid, player_claimed_at")
        .maybeSingle();
      return {
        row: data as
          | { id: string; player_claimed_paid: boolean; player_claimed_at: string }
          | null,
        error: error?.message ?? null,
      };
    },
    async getClaimState(orderId) {
      const { data } = await supabase
        .from("payment_orders")
        .select("id, player_claimed_paid, player_claimed_at")
        .eq("id", orderId)
        .maybeSingle();
      return data as
        | { player_claimed_paid: boolean; player_claimed_at: string | null }
        | null;
    },
    async getRegistrationContext(registrationId) {
      type RegRow = {
        display_name: string;
        social_events: {
          title_vi: string;
          slug: string;
          created_by: string;
          clubs: { slug: string } | null;
        } | null;
      };
      const { data: ctx } = await supabase
        .from("event_registrations")
        .select(
          `display_name,
           social_events!event_registrations_event_id_fkey(
             title_vi, slug, created_by,
             clubs!social_events_club_id_fkey ( slug )
           )`,
        )
        .eq("id", registrationId)
        .maybeSingle<RegRow>();
      if (!ctx) return null;
      const event = ctx.social_events;
      const context: RegistrationContext = {
        display_name: ctx.display_name ?? null,
        event: event
          ? {
              title_vi: event.title_vi ?? null,
              slug: event.slug,
              created_by: event.created_by,
              club_slug: event.clubs?.slug ?? null,
            }
          : null,
      };
      return context;
    },
    async notifyOrganizer(push) {
      const invokeRes = await supabase.functions.invoke("send-push-notification", {
        body: {
          user_ids: [push.organizerId],
          title: push.title,
          body: push.body,
          data: push.data,
        },
      });
      return { error: invokeRes.error ? String(invokeRes.error) : null };
    },
  };

  const result = await processMarkPaymentClaimed(body, store, undefined, logEvent);
  return jsonResponse(result.body, result.status);
});
