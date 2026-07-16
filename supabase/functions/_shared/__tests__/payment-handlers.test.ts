// QA-08: money-path handlers. The invariants that matter:
// - create-payment-order is idempotent per registration and survives both
//   unique-violation races (reference_code collision retries; concurrent
//   same-registration insert re-reads the winner's row)
// - mark-payment-claimed fires the organizer push EXACTLY ONCE, on the
//   winning false→true transition; losers and re-calls never re-push

import { describe, it, expect } from "vitest";
import {
  processCreatePaymentOrder,
  generateReferenceCode,
  REFERENCE_MAX_RETRIES,
  type BankConfig,
  type OrderRow,
  type PaymentOrderStore,
} from "../../create-payment-order/handler.ts";
import {
  processMarkPaymentClaimed,
  type ClaimOrderRow,
  type ClaimStore,
  type OrganizerPush,
} from "../../mark-payment-claimed/handler.ts";

const REG = "11111111-1111-1111-1111-111111111111";
const TOKEN = "22222222-2222-2222-2222-222222222222";
const ORDER = "33333333-3333-3333-3333-333333333333";

const BANK: BankConfig = {
  bank_code: "VCB",
  bank_account_number: "007",
  bank_account_name: "PICKLE",
  enabled: true,
};

// In-memory store enforcing the same unique constraints as payment_orders
// (UNIQUE registration_id, UNIQUE reference_code).
class FakeOrderStore implements PaymentOrderStore {
  orders: OrderRow[] = [];
  registration: { event_id: string; status: string } | null = {
    event_id: "evt-1",
    status: "registered",
  };
  regError: string | null = null;
  token: string | null = TOKEN;
  tokenError: string | null = null;
  event: { price_vnd: number | null; status: string } | null = {
    price_vnd: 150000,
    status: "published",
  };
  config: BankConfig | null = BANK;
  private seq = 0;
  /** When set, the next N inserts fail with this raw message. */
  failNextInserts: { count: number; message: string } | null = null;

  getRegistration() {
    return Promise.resolve({ row: this.registration, error: this.regError });
  }
  getMagicToken() {
    return Promise.resolve({ token: this.token, error: this.tokenError });
  }
  getEvent() {
    return Promise.resolve(this.event);
  }
  getPaymentConfig() {
    return Promise.resolve(this.config);
  }
  getOrderByRegistration(registrationId: string) {
    return Promise.resolve(
      this.orders.find((o) => o.id.startsWith(registrationId.slice(0, 8))) ??
        this.orders[0] ??
        null,
    );
  }
  insertOrder(input: { registration_id: string; amount_vnd: number; reference_code: string }) {
    if (this.failNextInserts && this.failNextInserts.count > 0) {
      this.failNextInserts.count--;
      return Promise.resolve({ row: null, error: this.failNextInserts.message });
    }
    if (this.orders.length > 0) {
      return Promise.resolve({
        row: null,
        error: 'duplicate key value violates unique constraint "payment_orders_registration_id_key"',
      });
    }
    if (this.orders.some((o) => o.reference_code === input.reference_code)) {
      return Promise.resolve({
        row: null,
        error: 'duplicate key value violates unique constraint "payment_orders_reference_code_key"',
      });
    }
    const row: OrderRow = {
      id: `${input.registration_id.slice(0, 8)}-order-${++this.seq}`,
      reference_code: input.reference_code,
      amount_vnd: input.amount_vnd,
      player_claimed_paid: false,
      player_claimed_at: null,
    };
    this.orders.push(row);
    return Promise.resolve({ row, error: null });
  }
}

describe("processCreatePaymentOrder", () => {
  const valid = { registration_id: REG, magic_token: TOKEN };

  it("rejects malformed ids and tokens", async () => {
    const store = new FakeOrderStore();
    expect((await processCreatePaymentOrder({}, store)).status).toBe(400);
    expect(
      (await processCreatePaymentOrder({ registration_id: REG, magic_token: "nope" }, store))
        .status,
    ).toBe(400);
  });

  it("rejects a cancelled registration with 403", async () => {
    const store = new FakeOrderStore();
    store.registration = { event_id: "evt-1", status: "cancelled" };
    const r = await processCreatePaymentOrder(valid, store);
    expect(r.status).toBe(403);
    expect(r.body.code).toBe("registration_cancelled");
  });

  it("rejects a wrong magic token with 401", async () => {
    const store = new FakeOrderStore();
    store.token = "99999999-9999-9999-9999-999999999999";
    expect((await processCreatePaymentOrder(valid, store)).status).toBe(401);
  });

  it("secret lookup failure is a 500, not a 401", async () => {
    const store = new FakeOrderStore();
    store.tokenError = "db down";
    const r = await processCreatePaymentOrder(valid, store);
    expect(r.status).toBe(500);
    expect(r.body.code).toBe("secret_lookup_failed");
  });

  it("returns payment_not_enabled (200) when the event has no enabled config", async () => {
    const store = new FakeOrderStore();
    store.config = { ...BANK, enabled: false };
    const r = await processCreatePaymentOrder(valid, store);
    expect(r.status).toBe(200);
    expect(r.body.code).toBe("payment_not_enabled");
  });

  it("creates a fresh order with the event price and bank details", async () => {
    const store = new FakeOrderStore();
    const r = await processCreatePaymentOrder(valid, store, () => "PHUB-AAAAAA");
    expect(r.status).toBe(200);
    expect(r.body.reference_code).toBe("PHUB-AAAAAA");
    expect(r.body.amount_vnd).toBe(150000);
    expect((r.body.bank as { code: string }).code).toBe("VCB");
    expect(store.orders).toHaveLength(1);
  });

  it("is idempotent: a second call returns the existing order without inserting", async () => {
    const store = new FakeOrderStore();
    const first = await processCreatePaymentOrder(valid, store);
    const second = await processCreatePaymentOrder(valid, store);
    expect(second.body.order_id).toBe(first.body.order_id);
    expect(store.orders).toHaveLength(1);
  });

  it("retries reference-code collisions and succeeds", async () => {
    const store = new FakeOrderStore();
    store.failNextInserts = {
      count: 2,
      message: 'duplicate key value violates unique constraint "payment_orders_reference_code_key"',
    };
    let calls = 0;
    const r = await processCreatePaymentOrder(valid, store, () => `PHUB-CODE${++calls}`);
    expect(r.status).toBe(200);
    expect(calls).toBe(3);
    expect(r.body.reference_code).toBe("PHUB-CODE3");
  });

  it("gives up after exhausting reference-code retries", async () => {
    const store = new FakeOrderStore();
    store.failNextInserts = {
      count: REFERENCE_MAX_RETRIES,
      message: 'duplicate key "payment_orders_reference_code_key"',
    };
    const r = await processCreatePaymentOrder(valid, store);
    expect(r.status).toBe(500);
    expect(r.body.code).toBe("reference_code_exhausted");
  });

  it("concurrent same-registration insert re-reads the winner's row", async () => {
    const store = new FakeOrderStore();
    // Simulate the loser: its insert hits the registration_id unique
    // violation because the winner's row landed between check and insert.
    store.orders.push({
      id: `${REG.slice(0, 8)}-order-winner`,
      reference_code: "PHUB-WINNER",
      amount_vnd: 150000,
      player_claimed_paid: false,
      player_claimed_at: null,
    });
    // getOrderByRegistration's first (idempotency) read must miss to model
    // the race window, then the post-conflict re-read must hit.
    let reads = 0;
    store.getOrderByRegistration = (registrationId: string) => {
      reads++;
      return Promise.resolve(reads === 1 ? null : store.orders[0]);
    };
    const r = await processCreatePaymentOrder(valid, store);
    expect(r.status).toBe(200);
    expect(r.body.reference_code).toBe("PHUB-WINNER");
  });

  it("generateReferenceCode format holds", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateReferenceCode()).toMatch(/^PHUB-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
    }
  });
});

class FakeClaimStore implements ClaimStore {
  order: ClaimOrderRow | null = {
    id: ORDER,
    registration_id: REG,
    amount_vnd: 150000,
    reference_code: "PHUB-AAAAAA",
    player_claimed_paid: false,
    player_claimed_at: null,
  };
  orderError: string | null = null;
  token: string | null = TOKEN;
  /** claimOrder returns null row when this is false (lost the race). */
  claimWins = true;
  claimError: string | null = null;
  pushes: OrganizerPush[] = [];
  pushError: string | null = null;
  pushThrows = false;
  context = {
    display_name: "Nguyen A",
    event: {
      title_vi: "Giao lưu tối thứ 5",
      slug: "giao-luu-toi-thu-5",
      created_by: "organizer-1",
      club_slug: "clb-q7",
    },
  };

  getOrder() {
    return Promise.resolve({ row: this.order, error: this.orderError });
  }
  getMagicToken() {
    return Promise.resolve(this.token);
  }
  claimOrder(orderId: string, claimedAt: string) {
    if (this.claimError) return Promise.resolve({ row: null, error: this.claimError });
    if (!this.claimWins) return Promise.resolve({ row: null, error: null });
    if (this.order) {
      this.order.player_claimed_paid = true;
      this.order.player_claimed_at = claimedAt;
    }
    return Promise.resolve({
      row: { id: orderId, player_claimed_paid: true, player_claimed_at: claimedAt },
      error: null,
    });
  }
  getClaimState() {
    return Promise.resolve(
      this.order
        ? {
            player_claimed_paid: this.order.player_claimed_paid,
            player_claimed_at: this.order.player_claimed_at,
          }
        : null,
    );
  }
  getRegistrationContext() {
    return Promise.resolve(this.context);
  }
  notifyOrganizer(push: OrganizerPush) {
    if (this.pushThrows) throw new Error("push transport down");
    this.pushes.push(push);
    return Promise.resolve({ error: this.pushError });
  }
}

describe("processMarkPaymentClaimed", () => {
  const valid = { order_id: ORDER, magic_token: TOKEN };
  const now = () => "2026-07-16T12:00:00.000Z";

  it("rejects malformed ids and a wrong token", async () => {
    const store = new FakeClaimStore();
    expect((await processMarkPaymentClaimed({}, store, now)).status).toBe(400);
    store.token = "99999999-9999-9999-9999-999999999999";
    expect((await processMarkPaymentClaimed(valid, store, now)).status).toBe(401);
  });

  it("first claim flips the flag and pushes the organizer exactly once", async () => {
    const store = new FakeClaimStore();
    const r = await processMarkPaymentClaimed(valid, store, now);
    expect(r.status).toBe(200);
    expect(r.body.player_claimed_paid).toBe(true);
    expect(r.body.player_claimed_at).toBe(now());
    expect(store.pushes).toHaveLength(1);
    expect(store.pushes[0].organizerId).toBe("organizer-1");
    expect(store.pushes[0].body).toBe(
      "Nguyen A • 150.000đ • PHUB-AAAAAA • Giao lưu tối thứ 5",
    );
    expect(store.pushes[0].data.reference_code).toBe("PHUB-AAAAAA");
  });

  it("an already-claimed order short-circuits with NO second push", async () => {
    const store = new FakeClaimStore();
    await processMarkPaymentClaimed(valid, store, now);
    const again = await processMarkPaymentClaimed(valid, store, now);
    expect(again.status).toBe(200);
    expect(again.body.player_claimed_paid).toBe(true);
    expect(store.pushes).toHaveLength(1);
  });

  it("the loser of a concurrent claim re-reads and does NOT push", async () => {
    const store = new FakeClaimStore();
    store.claimWins = false; // guarded UPDATE matched zero rows
    store.order!.player_claimed_paid = true; // winner's committed state
    store.order!.player_claimed_at = "2026-07-16T11:59:59.000Z";
    const r = await processMarkPaymentClaimed(valid, store, now);
    expect(r.status).toBe(200);
    expect(r.body.player_claimed_at).toBe("2026-07-16T11:59:59.000Z");
    expect(store.pushes).toHaveLength(0);
  });

  it("a push failure or exception never breaks the claim response", async () => {
    const failing = new FakeClaimStore();
    failing.pushError = "FCM 500";
    expect((await processMarkPaymentClaimed(valid, failing, now)).status).toBe(200);

    const throwing = new FakeClaimStore();
    throwing.pushThrows = true;
    const r = await processMarkPaymentClaimed(valid, throwing, now);
    expect(r.status).toBe(200);
    expect(r.body.player_claimed_paid).toBe(true);
  });

  it("skips the push when the event has no organizer", async () => {
    const store = new FakeClaimStore();
    store.context = { display_name: "Nguyen A", event: null };
    const r = await processMarkPaymentClaimed(valid, store, now);
    expect(r.status).toBe(200);
    expect(store.pushes).toHaveLength(0);
  });

  it("a failed guarded update surfaces as 500", async () => {
    const store = new FakeClaimStore();
    store.claimError = "db down";
    const r = await processMarkPaymentClaimed(valid, store, now);
    expect(r.status).toBe(500);
    expect(r.body.code).toBe("update_failed");
  });
});
