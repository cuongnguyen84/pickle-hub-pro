// ============================================================================
// "Diễn biến" — what happened to this order, in order.
// ----------------------------------------------------------------------------
// Reads shop_order_events, which is append-only and therefore the only honest
// history there is. Who acted is rendered as a ROLE, never as a name: the
// actor id is not granted to any client, and the buyer does not need to know
// which member of the shop pressed the button.
// ============================================================================

import type { OrderAction } from "@/integrations/supabase/shop-schema";
import { formatWhen } from "@/lib/shop/orderFormat";

export interface OrderTimelineEvent {
  id: string;
  action: OrderAction | "create";
  from_status: string | null;
  to_status: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// EN: Order sent to the seller · The seller confirmed the order · The seller
//     shipped it · Marked as received · The order was cancelled
const WHAT: Record<OrderAction | "create", string> = {
  create: "Đã gửi đơn tới người bán",
  confirm: "Người bán đã xác nhận đơn",
  ship: "Người bán đã gửi hàng",
  deliver: "Đã ghi nhận nhận được hàng",
  cancel: "Đơn đã huỷ",
};

const actorKind = (e: OrderTimelineEvent): string => {
  const kind = e.metadata?.actor_kind;
  if (kind === "seller") return "seller";
  if (kind === "admin") return "admin";
  return "buyer";
};

export function OrderTimeline({
  events,
  shopName,
}: {
  events: OrderTimelineEvent[];
  shopName?: string | null;
}) {
  if (events.length === 0) return null;
  return (
    <ul className="tl-shop-timeline">
      {events.map((e, i) => {
        const kind = actorKind(e);
        const who =
          kind === "seller"
            ? (shopName ?? "Người bán")
            : kind === "admin"
              ? "Quản trị viên"
              : "Người mua";
        return (
          <li key={e.id} className={i === events.length - 1 ? "is-current" : "is-done"}>
            <div className="tl-shop-timeline-when">{formatWhen(e.created_at)}</div>
            <div className="tl-shop-timeline-what">{WHAT[e.action] ?? e.to_status}</div>
            <div className="tl-shop-timeline-who">{who}</div>
          </li>
        );
      })}
    </ul>
  );
}
