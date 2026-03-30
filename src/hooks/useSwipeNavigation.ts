import { useEffect, useRef, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

interface SwipeState {
  startX: number;
  startY: number;
  currentX: number;
  isDragging: boolean;
}

const SWIPE_THRESHOLD = 80;
const MAX_INDICATOR_WIDTH = 60;

export function useSwipeNavigation(containerRef: React.RefObject<HTMLElement | null>) {
  const navigate = useNavigate();
  const swipeRef = useRef<SwipeState>({ startX: 0, startY: 0, currentX: 0, isDragging: false });
  const [swipeProgress, setSwipeProgress] = useState(0); // -1 to 1, negative = left, positive = right
  const [isActive, setIsActive] = useState(false);
  const lockedAxisRef = useRef<"horizontal" | "vertical" | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (window.innerWidth >= 768) return;

    const target = e.target as HTMLElement;
    if (target.closest("[data-no-swipe]") || target.closest(".embla") || target.closest("[role='slider']")) return;

    const touch = e.touches[0];
    swipeRef.current = { startX: touch.clientX, startY: touch.clientY, currentX: touch.clientX, isDragging: true };
    lockedAxisRef.current = null;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!swipeRef.current.isDragging || window.innerWidth >= 768) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - swipeRef.current.startX;
    const deltaY = touch.clientY - swipeRef.current.startY;

    if (!lockedAxisRef.current) {
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        lockedAxisRef.current = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
      }
    }

    if (lockedAxisRef.current !== "horizontal") {
      return;
    }

    swipeRef.current.currentX = touch.clientX;
    const progress = Math.max(-1, Math.min(1, deltaX / (SWIPE_THRESHOLD * 1.5)));
    setSwipeProgress(progress);
    setIsActive(true);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!swipeRef.current.isDragging) return;

    const deltaX = swipeRef.current.currentX - swipeRef.current.startX;

    if (lockedAxisRef.current === "horizontal" && Math.abs(deltaX) > SWIPE_THRESHOLD) {
      if (deltaX > 0) {
        navigate(-1);
      } else {
        navigate(1);
      }
    }

    swipeRef.current.isDragging = false;
    lockedAxisRef.current = null;
    setSwipeProgress(0);
    setIsActive(false);
  }, [navigate]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: true });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    el.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [containerRef, handleTouchStart, handleTouchMove, handleTouchEnd]);

  const indicatorWidth = Math.abs(swipeProgress) * MAX_INDICATOR_WIDTH;
  const indicatorSide = swipeProgress > 0 ? "left" : "right";
  const indicatorOpacity = Math.abs(swipeProgress);
  const isThresholdMet = Math.abs(swipeProgress) > 0.6;

  return { isActive, indicatorWidth, indicatorSide, indicatorOpacity, isThresholdMet };
}
