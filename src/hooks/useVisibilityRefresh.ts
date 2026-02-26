import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook that fires a callback when the document becomes visible again.
 * Includes a minimum interval to avoid rapid re-fires.
 * Also sets up a polling fallback that runs only when the document is visible.
 */
export function useVisibilityRefresh(
  onRefresh: () => void,
  { minInterval = 5000, pollingInterval = 20000 } = {}
) {
  const lastRefreshRef = useRef(Date.now());
  const refreshingRef = useRef(false);

  const doRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastRefreshRef.current < minInterval) return;
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    lastRefreshRef.current = now;
    try {
      onRefresh();
    } finally {
      // Allow next refresh after a short delay
      setTimeout(() => { refreshingRef.current = false; }, 1000);
    }
  }, [onRefresh, minInterval]);

  // Visibility change listener
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        doRefresh();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [doRefresh]);

  // Polling fallback - only when visible
  useEffect(() => {
    if (!pollingInterval) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') {
        doRefresh();
      }
    }, pollingInterval);
    return () => clearInterval(id);
  }, [doRefresh, pollingInterval]);

  return doRefresh;
}
