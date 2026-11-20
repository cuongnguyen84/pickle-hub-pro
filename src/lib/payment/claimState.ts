/** A player-reported transfer claim, not confirmation that money was received. */
export interface PersistedPaymentClaim {
  ok: true;
  order_id: string;
  player_claimed_paid: true;
  player_claimed_at: string;
}

/** Reject transport errors, partial acknowledgements and another order's state. */
export function confirmedPaymentClaim(
  response: { data?: unknown; error?: unknown },
  expectedOrderId: string,
): PersistedPaymentClaim | null {
  if (response.error || !response.data || typeof response.data !== "object") return null;
  const value = response.data as Record<string, unknown>;
  if (
    value.ok !== true ||
    value.order_id !== expectedOrderId ||
    value.player_claimed_paid !== true ||
    typeof value.player_claimed_at !== "string" ||
    !value.player_claimed_at.trim() ||
    !Number.isFinite(Date.parse(value.player_claimed_at))
  ) return null;
  return {
    ok: true,
    order_id: expectedOrderId,
    player_claimed_paid: true,
    player_claimed_at: value.player_claimed_at,
  };
}
