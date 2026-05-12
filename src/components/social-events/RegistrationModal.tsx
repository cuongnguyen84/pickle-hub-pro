// ============================================================================
// RegistrationModal — 3-step phone-OTP registration for a social event.
// ----------------------------------------------------------------------------
// Step 1 (phone)   → send OTP via phone-otp-send.
// Step 2 (otp)     → verify OTP + commit registration via phone-otp-verify.
// Step 3 (success) → confirmation screen with payment instructions + Zalo CTA.
//
// Magic token returned by phone-otp-verify is stored in a 90-day localStorage
// entry keyed by event_id so a returning guest sees "you're registered"
// state on subsequent visits. (Server-side validation of the token is out
// of scope for PR2 — the token currently exists for client-side recognition
// only.)
// ============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Copy } from "lucide-react";
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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import { useI18n } from "@/i18n";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  isValidVietnamPhone,
  maskPhone,
  normalizeVietnamPhone,
} from "@/lib/phone";
import { formatPriceVnd, interp } from "@/lib/social-events/format";
import { QRPaymentStep, type PaymentOrder } from "@/components/payment/QRPaymentStep";

const RESEND_COOLDOWN_SEC = 60;
const MAGIC_TOKEN_STORAGE_PREFIX = "tph-event-magic:";

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  priceVnd: number;
  zaloGroupUrl: string | null;
  /** Prefill phone from authed profile when available. */
  defaultPhone?: string | null;
  /** Prefill display name from authed profile when available. */
  defaultDisplayName?: string | null;
  /** Called when the user successfully registers (parent re-fetches counts). */
  onSuccess?: () => void;
}

type Step = "phone" | "otp" | "payment" | "success";

interface VerifyResponse {
  ok: true;
  registration_id: string;
  profile_id: string;
  magic_token: string;
  registered_at: string;
}

/**
 * Translate a server-side error code (from phone-otp-send / phone-otp-verify)
 * to a bilingual user-facing message via the i18n catalog. Falls back to a
 * generic "network error" line when the code is unknown.
 */
function translateErrorCode(
  code: string | undefined,
  t: ReturnType<typeof useI18n>["t"],
): string {
  const reg = t.socialEvents.register;
  switch (code) {
    case "invalid_phone":
      return reg.phoneInvalid;
    case "already_registered":
      return reg.alreadyRegistered;
    case "event_full":
      return reg.eventFull;
    case "event_not_published":
    case "event_not_public":
    case "event_not_found":
    case "guests_not_allowed":
    case "event_started_or_ended":
      return reg.eventNotOpen;
    case "too_many_otps":
      return reg.tooManyOtps;
    case "otp_mismatch":
      return reg.otpInvalid;
    case "otp_expired":
    case "otp_not_found":
      return reg.otpExpired;
    case "otp_too_many_attempts":
      return reg.tooManyAttempts;
    case "sms_send_failed":
      return reg.smsFailed;
    default:
      return reg.networkError;
  }
}

export function RegistrationModal({
  open,
  onOpenChange,
  eventId,
  eventSlug,
  eventTitle,
  priceVnd,
  zaloGroupUrl,
  defaultPhone,
  defaultDisplayName,
  onSuccess,
}: Props) {
  const { t, language } = useI18n();
  const reg = t.socialEvents.register;

  const [step, setStep] = useState<Step>("phone");
  const [phoneInput, setPhoneInput] = useState(defaultPhone ?? "");
  const [normalizedPhone, setNormalizedPhone] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(defaultDisplayName ?? "");
  const [selfRatedLevel, setSelfRatedLevel] = useState<string>("");
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [success, setSuccess] = useState<VerifyResponse | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<PaymentOrder | null>(null);
  // Tracks the dev_mode_code echo from phone-otp-send so we can surface
  // it inside the modal during local development (production never
  // returns this field).
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Reset state whenever the modal closes so the next open starts clean.
  useEffect(() => {
    if (!open) {
      setStep("phone");
      setOtp("");
      setSuccess(null);
      setDevOtp(null);
      setSubmitting(false);
      setResendIn(0);
      setPaymentOrder(null);
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [open]);

  // Resend cooldown ticker.
  useEffect(() => {
    if (resendIn <= 0) return;
    intervalRef.current = window.setInterval(() => {
      setResendIn((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [resendIn]);

  const phoneValid = useMemo(() => {
    const norm = normalizeVietnamPhone(phoneInput);
    return norm != null;
  }, [phoneInput]);

  async function callSendOtp(): Promise<boolean> {
    const norm = normalizeVietnamPhone(phoneInput);
    if (!norm || !isValidVietnamPhone(norm)) {
      toast({
        title: reg.phoneInvalid,
        variant: "destructive",
      });
      return false;
    }
    setSubmitting(true);
    setNormalizedPhone(norm);
    try {
      const { data, error } = await supabase.functions.invoke<{
        ok?: true;
        expires_at?: string;
        dev_mode_code?: string;
        error?: string;
        code?: string;
      }>("phone-otp-send", {
        body: { phone: norm, event_id: eventId },
      });
      // supabase.functions.invoke wraps non-2xx into `error`. We re-read
      // the response body to surface the structured `code` field.
      if (error) {
        // Try to extract the JSON body from the FunctionsHttpError.
        const ctx = (error as { context?: Response }).context;
        let bodyCode: string | undefined;
        if (ctx) {
          try {
            const txt = await ctx.text();
            const parsed = JSON.parse(txt);
            bodyCode = parsed?.code;
          } catch {
            // not JSON, fall through
          }
        }
        toast({
          title: translateErrorCode(bodyCode, t),
          variant: "destructive",
        });
        return false;
      }
      if (data?.code) {
        toast({ title: translateErrorCode(data.code, t), variant: "destructive" });
        return false;
      }
      setDevOtp(data?.dev_mode_code ?? null);
      setResendIn(RESEND_COOLDOWN_SEC);
      return true;
    } catch (e) {
      console.error("phone-otp-send failed", e);
      toast({ title: reg.networkError, variant: "destructive" });
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendOtp() {
    const trimmedName = displayName.trim();
    if (trimmedName.length < 1) {
      toast({ title: reg.nameRequired, variant: "destructive" });
      return;
    }
    const ok = await callSendOtp();
    if (ok) setStep("otp");
  }

  async function handleResendOtp() {
    if (resendIn > 0) return;
    await callSendOtp();
  }

  async function handleVerify() {
    if (!normalizedPhone) return;
    if (otp.length !== 6) return;
    setSubmitting(true);
    try {
      const levelNum = selfRatedLevel === "" ? null : Number(selfRatedLevel);
      const { data, error } = await supabase.functions.invoke<
        VerifyResponse & { error?: string; code?: string }
      >("phone-otp-verify", {
        body: {
          phone: normalizedPhone,
          event_id: eventId,
          code: otp,
          display_name: displayName.trim(),
          self_rated_level: levelNum,
        },
      });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        let bodyCode: string | undefined;
        if (ctx) {
          try {
            const txt = await ctx.text();
            const parsed = JSON.parse(txt);
            bodyCode = parsed?.code;
          } catch {
            // not JSON
          }
        }
        toast({
          title: translateErrorCode(bodyCode, t),
          variant: "destructive",
        });
        return;
      }
      if (!data || !data.ok) {
        toast({ title: reg.networkError, variant: "destructive" });
        return;
      }
      try {
        localStorage.setItem(
          `${MAGIC_TOKEN_STORAGE_PREFIX}${eventId}`,
          JSON.stringify({
            token: data.magic_token,
            registration_id: data.registration_id,
            registered_at: data.registered_at,
            // 90 days from now
            expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          }),
        );
      } catch {
        // localStorage can throw in private-mode Safari — non-fatal.
      }
      setSuccess(data);
      onSuccess?.();

      // PR49 payment branch. Free events skip straight to the success
      // step. Paid events ask the create-payment-order edge fn for an
      // order + bank config; a `payment_not_enabled` response means the
      // club hasn't onboarded payment yet and we fall back to the same
      // success step (which already shows a "pay at the venue" hint).
      if (priceVnd > 0) {
        const orderResp = await supabase.functions.invoke<{
          ok?: true;
          code?: string;
          order_id?: string;
          reference_code?: string;
          amount_vnd?: number;
          player_claimed_paid?: boolean;
          player_claimed_at?: string | null;
          bank?: { code: string; account_number: string; account_name: string };
        }>("create-payment-order", {
          body: {
            registration_id: data.registration_id,
            magic_token: data.magic_token,
          },
        });
        const payload = orderResp.data;
        if (
          orderResp.error ||
          !payload?.ok ||
          payload.code === "payment_not_enabled" ||
          !payload.order_id ||
          !payload.bank
        ) {
          // Either the club hasn't enabled payment or the call failed;
          // either way fall back to the venue-payment success message.
          setStep("success");
          return;
        }
        setPaymentOrder({
          order_id: payload.order_id,
          reference_code: payload.reference_code ?? "",
          amount_vnd: payload.amount_vnd ?? priceVnd,
          player_claimed_paid: payload.player_claimed_paid ?? false,
          player_claimed_at: payload.player_claimed_at ?? null,
          bank: payload.bank,
        });
        setStep("payment");
        return;
      }

      setStep("success");
    } catch (e) {
      console.error("phone-otp-verify failed", e);
      toast({ title: reg.networkError, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const stepHeader = (() => {
    if (step === "phone") return reg.stepPhone;
    if (step === "otp") return reg.stepCode;
    if (step === "payment") return reg.stepPayment;
    return reg.stepDone;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{reg.modalTitle}</DialogTitle>
          <DialogDescription>
            {eventTitle} — {stepHeader}
          </DialogDescription>
        </DialogHeader>

        {step === "phone" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!submitting) handleSendOtp();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="ev-phone">{reg.phoneLabel}</Label>
              <Input
                id="ev-phone"
                type="tel"
                inputMode="tel"
                placeholder={reg.phonePlaceholder}
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                autoComplete="tel"
                required
              />
              {phoneInput.length > 0 && !phoneValid && (
                <p className="text-sm text-destructive">{reg.phoneInvalid}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-name">{reg.nameLabel}</Label>
              <Input
                id="ev-name"
                type="text"
                placeholder={reg.namePlaceholder}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={80}
                autoComplete="name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-level">{reg.levelLabel}</Label>
              <select
                id="ev-level"
                value={selfRatedLevel}
                onChange={(e) => setSelfRatedLevel(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">{reg.levelOptional}</option>
                <option value="2.5">2.5</option>
                <option value="3.0">3.0</option>
                <option value="3.5">3.5</option>
                <option value="4.0">4.0</option>
                <option value="4.5">4.5</option>
                <option value="5.0">5.0+</option>
              </select>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={submitting || !phoneValid || displayName.trim().length < 1}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {reg.sendOtp}
            </Button>
          </form>
        )}

        {step === "otp" && normalizedPhone && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!submitting && otp.length === 6) handleVerify();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>{reg.otpLabel}</Label>
              <p className="text-sm text-muted-foreground">
                {interp(reg.otpHint, { phone: maskPhone(normalizedPhone) })}
              </p>
              <div className="flex justify-center pt-2">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={setOtp}
                  autoFocus
                  inputMode="numeric"
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {devOtp && (
                <p className="rounded-md border border-amber-400/50 bg-amber-50 px-3 py-2 text-center text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  Dev mode OTP: <strong>{devOtp}</strong>
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Button
                type="submit"
                className="w-full"
                disabled={submitting || otp.length !== 6}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitting ? reg.submitting : reg.submit}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled={submitting || resendIn > 0}
                onClick={handleResendOtp}
              >
                {resendIn > 0
                  ? interp(reg.otpResendIn, { seconds: resendIn })
                  : reg.otpResend}
              </Button>
            </div>
          </form>
        )}

        {step === "payment" && paymentOrder && success && (
          <QRPaymentStep
            order={paymentOrder}
            magicToken={success.magic_token}
            onClaimed={(next) => setPaymentOrder(next)}
            onSkip={() => onOpenChange(false)}
            zaloGroupUrl={zaloGroupUrl}
            onClose={() => onOpenChange(false)}
          />
        )}

        {step === "success" && success && (
          <div className="space-y-4">
            <div className="rounded-md border border-emerald-400/50 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
              <p className="font-semibold">{reg.successTitle}</p>
              <p className="mt-1">{reg.successBody}</p>
            </div>
            {priceVnd > 0 && (
              <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
                <p className="font-semibold">{reg.paymentInstructions}</p>
                <p className="mt-1 text-muted-foreground">
                  {interp(reg.successPaymentBody, {
                    price: formatPriceVnd(priceVnd, language, reg.submit),
                  })}
                </p>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {zaloGroupUrl && (
                <Button
                  asChild
                  className="w-full"
                  variant="outline"
                >
                  <a href={zaloGroupUrl} target="_blank" rel="noopener noreferrer">
                    {reg.openZalo}
                  </a>
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => onOpenChange(false)}
              >
                {reg.backToEvent}
              </Button>
            </div>
            {/* PR58 — save link card surfaces /dang-ky/<token> so the
                player can come back to cancel / view status without
                another OTP. localStorage already remembers it for 90
                days but the visible URL is the durable handle. */}
            {success.magic_token && (
              <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm">
                <p className="font-semibold">{t.socialEvents.playerRegistration.saveLinkHeading}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.socialEvents.playerRegistration.saveLinkBody}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 truncate rounded-md bg-background px-2 py-1.5 font-mono text-xs">
                    /dang-ky/{success.magic_token}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(
                        `${window.location.origin}/dang-ky/${success.magic_token}`,
                      );
                      toast({ title: t.socialEvents.playerRegistration.saveLinkCopied });
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
            <p className="text-center text-xs text-muted-foreground">
              {language === "vi"
                ? `Lưu liên kết: thepicklehub.net/su-kien/${eventSlug}`
                : `Bookmark: thepicklehub.net/su-kien/${eventSlug}`}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
