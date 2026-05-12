// ============================================================================
// WizardProgress — 2-step progress indicator for CreateSocialEvent wizard.
// ----------------------------------------------------------------------------
// Mobile-first; two dots + the "Bước n/2" label inline. Decorative only —
// step navigation lives in the parent component's footer buttons.
// ============================================================================

import { useI18n } from "@/i18n";

interface Props {
  step: 1 | 2;
}

export function WizardProgress({ step }: Props) {
  const { t } = useI18n();
  const label = t.socialEvents.create.stepIndicator.replace("{n}", String(step));
  return (
    <div
      aria-label={label}
      className="mb-6 flex items-center gap-3"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={2}
      aria-valuenow={step}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={`h-2 w-2 rounded-full transition-colors ${
            step >= 1 ? "bg-primary" : "bg-muted-foreground/30"
          }`}
        />
        <span
          className={`h-2 w-2 rounded-full transition-colors ${
            step >= 2 ? "bg-primary" : "bg-muted-foreground/30"
          }`}
        />
      </div>
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
