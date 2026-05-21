import { useCallback, useEffect, useState } from "react";

/**
 * Tracks which /feed Trending items the current viewer has already clicked
 * through to, so the score-based sort can demote them next time the user
 * comes back to the page.
 *
 * Storage: localStorage["tph_feed_viewed_v1"] = { [cursor_id]: epochMs }.
 * Trimmed to the most recent VIEWED_MAX entries, dropping anything older
 * than VIEWED_TTL_DAYS. Per Anh's UX brief: "user nào đã xem thì đẩy
 * content mới" — we DOWNRANK rather than hide so the user can still scroll
 * back to a previously-seen item.
 *
 * Notes:
 *   - SSR-safe: guards window access for the Cloudflare Pages bot prerender.
 *   - No cross-tab sync (storage event) yet — feed isn't multi-tab heavy and
 *     the cost (a small flicker on second tab when viewing an item) is
 *     acceptable for v1.
 *   - cursor_id matches whatever the FeedTimelineItem / FeedNewsItem hooks
 *     emit (e.g. "news:<uuid>", "en-blog:<slug>", or the match UUID), so
 *     marking + lookup keys line up exactly with the merged stream.
 */

const STORAGE_KEY = "tph_feed_viewed_v1";
const VIEWED_TTL_DAYS = 14;
const VIEWED_MAX = 200;

function safeLoad(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function prune(map: Record<string, number>): Record<string, number> {
  const cutoff = Date.now() - VIEWED_TTL_DAYS * 24 * 60 * 60 * 1000;
  const entries = Object.entries(map).filter(([, ts]) => ts >= cutoff);
  entries.sort((a, b) => b[1] - a[1]);
  return Object.fromEntries(entries.slice(0, VIEWED_MAX));
}

function safeSave(map: Record<string, number>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage quota / privacy mode — fail silently.
  }
}

export interface FeedViewedTracker {
  /** True if the viewer has clicked the card with this cursor_id before. */
  isViewed: (cursorId: string) => boolean;
  /** Mark a card as viewed (idempotent, persists to localStorage). */
  markViewed: (cursorId: string) => void;
  /** Snapshot Set for use in sort comparators (stable per render). */
  viewedSet: Set<string>;
}

export function useFeedViewedTracking(): FeedViewedTracker {
  const [map, setMap] = useState<Record<string, number>>(() => prune(safeLoad()));

  // Persist whenever the in-memory map mutates.
  useEffect(() => {
    safeSave(map);
  }, [map]);

  const markViewed = useCallback((cursorId: string) => {
    if (!cursorId) return;
    setMap((prev) => {
      if (prev[cursorId] && Date.now() - prev[cursorId] < 60_000) return prev; // dedupe rapid clicks
      const next = { ...prev, [cursorId]: Date.now() };
      return prune(next);
    });
  }, []);

  const isViewed = useCallback(
    (cursorId: string) => Boolean(map[cursorId]),
    [map]
  );

  const viewedSet = new Set(Object.keys(map));

  return { isViewed, markViewed, viewedSet };
}
