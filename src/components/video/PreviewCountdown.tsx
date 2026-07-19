import { useI18n } from "@/i18n";

interface PreviewCountdownProps {
  secondsRemaining: number;
  progress: number; // 0-100 (how much time has elapsed)
}

export function PreviewCountdown({ secondsRemaining, progress }: PreviewCountdownProps) {
  const { t } = useI18n();

  const remainingPercent = 100 - progress;
  const isEndingSoon = secondsRemaining <= 5;
  const label = (isEndingSoon ? t.live.previewEndingSoon : t.live.previewRemaining)
    .replace("{seconds}", String(secondsRemaining));

  return (
    <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
      {/* Progress bar — one brand color, amber only in the final seconds */}
      <div className="h-[3px] w-full bg-black/30">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${isEndingSoon ? "bg-amber-500" : "bg-primary"}`}
          style={{ width: `${remainingPercent}%` }}
        />
      </div>
      {/* Text badge — color alone fails WCAG 1.4.1, and a 1px bar reads as
          buffering; the number tells the viewer why playback will stop. */}
      <span className="absolute top-2 left-2 rounded bg-black/70 px-2 py-1 text-xs font-medium text-white tabular-nums">
        {label}
      </span>
    </div>
  );
}
