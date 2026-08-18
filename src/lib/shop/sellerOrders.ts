// ============================================================================
// /seller/orders — the order the rows come in, and the words on them.
// ----------------------------------------------------------------------------
// Pure. No React, no Supabase, no Date.now() unless it is handed in: every
// function here takes `now` so the tests can put an order five hours past its
// deadline without waiting five hours.
//
// The sort is the whole point of the screen. Sorting by order date — the
// obvious thing, and what every list in this repo does — buries the order that
// is about to run out of time under whatever arrived after it. So:
//
//   1. everything still waiting for the seller (`pending`), by DEADLINE,
//      soonest first. Overdue deadlines are in the past, so they sort to the
//      top by construction and the most overdue is first. That is rules 1 and
//      2 of the spec collapsed into one comparison rather than two passes;
//   2. everything else, newest first.
// ============================================================================

import type { OrderStatus } from "@/integrations/supabase/shop-schema";

/** The subset of an order row the sort and the labels read. */
export interface SellerOrderLike {
  status: OrderStatus;
  confirm_due_at: string;
  created_at: string;
}

const ms = (iso: string) => {
  const t = Date.parse(iso);
  // An unparseable timestamp sorts last rather than throwing inside a render.
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
};

/**
 * Newest-first, EXCEPT that orders still waiting on the seller come first in
 * deadline order. Returns a new array; the query cache's copy is not touched.
 */
export function sortSellerOrders<T extends SellerOrderLike>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const aWaiting = a.status === "pending";
    const bWaiting = b.status === "pending";
    if (aWaiting !== bWaiting) return aWaiting ? -1 : 1;
    if (aWaiting && bWaiting) return ms(a.confirm_due_at) - ms(b.confirm_due_at);
    return ms(b.created_at) - ms(a.created_at);
  });
}

// ─── The deadline, as something to read ─────────────────────────────────────

export type SellerDue =
  | { kind: "none" }
  | { kind: "due"; hours: number }
  | { kind: "overdue"; hours: number };

const HOUR = 3_600_000;

/**
 * Only a `pending` order has a deadline worth showing. `confirm_due_at` is
 * NOT NULL on every row — it defaults to now()+48h — so a confirmed or
 * delivered order still carries one, and printing it would be a countdown on
 * something nobody is waiting for.
 *
 * No job reads this column and nothing cancels an order when it passes. The
 * wording must not imply otherwise.
 */
export function sellerDue(order: SellerOrderLike, now: number): SellerDue {
  if (order.status !== "pending") return { kind: "none" };
  const diff = ms(order.confirm_due_at) - now;
  if (!Number.isFinite(diff)) return { kind: "none" };
  return diff <= 0
    ? { kind: "overdue", hours: Math.max(1, Math.floor(-diff / HOUR)) }
    : { kind: "due", hours: Math.max(1, Math.round(diff / HOUR)) };
}

/** EN: {n}h left to reply · {n}h past the deadline */
export const sellerDueLabel = (due: SellerDue): string =>
  due.kind === "overdue"
    ? `Quá hạn ${due.hours} giờ`
    : due.kind === "due"
      ? `Còn ${due.hours} giờ để trả lời`
      : "";

// ─── Words ──────────────────────────────────────────────────────────────────

/** The seller's job, per state. Not the status name: a seller scanning twenty
 *  rows is looking for what they have to DO.
 *
 *  EN: Needs your confirmation · Pack it and send it · On the way — waiting for
 *      the buyer · Done · Cancelled */
export const SELLER_TODO: Record<OrderStatus, string> = {
  pending: "Cần anh/chị xác nhận",
  confirmed: "Cần đóng gói và gửi hàng",
  shipped: "Đang giao — chờ người mua xác nhận",
  delivered: "Xong",
  cancelled: "Đã huỷ",
};

export type SellerTab = "todo" | "shipping" | "done" | "all";

/** `todo` is first and is the default: the screen exists to answer "what do I
 *  have to do", not "what have I ever sold". */
export const SELLER_TABS: { key: SellerTab; label: string; statuses: OrderStatus[] | null }[] = [
  { key: "todo", label: "Cần xử lý", statuses: ["pending", "confirmed"] },
  { key: "shipping", label: "Đang giao", statuses: ["shipped"] },
  { key: "done", label: "Đã xong", statuses: ["delivered", "cancelled"] },
  { key: "all", label: "Tất cả", statuses: null },
];

export const inSellerTab = (status: OrderStatus, tab: SellerTab): boolean => {
  const spec = SELLER_TABS.find((t) => t.key === tab);
  return !spec || spec.statuses === null || spec.statuses.includes(status);
};
