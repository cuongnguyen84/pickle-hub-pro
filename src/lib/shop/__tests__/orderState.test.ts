/**
 * The order machine, asserted pair by pair.
 *
 * Postgres enforces all of this in shop_order_transition() and
 * supabase/tests/shop_orders.test.sql proves it there. This file is about the
 * OTHER failure: a screen that offers a button the server refuses, or hides one
 * it would have allowed. Both are the same bug seen from opposite sides, and
 * neither shows up in a pgTAP run.
 *
 * The last describe reads the migration and compares the arrow list to this
 * one, so the two cannot drift apart quietly.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ORDER_ACTIONS,
  ORDER_STATUSES,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_LINE_BUYER,
  ORDER_H1_BUYER,
  ORDER_NOTE_BUYER,
  ORDER_TRANSITIONS,
  PAYMENT_METHOD_LABEL,
  actorForRole,
  allowedActions,
  canTransition,
  cancelNeedsReason,
  isTerminal,
  nextStatus,
} from "../orderState";
import type { OrderAction, OrderActor, OrderStatus } from "../orderState";

const ACTORS: OrderActor[] = ["buyer", "seller", "support", "admin"];

describe("the state set is exactly five", () => {
  it("has no completed and no awaiting_payment", () => {
    // `completed` only earns its keep with reviews (cut), and a separate
    // payment state would make cod and bank_transfer behave differently — which
    // D2 says they must not.
    expect([...ORDER_STATUSES].sort()).toEqual(
      ["cancelled", "confirmed", "delivered", "pending", "shipped"].sort(),
    );
    expect(Object.keys(ORDER_STATUS_LABEL)).toHaveLength(5);
    expect(Object.keys(ORDER_STATUS_LINE_BUYER)).toHaveLength(5);
  });
});

describe("every valid pair, and only those", () => {
  const expected: [OrderStatus, OrderAction, OrderStatus][] = [
    ["pending", "confirm", "confirmed"],
    ["confirmed", "ship", "shipped"],
    ["shipped", "deliver", "delivered"],
    ["pending", "cancel", "cancelled"],
    ["confirmed", "cancel", "cancelled"],
    ["shipped", "cancel", "cancelled"],
  ];

  it.each(expected)("%s --%s--> %s", (from, action, to) => {
    expect(nextStatus(from, action)).toBe(to);
  });

  it("returns null for every pair that is not on the list", () => {
    const valid = new Set(expected.map(([f, a]) => `${f}:${a}`));
    for (const status of ORDER_STATUSES) {
      for (const action of ORDER_ACTIONS) {
        if (valid.has(`${status}:${action}`)) continue;
        expect(nextStatus(status, action), `${status}:${action}`).toBeNull();
      }
    }
  });
});

describe("the buyer", () => {
  it("cannot confirm or ship, from any status", () => {
    for (const status of ORDER_STATUSES) {
      expect(canTransition(status, "confirm", "buyer"), status).toBe(false);
      expect(canTransition(status, "ship", "buyer"), status).toBe(false);
    }
  });

  it("cancels only while the shop has not confirmed (D5)", () => {
    expect(canTransition("pending", "cancel", "buyer")).toBe(true);
    expect(canTransition("confirmed", "cancel", "buyer")).toBe(false);
    expect(canTransition("shipped", "cancel", "buyer")).toBe(false);
  });

  it("confirms delivery from shipped (D7) — nothing else closes an order", () => {
    expect(canTransition("shipped", "deliver", "buyer")).toBe(true);
    expect(canTransition("confirmed", "deliver", "buyer")).toBe(false);
  });

  it("is never asked for a cancellation reason", () => {
    expect(cancelNeedsReason("buyer")).toBe(false);
    expect(cancelNeedsReason("seller")).toBe(true);
    expect(cancelNeedsReason("admin")).toBe(true);
  });
});

describe("the seller side", () => {
  it("cannot cancel an order that is already shipped", () => {
    expect(canTransition("shipped", "cancel", "seller")).toBe(false);
    expect(canTransition("shipped", "cancel", "admin")).toBe(true);
  });

  it("gives support read-only: no action, from any status", () => {
    for (const status of ORDER_STATUSES) {
      expect(allowedActions(status, "support"), status).toEqual([]);
    }
  });

  it("maps shop_members.role onto the right actor", () => {
    expect(actorForRole("owner")).toBe("seller");
    expect(actorForRole("manager")).toBe("seller");
    expect(actorForRole("fulfillment")).toBe("seller");
    expect(actorForRole("support")).toBe("support");
    expect(actorForRole(null)).toBeNull();
  });
});

describe("the admin", () => {
  it("cancels from all three cancellable states", () => {
    expect(canTransition("pending", "cancel", "admin")).toBe(true);
    expect(canTransition("confirmed", "cancel", "admin")).toBe(true);
    expect(canTransition("shipped", "cancel", "admin")).toBe(true);
  });
});

describe("the end states are ends", () => {
  it.each(["delivered", "cancelled"] as OrderStatus[])("nothing leaves %s", (status) => {
    expect(isTerminal(status)).toBe(true);
    for (const actor of ACTORS) {
      expect(allowedActions(status, actor), `${status}/${actor}`).toEqual([]);
    }
  });

  it("leaves pending, confirmed and shipped open", () => {
    expect(isTerminal("pending")).toBe(false);
    expect(isTerminal("confirmed")).toBe(false);
    expect(isTerminal("shipped")).toBe(false);
  });
});

describe("values that arrive from runtime", () => {
  it("refuses an unknown status, action or actor instead of throwing", () => {
    // These come off a URL, a stale cache or an API the client does not control.
    // A thrown error here is a blank screen; `false` is a button that is not
    // rendered.
    expect(canTransition("paid" as OrderStatus, "confirm", "seller")).toBe(false);
    expect(canTransition("pending", "refund" as OrderAction, "seller")).toBe(false);
    expect(canTransition("pending", "confirm", "courier" as OrderActor)).toBe(false);
    expect(nextStatus("completed" as OrderStatus, "deliver")).toBeNull();
    expect(allowedActions("awaiting_payment" as OrderStatus, "admin")).toEqual([]);
  });
});

describe("the words the buyer reads", () => {
  it("calls COD 'trả khi nhận hàng', never 'chưa thanh toán' (§G)", () => {
    expect(PAYMENT_METHOD_LABEL.cod).toBe("Trả khi nhận hàng");
    expect(PAYMENT_METHOD_LABEL.cod).not.toMatch(/thanh toán/i);
  });

  // The zero-fee rule moved to orderFormat.shippingLabel — one helper, tested
  // in orderFormat.test.ts, so two of them cannot disagree about "0₫".

  it("gives every buyer-facing state a heading and a next step", () => {
    // cancelled is absent from the note table on purpose: it gets its own
    // block, with who cancelled and why.
    expect(Object.keys(ORDER_H1_BUYER)).toEqual([...ORDER_STATUSES]);
    expect(Object.keys(ORDER_NOTE_BUYER)).toEqual(
      ORDER_STATUSES.filter((s) => s !== "cancelled"),
    );
    const all = [...Object.values(ORDER_H1_BUYER), ...Object.values(ORDER_NOTE_BUYER)].join(" ");
    // No countdown and no promised date anywhere on the buyer's side.
    expect(all).not.toMatch(/còn \d+ (giờ|ngày)/i);
    expect(all).not.toContain("email xác nhận");
  });

  it("never contains the prototype marker that fails the bundle gate", () => {
    // scripts/check-bundle-size.mjs fails the build if "Shop bị tạm ngưng"
    // reaches the artifact. The sanctioned wording is "Shop đang tạm ngưng bán".
    const all = [
      ...Object.values(ORDER_STATUS_LABEL),
      ...Object.values(ORDER_STATUS_LINE_BUYER),
      ...Object.values(PAYMENT_METHOD_LABEL),
      ...Object.values(ORDER_H1_BUYER),
      ...Object.values(ORDER_NOTE_BUYER),
    ].join(" ");
    expect(all).not.toContain("Shop bị tạm ngưng");
  });
});

describe("the TS table and the SQL table describe the same machine", () => {
  const SQL = readFileSync(
    resolve(__dirname, "../../../../supabase/migrations/20260818100000_shop_orders.sql"),
    "utf8",
  );

  it("has a CASE arm in shop_order_transition for every (from, action, to) here", () => {
    // The previous version only checked that each ACTION and each STATUS
    // appeared somewhere in the block — which is a vocabulary check wearing the
    // name of a table comparison. Rewiring `pending --ship--> shipped` kept
    // every one of those words present and the test green.
    //
    // So: one regexp per row of ORDER_TRANSITIONS, matching the source AND the
    // destination of that specific arm. Still not an SQL parser — the arms have
    // a fixed shape, `_action = 'x' AND _expected_status = 'y' THEN 'z'`, with
    // the cancel arm covering its three sources in one IN list.
    const at = SQL.indexOf("_next := CASE");
    expect(at, "the CASE that builds _next must exist").toBeGreaterThan(-1);
    // indexOf FROM `at`: "ELSE NULL" also appears earlier, in shop_cart_view's
    // unavailable_reason CASE, and slicing to that gives an empty string and a
    // test that asserts nothing.
    const body = SQL.slice(at, SQL.indexOf("ELSE NULL", at));

    for (const t of ORDER_TRANSITIONS) {
      const arm = new RegExp(
        `_action = '${t.action}'\\s+AND _expected_status ` +
          `(?:= '${t.from}'|IN \\([^)]*'${t.from}'[^)]*\\))` +
          `[\\s\\S]{0,80}?THEN '${t.to}'`,
      );
      expect(body, `${t.from} --${t.action}--> ${t.to}`).toMatch(arm);
    }
    // No arm the TS table does not know about.
    expect(body.match(/WHEN _action = /g) ?? [], "one arm per action, no more").toHaveLength(
      ORDER_ACTIONS.length,
    );
    expect(body).not.toContain("completed");
    expect(body).not.toContain("awaiting_payment");
  });

  it("keeps support out of the seller set on both sides", () => {
    const body = SQL.slice(
      SQL.indexOf("CREATE OR REPLACE FUNCTION public.shop_order_transition("),
      SQL.indexOf("REVOKE ALL   ON FUNCTION public.shop_order_transition"),
    );
    expect(body).toContain("'owner', 'manager', 'fulfillment'");
    expect(ORDER_TRANSITIONS.every((t) => !t.actors.includes("support"))).toBe(true);
  });
});
