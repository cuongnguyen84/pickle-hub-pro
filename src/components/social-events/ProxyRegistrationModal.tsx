// ============================================================================
// ProxyRegistrationModal — "Đăng ký hộ bạn bè"
// ----------------------------------------------------------------------------
// Mounted from SocialEventDetail when an already-registered viewer (i.e.
// has a magic_token in localStorage for this event) clicks the new
// "+ Đăng ký hộ bạn bè" button. Lets the viewer (anh A) register a
// friend (anh B) without B going through OTP themselves.
//
// Auth is the proxy_magic_token — A's existing registration's token. The
// edge function (add-registration-direct, mode='proxy') verifies that
// token belongs to an active registration on the same event.
//
// After success, swaps to the shared RegistrationSuccessShare card with
// the friend's /dang-ky/<token> link + Zalo/FB share buttons. The viewer
// is responsible for forwarding the link (Zalo OA notify will land in a
// follow-up PR once the OA template is approved).
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
import { useI18n } from "@/i18n";
import { toast } from "@/hooks/use-toast";
import {
  isValidVietnamPhone,
  normalizeVietnamPhone,
} from "@/lib/phone";
import {
  addRegistrationDirect,
  type AddRegistrationDirectResult,
} from "@/lib/social-events/addRegistrationDirect";
import {
  RegistrationSuccessShare,
  type BankInfoForCopy,
} from "./RegistrationSuccessShare";

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  eventId: string;
  eventTitle: string;
  priceVnd: number;
  /** Bank info to render in the success state (only relevant when paid). */
  bankInfo?: BankInfoForCopy | null;
  /** Proxy registrant's magic_token, read from localStorage. */
  proxyMagicToken: string;
  /** Parent callback to refetch the roster after a successful add. */
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

export function ProxyRegistrationModal({
  open,
  onOpenChange,
  eventId,
  eventTitle,
  priceVnd,
  bankInfo,
  proxyMagicToken,
  onSuccess,
}: Props) {
  const { t } = useI18n();
  const proxy = t.socialEvents.proxyRegister;

  const [phoneInput, setPhoneInput] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selfLevel, setSelfLevel] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AddRegistrationDirectResult | null>(null);

  // Reset form on close.
  useEffect(() => {
    if (!open) {
      setPhoneInput("");
      setDisplayName("");
      setSelfLevel("");
      setSubmitting(false);
      setResult(null);
    }
  }, [open]);

  const phoneValid = (() => {
    const norm = normalizeVietnamPhone(phoneInput);
    return norm != null && isValidVietnamPhone(norm);
  })();

  async function handleSubmit() {
    const norm = normalizeVietnamPhone(phoneInput);
    if (!norm || !isValidVietnamPhone(norm)) {
      toast({ title: t.socialEvents.register.phoneInvalid, variant: "destructive" });
      return;
    }
    if (displayName.trim().length < 1) {
      toast({ title: t.socialEvents.register.nameRequired, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const levelNum = selfLevel === "" ? null : Number(selfLevel);
      const data = await addRegistrationDirect({
        eventId,
        guestPhone: norm,
        guestName: displayName.trim(),
        guestSelfRating: Number.isFinite(levelNum as number) ? (levelNum as number) : null,
        mode: "proxy",
        proxyMagicToken,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle>{proxy.modalHeading}</DialogTitle>
          <DialogDescription>
            {eventTitle} — {proxy.modalSubheading}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <RegistrationSuccessShare
            result={result}
            showPaymentWarning
            bankInfo={bankInfo ?? null}
            priceVnd={priceVnd}
            onAddAnother={() => {
              setPhoneInput("");
              setDisplayName("");
              setSelfLevel("");
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
                {proxy.guestSectionHeading}
              </p>
              <div className="space-y-2">
                <Label htmlFor="proxy-phone">{proxy.guestPhoneLabel} *</Label>
                <Input
                  id="proxy-phone"
                  type="tel"
                  inputMode="tel"
                  placeholder={t.socialEvents.register.phonePlaceholder}
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  required
                />
                {phoneInput.length > 0 && !phoneValid && (
                  <p className="text-sm text-destructive">{t.socialEvents.register.phoneInvalid}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="proxy-name">{proxy.guestNameLabel} *</Label>
                <Input
                  id="proxy-name"
                  type="text"
                  placeholder={t.socialEvents.register.namePlaceholder}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={80}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proxy-level">{proxy.guestLevelLabel}</Label>
                <select
                  id="proxy-level"
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
                <p className="text-xs text-muted-foreground">{proxy.guestLevelHint}</p>
              </div>
            </div>

            {priceVnd > 0 && (
              <div className="rounded-md border-2 border-amber-400/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                <p>⚠️ {proxy.paymentWarningProxy}</p>
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
                disabled={submitting || !phoneValid || displayName.trim().length < 1}
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
