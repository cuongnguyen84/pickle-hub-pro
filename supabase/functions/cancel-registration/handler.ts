// ============================================================================
// cancel-registration core — Deno-free so it can be unit-tested under vitest
// (ARCH-02 increment 1, same pattern as create-payment-order/handler.ts).
// All persistence goes through an injected CancelStore; the clock is
// injectable so the event-started guard is testable deterministically.
// ============================================================================

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MAX_REASON_LEN = 280;

export interface RegistrationRow {
  id: string;
  event_id: string;
  status: string;
  cancelled_at: string | null;
}

export interface CancelEventRow {
  id: string;
  slug: string;
  status: string;
  start_at: string;
}

/** Narrow persistence surface — real impl wraps supabase-js, tests fake it. */
export interface CancelStore {
  getRegistrationIdByToken(
    magicToken: string,
  ): Promise<{ id: string | null; error: string | null }>;
  getRegistration(
    id: string,
  ): Promise<{ row: RegistrationRow | null; error: string | null }>;
  getEvent(
    id: string,
  ): Promise<{ row: CancelEventRow | null; error: string | null }>;
  /** UPDATE ... SET status='cancelled' ... WHERE id=? AND cancelled_at IS NULL */
  cancelRegistration(input: {
    registration_id: string;
    cancelled_at: string;
    reason: string | null;
  }): Promise<{ error: string | null }>;
}

export interface HandlerResult {
  status: number;
  body: Record<string, unknown>;
}

function err(error: string, status: number, code: string): HandlerResult {
  return { status, body: { error, code } };
}

export interface CancelLog {
  (payload: Record<string, unknown>): void;
}

export async function processCancelRegistration(
  body: unknown,
  store: CancelStore,
  log: CancelLog,
  now: () => number = Date.now,
): Promise<HandlerResult> {
  const b = (body ?? {}) as { magic_token?: unknown; reason?: unknown };

  const magicToken = typeof b.magic_token === "string" ? b.magic_token.trim() : "";
  if (!UUID_RE.test(magicToken)) {
    return err("invalid_magic_token", 400, "invalid_magic_token");
  }

  const rawReason = typeof b.reason === "string" ? b.reason.trim() : "";
  const reason = rawReason.length > 0 ? rawReason.slice(0, MAX_REASON_LEN) : null;

  // ─── 1. Resolve magic_token → registration_id ────────────────────────────
  const secret = await store.getRegistrationIdByToken(magicToken);
  if (secret.error) {
    log({ step: "lookup_secret", error: secret.error });
    return err("lookup_failed", 500, "lookup_failed");
  }
  if (!secret.id) return err("not_found", 404, "not_found");
  const registrationId = secret.id;

  // ─── 2. Fetch registration + parent event ────────────────────────────────
  const reg = await store.getRegistration(registrationId);
  if (reg.error) {
    log({ step: "lookup_registration", error: reg.error });
    return err("lookup_failed", 500, "lookup_failed");
  }
  if (!reg.row) return err("registration_missing", 404, "registration_missing");
  if (reg.row.cancelled_at) return err("already_cancelled", 409, "already_cancelled");

  const event = await store.getEvent(reg.row.event_id);
  if (event.error) {
    log({ step: "lookup_event", error: event.error });
    return err("lookup_failed", 500, "lookup_failed");
  }
  if (!event.row) return err("event_missing", 404, "event_missing");

  if (event.row.status === "cancelled") {
    // Whole event cancelled — registrations are already moot. Treat as
    // success to make the player flow idempotent.
    return { status: 200, body: { ok: true, already_cancelled: true } };
  }
  if (event.row.status === "completed") {
    return err("event_completed", 409, "event_completed");
  }

  const startAt = new Date(event.row.start_at).getTime();
  if (!Number.isFinite(startAt) || startAt <= now()) {
    return err("event_started", 409, "event_started");
  }

  // ─── 3. Flip status + record metadata ────────────────────────────────────
  const cancelledAt = new Date(now()).toISOString();
  const upd = await store.cancelRegistration({
    registration_id: registrationId,
    cancelled_at: cancelledAt,
    reason,
  });
  if (upd.error) {
    log({ step: "update_registration", error: upd.error, registration_id: registrationId });
    return err("update_failed", 500, "update_failed");
  }

  log({
    step: "cancelled",
    registration_id: registrationId,
    event_id: event.row.id,
    reason_set: reason !== null,
  });

  return { status: 200, body: { ok: true, cancelled_at: cancelledAt } };
}
