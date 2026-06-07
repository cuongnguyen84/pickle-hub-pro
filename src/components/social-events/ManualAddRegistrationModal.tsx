// ============================================================================
// ManualAddRegistrationModal — "Thêm người thủ công" (organizer)
// ----------------------------------------------------------------------------
// Mounted from SocialEventRoster (the organizer dashboard for one event)
// when the BTC clicks "+ Thêm người thủ công". Lets an organizer add a
// player they took the registration for outside the platform (Zalo
// group, phone, walk-in). The page already had a simpler manualAdd
// dialog backed by add_walk_in_registration; this modal replaces that
// path with a richer flow that:
//
//   - Lets the organizer set a payment status (unpaid / claimed / waived)
//     when the event has a fee.
//   - Adds an organizer-only "internal notes" field.
//   - Returns the player's /dang-ky/<token> link + Zalo/FB share buttons
//     so the organizer can hand it off without leaving the page.
//
// Auth is the organizer's current supabase access_token, sent to the
// add-registration-direct edge function in mode='manual'. The edge fn
// calls supabase.auth.getUser() + the verify_event_organizer RPC.
// ============================================================================

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  addRegistrationDirect,
  type AddRegistrationDirectResult,
  type ManualPaymentInitialStatus,
} from "@/lib/social-events/addRegistrationDirect";
import { RegistrationSuccessShare } from "./RegistrationSuccessShare";

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  eventId: string;
  eventTitle: string;
  priceVnd: number;
  onSuccess?: () => void;
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
      return proxy.errorRateLimitManual;
    case "unauthorized":
      return proxy.errorUnauthorized;
    case "event_not_found":
    case "event_cancelled":
    case "event_completed":
    case "event_started_or_ended":
      return reg.eventNotOpen;
    default:
      return reg.networkError;
  }
}

export function ManualAddRegistrationModal({
  open,
  onOpenChange,
  eventId,
  eventTitle,
  priceVnd,
  onSuccess,
}: Props) {
  const { t } = useI18n();
  const proxy = t.socialEvents.proxyRegister;

  const [displayName, setDisplayName] = useState("");
  const [selfLevel, setSelfLevel] = useState<string>("");
  const [paymentChoice, setPaymentChoice] = useState<ManualPaymentInitialStatus>("unpaid");
  const [internalNotes, setInternalNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AddRegistrationDirectResult | null>(null);

  useEffect(() => {
    if (!open) {
      setDisplayName("");
      setSelfLevel("");
      setPaymentChoice("unpaid");
      setInternalNotes("");
      setSubmitting(false);
      setResult(null);
    }
  }, [open]);

  async function handleSubmit() {
    if (displayName.trim().length < 1) {
      toast({ title: t.socialEvents.register.nameRequired, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        toast({ title: proxy.errorUnauthorized, variant: "destructive" });
        setSubmitting(false);
        return;
      }
      const levelNum = selfLevel === "" ? null : Number(selfLevel);
      const data = await addRegistrationDirect({
        eventId,
        // Phone intentionally not collected — organizer typically takes
        // registrations via Zalo/phone without recording the number.
        // Edge function accepts a missing phone and creates a phone-less
        // ghost profile.
        guestName: displayName.trim(),
        guestSelfRating: Number.isFinite(levelNum as number) ? (levelNum as number) : null,
        mode: "manual",
        organizerAuthToken: accessToken,
        initialPaymentStatus: priceVnd > 0 ? paymentChoice : undefined,
        internalNotes: internalNotes.trim() || null,
      });
      setResult(data);
      onSuccess?.();
    } catch (e) {
      const code = e instanceof Error ? e.message : "network_error";
      toast({ title: translateErrorCode(code, t), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  // Show payment warning only when the player still needs to pay
  // (claimed/waived means organizer already settled).
  const showPaymentWarning = priceVnd > 0 && paymentChoice === "unpaid";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle>{proxy.manualModalHeading}</DialogTitle>
          <DialogDescription>
            {eventTitle} — {proxy.manualModalSubheading}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <RegistrationSuccessShare
            result={result}
            showPaymentWarning={showPaymentWarning}
            /* Manual flow — organizer settles payment off-platform, so
               we hide the reference-code + bank-info section entirely.
               The shareable /dang-ky/<token> link stays. */
            bankInfo={null}
            priceVnd={priceVnd}
            showPaymentBlock={false}
            onAddAnother={() => {
              setDisplayName("");
              setSelfLevel("");
              setPaymentChoice("unpaid");
              setInternalNotes("");
              setResult(null);
            }}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!submitting) handleSubmit();
            }}
            className="space-y-4"
          >
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {proxy.playerSectionHeading}
              </p>
              <div className="space-y-2">
                <Label htmlFor="manual-name">{proxy.guestNameLabel} *</Label>
                <Input
                  id="manual-name"
                  type="text"
                  placeholder={t.socialEvents.register.namePlaceholder}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={80}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-level">{proxy.guestLevelLabel}</Label>
                <select
                  id="manual-level"
                  value={selfLevel}
                  onChange={(e) => setSelfLevel(e.target.value)}
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

            {priceVnd > 0 && (
              <div className="space-y-2 rounded-md border bg-muted/30 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {proxy.paymentStatusLabel}
                </p>
                <label className="flex items-start gap-3 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="payment-status"
                    value="unpaid"
                    checked={paymentChoice === "unpaid"}
                    onChange={() => setPaymentChoice("unpaid")}
                    className="mt-0.5"
                  />
                  <span>{proxy.paymentStatusUnpaid}</span>
                </label>
                <label className="flex items-start gap-3 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="payment-status"
                    value="claimed_paid"
                    checked={paymentChoice === "claimed_paid"}
                    onChange={() => setPaymentChoice("claimed_paid")}
                    className="mt-0.5"
                  />
                  <span>{proxy.paymentStatusClaimedPaid}</span>
                </label>
                <label className="flex items-start gap-3 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="payment-status"
                    value="waived"
                    checked={paymentChoice === "waived"}
                    onChange={() => setPaymentChoice("waived")}
                    className="mt-0.5"
                  />
                  <span>{proxy.paymentStatusWaived}</span>
                </label>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="manual-notes">{proxy.internalNotesLabel}</Label>
              <Textarea
                id="manual-notes"
                rows={2}
                placeholder={proxy.internalNotesPlaceholder}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">{proxy.internalNotesHint}</p>
            </div>

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
                disabled={submitting || displayName.trim().length < 1}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {proxy.manualConfirmCta}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
