import { useRef, useState, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import Hls from "hls.js";
import { TapToPlayOverlay } from "./TapToPlayOverlay";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface HlsPlayerHandle {
  play: () => Promise<void>;
  pause: () => void;
}

interface HlsPlayerProps {
  hlsUrl: string;
  title?: string;
  poster?: string;
  className?: string;
  isLive?: boolean;
  onPlayStateChange?: (playing: boolean) => void;
}

const MAX_RETRIES = 3;

export const HlsPlayer = forwardRef<HlsPlayerHandle, HlsPlayerProps>(({
  hlsUrl,
  title,
  poster,
  className = "",
  isLive = false,
  onPlayStateChange,
}, ref) => {
  const { t } = useI18n();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useImperativeHandle(ref, () => ({
    play: async () => {
      if (videoRef.current) await videoRef.current.play();
    },
    pause: () => {
      if (videoRef.current) videoRef.current.pause();
    },
  }));

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  const initHls = useCallback(() => {
    if (!videoRef.current || !hlsUrl) return;

    destroyHls();

    // Safari native HLS
    if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
      videoRef.current.src = hlsUrl;
      return;
    }

    if (!Hls.isSupported()) {
      setHasError(true);
      return;
    }

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: isLive,
      backBufferLength: isLive ? 0 : 30,
    });

    hls.loadSource(hlsUrl);
    hls.attachMedia(videoRef.current);

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        console.error("[HlsPlayer] Fatal error:", data.type, data.details);
        if (retryCount < MAX_RETRIES) {
          setIsReconnecting(true);
          setRetryCount((c) => c + 1);
          setTimeout(() => {
            hls.destroy();
            initHls();
          }, 2000 * (retryCount + 1));
        } else {
          setHasError(true);
          setIsReconnecting(false);
        }
      }
    });

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setIsReconnecting(false);
      setRetryCount(0);
    });

    hlsRef.current = hls;
  }, [hlsUrl, isLive, retryCount, destroyHls]);

  useEffect(() => {
    initHls();
    return destroyHls;
  }, [hlsUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTapToPlay = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      await videoRef.current.play();
      setShowOverlay(false);
      setHasError(false);
    } catch (error) {
      console.error("[HlsPlayer] Play error:", error);
      toast({
        title: t.player.playbackError,
        description: t.player.playbackErrorDesc,
        variant: "destructive",
      });
    }
  }, [toast, t]);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setIsReconnecting(false);
    setRetryCount(0);
    setShowOverlay(true);
    initHls();
  }, [initHls]);

  const handlePlay = useCallback(() => {
    setShowOverlay(false);
    onPlayStateChange?.(true);
  }, [onPlayStateChange]);

  const handlePause = useCallback(() => {
    onPlayStateChange?.(false);
  }, [onPlayStateChange]);

  if (!hlsUrl) {
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
      <TapToPlayOverlay
        type="livestream"
        isLive={isLive}
        onTap={handleTapToPlay}
        isVisible={showOverlay && !isReconnecting}
        poster={poster}
      />

      {isReconnecting && (
        <div className="absolute inset-0 z-20 bg-black/70 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-white text-sm font-medium">{t.player.reconnecting}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRetry}
            className="mt-2 text-white hover:text-white hover:bg-white/20"
          >
            {t.common.retry}
          </Button>
        </div>
      )}

      <video
        ref={videoRef}
        className="w-full h-full"
        playsInline
        poster={showOverlay ? undefined : poster}
        onPlay={handlePlay}
        onPause={handlePause}
      />
    </div>
  );
});

HlsPlayer.displayName = "HlsPlayer";
