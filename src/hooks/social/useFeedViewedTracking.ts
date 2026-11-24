/**
 * Tracks which feed items the current viewer has already seen, so the
 * next visit can sink them below everything still unseen.
 *
 * Items are marked in two ways: when a card actually enters the viewport
 * (IntersectionObserver in Feed.tsx / HomeNewsFeed.tsx) and when it is
 * clicked through. Storage: localStorage["tph_feed_viewed_v1"] =
 * { [cursor_id]: { t: epochMs, e?: engagementAtMark } }, trimmed to the
 * most recent VIEWED_MAX entries and anything younger than
 * VIEWED_TTL_DAYS. Legacy entries written as a bare epochMs number are
 * still understood (they simply carry no engagement baseline).
 *
 * Ordering contract (per the platforms' published patterns - X's
 * seen-filter, Facebook's unseen-first candidate pool, Instagram's
 * "You're All Caught Up"): unseen items first (newest first), then seen
 * items (newest first). The partition must use the AT-LOAD snapshot
 * (viewedAtLoad / viewedEntriesAtLoad), never the live map: items marked
 * during this visit take effect on the NEXT load, so the list never
 * re-orders itself under the reader's thumb, and a card scrolled past
 * in this session never reappears above on load-more or refresh.
 *
 * Revival (Facebook pattern): a seen item whose engagement (kudos +
 * comments, when the payload carries them - match items only today)
 * has GROWN since the last mark counts as having something new and
 * rejoins the unseen group. The comparison baseline is the engagement
 * value stored at mark time (`e`).
 *
 * Notes:
 *   - SSR-safe: guards window access for the Cloudflare Pages bot prerender.
 *   - No cross-tab sync (storage event) yet - acceptable for v1.
 *   - cursor_id matches whatever the feed hooks emit (e.g. "news:<uuid>",
 *     "en-blog:<slug>", or the match UUID), so marking + lookup keys line
 *     up exactly with the merged stream.
 */

import { useCallback, useMemo, useState } from "react";

const STORAGE_KEY = "tph_feed_viewed_v1";
const VIEWED_TTL_DAYS = 30;
const VIEWED_MAX = 1000;
const VIEWED_TTL_MS = VIEWED_TTL_DAYS * 24 * 60 * 60 * 1000;

export interface ViewedEntry {
  /** epochMs of the last mark. */
  t: number;
  /** Engagement (kudos + comments) at mark time, when the item has any. */
  e?: number;
}

type ViewedMap = Record<string, ViewedEntry>;

function hasStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function safeLoad(): ViewedMap {
  if (!hasStorage()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const out: ViewedMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        out[key] = { t: value };
      } else if (
        value !== null &&
        typeof value === "object" &&
        typeof (value as ViewedEntry).t === "number"
      ) {
        const entry = value as ViewedEntry;
        out[key] = typeof entry.e === "number"
          ? { t: entry.t, e: entry.e }
          : { t: entry.t };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function prune(map: ViewedMap, now = Date.now()): ViewedMap {
  const cutoff = now - VIEWED_TTL_MS;
  const entries = Object.entries(map)
    .filter(([, entry]) => entry.t >= cutoff)
    .sort((a, b) => b[1].t - a[1].t)
    .slice(0, VIEWED_MAX);
  return Object.fromEntries(entries);
}

function safeSave(map: ViewedMap) {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage full/blocked - the in-memory map still works this session.
  }
}

export interface FeedViewedTracker {
  /** True if the viewer has seen the card with this cursor_id before. */
  isViewed: (cursorId: string) => boolean;
  /**
   * Mark a card as seen (idempotent, persists to localStorage). Pass
   * the item's current engagement (kudos + comments) when it has any -
   * it becomes the baseline for the revival comparison on later loads.
   */
  markViewed: (cursorId: string, engagement?: number) => void;
  /** Snapshot Set for use in sort comparators (stable per render). */
  viewedSet: Set<string>;
  /**
   * Ids already seen when this page loaded. Ordering sinks these below
   * unseen items; marks made during this visit are NOT in here, so the
   * visible order stays stable while reading.
   */
  viewedAtLoad: ReadonlySet<string>;
  /** At-load entries with their engagement baselines (revival checks). */
  viewedEntriesAtLoad: ReadonlyMap<string, ViewedEntry>;
}

export function useFeedViewedTracking(): FeedViewedTracker {
  const [map, setMap] = useState<ViewedMap>(() => prune(safeLoad()));
  // Snapshot of what was already seen at load time (the initial map).
  // Ordering reads these, so they never change during the visit.
  const [viewedEntriesAtLoad] = useState<ReadonlyMap<string, ViewedEntry>>(
    () => new Map(Object.entries(map)),
  );
  const viewedAtLoad = useMemo<ReadonlySet<string>>(
    () => new Set(viewedEntriesAtLoad.keys()),
    [viewedEntriesAtLoad],
  );

  const markViewed = useCallback((cursorId: string, engagement?: number) => {
    if (!cursorId) return;
    setMap((prev) => {
      const existing = prev[cursorId];
      // Marking again within a minute with the same engagement is a
      // no-op (scroll/click observers can fire repeatedly).
      if (
        existing &&
        Date.now() - existing.t < 60_000 &&
        existing.e === engagement
      ) {
        return prev;
      }
      const next = prune({
        ...prev,
        [cursorId]: engagement === undefined
          ? { t: Date.now(), ...(existing?.e !== undefined ? { e: existing.e } : {}) }
          : { t: Date.now(), e: engagement },
      });
      safeSave(next);
      return next;
    });
  }, []);

  const isViewed = useCallback(
    (cursorId: string) => Object.prototype.hasOwnProperty.call(map, cursorId),
    [map],
  );

  const viewedSet = new Set(Object.keys(map));

  return { isViewed, markViewed, viewedSet, viewedAtLoad, viewedEntriesAtLoad };
}
