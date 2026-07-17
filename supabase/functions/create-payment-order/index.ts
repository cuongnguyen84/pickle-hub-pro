// ============================================================================
// create-payment-order — Social Events PR49 (Payment)
// ----------------------------------------------------------------------------
// POST { registration_id, magic_token }
//
// Idempotent: if a payment_order already exists for the registration we
// return the existing row + the club's bank config. The RegistrationModal
// re-uses this endpoint on reload so a returning guest gets their order
// back (their localStorage entry has the registration_id + magic_token).
//
// Core logic lives in handler.ts (Deno-free, vitest-covered — QA-08);
// this file is the transport + supabase-js adapter.
//
// verify_jwt=false; service role used internally.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { jsonResponse } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  processCreatePaymentOrder,
  type BankConfig,
  type OrderRow,
  type PaymentOrderStore,
} from "./handler.ts";

const ORDER_COLUMNS =
  "id, reference_code, amount_vnd, player_claimed_paid, player_claimed_at";

function logEvent(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ function: "create-payment-order", ...payload }));
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

  const store: PaymentOrderStore = {
    async getRegistration(id) {
      const { data, error } = await supabase
        .from("event_registrations")
        .select("id, event_id, status")
        .eq("id", id)
        .maybeSingle();
      return {
        row: data as { event_id: string; status: string } | null,
        error: error?.message ?? null,
      };
    },
    async getMagicToken(registrationId) {
      const { data, error } = await supabase
        .from("registration_secrets")
        .select("magic_token")
        .eq("registration_id", registrationId)
        .maybeSingle();
      return {
        token: (data?.magic_token as string) ?? null,
        error: error?.message ?? null,
      };
    },
    async getEvent(id) {
      const { data } = await supabase
        .from("social_events")
        .select("id, price_vnd, status")
        .eq("id", id)
        .maybeSingle();
      return data as { price_vnd: number | null; status: string } | null;
    },
    async getPaymentConfig(eventId) {
      const { data } = await supabase
        .from("event_payment_config")
        .select("bank_code, bank_account_number, bank_account_name, enabled")
        .eq("event_id", eventId)
        .maybeSingle();
      return data as BankConfig | null;
    },
    async getOrderByRegistration(registrationId) {
      const { data } = await supabase
        .from("payment_orders")
        .select(ORDER_COLUMNS)
        .eq("registration_id", registrationId)
        .maybeSingle();
      return data as OrderRow | null;
    },
    async insertOrder(input) {
      const { data, error } = await supabase
        .from("payment_orders")
        .insert(input)
        .select(ORDER_COLUMNS)
        .single();
      return { row: data as OrderRow | null, error: error?.message ?? null };
    },
  };

  const result = await processCreatePaymentOrder(body, store, undefined, logEvent);
  return jsonResponse(result.body, result.status);
});
