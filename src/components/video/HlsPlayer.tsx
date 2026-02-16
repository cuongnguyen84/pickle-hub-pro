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
  type?: "video" | "livestream";
  isLive?: boolean;
  onPlayStateChange?: (playing: boolean) => void;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000];

export const HlsPlayer = forwardRef<HlsPlayerHandle, HlsPlayerProps>(({
  hlsUrl,
  title,
  poster,
  className = "",
  type = "livestream",
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

  const initHls = useCallback(() => {
    const video = videoRef.current;
    if (!video || !hlsUrl) return;

    // Cleanup previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: isLive,
        liveSyncDurationCount: isLive ? 3 : 3,
        liveMaxLatencyDurationCount: isLive ? 10 : Infinity,
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.error("[HlsPlayer] HLS error:", data.type, data.details);
        if (data.fatal) {
          if (isLive && retryCount < MAX_RETRIES) {
            setIsReconnecting(true);
            const delay = RETRY_DELAYS[retryCount] || 8000;
            setTimeout(() => {
              hls.destroy();
              setRetryCount(prev => prev + 1);
              initHls();
            }, delay);
          } else {
            setHasError(true);
            setIsReconnecting(false);
          }
        }
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log("[HlsPlayer] Manifest parsed, ready to play");
        setIsReconnecting(false);
        setRetryCount(0);
      });

      hlsRef.current = hls;
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      video.src = hlsUrl;
    } else {
      setHasError(true);
    }
  }, [hlsUrl, isLive, retryCount]);

  useEffect(() => {
    initHls();
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [hlsUrl]); // Only reinit when URL changes, not on every retryCount change

  const handleTapToPlay = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      await videoRef.current.play();
      setShowOverlay(false);
      setHasError(false);
    } catch (error: any) {
      // AbortError happens when video is removed from DOM during play() - ignore silently
      if (error?.name === "AbortError") {
        console.log("[HlsPlayer] Play aborted (element removed from DOM), ignoring");
        return;
      }
      console.error("[HlsPlayer] Play error:", error);
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
    setIsReconnecting(false);
    setRetryCount(0);
    setShowOverlay(true);
    initHls();
  }, [initHls]);

  const handlePlay = useCallback(() => {
    setShowOverlay(false);
    setHasError(false);
    setIsReconnecting(false);
    setRetryCount(0);
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
        type={type}
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
