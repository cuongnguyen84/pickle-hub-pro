// ============================================================================
// StepHeader — the ONE wizard step indicator (UX-03, proposal ux-01-05 D2).
// ----------------------------------------------------------------------------
// Replaces the two competing wizard languages: WizardProgress's 2 dots
// (social) and the ad-hoc "◆ Bước n/N" kickers (tournament setups).
// Format per the approved spec: `Bước {n}/{total} · {tên bước}` + a thin
// progress bar. Step names come from the caller (i18n).
// ponytail: no tappable step-list sheet yet — add if organizers ask.
// ============================================================================

import { useI18n } from "@/i18n";

interface Props {
  step: number; // 1-based
  total: number;
  /** Localized name of the CURRENT step. */
  label: string;
}

export function StepHeader({ step, total, label }: Props) {
  const { t } = useI18n();
  const stepText = t.common.stepOf
    .replace("{n}", String(step))
    .replace("{total}", String(total));
  return (
    <div
      className="mb-6"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={step}
      aria-label={`${stepText} · ${label}`}
    >
      <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        ◆ {stepText} · <span className="text-foreground">{label}</span>
      </div>
      <div className="mt-2 h-1 w-full rounded-full bg-muted">
        <div
          className="h-1 rounded-full bg-primary transition-all"
          style={{ width: `${Math.round((step / total) * 100)}%` }}
        />
      </div>
    </div>
  );
}
