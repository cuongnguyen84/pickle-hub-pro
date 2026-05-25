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
import { Loader2, Copy, ExternalLink } from "lucide-react";
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
import { FollowOaBanner } from "@/components/social-events/FollowOaBanner";
import { TurnstileWidget } from "@/components/registration/TurnstileWidget";
import { useI18n } from "@/i18n";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  isValidVietnamPhone,
  maskPhone,
  normalizeVietnamPhone,
} from "@/lib/phone";
import { formatPriceVnd, interp } from "@/lib/social-events/format";
import { QRPaymentStep, type PaymentOrder } from "@/components/payment/QRPaymentStep";
import { saveMyRegistration } from "@/lib/social-events/myRegistration";
import type { SocialEventSlot } from "@/hooks/useSocialEvent";

const RESEND_COOLDOWN_SEC = 60;

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  priceVnd: number;
  /** PR67 — when true + priceVnd > 0, the QR step renders an amber
   *  prepayment warning and the skip button says "I'll pay later". */
  requiresPrepayment?: boolean;
  prepaymentDeadlineHours?: number;
  zaloGroupUrl: string | null;
  /**
   * Registration slots configured by the organizer. Empty array → no
   * slot picker (legacy gate on max_players only). Non-empty → player
   * MUST pick a slot before sending the OTP.
   */
  slots?: SocialEventSlot[];
  /** Prefill phone from authed profile when available. */
  defaultPhone?: string | null;
  /** Prefill display name from authed profile when available. */
  defaultDisplayName?: string | null;
  /**
   * 2026-05-22 — club membership skip-OTP path. When TRUE, the modal
   * opens straight into the slot picker (if any) + a single confirm
   * button, then calls the `register_event_as_member` RPC instead of
   * sending an OTP. Payment + slot logic are unchanged downstream.
   */
  memberSkipOtp?: boolean;
  /** Called when the user successfully registers (parent re-fetches counts). */
  onSuccess?: () => void;
}

type Step = "phone" | "otp" | "member" | "payment" | "success";

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
    case "slot_required":
      return reg.slotRequired;
    case "slot_not_found":
      return reg.slotInvalid;
    case "slot_full":
      return reg.slotFull;
    case "not_a_member":
      return reg.notAMember;
    case "event_not_published":
    case "event_not_public":
    case "event_not_found":
    case "guests_not_allowed":
    case "event_started_or_ended":
      return reg.eventNotOpen;
    case "too_many_otps_ip":
      return reg.errCaptchaIp;
    case "captcha_failed":
    case "captcha_misconfigured":
      return reg.errCaptcha;
    case "daily_budget_exceeded":
      return reg.errBudget;
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
  requiresPrepayment = false,
  prepaymentDeadlineHours,
  zaloGroupUrl,
  slots,
  defaultPhone,
  defaultDisplayName,
  memberSkipOtp = false,
  onSuccess,
}: Props) {
  const { t, language } = useI18n();
  const reg = t.socialEvents.register;
  const slotList = useMemo<SocialEventSlot[]>(
    () => (Array.isArray(slots) ? slots : []),
    [slots],
  );
  const hasSlots = slotList.length > 0;

  const [step, setStep] = useState<Step>(memberSkipOtp ? "member" : "phone");
  const [phoneInput, setPhoneInput] = useState(defaultPhone ?? "");
  const [normalizedPhone, setNormalizedPhone] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(defaultDisplayName ?? "");
  const [selfRatedLevel, setSelfRatedLevel] = useState<string>("");
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [otp, setOtp] = useState("");

  // Per-slot active registration counts. Used to grey out + disable a
  // slot that's already at capacity, and to render "X/Y chỗ còn lại"
  // under each radio. Re-fetches whenever the modal opens so the player
  // sees up-to-date numbers (someone else may have grabbed the slot
  // between page-load and clicking Register).
  const { data: slotCounts } = useQuery<Record<string, number>>({
    queryKey: ["event-slot-counts", eventId, open],
    queryFn: async () => {
      if (!hasSlots) return {};
      const { data, error } = await supabase.rpc("get_event_slot_counts", {
        p_event_id: eventId,
      });
      if (error) {
        console.error("get_event_slot_counts failed", error);
        return {};
      }
      const map: Record<string, number> = {};
      for (const row of (data ?? []) as Array<{
        slot_id: string;
        registered_count: number;
      }>) {
        if (row?.slot_id) map[row.slot_id] = row.registered_count ?? 0;
      }
      return map;
    },
    enabled: hasSlots && open,
    staleTime: 15_000,
  });
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [success, setSuccess] = useState<VerifyResponse | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<PaymentOrder | null>(null);
  // Tracks the dev_mode_code echo from phone-otp-send so we can surface
  // it inside the modal during local development (production never
  // returns this field).
  const [devOtp, setDevOtp] = useState<string | null>(null);
  // PR59 — optional recovery-channel collection in the success state.
  const [contactEmail, setContactEmail] = useState("");
  const [contactSaving, setContactSaving] = useState(false);
  const [contactSaved, setContactSaved] = useState(false);
  // PR61 — channel the last OTP was delivered through ('zalo' | 'sms' |
  // 'dev'). Surfaces in the OTP-waiting hint + lets the user force the
  // SMS fallback when Zalo doesn't reach them.
  const [otpChannel, setOtpChannel] = useState<"zalo" | "sms" | "dev" | null>(null);
  // PR69 — Cloudflare Turnstile token. Required by phone-otp-send in
  // production. Reset when the user goes back to the phone step or
  // changes their phone, so a stale token can't be replayed.
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Reset state whenever the modal closes so the next open starts clean.
  useEffect(() => {
    if (!open) {
      setStep(memberSkipOtp ? "member" : "phone");
      setOtp("");
      setSuccess(null);
      setDevOtp(null);
      setSubmitting(false);
      setResendIn(0);
      setPaymentOrder(null);
      setContactEmail("");
      setContactSaving(false);
      setContactSaved(false);
      setOtpChannel(null);
      setTurnstileToken(null);
      setSelectedSlotId("");
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [open, memberSkipOtp]);

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

  async function callSendOtp(opts?: { forceChannel?: "sms" | "zalo" }): Promise<boolean> {
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
        channel?: "zalo" | "sms" | "dev";
        error?: string;
        code?: string;
      }>("phone-otp-send", {
        body: {
          phone: norm,
          event_id: eventId,
          ...(opts?.forceChannel ? { force_channel: opts.forceChannel } : {}),
          // PR69 — Cloudflare Turnstile token. Server rejects with
          // 'captcha_failed' when missing/invalid in production.
          turnstile_token: turnstileToken ?? undefined,
        },
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
      setOtpChannel(data?.channel ?? null);
      setResendIn(RESEND_COOLDOWN_SEC);
      // PR69 — Turnstile tokens are single-use. Force a re-challenge
      // so a subsequent "resend OTP" click gets a fresh token.
      setTurnstileToken(null);
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
    // When the organizer configured slots, the player MUST pick one.
    // Otherwise phone-otp-verify would fall back to the legacy
    // max_players cap and ignore the per-slot bucketing the organizer
    // set up. Capacity full → block here so the player can pick another
    // slot before paying for an OTP.
    if (hasSlots) {
      if (!selectedSlotId) {
        toast({ title: reg.slotRequired, variant: "destructive" });
        return;
      }
      const slot = slotList.find((s) => s.id === selectedSlotId);
      if (!slot) {
        toast({ title: reg.slotInvalid, variant: "destructive" });
        return;
      }
      const taken = slotCounts?.[slot.id] ?? 0;
      if (taken >= slot.capacity) {
        toast({ title: reg.slotFull, variant: "destructive" });
        return;
      }
    }
    const ok = await callSendOtp();
    if (ok) setStep("otp");
  }

  async function handleResendOtp(opts?: { forceChannel?: "sms" | "zalo" }) {
    if (resendIn > 0) return;
    await callSendOtp(opts);
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
          // Only forward when set — older events without slots stay
          // backwards compatible (server treats missing/empty as "no
          // slot" and falls back to max_players gate).
          slot_id: hasSlots && selectedSlotId ? selectedSlotId : undefined,
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
      saveMyRegistration(eventId, {
        magic_token: data.magic_token,
        registration_id: data.registration_id,
        display_name: displayName.trim() || null,
        registered_at: data.registered_at,
      });
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
        // Now that we have the reference_code, fold it into the stored
        // registration so the "Save link" card + /dang-ky/:token page
        // can echo it back without another fetch.
        saveMyRegistration(eventId, {
          magic_token: data.magic_token,
          registration_id: data.registration_id,
          reference_code: payload.reference_code ?? null,
          display_name: displayName.trim() || null,
          registered_at: data.registered_at,
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

  /**
   * Member-path registration (skip OTP). Called from the "member" step
   * when the viewer is an active club member or an organizer of the
   * event's club. Hits the register_event_as_member RPC which validates
   * membership + capacity + slot server-side. Payment + success branch
   * are identical to handleVerify so QRPaymentStep + the save-link card
   * keep working without changes.
   */
  async function handleMemberRegister() {
    if (hasSlots && !selectedSlotId) {
      toast({ title: reg.slotRequired, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data: rows, error } = await supabase.rpc(
        "register_event_as_member",
        {
          p_event_id: eventId,
          p_slot_id: hasSlots && selectedSlotId ? selectedSlotId : null,
        },
      );
      if (error) {
        const code = (error as { message?: string }).message ?? "";
        const known = code.match(/^[a-z_]+$/i) ? code : "";
        toast({
          title: translateErrorCode(known, t),
          variant: "destructive",
        });
        return;
      }
      const row =
        Array.isArray(rows) && rows.length > 0
          ? (rows[0] as {
              registration_id: string;
              profile_id: string;
              magic_token: string;
              registered_at: string;
            })
          : null;
      if (!row) {
        toast({ title: reg.networkError, variant: "destructive" });
        return;
      }
      const stored: VerifyResponse = {
        ok: true,
        registration_id: row.registration_id,
        profile_id: row.profile_id,
        magic_token: row.magic_token,
        registered_at: row.registered_at,
      };
      saveMyRegistration(eventId, {
        magic_token: stored.magic_token,
        registration_id: stored.registration_id,
        display_name: defaultDisplayName ?? null,
        registered_at: stored.registered_at,
      });
      setSuccess(stored);
      onSuccess?.();

      // Payment branch — same as OTP path. Free events go straight to
      // the success screen. Paid events ask create-payment-order for
      // an order + bank config; payment_not_enabled fallback shows the
      // pay-at-venue success message.
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
            registration_id: stored.registration_id,
            magic_token: stored.magic_token,
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
        saveMyRegistration(eventId, {
          magic_token: stored.magic_token,
          registration_id: stored.registration_id,
          reference_code: payload.reference_code ?? null,
          display_name: defaultDisplayName ?? null,
          registered_at: stored.registered_at,
        });
        setStep("payment");
        return;
      }

      setStep("success");
    } catch (e) {
      console.error("register_event_as_member failed", e);
      toast({ title: reg.networkError, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const stepHeader = (() => {
    if (step === "phone") return reg.stepPhone;
    if (step === "otp") return reg.stepCode;
    if (step === "member") return reg.stepMember;
    if (step === "payment") return reg.stepPayment;
    return reg.stepDone;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* PR62 polish — success state now stacks 4 cards (reference
          code + save-link + recovery + footer). On md+ widen the
          modal so the URL + memo display don't fight the column
          width. Mobile (sm:max-w-md ≈ 448px) is unchanged. */}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle>{reg.modalTitle}</DialogTitle>
          <DialogDescription>
            {eventTitle} — {stepHeader}
          </DialogDescription>
        </DialogHeader>

        {step === "member" && (
          /* Member skip-OTP path. Shown when the viewer is an active
             club member (or organizer) registering for one of their
             club's events. The flow collapses 3 steps (phone → OTP →
             ...) into a single confirm — slot pick (if any) + button. */
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!submitting) handleMemberRegister();
            }}
            className="space-y-4"
          >
            <div className="rounded-md border border-emerald-400/50 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
              {reg.memberHint}
            </div>

            {hasSlots && (
              <div className="space-y-2">
                <Label>{reg.slotPickerLabel} *</Label>
                <p className="text-xs text-muted-foreground">{reg.slotPickerHint}</p>
                <div className="space-y-1.5">
                  {slotList.map((slot) => {
                    const taken = slotCounts?.[slot.id] ?? 0;
                    const remaining = Math.max(0, slot.capacity - taken);
                    const full = remaining === 0;
                    const checked = selectedSlotId === slot.id;
                    const meta: string[] = [];
                    if (slot.kind === "skill" && slot.skill_level) {
                      meta.push(`${reg.slotMetaSkill}: ${slot.skill_level}`);
                    }
                    if (slot.kind === "duration" && slot.min_play_months != null) {
                      meta.push(
                        slot.min_play_months === 0
                          ? reg.slotMetaDurationNewbie
                          : interp(reg.slotMetaDurationMonths, { n: slot.min_play_months }),
                      );
                    }
                    if (slot.court_count) {
                      meta.push(interp(reg.slotMetaCourts, { n: slot.court_count }));
                    }
                    return (
                      <label
                        key={slot.id}
                        className={`flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm transition-colors ${
                          checked
                            ? "border-primary bg-primary/5"
                            : full
                              ? "border-border bg-muted/30 opacity-60"
                              : "border-border hover:bg-muted/40"
                        }`}
                        style={{ cursor: full ? "not-allowed" : "pointer" }}
                      >
                        <input
                          type="radio"
                          name="ev-slot-member"
                          className="mt-1"
                          checked={checked}
                          disabled={full}
                          onChange={() => setSelectedSlotId(slot.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{slot.label}</div>
                          {meta.length > 0 && (
                            <div className="mt-0.5 text-xs text-muted-foreground">{meta.join(" · ")}</div>
                          )}
                          {slot.notes && (
                            <div className="mt-0.5 text-xs text-muted-foreground">{slot.notes}</div>
                          )}
                          <div className="mt-1 text-xs font-mono">
                            {full ? (
                              <span className="text-destructive">{reg.slotFullBadge}</span>
                            ) : (
                              <span className="text-muted-foreground">
                                {interp(reg.slotRemainingBadge, { remaining, capacity: slot.capacity })}
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={submitting || (hasSlots && !selectedSlotId)}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitting ? reg.submitting : reg.memberRegisterCta}
            </Button>
          </form>
        )}

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
                onChange={(e) => {
                  setPhoneInput(e.target.value);
                  // PR69 — invalidate captcha token if phone changes,
                  // forcing a fresh challenge.
                  if (turnstileToken) setTurnstileToken(null);
                }}
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

            {/* Slot picker — only shown when the organizer configured
                slots on the event. Player must pick one before we'll
                even send the OTP (handled in handleSendOtp). */}
            {hasSlots && (
              <div className="space-y-2">
                <Label>{reg.slotPickerLabel} *</Label>
                <p className="text-xs text-muted-foreground">
                  {reg.slotPickerHint}
                </p>
                <div className="space-y-1.5">
                  {slotList.map((slot) => {
                    const taken = slotCounts?.[slot.id] ?? 0;
                    const remaining = Math.max(0, slot.capacity - taken);
                    const full = remaining === 0;
                    const checked = selectedSlotId === slot.id;
                    const meta: string[] = [];
                    if (slot.kind === "skill" && slot.skill_level) {
                      meta.push(
                        `${reg.slotMetaSkill}: ${slot.skill_level}`,
                      );
                    }
                    if (slot.kind === "duration" && slot.min_play_months != null) {
                      meta.push(
                        slot.min_play_months === 0
                          ? reg.slotMetaDurationNewbie
                          : interp(reg.slotMetaDurationMonths, {
                              n: slot.min_play_months,
                            }),
                      );
                    }
                    if (slot.court_count) {
                      meta.push(
                        interp(reg.slotMetaCourts, { n: slot.court_count }),
                      );
                    }
                    return (
                      <label
                        key={slot.id}
                        className={`flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm transition-colors ${
                          checked
                            ? "border-primary bg-primary/5"
                            : full
                              ? "border-border bg-muted/30 opacity-60"
                              : "border-border hover:bg-muted/40"
                        }`}
                        style={{ cursor: full ? "not-allowed" : "pointer" }}
                      >
                        <input
                          type="radio"
                          name="ev-slot"
                          className="mt-1"
                          checked={checked}
                          disabled={full}
                          onChange={() => setSelectedSlotId(slot.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{slot.label}</div>
                          {meta.length > 0 && (
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {meta.join(" · ")}
                            </div>
                          )}
                          {slot.notes && (
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {slot.notes}
                            </div>
                          )}
                          <div className="mt-1 text-xs font-mono">
                            {full ? (
                              <span className="text-destructive">
                                {reg.slotFullBadge}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">
                                {interp(reg.slotRemainingBadge, {
                                  remaining,
                                  capacity: slot.capacity,
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PR69 — Cloudflare Turnstile invisible CAPTCHA. The widget
                renders silently in managed mode and only shows a challenge
                when Cloudflare's heuristics flag the request. Token is
                short-lived + single-use; we reset on phone change + after
                each successful OTP send. */}
            <div className="flex justify-center">
              <TurnstileWidget
                onVerify={(token) => setTurnstileToken(token)}
                onError={() => setTurnstileToken(null)}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={
                submitting ||
                !phoneValid ||
                displayName.trim().length < 1 ||
                (hasSlots && !selectedSlotId) ||
                !turnstileToken
              }
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
                {otpChannel === "zalo"
                  ? interp(reg.otpHintZalo, { phone: maskPhone(normalizedPhone) })
                  : otpChannel === "sms"
                    ? interp(reg.otpHintSms, { phone: maskPhone(normalizedPhone) })
                    : interp(reg.otpHint, { phone: maskPhone(normalizedPhone) })}
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
                onClick={() => handleResendOtp()}
              >
                {resendIn > 0
                  ? interp(reg.otpResendIn, { seconds: resendIn })
                  : reg.otpResend}
              </Button>
              {/* PR61 — when the last send went over Zalo, offer the
                  user a way to retry over SMS. A user who doesn't
                  follow the OA may never see a Zalo OTP arrive. */}
              {otpChannel === "zalo" && (
                <button
                  type="button"
                  className="text-center text-xs text-primary underline disabled:opacity-50"
                  disabled={submitting || resendIn > 0}
                  onClick={() => handleResendOtp({ forceChannel: "sms" })}
                >
                  {reg.otpResendViaSms}
                </button>
              )}
            </div>
          </form>
        )}

        {step === "payment" && paymentOrder && success && (
          <QRPaymentStep
            order={paymentOrder}
            magicToken={success.magic_token}
            requiresPrepayment={requiresPrepayment}
            prepaymentDeadlineHours={prepaymentDeadlineHours}
            registeredAt={success.registered_at}
            /* PR60 (v2) — after the player marks paid, jump straight
               to the success step. Otherwise QRPaymentStep would fall
               into its own State 2 (a generic "claimed" banner) and
               the player would have to click "Về trang sự kiện" to
               see the save-link + recovery cards. We keep the
               paymentOrder on state so the success view can surface
               the reference code prominently. */
            onClaimed={(next) => {
              setPaymentOrder(next);
              setStep("success");
            }}
            /* "Sẽ thanh toán tại sân" and the post-claim "Về trang
               sự kiện" (only reachable if State 2 somehow renders)
               both route to success too. */
            onSkip={() => setStep("success")}
            zaloGroupUrl={zaloGroupUrl}
            onClose={() => setStep("success")}
          />
        )}

        {step === "success" && success && (
          <div className="space-y-4">
            {/* 1. Top banner — "Đăng ký thành công". */}
            <div className="rounded-md border border-emerald-400/50 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
              <p className="font-semibold">{reg.successTitle}</p>
              <p className="mt-1">{reg.successBody}</p>
            </div>

            {/* PR65 — Zalo OA follow CTA. Inline (not modal) so it
                doesn't block the player from reading payment / save-link
                cards below. Dismiss persists per session in sessionStorage. */}
            <FollowOaBanner registrationId={success.registration_id} />

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

            {/* 2. Reference code (paid events only) — prominent so the
                player can show it at the venue without digging into
                the /dang-ky/:token page. Was previously buried inside
                QRPaymentStep State 2 which we now skip. */}
            {paymentOrder?.reference_code && (
              <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t.socialEvents.payment.referenceCodeLabel}
                  </p>
                  {/* PR67 — amber "unpaid" badge sits next to the
                      reference code when prepayment is required and
                      the player hasn't claimed payment yet. Gives a
                      clear at-a-glance signal in the success card. */}
                  {requiresPrepayment && !paymentOrder.player_claimed_paid && (
                    <span
                      className="tl-format-badge"
                      style={{
                        borderColor: "hsl(38 92% 50%)",
                        color: "hsl(38 92% 50%)",
                      }}
                    >
                      {t.socialEvents.payment.unpaidStatusBadge}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 break-all rounded-md bg-background px-3 py-2 font-mono text-lg font-semibold text-primary">
                    {paymentOrder.reference_code}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={t.common.copyLink}
                    onClick={() => {
                      if (!paymentOrder?.reference_code) return;
                      void navigator.clipboard.writeText(paymentOrder.reference_code);
                      toast({ title: t.socialEvents.payment.copiedToast });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* 3. Save-link card — the critical handle on this
                registration. Until SMS lands this URL is the only
                way the player can come back to cancel / view. */}
            {success.magic_token && (
              <div className="rounded-md border-2 border-primary/40 bg-primary/5 px-4 py-3 text-sm">
                <p className="font-semibold">
                  {t.socialEvents.playerRegistration.saveLinkHeading}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.socialEvents.playerRegistration.saveLinkBody}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 break-all rounded-md bg-background px-2 py-1.5 font-mono text-xs">
                    {`${window.location.origin}/dang-ky/${success.magic_token}`}
                  </code>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      void navigator.clipboard.writeText(
                        `${window.location.origin}/dang-ky/${success.magic_token}`,
                      );
                      toast({ title: t.socialEvents.playerRegistration.saveLinkCopied });
                    }}
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" />{" "}
                    {t.socialEvents.playerRegistration.saveLinkCopy}
                  </Button>
                  <Button asChild type="button" variant="outline" size="sm" className="flex-1">
                    <a
                      href={`/dang-ky/${success.magic_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-1 h-3.5 w-3.5" />{" "}
                      {t.socialEvents.playerRegistration.saveLinkOpen}
                    </a>
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t.socialEvents.playerRegistration.saveLinkScreenshotHint}
                </p>
              </div>
            )}

            {/* 4. Recovery opt-in — collect contact_email so request-
                recovery-link can email this player the URL when they
                lose it. Skipping is fine — the save-link card above
                is the primary handle. */}
            {success.magic_token && !contactSaved && (
              <div className="rounded-md border border-border bg-muted/20 px-4 py-3 text-sm">
                <p className="font-semibold">
                  {t.socialEvents.recoveryOptIn.heading}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.socialEvents.recoveryOptIn.body}
                </p>
                <div className="mt-3 space-y-2">
                  <Label htmlFor="recovery-email" className="text-xs">
                    {t.socialEvents.recoveryOptIn.emailLabel}
                  </Label>
                  <Input
                    id="recovery-email"
                    type="email"
                    inputMode="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="ten@gmail.com"
                    disabled={contactSaving}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="flex-1"
                    disabled={
                      contactSaving ||
                      contactEmail.trim().length === 0 ||
                      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail.trim())
                    }
                    onClick={async () => {
                      if (!success?.magic_token) return;
                      setContactSaving(true);
                      try {
                        const { error } = await supabase.rpc(
                          "update_profile_contact_from_magic",
                          {
                            p_magic_token: success.magic_token,
                            p_email: contactEmail.trim(),
                          },
                        );
                        if (error) {
                          toast({
                            title: t.socialEvents.recoveryOptIn.saveError,
                            description: error.message,
                            variant: "destructive",
                          });
                          return;
                        }
                        setContactSaved(true);
                        toast({
                          title: t.socialEvents.recoveryOptIn.saveSuccess,
                        });
                      } finally {
                        setContactSaving(false);
                      }
                    }}
                  >
                    {contactSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {t.socialEvents.recoveryOptIn.saveCta}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setContactSaved(true)}
                  >
                    {t.socialEvents.recoveryOptIn.skipCta}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t.socialEvents.recoveryOptIn.zaloHint}
                </p>
              </div>
            )}
            {contactSaved && contactEmail.trim().length > 0 && (
              <p className="text-center text-xs text-emerald-600">
                ✓ {t.socialEvents.recoveryOptIn.saveSuccess}
              </p>
            )}

            {/* 5. Footer actions — Zalo group (if set) + close. Pushed
                to the bottom so the user can't accidentally dismiss
                the modal before reading the cards above. */}
            <div className="flex flex-col gap-2 border-t border-border pt-4">
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

            <p className="text-center text-xs text-muted-foreground">
              {language === "vi"
                ? `Lưu liên kết: thepicklehub.net/social/${eventSlug}`
                : `Bookmark: thepicklehub.net/social/${eventSlug}`}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
