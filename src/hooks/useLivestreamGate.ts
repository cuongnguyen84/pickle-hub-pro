import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "pkl_preview";

/**
 * Which player surface is consuming the preview. Keys are namespaced per
 * surface so the homepage hero cannot burn the watch page's budget (a user
 * who sampled 15s on the home hero still gets a full preview on /live/:id —
 * gate-at-second-0 on the watch page kills the signup funnel it exists for).
 */
export type GateSurface = "home" | "watch" | "embed";

interface UseLivestreamGateOptions {
  livestreamId: string;
  surface: GateSurface;
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
  /** Seconds actually watched in THIS page session (not persisted elapsed).
   * 0 at gate time means the viewer was blocked on arrival — the signal that
   * the preview budget was consumed elsewhere (reload, earlier visit). */
  sessionSeconds: number;
}

function seenKey(surface: GateSurface, livestreamId: string) {
  return `${STORAGE_KEY}_seen_${surface}_${livestreamId}`;
}

function elapsedKey(surface: GateSurface, livestreamId: string) {
  return `${STORAGE_KEY}_elapsed_${surface}_${livestreamId}`;
}

function hasSeenPreview(surface: GateSurface, livestreamId: string): boolean {
  try {
    return localStorage.getItem(seenKey(surface, livestreamId)) === "1";
  } catch {
    return false;
  }
}

function markPreviewSeen(surface: GateSurface, livestreamId: string) {
  try {
    localStorage.setItem(seenKey(surface, livestreamId), "1");
  } catch {
    /* ignore — private mode / storage disabled */
  }
}

/** Watched-seconds already consumed on this surface (survives reloads).
 * Clamped so NaN / negative / corrupted values can never over-lock the gate. */
function readElapsed(
  surface: GateSurface,
  livestreamId: string,
  previewSeconds: number,
): number {
  try {
    const raw = Number(localStorage.getItem(elapsedKey(surface, livestreamId)));
    if (!Number.isFinite(raw) || raw < 0) return 0;
    return Math.min(Math.floor(raw), previewSeconds);
  } catch {
    return 0;
  }
}

function writeElapsed(surface: GateSurface, livestreamId: string, elapsed: number) {
  try {
    localStorage.setItem(elapsedKey(surface, livestreamId), String(elapsed));
  } catch {
    /* ignore */
  }
}

export function useLivestreamGate({
  livestreamId,
  surface,
  previewSeconds,
  isEnabled,
  isAuthenticated,
  isPlaying,
}: UseLivestreamGateOptions): UseLivestreamGateResult {
  const [secondsRemaining, setSecondsRemaining] = useState(previewSeconds);
  const [isGated, setIsGated] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Skip gate entirely if authenticated or disabled
  const shouldGate = isEnabled && !isAuthenticated;

  // Seed from persisted state: a viewer who watched 14s and reloaded gets
  // ~1s, not a fresh 15s. `seen` stays as the final latch.
  useEffect(() => {
    if (!shouldGate) return;
    if (hasSeenPreview(surface, livestreamId)) {
      setIsGated(true);
      setSecondsRemaining(0);
      return;
    }
    const elapsed = readElapsed(surface, livestreamId, previewSeconds);
    if (elapsed >= previewSeconds) {
      markPreviewSeen(surface, livestreamId);
      setIsGated(true);
      setSecondsRemaining(0);
      return;
    }
    setSecondsRemaining(previewSeconds - elapsed);
  }, [shouldGate, surface, livestreamId, previewSeconds]);

  // Countdown timer - only ticks when playing
  useEffect(() => {
    if (!shouldGate || isGated || !isPlaying) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return undefined;
    }

    intervalRef.current = setInterval(() => {
      setSessionSeconds((s) => s + 1);
      setSecondsRemaining((prev) => {
        const next = Math.max(prev - 1, 0);
        writeElapsed(surface, livestreamId, previewSeconds - next);
        if (next <= 0) {
          setIsGated(true);
          markPreviewSeen(surface, livestreamId);
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [shouldGate, isGated, isPlaying, surface, livestreamId, previewSeconds]);

  const progress = previewSeconds > 0
    ? ((previewSeconds - secondsRemaining) / previewSeconds) * 100
    : 100;

  return {
    isGated,
    secondsRemaining,
    progress,
    showCountdown: shouldGate && !isGated,
    sessionSeconds,
  };
}
