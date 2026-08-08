import MuxPlayerReact from "@mux/mux-player-react";
import { useRef, useState, useCallback, forwardRef, useImperativeHandle, useEffect, type ComponentRef } from "react";
import { TapToPlayOverlay } from "./TapToPlayOverlay";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, RefreshCw, Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface MuxPlayerHandle {
  play: () => Promise<void>;
  pause: () => void;
  /** Best-effort exit from element fullscreen, iOS native video fullscreen and PiP. */
  exitNativeSurfaces: () => void;
}

interface MuxPlayerProps {
  playbackId: string;
  title?: string;
  poster?: string;
  className?: string;
  streamType?: "on-demand" | "live" | "ll-live" | "live:dvr";
  type?: "video" | "livestream";
  isLive?: boolean;
  /**
   * Login-gate flag. When true the player pauses itself and re-pauses on
   * EVERY play event — fullscreen controls, PiP, media keys and lock-screen
   * resumes all route through `onPlay`, so one guard here covers every
   * call-site instead of each page wiring its own one-shot pause effect.
   */
  gated?: boolean;
  onPlayStateChange?: (playing: boolean) => void;
}

const MAX_RETRIES = 3;
const STALL_TIMEOUT_MS = 10000; // 10 seconds
const HEALTH_CHECK_INTERVAL_MS = 5000; // 5 seconds
const RETRY_DELAYS = [2000, 4000, 8000]; // Exponential backoff
type NativeHlsQuality = "auto" | "1080p" | "720p" | "540p" | "360p" | "270p";
const NATIVE_HLS_QUALITIES: NativeHlsQuality[] = ["auto", "1080p", "720p", "540p", "360p", "270p"];

export const MuxPlayer = forwardRef<MuxPlayerHandle, MuxPlayerProps>(({
  playbackId,
  title,
  poster,
  className = "",
  streamType = "on-demand",
  type = "video",
  isLive = false,
  gated = false,
  onPlayStateChange,
}, ref) => {
  const { t } = useI18n();
  const { toast } = useToast();
  // Safari on macOS/iPadOS otherwise uses native HLS, where browsers do not
  // expose the rendition ladder and Mux cannot render its quality selector.
  // Do not feature-detect window.MediaSource here: Safari may expose its
  // managed MSE implementation differently. Mux handles the engine details;
  // only iPhone/iPod must stay on Apple's native HLS because MSE is unavailable.
  const requiresNativeHls = typeof navigator !== "undefined"
    && /iPhone|iPod/i.test(navigator.userAgent);
  const playerRef = useRef<ComponentRef<typeof MuxPlayerReact> | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [, setIsReady] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [nativeHlsQuality, setNativeHlsQuality] = useState<NativeHlsQuality>("auto");
  const pinnedNativeResolution = nativeHlsQuality === "auto" ? undefined : nativeHlsQuality;
  const nativeHlsSourceParams = pinnedNativeResolution
    ? { min_resolution: pinnedNativeResolution, max_resolution: pinnedNativeResolution }
    : {};

  // Refs for health monitoring
  const lastCurrentTimeRef = useRef<number>(0);
  const stallTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const healthCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlayingRef = useRef(false);
  const gatedRef = useRef(gated);

  // The overlay the gate shows is a DOM sibling — it cannot render on top of
  // OS-level video fullscreen or a PiP window, so a silent pause there looks
  // like the app broke. Always exit those surfaces first, then pause.
  // ponytail: always-exit (no wrapper-fullscreen branch); add detection only
  // if real users complain about being kicked out of element fullscreen.
  const exitNativeSurfaces = useCallback(() => {
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      const doc = document as Document & {
        webkitFullscreenElement?: Element;
        webkitExitFullscreen?: () => void;
      };
      if (doc.webkitFullscreenElement) doc.webkitExitFullscreen?.();
      if (document.pictureInPictureElement) void document.exitPictureInPicture();
      // iOS Safari video-only fullscreen lives on the <video>, not document.
      const video = (playerRef.current as unknown as {
        media?: { nativeEl?: HTMLVideoElement };
      } | null)?.media?.nativeEl as
        | (HTMLVideoElement & {
            webkitDisplayingFullscreen?: boolean;
            webkitExitFullscreen?: () => void;
          })
        | undefined;
      if (video?.webkitDisplayingFullscreen) video.webkitExitFullscreen?.();
    } catch {
      /* best effort — worst case the pause still lands, just without exit */
    }
  }, []);

  useEffect(() => {
    gatedRef.current = gated;
    if (gated && playerRef.current) {
      exitNativeSurfaces();
      playerRef.current.pause();
    }
  }, [gated, exitNativeSurfaces]);

  // Cleanup function
  const clearAllTimeouts = useCallback(() => {
    if (stallTimeoutRef.current) {
      clearTimeout(stallTimeoutRef.current);
      stallTimeoutRef.current = null;
    }
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  // Auto-reconnect logic
  const attemptReconnect = useCallback(async () => {
    if (retryCount >= MAX_RETRIES) {
      console.log("[MuxPlayer] Max retries reached, showing error state");
      setIsReconnecting(false);
      setHasError(true);
      toast({
        title: t.player.playbackError,
        description: t.player.retryFailed,
        variant: "destructive",
      });
      return;
    }

    const delay = RETRY_DELAYS[retryCount] || 8000;
    console.log(`[MuxPlayer] Attempting reconnect (${retryCount + 1}/${MAX_RETRIES}) in ${delay}ms`);
    
    setIsReconnecting(true);

    retryTimeoutRef.current = setTimeout(async () => {
      try {
        if (playerRef.current) {
          console.log("[MuxPlayer] Reloading player...");
          playerRef.current.load();
          
          // Wait a moment then try to play
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          if (playerRef.current && isPlayingRef.current) {
            await playerRef.current.play();
            console.log("[MuxPlayer] Reconnect successful");
            setIsReconnecting(false);
            setRetryCount(0);
          }
        }
      } catch (err) {
        console.error("[MuxPlayer] Reconnect failed:", err);
        setRetryCount(prev => prev + 1);
        attemptReconnect();
      }
    }, delay);
  }, [retryCount, toast, t]);

  // Health check for live streams
  useEffect(() => {
    if (!isLive || !isPlayingRef.current) return undefined;

    healthCheckIntervalRef.current = setInterval(() => {
      if (!playerRef.current || !isPlayingRef.current) return;

      const currentTime = playerRef.current.currentTime || 0;
      
      // If currentTime hasn't changed and we're supposed to be playing, something's wrong
      if (currentTime === lastCurrentTimeRef.current && !playerRef.current.paused) {
        console.warn("[MuxPlayer] Stream appears stalled (currentTime not changing)");
        
        // Start stall timeout if not already started
        if (!stallTimeoutRef.current) {
          stallTimeoutRef.current = setTimeout(() => {
            console.log("[MuxPlayer] Stall timeout reached, attempting reconnect");
            attemptReconnect();
          }, STALL_TIMEOUT_MS);
        }
      } else {
        // Stream is healthy, reset stall detection
        lastCurrentTimeRef.current = currentTime;
        if (stallTimeoutRef.current) {
          clearTimeout(stallTimeoutRef.current);
          stallTimeoutRef.current = null;
        }
      }
    }, HEALTH_CHECK_INTERVAL_MS);

    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
        healthCheckIntervalRef.current = null;
      }
    };
  }, [isLive, attemptReconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAllTimeouts();
    };
  }, [clearAllTimeouts]);

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
    exitNativeSurfaces,
  }));

  const handleTapToPlay = useCallback(async () => {
    // Screen readers can activate the tap target through the gate overlay
    // (rotor navigation ignores z-index) — never trust the DOM to block it.
    if (gatedRef.current) return;
    if (!playerRef.current) return;

    try {
      await playerRef.current.play();
      setShowOverlay(false);
      setHasError(false);
      isPlayingRef.current = true;
    } catch (error) {
      console.error("[MuxPlayer] Play error:", error);
      toast({
        title: t.player.playbackError,
        description: t.player.playbackErrorDesc,
        variant: "destructive",
      });
      setHasError(true);
    }
  }, [toast, t]);

  const handleRetry = useCallback(() => {
    console.log("[MuxPlayer] Manual retry triggered");
    setHasError(false);
    setIsReconnecting(false);
    setRetryCount(0);
    setShowOverlay(true);
    clearAllTimeouts();
    if (playerRef.current) {
      playerRef.current.load();
    }
  }, [clearAllTimeouts]);

  const handlePlay = useCallback(() => {
    console.log("[MuxPlayer] Play event");
    if (gatedRef.current) {
      // Re-pause every resume attempt while gated (fullscreen controls,
      // media keys, PiP). Never report `playing` upstream for these.
      exitNativeSurfaces();
      playerRef.current?.pause();
      return;
    }
    setShowOverlay(false);
    setHasError(false);
    setIsReconnecting(false);
    setRetryCount(0);
    isPlayingRef.current = true;
    onPlayStateChange?.(true);
  }, [onPlayStateChange, exitNativeSurfaces]);

  const handlePause = useCallback(() => {
    console.log("[MuxPlayer] Pause event");
    isPlayingRef.current = false;
    onPlayStateChange?.(false);
    // Clear stall detection when paused
    if (stallTimeoutRef.current) {
      clearTimeout(stallTimeoutRef.current);
      stallTimeoutRef.current = null;
    }
  }, [onPlayStateChange]);

  const handleError = useCallback((event: unknown) => {
    console.error("[MuxPlayer] Error event:", event);
    
    // For live streams, attempt auto-reconnect instead of showing error immediately
    if (isLive && retryCount < MAX_RETRIES) {
      attemptReconnect();
    } else {
      setHasError(true);
    }
  }, [isLive, retryCount, attemptReconnect]);

  const handleCanPlay = useCallback(() => {
    console.log("[MuxPlayer] CanPlay event");
    setIsReady(true);
  }, []);

  // Handle stalled/waiting events
  const handleStalled = useCallback(() => {
    console.warn("[MuxPlayer] Stream stalled");
    
    if (isLive && isPlayingRef.current && !stallTimeoutRef.current) {
      stallTimeoutRef.current = setTimeout(() => {
        console.log("[MuxPlayer] Stall timeout reached after stalled event");
        attemptReconnect();
      }, STALL_TIMEOUT_MS);
    }
  }, [isLive, attemptReconnect]);

  const handleWaiting = useCallback(() => {
    console.log("[MuxPlayer] Stream waiting for data");
    // Don't immediately trigger reconnect, just log - the health check will handle prolonged issues
  }, []);

  const handlePlaying = useCallback(() => {
    console.log("[MuxPlayer] Stream playing (recovered from stall/wait)");
    // Clear any stall timeouts since we recovered
    if (stallTimeoutRef.current) {
      clearTimeout(stallTimeoutRef.current);
      stallTimeoutRef.current = null;
    }
    setIsReconnecting(false);
    setRetryCount(0);
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
        isVisible={showOverlay && !isReconnecting && !gated}
        poster={poster}
      />

      {/* Reconnecting overlay */}
      {isReconnecting && (
        <div className="absolute inset-0 z-20 bg-black/70 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-white text-sm font-medium">{t.player.reconnecting}</p>
          <p className="text-white/70 text-xs">
            {t.player.autoRetry.replace("{seconds}", String(RETRY_DELAYS[retryCount] / 1000 || 8))}
          </p>
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

      {/* iPhone browsers must use Apple's native HLS engine, which does not
          expose Mux's built-in rendition menu. Pin both manifest bounds from
          this native <select>; Auto removes the bounds and restores ABR. */}
      {requiresNativeHls && !showOverlay && !isReconnecting && (
        <label className="absolute right-3 top-3 z-30 flex h-9 items-center gap-1.5 rounded-lg bg-black/75 px-2.5 text-xs font-semibold text-white backdrop-blur-sm">
          <Settings className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Chất lượng video</span>
          <select
            aria-label="Chất lượng video"
            value={nativeHlsQuality}
            onChange={(event) => setNativeHlsQuality(event.target.value as NativeHlsQuality)}
            className="max-w-[5.5rem] appearance-none bg-transparent pr-1 text-white outline-none"
          >
            {NATIVE_HLS_QUALITIES.map((quality) => (
              <option key={quality} value={quality} className="text-black">
                {quality === "auto" ? "Auto" : quality}
              </option>
            ))}
          </select>
        </label>
      )}

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
        preferPlayback={requiresNativeHls ? undefined : "mse"}
        extraSourceParams={requiresNativeHls ? nativeHlsSourceParams : undefined}
        // A live match contains small, fast-moving detail. Do not let the
        // default player-size heuristic hold Auto to a lower rendition just
        // because chat makes the video column narrower on desktop.
        capRenditionToPlayerSize={isLive ? false : undefined}
        // Start from the best source rendition; Mux ABR can still step down
        // immediately when measured bandwidth cannot sustain it.
        renditionOrder={isLive ? "desc" : undefined}
        className="w-full h-full"
        primaryColor="#22c55e"
        accentColor="#16a34a"
        onPlay={handlePlay}
        onPause={handlePause}
        onError={handleError}
        onCanPlay={handleCanPlay}
        onStalled={handleStalled}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
      />
    </div>
  );
});

MuxPlayer.displayName = "MuxPlayer";
