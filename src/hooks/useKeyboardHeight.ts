import { useState, useEffect } from "react";

/**
 * Detects virtual keyboard height using the Visual Viewport API.
 * Returns 0 when keyboard is closed or on desktop.
 * Only activates on mobile (< 1024px width).
 */
export const useKeyboardHeight = (): number => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      // Only on mobile-sized screens
      if (window.innerWidth >= 1024) {
        setKeyboardHeight(0);
        return;
      }
      // keyboard height = difference between layout viewport and visual viewport
      const diff = window.innerHeight - vv.height;
      // Threshold to avoid false positives from address bar changes
      setKeyboardHeight(diff > 50 ? diff : 0);
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return keyboardHeight;
};
