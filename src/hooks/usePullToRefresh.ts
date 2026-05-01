import { useEffect, useRef, useState } from "react";
import { isIOS } from "@/lib/capacitor-utils";

/**
 * Pull-to-refresh on the main `.tl-scroll` container, iOS-native only.
 *
 * UX rules:
 *   - Only fires when the scroll container is at scrollTop === 0 when
 *     the touch starts. Mid-scroll pulls are ignored so the user doesn't
 *     accidentally trigger refresh while reading further down a feed.
 *   - Threshold 60 px. Below the threshold the indicator just animates
 *     proportionally — release without triggering.
 *   - While refreshing, further pulls are no-ops until onRefresh resolves.
 *   - touch listeners use { passive: true } to keep the bounce buttery
 *     on iOS Safari WebView; we never preventDefault.
 *
 * Caller is responsible for invalidating React Query keys inside
 * onRefresh and returning the resulting promise.
 */
export interface PullToRefreshState {
  pullDistance: number;
  isRefreshing: boolean;
  triggered: boolean;
}

const PULL_THRESHOLD_PX = 60;
const MAX_PULL_PX = 120;
const RESISTANCE = 0.5;

export function usePullToRefresh(onRefresh: () => Promise<unknown>): PullToRefreshState {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startYRef = useRef<number | null>(null);
  const isActiveRef = useRef(false);
  const refreshingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  useEffect(() => {
    if (!isIOS()) return;

    const container = document.querySelector<HTMLElement>(".tl-scroll");
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (container.scrollTop > 0) return;
      startYRef.current = e.touches[0].clientY;
      isActiveRef.current = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isActiveRef.current || startYRef.current === null) return;
      if (refreshingRef.current) return;

      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0) {
        setPullDistance(0);
        return;
      }
      const resisted = Math.min(delta * RESISTANCE, MAX_PULL_PX);
      setPullDistance(resisted);
    };

    const handleTouchEnd = async () => {
      if (!isActiveRef.current) return;
      isActiveRef.current = false;
      startYRef.current = null;

      const fired = pullDistanceRef.current >= PULL_THRESHOLD_PX;
      if (fired && !refreshingRef.current) {
        refreshingRef.current = true;
        setIsRefreshing(true);
        setPullDistance(PULL_THRESHOLD_PX);
        try {
          await onRefreshRef.current();
        } finally {
          refreshingRef.current = false;
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: true });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });
    container.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, []);

  return {
    pullDistance,
    isRefreshing,
    triggered: pullDistance >= PULL_THRESHOLD_PX,
  };
}
