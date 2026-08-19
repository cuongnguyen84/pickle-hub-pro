/**
 * Remembers whether the live slot led the homepage last time, so the hero slot
 * can be reserved from first paint instead of inserting itself above the
 * editorial section once the livestream queries resolve.
 *
 * CLS INC3 shipped this hint in sessionStorage. That reserves the slot on
 * repeat navigations and leaves the first pageview of every new session
 * unreserved — and that pageview is the one CrUX weights most, because most
 * sessions on a content site are one or two views. Field data on 2026-08-19
 * put CLS at p75 0.37 on mobile with 37.5% of real users above 0.25, while
 * lab runs, which always start from a clean profile, scored 0.9.
 *
 * Moving the hint to localStorage keeps the semantics identical and narrows
 * the unreserved case from "every new session" to "first ever visit on this
 * device". The first visit still shifts once; nothing available at first paint
 * can predict the slot without a network round trip.
 *
 * The hint carries a timestamp and expires after the same 7 days the replay
 * window keeps an ended stream in the lead slot. Past that the sticky state it
 * recorded is no longer a fair prediction, and reserving nothing beats
 * reserving wrongly — a skeleton that resolves to an absent section shifts
 * just as much as a section that appears.
 */

const STORAGE_KEY = "tph.home-live-lead";

/** Matches the 7-day replay window in Index.tsx that makes the slot sticky. */
export const LIVE_LEAD_HINT_TTL_MS = 7 * 86_400_000;

interface LiveLeadHint {
  leads: boolean;
  at: number;
}

/**
 * Whether the live slot should be reserved on this paint. False whenever the
 * hint is missing, malformed, expired, or future-dated (a clock moved
 * backwards makes a stale hint look fresh, so treat it as untrustworthy).
 */
export function readLiveLeadHint(now: number = Date.now()): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<LiveLeadHint> | null;
    if (typeof parsed?.leads !== "boolean" || typeof parsed?.at !== "number") {
      return false;
    }
    const age = now - parsed.at;
    if (age < 0 || age >= LIVE_LEAD_HINT_TTL_MS) return false;
    return parsed.leads;
  } catch {
    // Private mode, disabled storage, or a corrupt value. The hint is an
    // optimisation; never let it break the render.
    return false;
  }
}

/** Records the resolved lead state for the next visit. Never throws. */
export function writeLiveLeadHint(leads: boolean, now: number = Date.now()): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ leads, at: now }));
  } catch {
    /* quota or disabled storage — losing the hint only costs one shift */
  }
}
