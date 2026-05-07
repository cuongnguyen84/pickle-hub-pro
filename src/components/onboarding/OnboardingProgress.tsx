interface OnboardingProgressProps {
  currentStep: 1 | 2 | 3 | 4;
}

const STEPS: Array<{ num: 1 | 2 | 3 | 4; label: string }> = [
  { num: 1, label: "HỒ SƠ" },
  { num: 2, label: "DUPR" },
  { num: 3, label: "SÂN" },
  { num: 4, label: "THEO DÕI" },
];

/**
 * Editorial step indicator — replaces the chip-style progress bar with a
 * minimal "Bước N/4 · LABEL" eyebrow on top of a hairline track. Matches
 * TheLine pattern used by tournament filters (mono caps + dim track).
 */
export function OnboardingProgress({ currentStep }: OnboardingProgressProps) {
  const current = STEPS.find((s) => s.num === currentStep)!;

  return (
    <div style={{ marginBottom: 32 }}>
      <div
        className="tl-eyebrow"
        aria-label={`Bước ${currentStep} / 4`}
        style={{ marginBottom: 12 }}
      >
        <span className="pip" />
        <span>BƯỚC {currentStep} / 4</span>
        <span className="sep">·</span>
        <span>{current.label}</span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={currentStep}
        aria-valuemin={1}
        aria-valuemax={4}
        style={{
          display: "flex",
          gap: 4,
          height: 2,
          background: "transparent",
        }}
      >
        {STEPS.map((s) => {
          const done = s.num <= currentStep;
          return (
            <span
              key={s.num}
              style={{
                flex: 1,
                height: "100%",
                background: done ? "var(--tl-green)" : "var(--tl-border)",
                transition: "background 0.2s",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
