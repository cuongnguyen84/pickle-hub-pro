// ============================================================================
// RegistrationSuccessShare — shared success card after proxy/manual add
// ----------------------------------------------------------------------------
// Renders the post-add panel for both ProxyRegistrationModal and
// ManualAddRegistrationModal. Shows:
//
//   1. Heading "Đã thêm <name> vào sự kiện"
//   2. Optional warning card (only when player still needs to receive the
//      link or finish payment) telling the caller to forward the link.
//   3. The save-link card with the player's /dang-ky/<token> URL + copy +
//      Zalo + Facebook share buttons.
//   4. Optional payment block with reference_code + bank info copy CTA.
//   5. Footer: "+ Thêm người khác" (resets the form) + "Đóng".
//
// All copy comes through i18n.
// ============================================================================

import { Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { toast } from "@/hooks/use-toast";
import { findBankByCode } from "@/lib/payment/banks";
import type { AddRegistrationDirectResult } from "@/lib/social-events/addRegistrationDirect";

/** Bank info we can lazily fetch + show. Optional — when not provided the
 *  card hides the bank-info copy button. */
export interface BankInfoForCopy {
  code: string;
  account_number: string;
  account_name: string;
}

interface Props {
  result: AddRegistrationDirectResult;
  /** Proxy mode shows the "ask the player to pay themselves" warning by
   *  default. Manual mode suppresses it when the organizer set
   *  payment_status=claimed_paid or waived. */
  showPaymentWarning: boolean;
  /** Bank info to assemble the copyable transfer text. Optional — when
   *  null we just show the reference_code without the copy button. */
  bankInfo?: BankInfoForCopy | null;
  /** Price in VND — only used to build the copy-bank-info text. */
  priceVnd: number;
  /** Reset the form to add another player. */
  onAddAnother: () => void;
  /** Close the modal. */
  onClose: () => void;
}

export function RegistrationSuccessShare({
  result,
  showPaymentWarning,
  bankInfo,
  priceVnd,
  onAddAnother,
  onClose,
}: Props) {
  const { t, language } = useI18n();
  const proxy = t.socialEvents.proxyRegister;
  const common = t.common;

  const recoveryUrl = result.recovery_url;
  const eventName = result.event_name;
  const guestName = result.guest_name;
  const referenceCode = result.reference_code;

  // Message body for Zalo / Facebook deep-links + clipboard copy.
  const shareMessage = language === "vi"
    ? `Mình đã đăng ký giúp bạn tham gia ${eventName}. Link quản lý: ${recoveryUrl}${referenceCode ? `. Mã thanh toán: ${referenceCode}` : ""}`
    : `I registered you for ${eventName}. Manage link: ${recoveryUrl}${referenceCode ? `. Payment code: ${referenceCode}` : ""}`;

  const zaloShareUrl = `https://zalo.me/share/link?url=${encodeURIComponent(recoveryUrl)}&message=${encodeURIComponent(shareMessage)}`;
  const fbShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(recoveryUrl)}&quote=${encodeURIComponent(shareMessage)}`;

  const copyLink = () => {
    void navigator.clipboard.writeText(recoveryUrl);
    toast({ title: proxy.copyLinkSuccess });
  };

  const bankDisplayName = bankInfo ? (
    findBankByCode(bankInfo.code)?.shortName ?? bankInfo.code
  ) : null;

  const copyPaymentInfo = () => {
    if (!referenceCode || !bankInfo) return;
    const bankLabel = bankDisplayName ? `${bankDisplayName} (${bankInfo.code})` : bankInfo.code;
    const text = language === "vi"
      ? `Chuyển khoản:\nNgân hàng: ${bankLabel}\nSố TK: ${bankInfo.account_number}\nChủ TK: ${bankInfo.account_name}\nSố tiền: ${priceVnd.toLocaleString("vi-VN")}₫\nNội dung CK: ${referenceCode}`
      : `Bank transfer:\nBank: ${bankLabel}\nAccount: ${bankInfo.account_number}\nName: ${bankInfo.account_name}\nAmount: ${priceVnd.toLocaleString("en-US")} VND\nMemo: ${referenceCode}`;
    void navigator.clipboard.writeText(text);
    toast({ title: proxy.copyPaymentInfoSuccess });
  };

  return (
    <div className="space-y-4">
      {/* 1. Top heading */}
      <div className="rounded-md border border-emerald-400/50 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
        <p className="font-semibold">
          ✅{" "}
          {proxy.successHeading.replace("{name}", guestName)}
        </p>
      </div>

      {/* 2. Warning — please forward the link */}
      {showPaymentWarning && (
        <div className="rounded-md border-2 border-amber-400/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <p>
            ⚠️ {proxy.shareWarning.replace("{name}", guestName)}
          </p>
        </div>
      )}

      {/* 3. Save-link card */}
      <div className="rounded-md border-2 border-primary/40 bg-primary/5 px-4 py-3 text-sm">
        <p className="font-semibold">
          {proxy.shareLinkHeading.replace("{name}", guestName)}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 break-all rounded-md bg-background px-2 py-1.5 font-mono text-xs">
            {recoveryUrl}
          </code>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 min-w-[120px]"
            onClick={copyLink}
          >
            <Copy className="mr-1 h-3.5 w-3.5" /> {proxy.copyLinkLabel}
          </Button>
          <Button asChild type="button" variant="outline" size="sm" className="flex-1 min-w-[120px]">
            <a
              href={zaloShareUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span
                aria-hidden="true"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  background: "#0068ff",
                  color: "white",
                  fontWeight: 700,
                  fontSize: 9,
                  marginRight: 4,
                }}
              >
                Z
              </span>
              {proxy.shareZaloLabel}
            </a>
          </Button>
          <Button asChild type="button" variant="outline" size="sm" className="flex-1 min-w-[120px]">
            <a
              href={fbShareUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-1 h-3.5 w-3.5" /> {proxy.shareFacebookLabel}
            </a>
          </Button>
        </div>
      </div>

      {/* 4. Payment block (paid event) */}
      {referenceCode && priceVnd > 0 && (
        <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t.socialEvents.payment.referenceCodeLabel}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 break-all rounded-md bg-background px-3 py-2 font-mono text-lg font-semibold text-primary">
              {referenceCode}
            </code>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={common.copyLink}
              onClick={() => {
                void navigator.clipboard.writeText(referenceCode);
                toast({ title: t.socialEvents.payment.copiedToast });
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          {bankInfo && (
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <p>
                {language === "vi" ? "Ngân hàng" : "Bank"}: <span className="font-medium text-foreground">{bankDisplayName ?? bankInfo.code}</span>
              </p>
              <p>
                {language === "vi" ? "Số TK" : "Account"}: <span className="font-medium text-foreground">{bankInfo.account_number}</span>
              </p>
              <p>
                {language === "vi" ? "Chủ TK" : "Holder"}: <span className="font-medium text-foreground">{bankInfo.account_name}</span>
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={copyPaymentInfo}
              >
                <Copy className="mr-1 h-3.5 w-3.5" />
                {proxy.copyPaymentInfoLabel}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 5. Footer */}
      <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row">
        <Button
          type="button"
          className="flex-1"
          onClick={onAddAnother}
        >
          {proxy.addAnotherCta}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="flex-1"
          onClick={onClose}
        >
          {common.close}
        </Button>
      </div>
    </div>
  );
}
