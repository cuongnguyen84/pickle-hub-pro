import { describe, expect, it } from "vitest";
import { confirmedPaymentClaim } from "../claimState";

const orderId = "order-one";
const winner = { ok: true, order_id: orderId, player_claimed_paid: true, player_claimed_at: "2026-11-20T00:00:00Z" };
describe("persisted payment claim response", () => {
  it.each([
    null, {}, { ok: true }, { ...winner, order_id: "another-order" },
    { ...winner, player_claimed_paid: false }, { ...winner, player_claimed_at: null },
    { ...winner, player_claimed_at: "" }, { ...winner, player_claimed_at: "invalid" },
  ])("rejects malformed or unconfirmed success %j", data => {
    expect(confirmedPaymentClaim({ data, error: null }, orderId)).toBeNull();
  });
  it("rejects a 503 transport result even if stale data claims success", () => {
    expect(confirmedPaymentClaim({ data: winner, error: new Error("503 claim_state_unconfirmed") }, orderId)).toBeNull();
  });
  it("preserves the winner's committed timestamp without inventing payment receipt", () => {
    expect(confirmedPaymentClaim({ data: winner, error: null }, orderId)).toEqual(winner);
    expect(confirmedPaymentClaim({ data: winner }, orderId)).not.toHaveProperty("payment_status");
  });
});
