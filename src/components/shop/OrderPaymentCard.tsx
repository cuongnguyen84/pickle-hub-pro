// ============================================================================
// P4b — the bank-transfer card, one component for both sides of the order.
// ----------------------------------------------------------------------------
// Two people look at the same four facts (bank, account, amount, memo) and
// each has exactly one button. Splitting that into a buyer card and a seller
// card would be two places for "0 means free" to drift apart again, and the
// buyer's half is the half that has to be right — so it is written once and
// the `side` prop chooses the button.
//
// Three states, and they are NOT the order's status. An order whose money is
// late is still `pending` (D2 survives: no awaiting_payment):
//
//   nobody has said anything  → QR + account + "Tôi đã chuyển khoản"
//   buyer claimed             → "đang chờ shop đối soát" + the QR stays, because
//                               a buyer who mis-tapped still needs the number
//   seller confirmed          → done, QR gone, nothing left to pay
//
// The QR is an <img> against img.vietqr.io. No API key, no merchant account,
// no webhook — the same helper event fees (20260512130000) and team-match fees
// (20260701120001) have used all along.
// ============================================================================

import { useState } from "react";
import { CheckCircle2, Clock, Copy, Loader2 } from "lucide-react";
import { generateVietQRUrl } from "@/lib/payment/vietqr";
import { findBankByCode } from "@/lib/payment/banks";
import { formatVnd } from "@/lib/shop/publicCatalog";
import type { OrderPaymentInfo } from "@/hooks/shop/useOrderPayment";

const COPY = {
  h: "Thanh toán chuyển khoản",
  amount: "Số tiền",
  bank: "Ngân hàng",
  account: "Số tài khoản",
  holder: "Chủ tài khoản",
  memo: "Nội dung chuyển khoản",
  memoHint:
    "Ghi ĐÚNG nội dung này khi chuyển — đây là thứ duy nhất giúp shop biết tiền của đơn nào.",
  qrAlt: "Mã QR chuyển khoản",
  qrHint: "Mở app ngân hàng, quét mã này là điền sẵn hết.",
  copied: "Đã chép",
  copy: "Chép",
  claim: "Tôi đã chuyển khoản",
  claimBusy: "Đang gửi…",
  claimed: "Anh/chị đã báo đã chuyển khoản. Shop sẽ đối soát rồi xác nhận.",
  confirm: "Xác nhận đã nhận tiền",
  confirmBusy: "Đang lưu…",
  confirmed: "Shop đã xác nhận nhận được tiền.",
  claimedSeller: "Người mua báo đã chuyển khoản. Kiểm tra tài khoản rồi xác nhận.",
  notClaimedSeller: "Người mua chưa báo đã chuyển. Nếu tiền đã về thì cứ xác nhận.",
  noBank:
    "Shop chưa điền thông tin ngân hàng. Liên hệ shop theo nút bên dưới để nhận số tài khoản.",
  noBankSeller:
    "Shop chưa điền thông tin ngân hàng, nên người mua không thấy mã QR. Điền trong Cài đặt shop.",
  error: "Không lưu được. Thử lại giúp em.",
};

export interface OrderPaymentCardProps {
  info: OrderPaymentInfo;
  side: "buyer" | "seller";
  /** Cancelled orders render nothing — there is no money left to move. */
  cancelled?: boolean;
  onMark: () => Promise<unknown>;
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="tl-shop-row">
      <span>{label}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <strong>{value}</strong>
        <button
          type="button"
          className="tl-shop-btn tl-shop-btn--ghost"
          // A copy button that silently does nothing on an insecure origin is
          // worse than no button; the value is on screen either way.
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(
              () => {
                setDone(true);
                window.setTimeout(() => setDone(false), 1500);
              },
              () => undefined,
            );
          }}
          aria-label={`${COPY.copy} ${label}`}
        >
          <Copy size={14} aria-hidden="true" />
          {done ? COPY.copied : COPY.copy}
        </button>
      </span>
    </div>
  );
}

export function OrderPaymentCard({ info, side, cancelled, onMark }: OrderPaymentCardProps) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!info.found || info.method !== "bank_transfer" || cancelled) return null;

  const confirmed = !!info.confirmed_at;
  const claimed = !!info.claimed_at;
  const bank = info.bank ?? null;
  const bankName = bank ? findBankByCode(bank.code)?.shortName ?? bank.code : null;

  const qrUrl =
    bank && !confirmed
      ? generateVietQRUrl({
          bankCode: bank.code,
          accountNumber: bank.account_number,
          accountName: bank.account_name,
          amount: info.amount_vnd ?? 0,
          memo: info.memo ?? "",
        })
      : null;

  const run = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await onMark();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="tl-shop-card" aria-labelledby="ord-pay">
      <h2 className="tl-shop-h2" id="ord-pay">{COPY.h}</h2>

      {confirmed ? (
        <p className="tl-shop-notice tl-shop-notice--info">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>{COPY.confirmed}</span>
        </p>
      ) : (
        <>
          {!bank && (
            <p className="tl-shop-hint">{side === "seller" ? COPY.noBankSeller : COPY.noBank}</p>
          )}

          {bank && (
            <>
              {qrUrl && (
                <p style={{ textAlign: "center", margin: "4px 0 8px" }}>
                  <img
                    src={qrUrl}
                    alt={COPY.qrAlt}
                    width={240}
                    height={340}
                    style={{ maxWidth: "100%", height: "auto" }}
                    loading="lazy"
                  />
                  <span className="tl-shop-hint" style={{ display: "block" }}>{COPY.qrHint}</span>
                </p>
              )}
              <div className="tl-shop-row">
                <span>{COPY.amount}</span>
                <strong>{formatVnd(info.amount_vnd ?? 0)}</strong>
              </div>
              <div className="tl-shop-row">
                <span>{COPY.bank}</span>
                <strong>{bankName}</strong>
              </div>
              <CopyRow label={COPY.account} value={bank.account_number} />
              <div className="tl-shop-row">
                <span>{COPY.holder}</span>
                <strong>{bank.account_name}</strong>
              </div>
              <CopyRow label={COPY.memo} value={info.memo ?? ""} />
              <p className="tl-shop-hint">{COPY.memoHint}</p>
            </>
          )}

          {claimed && (
            <p className="tl-shop-notice tl-shop-notice--warn">
              <Clock size={16} aria-hidden="true" />
              <span>{side === "seller" ? COPY.claimedSeller : COPY.claimed}</span>
            </p>
          )}
          {!claimed && side === "seller" && <p className="tl-shop-hint">{COPY.notClaimedSeller}</p>}

          {failed && (
            <p className="tl-shop-notice tl-shop-notice--danger" role="alert">{COPY.error}</p>
          )}

          {/* The buyer's button disappears once they have pressed it; the
              seller's stays until the money is actually confirmed. */}
          {(side === "seller" || !claimed) && (
            <div className="tl-shop-cta-row">
              <button
                type="button"
                className="tl-shop-btn tl-shop-btn--primary"
                disabled={busy}
                aria-busy={busy || undefined}
                onClick={() => void run()}
              >
                {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                {side === "seller"
                  ? busy ? COPY.confirmBusy : COPY.confirm
                  : busy ? COPY.claimBusy : COPY.claim}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
