import { useState, useEffect, useRef, useCallback } from "react";

const STORAGE_KEY = "pkl_preview_seen";

interface UseLivestreamGateOptions {
  livestreamId: string;
  previewSeconds: number;
  isEnabled: boolean;
  isAuthenticated: boolean;
  isPlaying: boolean;
}

interface UseLivestreamGateResult {
  isGated: boolean;
  secondsRemaining: number;
  progress: number; // 0-100
  showCountdown: boolean;
}

function getSeenKey(livestreamId: string) {
  return `${STORAGE_KEY}_${livestreamId}`;
}

function hasSeenPreview(livestreamId: string): boolean {
  try {
    return localStorage.getItem(getSeenKey(livestreamId)) === "1";
  } catch {
    return false;
  }
}

function markPreviewSeen(livestreamId: string) {
  try {
    localStorage.setItem(getSeenKey(livestreamId), "1");
  } catch {}
}

export function useLivestreamGate({
  livestreamId,
  previewSeconds,
  isEnabled,
  isAuthenticated,
  isPlaying,
}: UseLivestreamGateOptions): UseLivestreamGateResult {
  const [secondsRemaining, setSecondsRemaining] = useState(previewSeconds);
  const [isGated, setIsGated] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Skip gate entirely if authenticated or disabled
  const shouldGate = isEnabled && !isAuthenticated;

  // Check if already seen preview
  useEffect(() => {
    if (shouldGate && hasSeenPreview(livestreamId)) {
      setIsGated(true);
      setSecondsRemaining(0);
    }
  }, [shouldGate, livestreamId]);

  // Countdown timer - only ticks when playing
  useEffect(() => {
    if (!shouldGate || isGated || !isPlaying) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setIsGated(true);
          markPreviewSeen(livestreamId);
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [shouldGate, isGated, isPlaying, livestreamId]);

  // Reset when previewSeconds changes
  useEffect(() => {
    if (!isGated) {
      setSecondsRemaining(previewSeconds);
    }
  }, [previewSeconds, isGated]);

  const progress = previewSeconds > 0
    ? ((previewSeconds - secondsRemaining) / previewSeconds) * 100
    : 100;

  return {
    isGated,
    secondsRemaining,
    progress,
    showCountdown: shouldGate && !isGated,
  };
}
