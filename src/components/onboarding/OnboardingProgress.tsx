import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingProgressProps {
  currentStep: 1 | 2 | 3 | 4;
}

const STEPS: Array<{ num: 1 | 2 | 3 | 4; label: string }> = [
  { num: 1, label: "Hồ sơ" },
  { num: 2, label: "DUPR" },
  { num: 3, label: "Sân" },
  { num: 4, label: "Theo dõi" },
];

export function OnboardingProgress({ currentStep }: OnboardingProgressProps) {
  return (
    <nav aria-label="Tiến trình hoàn thiện hồ sơ" className="px-1">
      <ol className="flex items-center justify-between gap-2">
        {STEPS.map((step, idx) => {
          const isDone = step.num < currentStep;
          const isActive = step.num === currentStep;
          const showConnector = idx < STEPS.length - 1;
          return (
            <li key={step.num} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                    isDone &&
                      "border-primary bg-primary text-primary-foreground",
                    isActive &&
                      "border-primary bg-background text-primary",
                    !isDone && !isActive &&
                      "border-border bg-background text-muted-foreground",
                  )}
                >
                  {isDone ? <Check className="h-4 w-4" /> : step.num}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium uppercase tracking-wider",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </div>
              {showConnector && (
                <div
                  className={cn(
                    "h-0.5 flex-1 mx-1 mb-5",
                    step.num < currentStep ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
