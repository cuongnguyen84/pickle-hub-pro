// ============================================================================
// create-payment-order core — Deno-free so it can be unit-tested under vitest
// (QA-08, same pattern as dupr-webhook/handler.ts). All persistence goes
// through an injected PaymentOrderStore; the reference-code generator is
// injectable so collision retries are testable deterministically.
// ============================================================================

export const REFERENCE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const REFERENCE_LENGTH = 6;
export const REFERENCE_MAX_RETRIES = 5;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function generateReferenceCode(): string {
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

export interface OrderRow {
  id: string;
  reference_code: string;
  amount_vnd: number;
  player_claimed_paid: boolean;
  player_claimed_at: string | null;
}

export interface BankConfig {
  bank_code: string;
  bank_account_number: string;
  bank_account_name: string;
  enabled: boolean;
}

/** Narrow persistence surface — real impl wraps supabase-js, tests fake it. */
export interface PaymentOrderStore {
  getRegistration(
    id: string,
  ): Promise<{ row: { event_id: string; status: string } | null; error: string | null }>;
  getMagicToken(
    registrationId: string,
  ): Promise<{ token: string | null; error: string | null }>;
  getEvent(
    id: string,
  ): Promise<{ price_vnd: number | null; status: string } | null>;
  getPaymentConfig(eventId: string): Promise<BankConfig | null>;
  getOrderByRegistration(registrationId: string): Promise<OrderRow | null>;
  /** error is the raw DB message; unique violations are matched by substring. */
  insertOrder(input: {
    registration_id: string;
    amount_vnd: number;
    reference_code: string;
  }): Promise<{ row: OrderRow | null; error: string | null }>;
}

export interface HandlerResult {
  status: number;
  body: Record<string, unknown>;
}

function err(error: string, status: number, code: string): HandlerResult {
  return { status, body: { error, code } };
}

function orderResponse(order: OrderRow, cfg: BankConfig): HandlerResult {
  return {
    status: 200,
    body: {
      ok: true,
      order_id: order.id,
      reference_code: order.reference_code,
      amount_vnd: order.amount_vnd,
      player_claimed_paid: order.player_claimed_paid,
      player_claimed_at: order.player_claimed_at,
      bank: {
        code: cfg.bank_code,
        account_number: cfg.bank_account_number,
        account_name: cfg.bank_account_name,
      },
    },
  };
}

export async function processCreatePaymentOrder(
  body: { registration_id?: unknown; magic_token?: unknown },
  store: PaymentOrderStore,
  genCode: () => string = generateReferenceCode,
  log: (payload: Record<string, unknown>) => void = () => {},
): Promise<HandlerResult> {
  const registrationId =
    typeof body.registration_id === "string" ? body.registration_id : "";
  const magicToken = typeof body.magic_token === "string" ? body.magic_token : "";
  if (!UUID_RE.test(registrationId)) {
    return err("invalid_registration_id", 400, "invalid_registration_id");
  }
  if (!UUID_RE.test(magicToken)) {
    return err("invalid_magic_token", 400, "invalid_magic_token");
  }

  // ─── Verify token + load registration ────────────────────────────────────
  const reg = await store.getRegistration(registrationId);
  if (reg.error) {
    log({ error: reg.error, step: "fetch_registration" });
    return err("registration_lookup_failed", 500, "registration_lookup_failed");
  }
  if (!reg.row) return err("registration_not_found", 404, "registration_not_found");
  if (reg.row.status === "cancelled") {
    return err("registration_cancelled", 403, "registration_cancelled");
  }

  const secret = await store.getMagicToken(registrationId);
  if (secret.error) {
    log({ error: secret.error, step: "fetch_secret" });
    return err("secret_lookup_failed", 500, "secret_lookup_failed");
  }
  if (!secret.token || secret.token !== magicToken) {
    return err("magic_token_mismatch", 401, "magic_token_mismatch");
  }

  // ─── Load event + event_payment_config ───────────────────────────────────
  const event = await store.getEvent(reg.row.event_id);
  if (!event) return err("event_not_found", 404, "event_not_found");
  if (event.status === "cancelled") {
    return err("event_cancelled", 410, "event_cancelled");
  }

  const cfg = await store.getPaymentConfig(reg.row.event_id);
  if (!cfg || cfg.enabled !== true) {
    // 200 by design: the frontend falls back to "pay at the venue".
    return err("payment_not_enabled", 200, "payment_not_enabled");
  }

  // ─── Idempotent path: existing order ─────────────────────────────────────
  const existing = await store.getOrderByRegistration(registrationId);
  if (existing) return orderResponse(existing, cfg);

  // ─── Fresh order — retry the insert if the reference code collides ──────
  const amountVnd = event.price_vnd ?? 0;
  for (let attempt = 0; attempt < REFERENCE_MAX_RETRIES; attempt++) {
    const referenceCode = genCode();
    const { row: inserted, error: insErr } = await store.insertOrder({
      registration_id: registrationId,
      amount_vnd: amountVnd,
      reference_code: referenceCode,
    });
    if (!insErr && inserted) {
      log({
        step: "created",
        order_id: inserted.id,
        registration_id: registrationId,
        amount_vnd: amountVnd,
      });
      return orderResponse(inserted, cfg);
    }
    const msg = (insErr ?? "").toLowerCase();
    if (msg.includes("reference_code")) {
      // Reference-code collision — try again with a fresh code.
      continue;
    }
    if (msg.includes("registration_id")) {
      // Race: another request just created the order for the same
      // registration. Re-read it and return.
      const raced = await store.getOrderByRegistration(registrationId);
      if (raced) return orderResponse(raced, cfg);
    }
    log({ error: insErr ?? "no_row", step: "insert_order", registration_id: registrationId });
    return err("order_insert_failed", 500, "order_insert_failed");
  }
  return err("reference_code_exhausted", 500, "reference_code_exhausted");
}
