import MuxPlayerReact from "@mux/mux-player-react";
import { useRef, useState, useCallback, forwardRef, useImperativeHandle, useEffect } from "react";
import { TapToPlayOverlay } from "./TapToPlayOverlay";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, RefreshCw, Loader2 } from "lucide-react";
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

const MAX_RETRIES = 3;
const STALL_TIMEOUT_MS = 10000; // 10 seconds
const HEALTH_CHECK_INTERVAL_MS = 5000; // 5 seconds
const RETRY_DELAYS = [2000, 4000, 8000]; // Exponential backoff

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
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Refs for health monitoring
  const lastCurrentTimeRef = useRef<number>(0);
  const stallTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPlayingRef = useRef(false);

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
    if (!isLive || !isPlayingRef.current) return;

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
  }));

  const handleTapToPlay = useCallback(async () => {
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
    setShowOverlay(false);
    setHasError(false);
    setIsReconnecting(false);
    setRetryCount(0);
    isPlayingRef.current = true;
  }, []);

  const handlePause = useCallback(() => {
    console.log("[MuxPlayer] Pause event");
    isPlayingRef.current = false;
    // Clear stall detection when paused
    if (stallTimeoutRef.current) {
      clearTimeout(stallTimeoutRef.current);
      stallTimeoutRef.current = null;
    }
  }, []);

  const handleError = useCallback((event: any) => {
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
        isVisible={showOverlay && !isReconnecting}
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
        onStalled={handleStalled}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
      />
    </div>
  );
});

MuxPlayer.displayName = "MuxPlayer";
