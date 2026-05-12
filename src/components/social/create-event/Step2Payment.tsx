// ============================================================================
// Step2Payment — second step of the CreateSocialEvent wizard.
// ----------------------------------------------------------------------------
// One field (price_vnd) + a reactive banner describing what the player
// will see at registration time, based on:
//   - price === 0                              → "free event"
//   - price > 0 + club has no/disabled payment → "pay at the venue"
//   - price > 0 + club has enabled payment     → "VietQR will render"
// The banner state derives from the club_payment_config row pulled by the
// container; this component never queries directly.
// ============================================================================

import { Link } from "react-router-dom";
import { CheckCircle2, Info, AlertTriangle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import type { ClubPaymentConfigRow } from "@/hooks/useClubPaymentConfig";
import type { FormState, FormErrors } from "./types";

interface Props {
  form: FormState;
  errors: FormErrors;
  touched: Partial<Record<keyof FormState, boolean>>;
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onBlur: (key: keyof FormState) => void;
  paymentConfig: ClubPaymentConfigRow | null | undefined;
  paymentConfigLoading: boolean;
  clubSlug: string;
  /** Locale code for thousand-separator formatting. */
  language: "vi" | "en";
}

function ErrorText({ msg }: { msg: string | null | undefined }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-destructive">{msg}</p>;
}

export function Step2Payment({
  form,
  errors,
  touched,
  onChange,
  onBlur,
  paymentConfig,
  paymentConfigLoading,
  clubSlug,
  language,
}: Props) {
  const { t } = useI18n();
  const create = t.socialEvents.create;
  const showError = (k: keyof FormState) => (touched[k] ? errors[k] : null);

  const priceLocale = language === "vi" ? "vi-VN" : "en-US";
  const formatted =
    form.price_vnd === 0
      ? "0 ₫"
      : `${form.price_vnd.toLocaleString(priceLocale)} ₫`;

  const isFree = form.price_vnd === 0;
  const paymentEnabled = Boolean(paymentConfig?.enabled);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">{create.step2Heading}</h2>
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
            <p className="font-mono text-sm font-semibold text-foreground">{formatted}</p>
          )}
        </div>
        <ErrorText msg={showError("price_vnd")} />
      </div>

      {/* Banner state. Hidden while paymentConfig query is still resolving
          so we don't briefly flash the "not configured" message before the
          row arrives — it would be the most-common failure-mode visually
          since the row IS public-readable and fetches quickly. */}
      {paymentConfigLoading ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t.common.loading}</span>
        </div>
      ) : isFree ? (
        <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 px-4 py-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p>{create.paymentBannerFree}</p>
        </div>
      ) : !paymentEnabled ? (
        <div className="space-y-2 rounded-md border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{create.paymentBannerNotConfigured}</p>
          </div>
          <Link
            to={`/clb/${clubSlug}/quan-ly/thanh-toan`}
            className="ml-7 block text-xs font-medium underline decoration-dotted underline-offset-4 hover:no-underline"
          >
            {create.paymentBannerNotConfiguredCta}
          </Link>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-md border border-emerald-400/40 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{create.paymentBannerReady}</p>
        </div>
      )}
    </div>
  );
}
