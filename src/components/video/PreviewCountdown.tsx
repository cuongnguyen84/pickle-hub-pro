import { useI18n } from "@/i18n";

interface PreviewCountdownProps {
  secondsRemaining: number;
  progress: number; // 0-100 (how much time has elapsed)
}

export function PreviewCountdown({ secondsRemaining, progress }: PreviewCountdownProps) {
  const { t } = useI18n();

  // Color based on remaining percentage: green > yellow > red
  const remainingPercent = 100 - progress;
  const barColor =
    remainingPercent > 50
      ? "bg-green-500"
      : remainingPercent > 20
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className="absolute top-0 left-0 right-0 z-30">
      {/* Progress bar */}
      <div className="h-1 w-full bg-black/30">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${barColor}`}
          style={{ width: `${remainingPercent}%` }}
        />
      </div>
    </div>
  );
}
