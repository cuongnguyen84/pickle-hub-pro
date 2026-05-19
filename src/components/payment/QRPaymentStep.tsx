// ============================================================================
// QRPaymentStep — second-to-last step of the RegistrationModal (PR49)
// ----------------------------------------------------------------------------
// Rendered after phone-otp-verify when the event has a non-zero price AND
// the club has a `club_payment_config` with `enabled=true`. Two visual
// states:
//
//   (1) Pre-claim (`order.player_claimed_paid === false`):
//       - Large amount
//       - Inline VietQR image (img.vietqr.io)
//       - Copyable bank account number + reference code
//       - Two CTAs: "Tôi đã chuyển tiền" (calls mark-payment-claimed)
//         and "Sẽ thanh toán tại sân" (closes the modal, leaves the
//         order in `player_claimed_paid=false`)
//
//   (2) Post-claim (`order.player_claimed_paid === true`):
//       - Green confirmation banner
//       - Reference code (copyable) so the player can show it at the
//         venue if asked
//       - Zalo group + "Về trang sự kiện" footer
//
// Does NOT close the modal on claim — parent controls modal close so it
// can keep "Open Zalo group" + back-to-event CTAs in the footer.
// ============================================================================

import { useState } from "react";
import { CheckCircle2, Copy, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateVietQRUrl } from "@/lib/payment/vietqr";
import { findBankByCode } from "@/lib/payment/banks";

export interface PaymentOrder {
  order_id: string;
  reference_code: string;
  amount_vnd: number;
  player_claimed_paid: boolean;
  player_claimed_at: string | null;
  bank: {
    code: string;
    account_number: string;
    account_name: string;
  };
}

interface Props {
  order: PaymentOrder;
  magicToken: string;
  /** Called when the player marks the order as paid — parent updates its copy. */
  onClaimed: (next: PaymentOrder) => void;
  /** Called when the player picks "Sẽ thanh toán tại sân" — parent closes the modal. */
  onSkip: () => void;
  /** Optional Zalo URL — rendered in the post-claim footer if set. */
  zaloGroupUrl: string | null;
  /** Called from the post-claim footer's "Về trang sự kiện" button. */
  onClose: () => void;
  /** PR67 — when true, prepend an amber warning banner explaining the
   *  auto-cancel timeout. The skip-button copy also shifts from
   *  "Sẽ thanh toán tại sân" to "Tôi sẽ thanh toán sau". */
  requiresPrepayment?: boolean;
  /** PR67 — hours from registered_at after which the auto-cancel cron
   *  flips the registration. Used to render the deadline label. */
  prepaymentDeadlineHours?: number;
  /** PR67 — ISO timestamp of registration. The deadline label =
   *  registeredAt + prepaymentDeadlineHours. */
  registeredAt?: string;
}

async function copyToClipboard(text: string, successMsg: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: successMsg });
  } catch {
    toast({ title: text });
  }
}

export function QRPaymentStep({
  order,
  magicToken,
  onClaimed,
  onSkip,
  zaloGroupUrl,
  onClose,
  requiresPrepayment = false,
  prepaymentDeadlineHours,
  registeredAt,
}: Props) {
  const { t, language } = useI18n();
  const pay = t.socialEvents.payment;
  const [submitting, setSubmitting] = useState(false);

  // PR67 — deadline label for the warning banner. Formats in
  // Asia/Ho_Chi_Minh so the player sees their local clock.
  const deadlineLabel = (() => {
    if (!requiresPrepayment || !prepaymentDeadlineHours) return null;
    const baseMs = registeredAt
      ? new Date(registeredAt).getTime()
      : Date.now();
    if (!Number.isFinite(baseMs)) return null;
    const deadline = new Date(baseMs + prepaymentDeadlineHours * 60 * 60 * 1000);
    return deadline.toLocaleString(language === "vi" ? "vi-VN" : "en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  })();

  const bank = findBankByCode(order.bank.code);
  const bankLabel = bank
    ? `${bank.shortName} (${bank.code})`
    : order.bank.code;

  const amountFormatted = order.amount_vnd.toLocaleString(
    language === "vi" ? "vi-VN" : "en-US",
  );

  async function handleClaim() {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke<{
        ok?: true;
        player_claimed_paid?: boolean;
        player_claimed_at?: string | null;
      }>("mark-payment-claimed", {
        body: {
          order_id: order.order_id,
          magic_token: magicToken,
        },
      });
      if (error || !data?.ok) {
        toast({ title: pay.claimError, variant: "destructive" });
        return;
      }
      onClaimed({
        ...order,
        player_claimed_paid: data.player_claimed_paid ?? true,
        player_claimed_at: data.player_claimed_at ?? new Date().toISOString(),
      });
      toast({ title: pay.claimedToast });
    } finally {
      setSubmitting(false);
    }
  }

  // ─── State 2: post-claim ────────────────────────────────────────────────
  if (order.player_claimed_paid) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-md border border-emerald-400/50 bg-emerald-50 p-3 dark:bg-emerald-950/40">
          <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="font-semibold">{pay.claimedTitle}</p>
            <p className="text-sm text-muted-foreground">{pay.claimedBody}</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">
            {pay.referenceCodeLabel}
          </label>
          <div className="flex gap-2">
            <Input
              value={order.reference_code}
              readOnly
              className="font-mono text-lg"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t.common.copyLink}
              onClick={() => copyToClipboard(order.reference_code, pay.copiedToast)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{pay.claimedHint}</p>
        </div>

        <div className="flex flex-col gap-2">
          {zaloGroupUrl && (
            <Button asChild variant="outline" className="w-full">
              <a href={zaloGroupUrl} target="_blank" rel="noopener noreferrer">
                {t.socialEvents.register.openZalo}
              </a>
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={onClose}
          >
            {t.socialEvents.register.backToEvent}
          </Button>
        </div>
      </div>
    );
  }

  // ─── State 1: awaiting transfer ─────────────────────────────────────────
  const qrUrl = generateVietQRUrl({
    bankCode: order.bank.code,
    accountNumber: order.bank.account_number,
    accountName: order.bank.account_name,
    amount: order.amount_vnd,
    memo: order.reference_code,
  });

  return (
    <div className="space-y-4">
      {/* PR67 — prepayment warning. Sits at the very top so it's the
          first thing the player sees before the QR + bank details. */}
      {requiresPrepayment && (
        <div className="flex items-start gap-2 rounded-md border border-amber-400/50 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">{pay.prepaymentWarningTitle}</p>
            <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-200">
              {pay.prepaymentWarningDescription
                .replace("{hours}", String(prepaymentDeadlineHours ?? 12))
                .replace("{deadline}", deadlineLabel ?? "—")}
            </p>
          </div>
        </div>
      )}

      <div className="text-center">
        <p className="text-sm text-muted-foreground">{pay.amountLabel}</p>
        <p className="font-mono text-3xl font-semibold">
          {amountFormatted} ₫
        </p>
      </div>

      <div className="flex justify-center">
        <img
          src={qrUrl}
          alt={pay.qrAlt}
          width={260}
          height={340}
          className="rounded-md border border-border bg-white"
          loading="lazy"
        />
      </div>

      <dl className="space-y-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">{pay.bankLabel}</dt>
          <dd className="text-right font-medium">{bankLabel}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">{pay.accountNumberLabel}</dt>
          <dd className="flex items-center gap-2">
            <span className="font-mono">{order.bank.account_number}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={t.common.copyLink}
              onClick={() => copyToClipboard(order.bank.account_number, pay.copiedToast)}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">{pay.accountNameLabel}</dt>
          <dd className="text-right font-medium">{order.bank.account_name}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">{pay.memoLabel}</dt>
          <dd className="flex items-center gap-2">
            <span className="font-mono font-semibold text-primary">
              {order.reference_code}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={t.common.copyLink}
              onClick={() => copyToClipboard(order.reference_code, pay.copiedToast)}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </dd>
        </div>
      </dl>

      <p className="rounded-md border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        ⚠️ {pay.warning}
      </p>

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          onClick={handleClaim}
          disabled={submitting}
          className="w-full"
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitting ? pay.submitting : pay.claimButton}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onSkip}
          disabled={submitting}
          className="w-full"
        >
          {/* PR67 — when prepayment is required, the "skip" button is
              semantically "I'll pay later" (auto-cancel will fire if
              they don't follow through). */}
          {requiresPrepayment ? pay.payLater : pay.skipButton}
        </Button>
      </div>
    </div>
  );
}
