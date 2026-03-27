import { useState, useEffect, useRef } from "react";

/**
 * Detects virtual keyboard height using the Visual Viewport API.
 * Returns 0 when keyboard is closed or on desktop.
 * Only activates on mobile (< 1024px width).
 */
export const useKeyboardHeight = (): number => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const baselineHeightRef = useRef(0);

  useEffect(() => {
    const vv = window.visualViewport;

    const getVisibleViewportHeight = () => {
      if (!vv) return window.innerHeight;
      return vv.height + vv.offsetTop;
    };

    const update = () => {
      // Only on mobile-sized screens
      if (window.innerWidth >= 1024) {
        baselineHeightRef.current = getVisibleViewportHeight();
        setKeyboardHeight(0);
        return;
      }

      const currentVisibleHeight = getVisibleViewportHeight();

      if (
        baselineHeightRef.current === 0 ||
        currentVisibleHeight >= baselineHeightRef.current - 32
      ) {
        baselineHeightRef.current = Math.max(baselineHeightRef.current, currentVisibleHeight);
      }

      // On iOS/WKWebView, window.innerHeight may also shrink with the keyboard,
      // so compare against the largest observed visual viewport instead.
      const diff = baselineHeightRef.current - currentVisibleHeight;

      // Threshold to avoid false positives from address bar changes
      setKeyboardHeight(diff > 80 ? Math.round(diff) : 0);
    };

    update();

    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return keyboardHeight;
};
