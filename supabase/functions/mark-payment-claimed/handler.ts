// ============================================================================
// mark-payment-claimed core — Deno-free so it can be unit-tested under vitest
// (QA-08, same pattern as dupr-webhook/handler.ts).
//
// The invariant the tests pin: the organizer push fires EXACTLY ONCE, on the
// caller whose guarded UPDATE actually flipped player_claimed_paid
// false → true. Idempotent re-calls short-circuit before the update; a
// concurrent-claim loser (guarded UPDATE matched zero rows) re-reads and
// returns WITHOUT firing a second push. A push failure never breaks the
// claim response.
// ============================================================================

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ClaimOrderRow {
  id: string;
  registration_id: string;
  amount_vnd: number | null;
  reference_code: string | null;
  player_claimed_paid: boolean;
  player_claimed_at: string | null;
}

export interface RegistrationContext {
  display_name: string | null;
  event: {
    title_vi: string | null;
    slug: string;
    created_by: string;
    club_slug: string | null;
  } | null;
}

export interface OrganizerPush {
  organizerId: string;
  title: string;
  body: string;
  data: Record<string, string>;
}

/** Narrow persistence surface — real impl wraps supabase-js, tests fake it. */
export interface ClaimStore {
  getOrder(
    id: string,
  ): Promise<{ row: ClaimOrderRow | null; error: string | null }>;
  getMagicToken(registrationId: string): Promise<string | null>;
  /** Guarded UPDATE ... WHERE player_claimed_paid = false. null row = lost the race. */
  claimOrder(
    orderId: string,
    claimedAt: string,
  ): Promise<{
    row: { id: string; player_claimed_paid: boolean; player_claimed_at: string } | null;
    error: string | null;
  }>;
  getClaimState(
    orderId: string,
  ): Promise<{ player_claimed_paid: boolean; player_claimed_at: string | null } | null>;
  getRegistrationContext(registrationId: string): Promise<RegistrationContext | null>;
  notifyOrganizer(push: OrganizerPush): Promise<{ error: string | null }>;
}

export interface HandlerResult {
  status: number;
  body: Record<string, unknown>;
}

function err(error: string, status: number, code: string): HandlerResult {
  return { status, body: { error, code } };
}

export async function processMarkPaymentClaimed(
  body: { order_id?: unknown; magic_token?: unknown },
  store: ClaimStore,
  nowIso: () => string = () => new Date().toISOString(),
  log: (payload: Record<string, unknown>) => void = () => {},
): Promise<HandlerResult> {
  const orderId = typeof body.order_id === "string" ? body.order_id : "";
  const magicToken = typeof body.magic_token === "string" ? body.magic_token : "";
  if (!UUID_RE.test(orderId)) {
    return err("invalid_order_id", 400, "invalid_order_id");
  }
  if (!UUID_RE.test(magicToken)) {
    return err("invalid_magic_token", 400, "invalid_magic_token");
  }

  const { row: order, error: orderErr } = await store.getOrder(orderId);
  if (orderErr) {
    log({ error: orderErr, step: "fetch_order" });
    return err("order_lookup_failed", 500, "order_lookup_failed");
  }
  if (!order) return err("order_not_found", 404, "order_not_found");

  const secret = await store.getMagicToken(order.registration_id);
  if (!secret || secret !== magicToken) {
    return err("magic_token_mismatch", 401, "magic_token_mismatch");
  }

  // Idempotent short-circuit — already claimed, just echo back the state.
  if (order.player_claimed_paid) {
    return {
      status: 200,
      body: {
        ok: true,
        order_id: order.id,
        player_claimed_paid: true,
        player_claimed_at: order.player_claimed_at,
      },
    };
  }

  const claimedAt = nowIso();
  const { row: updated, error: updErr } = await store.claimOrder(orderId, claimedAt);
  if (updErr) {
    log({ error: updErr, step: "update_order" });
    return err("update_failed", 500, "update_failed");
  }

  if (!updated) {
    // Race with another claim — the winner already fired the organizer
    // push. Re-read the row and return without a second push.
    const post = await store.getClaimState(orderId);
    return {
      status: 200,
      body: {
        ok: true,
        order_id: orderId,
        player_claimed_paid: post?.player_claimed_paid ?? true,
        player_claimed_at: post?.player_claimed_at ?? claimedAt,
      },
    };
  }

  log({ step: "claimed", order_id: orderId, registration_id: order.registration_id });

  // Best-effort organizer push — genuine first-claim transition only.
  try {
    const ctx = await store.getRegistrationContext(order.registration_id);
    const event = ctx?.event;
    if (event?.created_by) {
      const amount = order.amount_vnd ?? 0;
      const amountFormatted = new Intl.NumberFormat("vi-VN").format(amount);
      const refCode = order.reference_code ?? "";
      const pushBody = `${ctx?.display_name ?? ""} • ${amountFormatted}đ • ${refCode} • ${event.title_vi ?? ""}`;

      const push = await store.notifyOrganizer({
        organizerId: event.created_by,
        title: "Player đã chuyển tiền",
        body: pushBody,
        data: {
          type: "payment_claimed",
          registration_id: order.registration_id,
          event_slug: event.slug,
          club_slug: event.club_slug ?? "",
          reference_code: refCode,
        },
      });
      log(
        push.error
          ? { step: "push_notify_failed", order_id: orderId, error: push.error }
          : { step: "push_notify_ok", order_id: orderId },
      );
    } else {
      log({ step: "push_notify_skipped_no_organizer", order_id: orderId });
    }
  } catch (e) {
    // Push failure must never break the claim flow.
    log({
      step: "push_notify_exception",
      order_id: orderId,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  return {
    status: 200,
    body: {
      ok: true,
      order_id: updated.id,
      player_claimed_paid: updated.player_claimed_paid,
      player_claimed_at: updated.player_claimed_at,
    },
  };
}
