// ============================================================================
// ProxyRegistrationModal v2 — batch "Đăng ký hộ bạn bè" (2026-05-22)
// ----------------------------------------------------------------------------
// Mounted from SocialEventDetail when an already-registered viewer clicks
// the "Đăng ký hộ bạn bè" button. Lets the viewer (anh A) register N
// friends (B1, B2, …) at once without going through OTP for each.
//
// v2 changes vs v1:
//   * Form is now multi-row — A can add/remove entries before submit.
//   * Submit loops through entries calling addRegistrationDirect for each.
//   * Success screen shows ONE aggregate VietQR with priceVnd × N total +
//     a single "Tôi đã chuyển" button that marks all N orders as paid
//     (calls mark-payment-claimed once per registration).
//   * Bank info is fetched inline from event_payment_config so the QR is
//     populated regardless of whether the parent passed bankInfo.
//
// Auth is still the proxy_magic_token (A's registration token).
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  Copy,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  addRegistrationDirect,
  type AddRegistrationDirectResult,
} from "@/lib/social-events/addRegistrationDirect";
import { generateVietQRUrl } from "@/lib/payment/vietqr";
import { findBankByCode } from "@/lib/payment/banks";

export interface BankInfoForCopy {
  code: string;
  account_number: string;
  account_name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  eventId: string;
  eventTitle: string;
  priceVnd: number;
  requiresPrepayment?: boolean;
  prepaymentDeadlineHours?: number;
  /** Optional pre-fetched bank info. When null we fetch from
   *  event_payment_config on modal open. */
  bankInfo?: BankInfoForCopy | null;
  /** Proxy registrant's magic_token, read from localStorage. */
  proxyMagicToken: string;
  /** Parent callback to refetch the roster after each successful add. */
  onSuccess?: () => void;
}

interface EntryDraft {
  /** Stable client id for React keys. */
  id: string;
  name: string;
  level: string;
}

function makeEntry(): EntryDraft {
  return {
    id: Math.random().toString(36).slice(2, 10),
    name: "",
    level: "",
  };
}

function translateErrorCode(code: string, t: ReturnType<typeof useI18n>["t"]): string {
  const proxy = t.socialEvents.proxyRegister;
  const reg = t.socialEvents.register;
  switch (code) {
    case "invalid_phone":
      return reg.phoneInvalid;
    case "already_registered":
      return proxy.errorAlreadyRegistered;
    case "event_full":
      return proxy.errorEventFull;
    case "rate_limit_exceeded":
      return proxy.errorRateLimitProxy;
    case "unauthorized":
      return proxy.errorUnauthorized;
    case "event_not_published":
    case "event_not_public":
    case "event_not_found":
    case "event_cancelled":
    case "event_completed":
    case "event_started_or_ended":
    case "guests_not_allowed":
      return reg.eventNotOpen;
    default:
      return reg.networkError;
  }
}

async function copyToClipboard(text: string, successMsg: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: successMsg });
  } catch {
    toast({ title: text });
  }
}

export function ProxyRegistrationModal({
  open,
  onOpenChange,
  eventId,
  eventTitle,
  priceVnd,
  requiresPrepayment = false,
  prepaymentDeadlineHours,
  bankInfo: bankInfoProp,
  proxyMagicToken,
  onSuccess,
}: Props) {
  const { t, language } = useI18n();
  const proxy = t.socialEvents.proxyRegister;
  const pay = t.socialEvents.payment;

  const [entries, setEntries] = useState<EntryDraft[]>([makeEntry()]);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<AddRegistrationDirectResult[]>([]);
  const [batchClaimed, setBatchClaimed] = useState(false);
  const [batchClaiming, setBatchClaiming] = useState(false);
  const [batchSkipped, setBatchSkipped] = useState(false);
  const [resolvedBank, setResolvedBank] = useState<BankInfoForCopy | null>(
    bankInfoProp ?? null,
  );

  // Fetch bank info from event_payment_config when the modal opens and
  // the parent didn't pre-fetch it. The proxy_magic_token caller is
  // anonymous against PostgREST so this relies on the public SELECT
  // policy that allows reading bank info for published+public events.
  useEffect(() => {
    if (!open) return;
    if (resolvedBank || bankInfoProp) {
      if (bankInfoProp && !resolvedBank) setResolvedBank(bankInfoProp);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("event_payment_config")
        .select("bank_code, bank_account_number, bank_account_name, enabled")
        .eq("event_id", eventId)
        .eq("enabled", true)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setResolvedBank({
          code: (data as { bank_code: string }).bank_code,
          account_number: (data as { bank_account_number: string }).bank_account_number,
          account_name: (data as { bank_account_name: string }).bank_account_name,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, eventId, bankInfoProp, resolvedBank]);

  // Reset state on close.
  useEffect(() => {
    if (!open) {
      setEntries([makeEntry()]);
      setSubmitting(false);
      setResults([]);
      setBatchClaimed(false);
      setBatchClaiming(false);
      setBatchSkipped(false);
    }
  }, [open]);

  function patchEntry(id: string, patch: Partial<EntryDraft>) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
  }

  function removeEntry(id: string) {
    setEntries((prev) => (prev.length <= 1 ? prev : prev.filter((e) => e.id !== id)));
  }

  function addEntry() {
    setEntries((prev) => [...prev, makeEntry()]);
  }

  const validEntries = useMemo(
    () => entries.filter((e) => e.name.trim().length > 0),
    [entries],
  );

  async function handleSubmit() {
    if (validEntries.length === 0) {
      toast({
        title: t.socialEvents.register.nameRequired,
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    const collected: AddRegistrationDirectResult[] = [];
    try {
      // Sequential calls — keeps the rate-limit logic on the edge
      // function happy (one transfer per request rather than a burst).
      for (const entry of validEntries) {
        const levelNum = entry.level === "" ? null : Number(entry.level);
        try {
          const data = await addRegistrationDirect({
            eventId,
            guestName: entry.name.trim(),
            guestSelfRating: Number.isFinite(levelNum as number)
              ? (levelNum as number)
              : null,
            mode: "proxy",
            proxyMagicToken,
          });
          collected.push(data);
        } catch (e) {
          // Surface the first failing row but keep already-collected
          // ones so the caller doesn't lose successful registrations.
          const code = e instanceof Error ? e.message : "network_error";
          toast({
            title: `${entry.name.trim()}: ${translateErrorCode(code, t)}`,
            variant: "destructive",
          });
          break;
        }
      }
      if (collected.length > 0) {
        setResults(collected);
        onSuccess?.();
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Aggregate VietQR URL — total = priceVnd × number of registrations.
  // Memo carries the FIRST reference code plus a suffix indicating the
  // batch size so the organizer can search by it. Vietnamese banking
  // apps strip diacritics from the memo anyway.
  const totalAmount = priceVnd * results.length;
  const aggregateMemo = useMemo(() => {
    if (results.length === 0) return "";
    const first = results[0]?.reference_code ?? "";
    if (results.length === 1) return first;
    return `${first} BATCH ${results.length}`;
  }, [results]);

  const qrUrl = useMemo(() => {
    if (results.length === 0 || !resolvedBank || priceVnd <= 0) return null;
    return generateVietQRUrl({
      bankCode: resolvedBank.code,
      accountNumber: resolvedBank.account_number,
      accountName: resolvedBank.account_name,
      amount: totalAmount,
      memo: aggregateMemo,
      template: "compact2",
    });
  }, [results, resolvedBank, priceVnd, totalAmount, aggregateMemo]);

  const bankLabel = useMemo(() => {
    if (!resolvedBank) return null;
    const found = findBankByCode(resolvedBank.code);
    return found ? `${found.shortName} (${resolvedBank.code})` : resolvedBank.code;
  }, [resolvedBank]);

  async function markBatchClaimed() {
    if (results.length === 0) return;
    setBatchClaiming(true);
    let okCount = 0;
    try {
      // Loop through every order, calling mark-payment-claimed in
      // parallel. Each call needs its own magic_token + order_id.
      const toMark = results.filter((r) => r.payment_order_id && r.magic_token);
      const calls = toMark.map((r) =>
        supabase.functions
          .invoke<{ ok?: true; code?: string }>("mark-payment-claimed", {
            body: {
              order_id: r.payment_order_id!,
              magic_token: r.magic_token,
            },
          })
          .then((resp) => {
            if (!resp.error && resp.data?.ok) okCount += 1;
            return resp;
          }),
      );
      await Promise.all(calls);
      if (okCount === toMark.length && okCount > 0) {
        setBatchClaimed(true);
        toast({ title: pay.claimedToast });
        onSuccess?.();
      } else {
        toast({ title: pay.claimError, variant: "destructive" });
      }
    } finally {
      setBatchClaiming(false);
    }
  }

  function copyBankInfo() {
    if (!resolvedBank || !aggregateMemo || !bankLabel) return;
    const lines = [
      `${pay.bankLabel}: ${bankLabel}`,
      `${pay.accountNumberLabel}: ${resolvedBank.account_number}`,
      `${pay.accountNameLabel}: ${resolvedBank.account_name}`,
      `${pay.amountLabel}: ${totalAmount.toLocaleString("vi-VN")}₫`,
      `${pay.memoLabel}: ${aggregateMemo}`,
    ];
    copyToClipboard(lines.join("\n"), pay.copiedToast);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle>{proxy.modalHeading}</DialogTitle>
          <DialogDescription>
            {eventTitle} — {proxy.modalSubheading}
          </DialogDescription>
        </DialogHeader>

        {results.length > 0 ? (
          /* ───── SUCCESS / BATCH SHARE + AGGREGATE QR ───── */
          <div className="space-y-4">
            <div className="rounded-md border-2 border-emerald-400/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
              <p className="font-semibold">
                {"✅ "}
                {language === "vi"
                  ? `Đã thêm ${results.length} người vào sự kiện`
                  : `Added ${results.length} player${results.length > 1 ? "s" : ""} to the event`}
              </p>
              {priceVnd > 0 && !batchClaimed && !batchSkipped && (
                <p className="mt-1 text-xs">
                  {language === "vi"
                    ? `Tổng số tiền cần chuyển: ${totalAmount.toLocaleString("vi-VN")}₫ (${priceVnd.toLocaleString("vi-VN")}₫ × ${results.length})`
                    : `Total to transfer: ${totalAmount.toLocaleString("en-US")}₫ (${priceVnd.toLocaleString("en-US")}₫ × ${results.length})`}
                </p>
              )}
            </div>

            {/* Per-registration share rows */}
            <div className="space-y-2">
              {results.map((r, idx) => {
                const url = `${window.location.origin}/dang-ky/${r.magic_token}`;
                return (
                  <div
                    key={r.registration_id}
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="font-medium">
                        {idx + 1}. {r.guest_name}
                      </div>
                      {r.reference_code && (
                        <code className="font-mono text-xs text-primary">
                          {r.reference_code}
                        </code>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <code className="flex-1 break-all rounded bg-muted px-2 py-1 font-mono text-xs">
                        {url}
                      </code>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => copyToClipboard(url, proxy.copyLinkSuccess)}
                        aria-label={proxy.copyLinkLabel}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        asChild
                        type="button"
                        size="icon"
                        variant="outline"
                        aria-label={proxy.copyLinkLabel}
                      >
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Aggregate QR + batch claim CTAs — only when there's an
                actual price and bank info to render against. */}
            {priceVnd > 0 && qrUrl && resolvedBank && !batchClaimed && !batchSkipped && (
              <div className="rounded-md border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="text-center">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {pay.amountLabel}
                  </p>
                  <p className="text-2xl font-bold">
                    {totalAmount.toLocaleString(language === "vi" ? "vi-VN" : "en-US")}₫
                  </p>
                </div>
                <div className="flex justify-center">
                  <img
                    src={qrUrl}
                    alt={pay.qrAlt}
                    style={{ maxWidth: 240, width: "100%", height: "auto" }}
                  />
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{pay.bankLabel}</span>
                    <span className="font-medium">{bankLabel}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{pay.accountNumberLabel}</span>
                    <span className="font-mono">{resolvedBank.account_number}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{pay.accountNameLabel}</span>
                    <span className="font-medium">{resolvedBank.account_name}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{pay.memoLabel}</span>
                    <code className="font-mono text-primary">{aggregateMemo}</code>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={copyBankInfo}
                >
                  <Copy className="h-3.5 w-3.5" /> {proxy.copyPaymentInfoLabel}
                </Button>
                <p className="text-xs text-muted-foreground">{pay.warning}</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setBatchSkipped(true)}
                    disabled={batchClaiming}
                  >
                    {requiresPrepayment ? pay.payLater : pay.skipButton}
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    onClick={markBatchClaimed}
                    disabled={batchClaiming}
                  >
                    {batchClaiming && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {batchClaiming ? pay.submitting : pay.claimButton}
                  </Button>
                </div>
              </div>
            )}

            {/* Post-claim banner */}
            {batchClaimed && (
              <div className="rounded-md border-2 border-emerald-400/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                <p className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4" /> {pay.claimedTitle}
                </p>
                <p className="mt-1">{pay.claimedBody}</p>
              </div>
            )}

            {/* Skipped-prepayment banner */}
            {batchSkipped && requiresPrepayment && (
              <div className="rounded-md border-2 border-amber-400/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                <p>
                  {"⚠️ "}
                  {language === "vi"
                    ? `Slot sẽ tự động bị huỷ nếu không chuyển khoản trong ${prepaymentDeadlineHours ?? 12} giờ.`
                    : `Slots will be auto-cancelled if not paid within ${prepaymentDeadlineHours ?? 12} hours.`}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row pt-1 border-t border-border">
              <Button
                type="button"
                className="flex-1"
                onClick={() => {
                  setEntries([makeEntry()]);
                  setResults([]);
                  setBatchClaimed(false);
                  setBatchSkipped(false);
                }}
              >
                <Plus className="h-4 w-4" /> {proxy.addAnotherCta}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                {proxy.closeCta}
              </Button>
            </div>
          </div>
        ) : (
          /* ───── FORM / MULTI-ENTRY ───── */
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!submitting) handleSubmit();
            }}
            className="space-y-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {proxy.guestSectionHeading}
            </p>

            <div className="space-y-3">
              {entries.map((entry, idx) => (
                <div
                  key={entry.id}
                  className="rounded-md border border-border bg-muted/20 p-3 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono uppercase tracking-wide text-muted-foreground">
                      {language === "vi" ? `Người ${idx + 1}` : `Player ${idx + 1}`}
                    </span>
                    {entries.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEntry(entry.id)}
                        className="rounded-md p-1 text-muted-foreground hover:text-destructive"
                        aria-label={language === "vi" ? "Xoá người" : "Remove player"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`proxy-name-${entry.id}`}>
                      {proxy.guestNameLabel} *
                    </Label>
                    <Input
                      id={`proxy-name-${entry.id}`}
                      type="text"
                      placeholder={t.socialEvents.register.namePlaceholder}
                      value={entry.name}
                      onChange={(e) => patchEntry(entry.id, { name: e.target.value })}
                      maxLength={80}
                      autoFocus={idx === 0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`proxy-level-${entry.id}`}>
                      {proxy.guestLevelLabel}
                    </Label>
                    <select
                      id={`proxy-level-${entry.id}`}
                      value={entry.level}
                      onChange={(e) =>
                        patchEntry(entry.id, { level: e.target.value })
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">{t.socialEvents.register.levelOptional}</option>
                      <option value="2.5">2.5</option>
                      <option value="3.0">3.0</option>
                      <option value="3.5">3.5</option>
                      <option value="4.0">4.0</option>
                      <option value="4.5">4.5</option>
                      <option value="5.0">5.0+</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={addEntry}
            >
              <Plus className="h-4 w-4" />{" "}
              {language === "vi" ? "+ Thêm người" : "+ Add player"}
            </Button>

            {priceVnd > 0 && (
              <div className="rounded-md border-2 border-amber-400/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                <p>⚠️ {proxy.paymentWarningProxy}</p>
                {validEntries.length > 0 && (
                  <p className="mt-1 text-xs">
                    {language === "vi"
                      ? `Tổng: ${(priceVnd * validEntries.length).toLocaleString("vi-VN")}₫ (${priceVnd.toLocaleString("vi-VN")}₫ × ${validEntries.length})`
                      : `Total: ${(priceVnd * validEntries.length).toLocaleString("en-US")}₫ (${priceVnd.toLocaleString("en-US")}₫ × ${validEntries.length})`}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={submitting}
                onClick={() => onOpenChange(false)}
              >
                {t.common.cancel}
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={submitting || validEntries.length === 0}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {proxy.proxyConfirmCta}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
