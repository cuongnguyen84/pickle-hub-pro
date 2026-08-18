// ============================================================================
// "What happens next", said once.
// ----------------------------------------------------------------------------
// The buyer's first question about an order is never "what status is it", it
// is "do I have to do anything". So the status IS the sentence, and the h1 of
// the order page is that sentence rather than a chip.
//
// A cancelled order is the exception that gets a block of its own, placed
// ABOVE everything else (§H.4): who cancelled it, when, and — when it was not
// the buyer — the reason in the seller's own words.
//
// The wordings themselves are in orderState.ts with the rest of the order
// copy — this file renders them, it does not own them.
// ============================================================================

import { AlertTriangle } from "lucide-react";
import type { OrderStatus } from "@/integrations/supabase/shop-schema";
import { formatWhen } from "@/lib/shop/orderFormat";
import { ORDER_NOTE_BUYER } from "@/lib/shop/orderState";

/** Who pressed cancel. Read off the cancel event's `metadata.actor_kind`. */
export type CancelActorKind = "buyer" | "seller" | "admin";

export interface OrderStatusLineProps {
  status: OrderStatus;
  /** Only the buyer surface exists this round; the prop is here because S08/S09
   *  reuse this component and the wording differs. */
  side?: "buyer" | "seller";
  cancelledBy?: CancelActorKind | null;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  shopName?: string | null;
}

export function OrderStatusLine({
  status,
  side = "buyer",
  cancelledBy,
  cancelReason,
  cancelledAt,
  shopName,
}: OrderStatusLineProps) {
  if (status !== "cancelled") {
    return <p className="tl-shop-sub">{ORDER_NOTE_BUYER[status]}</p>;
  }

  const when = formatWhen(cancelledAt);
  const whenPart = when ? ` lúc ${when}` : "";
  // EN: You cancelled this order · {shop} cancelled this order · A ThePickleHub
  //     admin cancelled this order
  const who =
    cancelledBy === "seller"
      ? `${shopName ?? "Người bán"} đã huỷ đơn này`
      : cancelledBy === "admin"
        ? "Quản trị viên ThePickleHub đã huỷ đơn này"
        : side === "seller"
          ? "Người mua đã huỷ đơn này"
          : "Anh/chị đã huỷ đơn này";

  return (
    <div className="tl-shop-notice tl-shop-notice--warn">
      <AlertTriangle size={16} aria-hidden="true" />
      <div>
        <strong>{who}</strong>
        {whenPart}.
        {/* No reason means the buyer cancelled their own order — they owe
            nobody a sentence, and printing "—" would invent one. */}
        {cancelReason ? <> Lý do shop ghi: “{cancelReason}”.</> : null}
      </div>
    </div>
  );
}
