// ============================================================================
// mark-payment-claimed — Social Events PR49 (Payment)
// ----------------------------------------------------------------------------
// POST { order_id, magic_token }
//
// The player presses "Tôi đã chuyển tiền" after they hit Send in their
// banking app. We don't auto-reconcile (no bank API); the organizer
// matches the transfer by reference code at the venue. This flag is just
// the player's self-claim so the roster page can highlight who said
// they paid.
//
// Idempotent: a second call against an already-claimed order returns OK
// without re-updating the timestamp.
//
// verify_jwt=false; service role used internally.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/auth.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Body {
  order_id?: unknown;
  magic_token?: unknown;
}

function err(error: string, status: number, code: string) {
  return jsonResponse({ error, code }, status);
}

function logEvent(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ function: "mark-payment-claimed", ...payload }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return err("method_not_allowed", 405, "method_not_allowed");
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return err("invalid_json", 400, "invalid_json");
  }

  const orderId = typeof body.order_id === "string" ? body.order_id : "";
  const magicToken = typeof body.magic_token === "string" ? body.magic_token : "";
  if (!UUID_RE.test(orderId)) {
    return err("invalid_order_id", 400, "invalid_order_id");
  }
  if (!UUID_RE.test(magicToken)) {
    return err("invalid_magic_token", 400, "invalid_magic_token");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Load the order + its registration so we can verify the token.
  const { data: order, error: orderErr } = await supabase
    .from("payment_orders")
    .select("id, registration_id, player_claimed_paid, player_claimed_at")
    .eq("id", orderId)
    .maybeSingle();
  if (orderErr) {
    logEvent({ error: orderErr.message, step: "fetch_order" });
    return err("order_lookup_failed", 500, "order_lookup_failed");
  }
  if (!order) return err("order_not_found", 404, "order_not_found");

  const { data: secret } = await supabase
    .from("registration_secrets")
    .select("magic_token")
    .eq("registration_id", order.registration_id)
    .maybeSingle();
  if (!secret || (secret.magic_token as string) !== magicToken) {
    return err("magic_token_mismatch", 401, "magic_token_mismatch");
  }

  // Idempotent short-circuit — already claimed, just echo back the state.
  if (order.player_claimed_paid) {
    return jsonResponse({
      ok: true,
      order_id: order.id,
      player_claimed_paid: true,
      player_claimed_at: order.player_claimed_at,
    });
  }

  const claimedAt = new Date().toISOString();
  const { data: updated, error: updErr } = await supabase
    .from("payment_orders")
    .update({
      player_claimed_paid: true,
      player_claimed_at: claimedAt,
    })
    .eq("id", orderId)
    .eq("player_claimed_paid", false)
    .select("id, player_claimed_paid, player_claimed_at")
    .maybeSingle();

  if (updErr) {
    logEvent({ error: updErr.message, step: "update_order" });
    return err("update_failed", 500, "update_failed");
  }

  if (!updated) {
    // Race with another claim — re-read the row and return.
    const { data: post } = await supabase
      .from("payment_orders")
      .select("id, player_claimed_paid, player_claimed_at")
      .eq("id", orderId)
      .maybeSingle();
    return jsonResponse({
      ok: true,
      order_id: orderId,
      player_claimed_paid: post?.player_claimed_paid ?? true,
      player_claimed_at: post?.player_claimed_at ?? claimedAt,
    });
  }

  logEvent({
    step: "claimed",
    order_id: orderId,
    registration_id: order.registration_id,
  });
  return jsonResponse({
    ok: true,
    order_id: updated.id,
    player_claimed_paid: updated.player_claimed_paid,
    player_claimed_at: updated.player_claimed_at,
  });
});
