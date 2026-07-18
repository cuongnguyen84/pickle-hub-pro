// ============================================================================
// reactivate-registration core — Deno-free so it can be unit-tested under
// vitest (ARCH-02 increment 1, same pattern as create-payment-order/handler.ts).
// The capacity check + flip stays inside the DB-01 advisory-locked RPC; this
// handler owns the guard rails around it and the outcome → HTTP mapping.
// ============================================================================

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RegistrationRow {
  id: string;
  event_id: string;
  status: string;
  cancelled_at: string | null;
}

export interface ReactivateEventRow {
  id: string;
  status: string;
  start_at: string;
  max_players: number | null;
}

/** Narrow persistence surface — real impl wraps supabase-js, tests fake it. */
export interface ReactivateStore {
  getRegistrationIdByToken(
    magicToken: string,
  ): Promise<{ id: string | null; error: string | null }>;
  getRegistration(
    id: string,
  ): Promise<{ row: RegistrationRow | null; error: string | null }>;
  getEvent(
    id: string,
  ): Promise<{ row: ReactivateEventRow | null; error: string | null }>;
  /** social_event_reactivate_registration RPC (DB-01 advisory lock). */
  reactivateRpc(
    registrationId: string,
  ): Promise<{ outcome: string | null; error: string | null }>;
}

export interface HandlerResult {
  status: number;
  body: Record<string, unknown>;
}

function err(error: string, status: number, code: string): HandlerResult {
  return { status, body: { error, code } };
}

export interface ReactivateLog {
  (payload: Record<string, unknown>): void;
}

export async function processReactivateRegistration(
  body: unknown,
  store: ReactivateStore,
  log: ReactivateLog,
  now: () => number = Date.now,
): Promise<HandlerResult> {
  const b = (body ?? {}) as { magic_token?: unknown };

  const magicToken = typeof b.magic_token === "string" ? b.magic_token.trim() : "";
  if (!UUID_RE.test(magicToken)) {
    return err("invalid_magic_token", 400, "invalid_magic_token");
  }

  // ─── 1. Resolve magic_token → registration_id ────────────────────────────
  const secret = await store.getRegistrationIdByToken(magicToken);
  if (secret.error) {
    log({ step: "lookup_secret", error: secret.error });
    return err("lookup_failed", 500, "lookup_failed");
  }
  if (!secret.id) return err("not_found", 404, "not_found");
  const registrationId = secret.id;

  // ─── 2. Fetch registration ───────────────────────────────────────────────
  const reg = await store.getRegistration(registrationId);
  if (reg.error) {
    log({ step: "lookup_registration", error: reg.error });
    return err("lookup_failed", 500, "lookup_failed");
  }
  if (!reg.row) return err("registration_missing", 404, "registration_missing");
  if (!reg.row.cancelled_at) {
    // Already active — idempotent success.
    return { status: 200, body: { ok: true, already_active: true } };
  }

  // ─── 3. Event guard rails ────────────────────────────────────────────────
  const event = await store.getEvent(reg.row.event_id);
  if (event.error) {
    log({ step: "lookup_event", error: event.error });
    return err("lookup_failed", 500, "lookup_failed");
  }
  if (!event.row) return err("event_missing", 404, "event_missing");

  if (event.row.status === "cancelled") return err("event_cancelled", 409, "event_cancelled");
  if (event.row.status === "completed") return err("event_completed", 409, "event_completed");
  if (event.row.status !== "published") return err("event_not_open", 409, "event_not_open");

  const startAt = new Date(event.row.start_at).getTime();
  if (!Number.isFinite(startAt) || startAt <= now()) {
    return err("event_started", 409, "event_started");
  }

  // ─── 4+5. Atomic capacity check + reactivate (DB-01) ─────────────────────
  const rpc = await store.reactivateRpc(registrationId);
  if (rpc.error) {
    log({ step: "reactivate_rpc", error: rpc.error, registration_id: registrationId });
    return err("update_failed", 500, "update_failed");
  }

  switch (rpc.outcome) {
    case "reactivated":
      log({ step: "reactivated", registration_id: registrationId, event_id: event.row.id });
      return { status: 200, body: { ok: true } };
    case "already_active":
      return { status: 200, body: { ok: true, already_active: true } };
    case "event_full":
      return err("event_full", 409, "event_full");
    case "not_found":
      return err("registration_missing", 404, "registration_missing");
    default:
      log({ step: "reactivate_rpc", error: `unexpected outcome ${rpc.outcome}` });
      return err("update_failed", 500, "update_failed");
  }
}
