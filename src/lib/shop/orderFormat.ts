// ============================================================================
// The three formatting rules the order screens must not each invent.
// ----------------------------------------------------------------------------
// Pure, because each one is a claim a buyer acts on:
//
//   · a shipping fee of 0 is FREE (D3). Rendered as "0₫" it reads as a bug and
//     rendered as "—" it reads as "not calculated yet"; both were in the
//     prototype and both are banned. One function, so no screen can disagree.
//   · a phone number becomes a `tel:` link only when it is a phone number.
//     Same rule contactCta.ts applies to a seller's channel — the difference
//     is that this one is typed by the buyer, so the shape is the local
//     10-digit form the order table CHECKs, not E.164.
//   · a timestamp is read on a phone, so it is dd/MM HH:mm and nothing longer.
// ============================================================================

import { formatVnd } from "@/lib/shop/publicCatalog";

/** 0 (or anything not positive) is "Miễn phí" — never "0₫", never "—". */
export const shippingLabel = (feeVnd: number): string =>
  feeVnd > 0 ? formatVnd(feeVnd) : "Miễn phí";

/**
 * `tel:` for a Vietnamese mobile number as the buyer typed it, null otherwise.
 *
 * The pattern is the one shop_orders.recipient_phone CHECKs, so a number the
 * database accepted always produces a link and a number it would refuse never
 * reaches an href. `null` means "print the digits as text" — a dead tel: link
 * is worse than no button.
 */
export const telHref = (phone: string | null | undefined): string | null => {
  const v = (phone ?? "").trim();
  return /^0\d{9}$/.test(v) ? `tel:${v}` : null;
};

/** dd/MM HH:mm, Vietnam time. Long enough to place an event, short enough to
 *  sit on one line at 320px. */
export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(d.getDate())}/${two(d.getMonth() + 1)} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** "Màu: Đen · Cỡ cán: 4" — the option map as one readable line. Cart lines
 *  carry the map; order items carry the string the RPC already built. */
export const optionSummary = (values: Record<string, string> | null | undefined): string =>
  Object.entries(values ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");

/**
 * The delivery address, as four lines a seller pastes onto a waybill.
 *
 * Its own function because the clipboard is the one place where a missing
 * newline is invisible until a parcel comes back. The note is dropped when
 * there is not one — an empty fourth line pasted into a courier form is a
 * field somebody has to notice and delete.
 */
export function addressForClipboard(o: {
  recipient_name: string;
  recipient_phone: string;
  shipping_address: string;
  delivery_note?: string | null;
}): string {
  return [o.recipient_name, o.recipient_phone, o.shipping_address, o.delivery_note?.trim() || null]
    .filter((line): line is string => !!line)
    .join("\n");
}

// ─── What is wrong with a cart line ─────────────────────────────────────────
// shop_cart_view() answers `out_of_stock` for TWO different situations: the
// variant has none left, and the variant has some left but fewer than the qty
// in the cart. The screen used to print "vừa hết hàng" for both, which is a
// lie in the second case — the buyer is looking at four in stock and being
// told there are none (round 2, secondary finding 2).
//
// The reason column is not going to gain a third value: the server is right
// that the line cannot be bought, and the count it already sends is enough to
// say WHY. So the sentence is chosen here, off `stock_on_hand` vs `qty`.

/** The one line a cart row is unbuyable for, or null when it is fine. */
export function cartLineProblem(line: {
  qty: number;
  stock_on_hand: number | null;
  unavailable_reason: string | null;
}): string | null {
  switch (line.unavailable_reason) {
    case "out_of_stock":
      // EN: Only {n} left. Lower the quantity to keep ordering.
      return line.stock_on_hand !== null && line.stock_on_hand > 0 && line.qty > line.stock_on_hand
        ? `Chỉ còn ${line.stock_on_hand} cái. Giảm số lượng để đặt tiếp.`
        : "Phiên bản này vừa hết hàng. Bỏ ra để đặt phần còn lại, hoặc chọn phiên bản khác.";
    case "variant_retired":
      return "Phiên bản này vừa ngừng bán. Bỏ khỏi giỏ để đặt phần còn lại.";
    case "product_unavailable":
      return "Shop vừa gỡ sản phẩm này. Bỏ khỏi giỏ để đặt phần còn lại.";
    // shop_inactive / ordering_disabled are group-level: the notice above the
    // group already says it, and repeating it per line says it four times.
    default:
      return null;
  }
}
