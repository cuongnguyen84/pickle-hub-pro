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
// Flow:
//   1. Verify magic_token matches registration via registration_secrets.
//   2. Look up event → club → club_payment_config. If the club hasn't
//      set up payment OR has it disabled, return `payment_not_enabled`
//      so the frontend can fall back to the "pay at the venue" path.
//   3. If a payment_order exists, return it as-is.
//   4. Otherwise generate a unique reference code + insert. Retry on
//      the unique-violation in the (cosmically unlikely) collision case.
//
// verify_jwt=false; service role used internally.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/auth.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REFERENCE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const REFERENCE_LENGTH = 6;
const REFERENCE_MAX_RETRIES = 5;

interface Body {
  registration_id?: unknown;
  magic_token?: unknown;
}

function err(error: string, status: number, code: string) {
  return jsonResponse({ error, code }, status);
}

function logEvent(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ function: "create-payment-order", ...payload }));
}

function generateReferenceCode(): string {
  const ALPHABET = REFERENCE_ALPHABET;
  const MAX = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  const out: string[] = [];
  const pool = new Uint8Array(REFERENCE_LENGTH * 2);
  crypto.getRandomValues(pool);
  let i = 0;
  while (out.length < REFERENCE_LENGTH) {
    if (i >= pool.length) {
      crypto.getRandomValues(pool);
      i = 0;
    }
    const b = pool[i++];
    if (b < MAX) out.push(ALPHABET[b % ALPHABET.length]);
  }
  return `PHUB-${out.join("")}`;
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

  const registrationId =
    typeof body.registration_id === "string" ? body.registration_id : "";
  const magicToken = typeof body.magic_token === "string" ? body.magic_token : "";
  if (!UUID_RE.test(registrationId)) {
    return err("invalid_registration_id", 400, "invalid_registration_id");
  }
  if (!UUID_RE.test(magicToken)) {
    return err("invalid_magic_token", 400, "invalid_magic_token");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // ─── Verify token + load registration ────────────────────────────────────
  const { data: reg, error: regErr } = await supabase
    .from("event_registrations")
    .select("id, event_id, status")
    .eq("id", registrationId)
    .maybeSingle();
  if (regErr) {
    logEvent({ error: regErr.message, step: "fetch_registration" });
    return err("registration_lookup_failed", 500, "registration_lookup_failed");
  }
  if (!reg) return err("registration_not_found", 404, "registration_not_found");
  if (reg.status === "cancelled") {
    return err("registration_cancelled", 403, "registration_cancelled");
  }

  const { data: secret, error: secretErr } = await supabase
    .from("registration_secrets")
    .select("magic_token")
    .eq("registration_id", registrationId)
    .maybeSingle();
  if (secretErr) {
    logEvent({ error: secretErr.message, step: "fetch_secret" });
    return err("secret_lookup_failed", 500, "secret_lookup_failed");
  }
  if (!secret || (secret.magic_token as string) !== magicToken) {
    return err("magic_token_mismatch", 401, "magic_token_mismatch");
  }

  // ─── Load event + club_payment_config ────────────────────────────────────
  const { data: event } = await supabase
    .from("social_events")
    .select("id, club_id, price_vnd, status")
    .eq("id", reg.event_id)
    .maybeSingle();
  if (!event) return err("event_not_found", 404, "event_not_found");
  if (event.status === "cancelled") {
    return err("event_cancelled", 410, "event_cancelled");
  }
  if (event.club_id == null) {
    return err("payment_not_enabled", 200, "payment_not_enabled");
  }

  const { data: cfg } = await supabase
    .from("club_payment_config")
    .select("bank_code, bank_account_number, bank_account_name, enabled")
    .eq("club_id", event.club_id)
    .maybeSingle();
  if (!cfg || cfg.enabled !== true) {
    return err("payment_not_enabled", 200, "payment_not_enabled");
  }

  // ─── Idempotent path: existing order ─────────────────────────────────────
  const { data: existing } = await supabase
    .from("payment_orders")
    .select("id, reference_code, amount_vnd, player_claimed_paid, player_claimed_at")
    .eq("registration_id", registrationId)
    .maybeSingle();
  if (existing) {
    return jsonResponse({
      ok: true,
      order_id: existing.id,
      reference_code: existing.reference_code,
      amount_vnd: existing.amount_vnd,
      player_claimed_paid: existing.player_claimed_paid,
      player_claimed_at: existing.player_claimed_at,
      bank: {
        code: cfg.bank_code,
        account_number: cfg.bank_account_number,
        account_name: cfg.bank_account_name,
      },
    });
  }

  // ─── Fresh order — retry the insert if the reference code collides ──────
  const amountVnd = (event.price_vnd as number) ?? 0;
  for (let attempt = 0; attempt < REFERENCE_MAX_RETRIES; attempt++) {
    const referenceCode = generateReferenceCode();
    const { data: inserted, error: insErr } = await supabase
      .from("payment_orders")
      .insert({
        registration_id: registrationId,
        amount_vnd: amountVnd,
        reference_code: referenceCode,
      })
      .select("id, reference_code, amount_vnd, player_claimed_paid, player_claimed_at")
      .single();
    if (!insErr && inserted) {
      logEvent({
        step: "created",
        order_id: inserted.id,
        registration_id: registrationId,
        amount_vnd: amountVnd,
      });
      return jsonResponse({
        ok: true,
        order_id: inserted.id,
        reference_code: inserted.reference_code,
        amount_vnd: inserted.amount_vnd,
        player_claimed_paid: inserted.player_claimed_paid,
        player_claimed_at: inserted.player_claimed_at,
        bank: {
          code: cfg.bank_code,
          account_number: cfg.bank_account_number,
          account_name: cfg.bank_account_name,
        },
      });
    }
    const msg = (insErr?.message ?? "").toLowerCase();
    if (msg.includes("reference_code")) {
      // Reference-code collision — try again with a fresh code.
      continue;
    }
    if (msg.includes("registration_id")) {
      // Race: another request just created the order for the same
      // registration. Re-read it and return.
      const { data: raced } = await supabase
        .from("payment_orders")
        .select(
          "id, reference_code, amount_vnd, player_claimed_paid, player_claimed_at",
        )
        .eq("registration_id", registrationId)
        .maybeSingle();
      if (raced) {
        return jsonResponse({
          ok: true,
          order_id: raced.id,
          reference_code: raced.reference_code,
          amount_vnd: raced.amount_vnd,
          player_claimed_paid: raced.player_claimed_paid,
          player_claimed_at: raced.player_claimed_at,
          bank: {
            code: cfg.bank_code,
            account_number: cfg.bank_account_number,
            account_name: cfg.bank_account_name,
          },
        });
      }
    }
    logEvent({
      error: insErr?.message ?? "no_row",
      step: "insert_order",
      registration_id: registrationId,
    });
    return err("order_insert_failed", 500, "order_insert_failed");
  }
  return err("reference_code_exhausted", 500, "reference_code_exhausted");
});
