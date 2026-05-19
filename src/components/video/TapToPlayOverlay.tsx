import { Play, Radio } from "lucide-react";
import { useI18n } from "@/i18n";

interface TapToPlayOverlayProps {
  type: "video" | "livestream";
  isLive?: boolean;
  onTap: () => void;
  isVisible: boolean;
  poster?: string;
}

export function TapToPlayOverlay({
  type,
  isLive = false,
  onTap,
  isVisible,
  poster,
}: TapToPlayOverlayProps) {
  const { t } = useI18n();

  if (!isVisible) return null;

  const overlayText = type === "livestream" 
    ? t.player.tapToWatchLive 
    : t.player.tapToPlayVideo;

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 cursor-pointer transition-opacity duration-300"
      onClick={onTap}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTap();
        }
      }}
      aria-label={overlayText}
    >
      {/* Background poster */}
      {poster && (
        <img
          src={poster}
          alt=""
          className="absolute inset-0 w-full h-full object-cover -z-10"
        />
      )}

      {/* Live badge */}
      {isLive && (
        <div className="absolute top-4 left-4 px-3 py-1.5 bg-red-600 rounded-md text-white text-sm font-bold flex items-center gap-2 animate-pulse">
          <Radio className="w-4 h-4" />
          {t.live.live}
        </div>
      )}

      {/* Play button */}
      <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-primary/90 hover:bg-primary flex items-center justify-center shadow-2xl transition-all duration-200 hover:scale-110">
        <Play className="w-10 h-10 md:w-12 md:h-12 text-primary-foreground fill-primary-foreground ml-1" />
      </div>

      {/* Text */}
      <p className="mt-4 text-white text-base md:text-lg font-medium drop-shadow-lg">
        {overlayText}
      </p>
    </div>
  );
}
