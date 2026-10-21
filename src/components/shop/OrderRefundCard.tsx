// ============================================================================
// Refund block — a PAID order that got cancelled, for both parties.
// ----------------------------------------------------------------------------
// Renders nothing unless refund_due_vnd is set, so every order page can mount
// it unconditionally. The seller sees the instruction and the button; the
// buyer sees the promise, then the receipt.
// ============================================================================

import { useState } from "react";
import { CheckCircle2, Loader2, Undo2 } from "lucide-react";
import { formatVnd } from "@/lib/shop/publicCatalog";
import { formatWhen } from "@/lib/shop/orderFormat";
import { shopReasonMessage } from "@/lib/shop/errors";

// EN: Refund · {amount} to refund · The order was cancelled after the buyer
// paid. Send it back to the account they paid from, then press the button. ·
// Refunded on {when} · Mark as refunded · Sending… · The shop will send
// {amount} back to the account you paid from. · The shop sent {amount} back on
// {when}. Check your account.
const COPY = {
  h: "Hoàn tiền",
  dueSeller: (amount: string) => `Cần hoàn ${amount}`,
  bodySeller:
    "Đơn đã huỷ sau khi người mua thanh toán. Chuyển trả về đúng tài khoản họ đã dùng, rồi bấm nút dưới.",
  doneSeller: (amount: string, when: string) => `Đã hoàn ${amount} lúc ${when}.`,
  mark: "Đã hoàn tiền",
  markBusy: "Đang ghi nhận…",
  dueBuyer: (amount: string) =>
    `Shop sẽ chuyển trả ${amount} về tài khoản anh/chị đã dùng để thanh toán.`,
  doneBuyer: (amount: string, when: string) =>
    `Shop đã chuyển trả ${amount} lúc ${when}. Kiểm tra tài khoản của anh/chị.`,
};

interface Props {
  refundDueVnd: number | null;
  refundedAt: string | null;
  side: "buyer" | "seller";
  /** Seller only. Absent for `support`, who reads and cannot press. */
  onMark?: () => Promise<unknown>;
}

export function OrderRefundCard({ refundDueVnd, refundedAt, side, onMark }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!refundDueVnd) return null;

  const amount = formatVnd(refundDueVnd);
  const when = formatWhen(refundedAt);

  const run = async () => {
    if (!onMark) return;
    setBusy(true);
    setError(null);
    try {
      await onMark();
    } catch (e) {
      setError(shopReasonMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="ord-refund" className="tl-shop-card">
      <h2 className="tl-shop-h2" id="ord-refund">{COPY.h}</h2>
      {refundedAt ? (
        <p className="tl-shop-sub" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>{side === "seller" ? COPY.doneSeller(amount, when) : COPY.doneBuyer(amount, when)}</span>
        </p>
      ) : side === "seller" ? (
        <>
          <p style={{ marginTop: 0, fontWeight: 600, color: "var(--shop-danger)" }}>
            <Undo2 size={16} aria-hidden="true" /> {COPY.dueSeller(amount)}
          </p>
          <p className="tl-shop-sub">{COPY.bodySeller}</p>
          {onMark && (
            <button
              type="button"
              className="tl-shop-btn tl-shop-btn--primary"
              disabled={busy}
              aria-busy={busy || undefined}
              onClick={() => void run()}
            >
              {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {busy ? COPY.markBusy : COPY.mark}
            </button>
          )}
          {error && (
            <p className="tl-shop-hint" role="alert" style={{ color: "var(--shop-danger)" }}>
              {error}
            </p>
          )}
        </>
      ) : (
        <p className="tl-shop-sub">{COPY.dueBuyer(amount)}</p>
      )}
    </section>
  );
}
