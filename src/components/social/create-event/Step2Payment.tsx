// ============================================================================
// Step2Payment — second step of the CreateSocialEvent wizard (PR51).
// ----------------------------------------------------------------------------
// Asks the organizer the participation fee + (when > 0) the bank account
// to receive transfers into. The bank trio writes one event_payment_config
// row on submit. PR49 stored payment at the club level; PR51 moves it
// here so different events run by different organizers in the same club
// can each receive into their own bank account.
//
// Free events skip the bank fields entirely and show a "no payment step"
// hint instead — the validator already short-circuits the bank-trio when
// price_vnd === 0.
// ============================================================================

import { useMemo } from "react";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/i18n";
import { VN_BANKS } from "@/lib/payment/banks";
import { generateVietQRUrl } from "@/lib/payment/vietqr";
import { normalizeAccountName, type FormState, type FormErrors } from "./types";

interface Props {
  form: FormState;
  errors: FormErrors;
  touched: Partial<Record<keyof FormState, boolean>>;
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onBlur: (key: keyof FormState) => void;
  /** Locale code for thousand-separator formatting. */
  language: "vi" | "en";
}

function ErrorText({ msg }: { msg: string | null | undefined }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-destructive">{msg}</p>;
}

export function Step2Payment({ form, errors, touched, onChange, onBlur, language }: Props) {
  const { t } = useI18n();
  const create = t.socialEvents.create;
  const showError = (k: keyof FormState) => (touched[k] ? errors[k] : null);

  const priceLocale = language === "vi" ? "vi-VN" : "en-US";
  const isFree = form.price_vnd === 0;

  // Preview QR shows up only when the bank trio + price are all valid;
  // until then we keep the slot empty so a bad URL never paints.
  const previewUrl = useMemo(() => {
    if (isFree) return null;
    if (!form.bank_code) return null;
    if (!/^[0-9]{6,20}$/.test(form.bank_account_number.trim())) return null;
    if (form.bank_account_name.trim().length < 3) return null;
    return generateVietQRUrl({
      bankCode: form.bank_code,
      accountNumber: form.bank_account_number.trim(),
      accountName: form.bank_account_name.trim(),
      amount: form.price_vnd,
      memo: "PHUB-DEMO00",
    });
  }, [
    isFree,
    form.bank_code,
    form.bank_account_number,
    form.bank_account_name,
    form.price_vnd,
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">{create.step2PaymentHeading}</h2>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ev-price">{create.priceAmount} *</Label>
        <Input
          id="ev-price"
          type="text"
          inputMode="numeric"
          value={form.price_vnd === 0 ? "" : form.price_vnd.toLocaleString(priceLocale)}
          placeholder="0"
          onChange={(e) => {
            const digitsOnly = e.target.value.replace(/\D+/g, "");
            onChange("price_vnd", digitsOnly === "" ? 0 : Number(digitsOnly));
          }}
          onBlur={() => onBlur("price_vnd")}
        />
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs text-muted-foreground">{create.priceFreeHint}</p>
          {form.price_vnd > 0 && (
            <p className="font-mono text-sm font-semibold text-foreground">
              {form.price_vnd.toLocaleString(priceLocale)} ₫
            </p>
          )}
        </div>
        <ErrorText msg={showError("price_vnd")} />
      </div>

      {isFree ? (
        <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 px-4 py-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p>{create.paymentBannerFree}</p>
        </div>
      ) : (
        <>
          <div className="space-y-4 border-t pt-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {create.bankInfoHeading}
            </h3>

            <div className="space-y-2">
              <Label htmlFor="ev-bank-code">{create.bankLabel} *</Label>
              <Select
                value={form.bank_code}
                onValueChange={(v) => {
                  onChange("bank_code", v);
                  onBlur("bank_code");
                }}
              >
                <SelectTrigger id="ev-bank-code">
                  <SelectValue placeholder={create.bankPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {VN_BANKS.map((b) => (
                    <SelectItem key={b.code} value={b.code}>
                      {b.shortName} — {b.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ErrorText msg={showError("bank_code")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ev-account-number">{create.accountNumberLabel} *</Label>
              <Input
                id="ev-account-number"
                inputMode="numeric"
                autoComplete="off"
                value={form.bank_account_number}
                onChange={(e) =>
                  onChange(
                    "bank_account_number",
                    e.target.value.replace(/\D+/g, "").slice(0, 20),
                  )
                }
                onBlur={() => onBlur("bank_account_number")}
                placeholder={create.accountNumberPlaceholder}
              />
              <ErrorText msg={showError("bank_account_number")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ev-account-name">{create.accountNameLabel} *</Label>
              <Input
                id="ev-account-name"
                value={form.bank_account_name}
                onChange={(e) => onChange("bank_account_name", e.target.value.slice(0, 100))}
                onBlur={() => {
                  // Auto-normalize to the bank-printed format on blur so
                  // the organizer can paste a mixed-case name and we still
                  // store it as the bank expects.
                  onChange(
                    "bank_account_name",
                    normalizeAccountName(form.bank_account_name),
                  );
                  onBlur("bank_account_name");
                }}
                placeholder="NGUYEN VAN A"
              />
              <p className="text-xs text-muted-foreground">{create.accountNameHint}</p>
              <ErrorText msg={showError("bank_account_name")} />
            </div>
          </div>

          <p className="rounded-md border border-blue-400/30 bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
            ⓘ {create.bankDisclaimer}
          </p>

          {previewUrl && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {create.previewLabel}
              </p>
              <div className="flex justify-center">
                <img
                  src={previewUrl}
                  alt={create.previewAlt}
                  width={200}
                  height={260}
                  className="rounded-md border border-border bg-white"
                  loading="lazy"
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
