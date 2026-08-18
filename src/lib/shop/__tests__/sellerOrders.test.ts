/**
 * The order the seller's list comes in.
 *
 * This is the one piece of logic on /seller/orders that is not obvious, and
 * the obvious version is wrong: sorted by order date, the order that is two
 * hours from its deadline sits below everything that arrived after it. So the
 * assertions below are about POSITION, by code, not about "a sort happened".
 */
import { describe, expect, it } from "vitest";
import type { OrderStatus } from "@/integrations/supabase/shop-schema";
import {
  SELLER_TODO,
  inSellerTab,
  sellerDue,
  sellerDueLabel,
  sortSellerOrders,
} from "../sellerOrders";

const NOW = Date.parse("2026-08-18T12:00:00.000Z");
const h = (n: number) => new Date(NOW + n * 3_600_000).toISOString();

const order = (
  code: string,
  status: OrderStatus,
  dueHours: number,
  createdHours: number,
) => ({ code, status, confirm_due_at: h(dueHours), created_at: h(createdHours) });

describe("sortSellerOrders", () => {
  it("puts the overdue pending orders on top, longest overdue first", () => {
    // A is 5h past its deadline, B is 1h past, C has 2h left, D has 20h left.
    // Their ORDER DATES run the other way on purpose: D is the newest, so a
    // created_at sort would put it first and bury A.
    const rows = [
      order("D", "pending", 20, -1),
      order("C", "pending", 2, -2),
      order("B", "pending", -1, -3),
      order("A", "pending", -5, -4),
    ];
    expect(sortSellerOrders(rows).map((r) => r.code)).toEqual(["A", "B", "C", "D"]);
  });

  it("keeps every pending order above everything else, however old", () => {
    const rows = [
      order("SHIPPED-TODAY", "shipped", 40, 0),
      order("PENDING-LAST-WEEK", "pending", 6, -168),
      order("DELIVERED-TODAY", "delivered", 40, -1),
    ];
    expect(sortSellerOrders(rows)[0].code).toBe("PENDING-LAST-WEEK");
  });

  it("sorts the rest newest first, ignoring their meaningless deadline", () => {
    // confirm_due_at is NOT NULL on every row, so a confirmed order still has
    // one. Reading it here would shuffle finished work by a date nobody set.
    const rows = [
      order("OLD", "delivered", -100, -48),
      order("NEW", "confirmed", -100, -1),
      order("MID", "cancelled", -100, -24),
    ];
    expect(sortSellerOrders(rows).map((r) => r.code)).toEqual(["NEW", "MID", "OLD"]);
  });

  it("does not mutate the array it was given", () => {
    const rows = [order("A", "delivered", 1, -1), order("B", "pending", 1, -2)];
    const before = rows.map((r) => r.code);
    sortSellerOrders(rows);
    expect(rows.map((r) => r.code)).toEqual(before);
  });
});

describe("sellerDue", () => {
  it("only a pending order has a deadline worth showing", () => {
    for (const status of ["confirmed", "shipped", "delivered", "cancelled"] as OrderStatus[]) {
      expect(sellerDue(order("X", status, -5, -1), NOW)).toEqual({ kind: "none" });
    }
  });

  it("counts the hours left, and the hours past", () => {
    expect(sellerDue(order("X", "pending", 2, -1), NOW)).toEqual({ kind: "due", hours: 2 });
    expect(sellerDue(order("X", "pending", -5, -1), NOW)).toEqual({ kind: "overdue", hours: 5 });
  });

  it("never says zero hours", () => {
    // "Còn 0 giờ" reads as a deadline that has already passed; "Quá hạn 0 giờ"
    // reads as a typo. Both round away from zero.
    expect(sellerDueLabel(sellerDue(order("X", "pending", 0.1, -1), NOW))).toBe(
      "Còn 1 giờ để trả lời",
    );
    expect(sellerDueLabel(sellerDue(order("X", "pending", -0.1, -1), NOW))).toBe("Quá hạn 1 giờ");
  });

  it("says nothing that implies a job will step in", () => {
    const words = [
      sellerDueLabel(sellerDue(order("X", "pending", 2, -1), NOW)),
      sellerDueLabel(sellerDue(order("X", "pending", -5, -1), NOW)),
      ...Object.values(SELLER_TODO),
    ].join(" ");
    expect(words).not.toMatch(/tự huỷ|tự động huỷ|quản trị viên/i);
  });
});

describe("the tabs", () => {
  it("send each state to exactly one working tab, and all of them to Tất cả", () => {
    const map: Record<OrderStatus, string> = {
      pending: "todo",
      confirmed: "todo",
      shipped: "shipping",
      delivered: "done",
      cancelled: "done",
    };
    for (const [status, tab] of Object.entries(map) as [OrderStatus, "todo" | "shipping" | "done"][]) {
      expect(inSellerTab(status, tab)).toBe(true);
      expect(inSellerTab(status, "all")).toBe(true);
      const others = (["todo", "shipping", "done"] as const).filter((t) => t !== tab);
      expect(others.some((t) => inSellerTab(status, t))).toBe(false);
    }
  });
});
