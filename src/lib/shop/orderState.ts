// ============================================================================
// Order state → who may do what, and what happens next.
// ----------------------------------------------------------------------------
// A mirror of the machine declared in migration 20260818100000. Postgres is the
// authority: shop_order_transition() re-derives every one of these rules and
// refuses anything this file would have allowed by mistake. What lives here is
// only the question "should this button exist", asked without a round trip.
//
// Five states, and no more. There is no `completed` — that state only earns its
// keep once there are reviews, and reviews are cut — and no `awaiting_payment`:
// cod and bank_transfer behave identically as far as status is concerned (D2).
//
// Pure functions, no React, no Supabase.
// ============================================================================

export type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";

export type OrderAction = "confirm" | "ship" | "deliver" | "cancel";

export type PaymentMethod = "cod" | "bank_transfer";

/**
 * Who is pressing.
 *
 * `seller` is owner | manager | fulfillment. `support` is a separate actor
 * precisely because it can do NONE of these — collapsing it into `seller`
 * would render four buttons the server answers 42501 to.
 */
export type OrderActor = "buyer" | "seller" | "support" | "admin";

/** shop_members.role → the actor this file reasons about. */
export function actorForRole(
  role: "owner" | "manager" | "fulfillment" | "support" | null,
): OrderActor | null {
  if (role === "support") return "support";
  if (role) return "seller";
  return null;
}

interface Transition {
  from: OrderStatus;
  action: OrderAction;
  to: OrderStatus;
  actors: OrderActor[];
}

/**
 * The whole machine, in the same order as the SQL comment it mirrors.
 *
 * `deliver` includes the buyer (D7). There is no job closing orders, so without
 * that row a delivered order sits in `shipped` for ever and the buyer has no
 * way to say it arrived.
 *
 * `cancel` from `shipped` is admin-only: the goods are already moving, and
 * undoing that is a decision with a person behind it.
 */
export const ORDER_TRANSITIONS: readonly Transition[] = [
  { from: "pending", action: "confirm", to: "confirmed", actors: ["seller", "admin"] },
  { from: "confirmed", action: "ship", to: "shipped", actors: ["seller", "admin"] },
  { from: "shipped", action: "deliver", to: "delivered", actors: ["buyer", "seller", "admin"] },
  { from: "pending", action: "cancel", to: "cancelled", actors: ["buyer", "seller", "admin"] },
  { from: "confirmed", action: "cancel", to: "cancelled", actors: ["seller", "admin"] },
  { from: "shipped", action: "cancel", to: "cancelled", actors: ["admin"] },
] as const;

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export const ORDER_ACTIONS: readonly OrderAction[] = [
  "confirm",
  "ship",
  "deliver",
  "cancel",
] as const;

/** `delivered` is the successful end; `cancelled` is the other one. Neither has
 *  an exit, and a screen that offers one is offering a 409. */
export const isTerminal = (status: OrderStatus) =>
  status === "delivered" || status === "cancelled";

/** Can THIS actor do THIS action from THIS status. Unknown values coming back
 *  from an API or a URL answer `false` rather than throwing — a runtime string
 *  is not a promise about the type. */
export function canTransition(
  status: OrderStatus,
  action: OrderAction,
  actor: OrderActor,
): boolean {
  return ORDER_TRANSITIONS.some(
    (t) => t.from === status && t.action === action && t.actors.includes(actor),
  );
}

/** What the status becomes, or null when the pair is not a transition at all.
 *  Deliberately independent of the actor: this answers "where does this arrow
 *  point", not "may you follow it". */
export function nextStatus(status: OrderStatus, action: OrderAction): OrderStatus | null {
  return ORDER_TRANSITIONS.find((t) => t.from === status && t.action === action)?.to ?? null;
}

/** Everything this actor may do right now, in the order the buttons appear:
 *  the forward move first, cancel last. */
export function allowedActions(status: OrderStatus, actor: OrderActor): OrderAction[] {
  return ORDER_ACTIONS.filter((action) => canTransition(status, action, actor));
}

/** The server demands a reason from anybody who is not the buyer, and refuses
 *  with 22023 / invalid_payload without one. Mirrored so the form can require
 *  the field instead of discovering it. */
export const cancelNeedsReason = (actor: OrderActor) => actor !== "buyer";

// ─── Words ──────────────────────────────────────────────────────────────────
// B11 writes a status as the SENTENCE about what the reader does next, not as a
// chip. The chip label exists for the compact list; the line is what the buyer
// actually reads.

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Chờ shop xác nhận",
  confirmed: "Shop đang chuẩn bị hàng",
  shipped: "Đang giao",
  delivered: "Đã nhận hàng",
  cancelled: "Đã huỷ",
};

export const ORDER_STATUS_LINE_BUYER: Record<OrderStatus, string> = {
  pending: "Shop chưa xác nhận — chưa cần làm gì. Huỷ được bất cứ lúc nào.",
  confirmed: "Người bán đang chuẩn bị hàng — chưa cần làm gì.",
  shipped: "Hàng đang trên đường. Nhận được rồi thì bấm “Tôi đã nhận hàng”.",
  delivered: "Đơn đã xong.",
  cancelled: "Đơn này đã huỷ.",
};

export const ORDER_STATUS_TONE: Record<OrderStatus, "ok" | "warn" | "danger" | "muted"> = {
  pending: "warn",
  confirmed: "ok",
  shipped: "ok",
  delivered: "ok",
  cancelled: "muted",
};

/** COD is not "unpaid" (§G): nothing is owed yet, so saying so invents a debt.
 *  bank_transfer promises no QR, no bank details and no reconciliation — the
 *  shop sends its own instructions. */
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cod: "Trả khi nhận hàng",
  bank_transfer: "Chuyển khoản trước — shop sẽ gửi thông tin",
};

/**
 * The h1 of /shop/order/:code.
 *
 * The buyer's first question about an order is never "what status is it", it
 * is "do I have to do anything" — so the status IS the heading, not a chip.
 *
 * EN: The shop hasn't confirmed yet · The seller is packing your order ·
 *     Your order is on its way · This order is complete · This order was cancelled
 */
export const ORDER_H1_BUYER: Record<OrderStatus, string> = {
  pending: "Shop chưa xác nhận đơn",
  confirmed: "Người bán đang chuẩn bị hàng",
  shipped: "Hàng đang trên đường tới anh/chị",
  delivered: "Đơn đã xong",
  cancelled: "Đơn đã huỷ",
};

/**
 * The line under it. No delivery dates and no countdown — nothing in Phase 3
 * knows when a parcel arrives, so nothing here pretends to. `cancelled` is
 * absent because that state gets a block of its own, with who and why in it.
 *
 * EN: The shop usually replies within 1–2 days. Nothing to do. You can still
 *     cancel right now. · Nothing to do. The seller adds a tracking code here
 *     once it ships. · Press "I've received it" to close the order. ·
 *     Thank you. Contact the shop below if anything is wrong.
 */
export const ORDER_NOTE_BUYER: Record<Exclude<OrderStatus, "cancelled">, string> = {
  pending:
    "Shop thường trả lời trong 1–2 ngày. Chưa cần làm gì. Đổi ý thì huỷ được ngay bây giờ.",
  confirmed:
    "Chưa cần làm gì. Khi gửi xong, người bán sẽ đưa mã vận đơn ở đây.",
  shipped:
    "Nhận được hàng rồi thì bấm “Tôi đã nhận hàng” để đóng đơn.",
  delivered: "Cảm ơn anh/chị. Có vấn đề gì thì liên hệ shop ở dưới.",
};

// The shipping-fee label lives in orderFormat.ts (`shippingLabel`) — it is the
// same rule as every other price on these screens and formats through
// formatVnd, so there is exactly one of it.
