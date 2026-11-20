import { describe, expect, it, vi } from "vitest";
import { processMarkPaymentClaimed, type ClaimStore } from "../../mark-payment-claimed/handler";

const orderId = "11111111-1111-1111-1111-111111111111";
const registrationId = "22222222-2222-2222-2222-222222222222";
const token = "33333333-3333-3333-3333-333333333333";
const committedAt = "2026-11-20T00:00:00.000Z";

function storeWithState(state: Awaited<ReturnType<ClaimStore["getClaimState"]>>) {
  return {
    getOrder: vi.fn().mockResolvedValue({ row: {
      id: orderId, registration_id: registrationId, amount_vnd: 50000,
      reference_code: "PHUB-TEST", player_claimed_paid: false, player_claimed_at: null,
    }, error: null }),
    getMagicToken: vi.fn().mockResolvedValue(token),
    claimOrder: vi.fn().mockResolvedValue({ row: null, error: null }),
    getClaimState: vi.fn().mockResolvedValue(state),
    getRegistrationContext: vi.fn(),
    notifyOrganizer: vi.fn(),
  } satisfies ClaimStore;
}

describe("payment claim zero-row update reconciliation", () => {
  it.each([
    null,
    { player_claimed_paid: false, player_claimed_at: null },
    { player_claimed_paid: true, player_claimed_at: null },
  ])("never invents success when committed state cannot be confirmed: %j", async state => {
    const store = storeWithState(state);
    const result = await processMarkPaymentClaimed({ order_id: orderId, magic_token: token }, store);
    expect(result).toEqual({
      status: 503, body: { error: "claim_state_unconfirmed", code: "claim_state_unconfirmed" },
    });
    expect(store.notifyOrganizer).not.toHaveBeenCalled();
    expect(store.getRegistrationContext).not.toHaveBeenCalled();
  });

  it("returns the winner's committed state and never repeats its push", async () => {
    const store = storeWithState({ player_claimed_paid: true, player_claimed_at: committedAt });
    const result = await processMarkPaymentClaimed({ order_id: orderId, magic_token: token }, store);
    expect(result.status).toBe(200);
    expect(result.body.player_claimed_at).toBe(committedAt);
    expect(store.notifyOrganizer).not.toHaveBeenCalled();
  });
});
