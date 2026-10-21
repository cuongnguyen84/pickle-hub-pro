// ============================================================================
// The money table — three rows, one rule.
// ----------------------------------------------------------------------------
// It exists so the "0 means free" rule (D3) has exactly one home. Checkout,
// the buyer's order page and the seller's order page all render this, and a
// second copy of the rule is how one of them ends up printing "0₫".
//
// Not a <table>: at 320px a table wants a horizontal scroller, and a money
// total the buyer has to scroll sideways to read is not a total.
// ============================================================================

import { formatVnd } from "@/lib/shop/publicCatalog";
import { shippingLabel } from "@/lib/shop/orderFormat";

// EN: Items ({n}) · Shipping · You pay · Order total
const COPY = {
  items: (n: number) => `Sản phẩm (${n})`,
  shipping: "Phí vận chuyển",
  totalBuyer: "Anh/chị trả",
  totalSeller: "Tổng đơn",
};

export interface OrderMoneyRowsProps {
  itemsTotalVnd: number;
  shippingFeeVnd: number;
  totalVnd: number;
  itemCount: number;
  side?: "buyer" | "seller";
}

export function OrderMoneyRows({
  itemsTotalVnd,
  shippingFeeVnd,
  totalVnd,
  itemCount,
  side = "buyer",
}: OrderMoneyRowsProps) {
  return (
    <div>
      <div className="tl-shop-row">
        <span>{COPY.items(itemCount)}</span>
        <span>{formatVnd(itemsTotalVnd)}</span>
      </div>
      <div className="tl-shop-row">
        <span>{COPY.shipping}</span>
        <span>{shippingLabel(shippingFeeVnd)}</span>
      </div>
      <div className="tl-shop-row tl-shop-row--total">
        <strong>{side === "seller" ? COPY.totalSeller : COPY.totalBuyer}</strong>
        <strong>{formatVnd(totalVnd)}</strong>
      </div>
    </div>
  );
}
