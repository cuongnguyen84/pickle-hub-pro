import MuxPlayerReact from "@mux/mux-player-react";
import { useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { TapToPlayOverlay } from "./TapToPlayOverlay";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface MuxPlayerHandle {
  play: () => Promise<void>;
  pause: () => void;
}

interface MuxPlayerProps {
  playbackId: string;
  title?: string;
  poster?: string;
  className?: string;
  streamType?: "on-demand" | "live" | "ll-live" | "live:dvr";
  type?: "video" | "livestream";
  isLive?: boolean;
}

export const MuxPlayer = forwardRef<MuxPlayerHandle, MuxPlayerProps>(({
  playbackId,
  title,
  poster,
  className = "",
  streamType = "on-demand",
  type = "video",
  isLive = false,
}, ref) => {
  const { t } = useI18n();
  const { toast } = useToast();
  const playerRef = useRef<any>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useImperativeHandle(ref, () => ({
    play: async () => {
      if (playerRef.current) {
        await playerRef.current.play();
      }
    },
    pause: () => {
      if (playerRef.current) {
        playerRef.current.pause();
      }
    },
  }));

  const handleTapToPlay = useCallback(async () => {
    if (!playerRef.current) return;

    try {
      await playerRef.current.play();
      setShowOverlay(false);
      setHasError(false);
    } catch (error) {
      console.error("Play error:", error);
      toast({
        title: t.player.playbackError,
        description: t.player.playbackErrorDesc,
        variant: "destructive",
      });
      setHasError(true);
    }
  }, [toast, t]);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setShowOverlay(true);
    if (playerRef.current) {
      playerRef.current.load();
    }
  }, []);

  const handlePlay = useCallback(() => {
    setShowOverlay(false);
    setHasError(false);
  }, []);

  const handlePause = useCallback(() => {
    // Optionally show overlay on pause - disabled for better UX
    // setShowOverlay(true);
  }, []);

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  const handleCanPlay = useCallback(() => {
    setIsReady(true);
  }, []);

  if (!playbackId) {
    return (
      <div className={`aspect-video bg-muted flex items-center justify-center rounded-xl ${className}`}>
        <p className="text-foreground-muted text-sm">{t.player.notReady}</p>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className={`aspect-video bg-muted flex flex-col items-center justify-center gap-4 rounded-xl ${className}`}>
        <AlertCircle className="w-12 h-12 text-destructive" />
        <p className="text-foreground-secondary text-center px-4">{t.player.playbackError}</p>
        <Button variant="outline" size="sm" onClick={handleRetry} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          {t.common.retry}
        </Button>
      </div>
    );
  }

  return (
    <div className={`relative aspect-video rounded-xl overflow-hidden ${className}`}>
      {/* Tap to play overlay */}
      <TapToPlayOverlay
        type={type}
        isLive={isLive}
        onTap={handleTapToPlay}
        isVisible={showOverlay}
        poster={poster}
      />

      {/* Mux Player - always rendered but behind overlay until played */}
      <MuxPlayerReact
        ref={playerRef}
        playbackId={playbackId}
        metadata={{
          video_title: title,
        }}
        poster={showOverlay ? undefined : poster}
        autoPlay={false}
        muted={false}
        playsInline={true}
        streamType={streamType}
        className="w-full h-full"
        primaryColor="#22c55e"
        accentColor="#16a34a"
        onPlay={handlePlay}
        onPause={handlePause}
        onError={handleError}
        onCanPlay={handleCanPlay}
      />
    </div>
  );
});

MuxPlayer.displayName = "MuxPlayer";
