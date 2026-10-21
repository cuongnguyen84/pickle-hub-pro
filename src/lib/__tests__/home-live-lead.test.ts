// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LIVE_LEAD_HINT_TTL_MS,
  readLiveLeadHint,
  shouldReserveLiveSlot,
  writeLiveLeadHint,
} from "../home-live-lead";

const KEY = "tph.home-live-lead";
const NOW = 1_755_000_000_000;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("home live-lead hint", () => {
  it("returns null on a first ever visit — unknown, not known-absent", () => {
    expect(readLiveLeadHint(NOW)).toBeNull();
  });

  it("round-trips a positive hint written on a previous visit", () => {
    writeLiveLeadHint(true, NOW);
    expect(readLiveLeadHint(NOW)).toBe(true);
  });

  it("round-trips a negative hint so an absent live slot stays unreserved", () => {
    writeLiveLeadHint(false, NOW);
    expect(readLiveLeadHint(NOW)).toBe(false);
    expect(shouldReserveLiveSlot(NOW)).toBe(false);
  });

  it("survives a new session — the regression this module exists for", () => {
    // sessionStorage was cleared between sessions, which left the first
    // pageview of every session unreserved. The hint must outlive it.
    writeLiveLeadHint(true, NOW);
    sessionStorage.clear();
    expect(readLiveLeadHint(NOW)).toBe(true);
  });

  it("persists to localStorage, not sessionStorage", () => {
    writeLiveLeadHint(true, NOW);
    expect(localStorage.getItem(KEY)).not.toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it("still trusts a hint one millisecond inside the TTL", () => {
    writeLiveLeadHint(true, NOW);
    expect(readLiveLeadHint(NOW + LIVE_LEAD_HINT_TTL_MS - 1)).toBe(true);
  });

  it("drops a hint that has reached the TTL", () => {
    writeLiveLeadHint(true, NOW);
    expect(readLiveLeadHint(NOW + LIVE_LEAD_HINT_TTL_MS)).toBeNull();
  });

  it("expires on the same 7 days the replay window keeps a stream in the lead slot", () => {
    expect(LIVE_LEAD_HINT_TTL_MS).toBe(7 * 86_400_000);
  });

  it("distrusts a future-dated hint, because a backwards clock makes stale look fresh", () => {
    writeLiveLeadHint(true, NOW + 60_000);
    expect(readLiveLeadHint(NOW)).toBeNull();
  });

  it("ignores a corrupt value instead of throwing", () => {
    localStorage.setItem(KEY, "not json");
    expect(() => readLiveLeadHint(NOW)).not.toThrow();
    expect(readLiveLeadHint(NOW)).toBeNull();
  });

  it("ignores the old sessionStorage-era value shape", () => {
    // The previous implementation stored the bare strings "1" / "0".
    localStorage.setItem(KEY, "1");
    expect(readLiveLeadHint(NOW)).toBeNull();
  });

  it("ignores a hint missing its timestamp", () => {
    localStorage.setItem(KEY, JSON.stringify({ leads: true }));
    expect(readLiveLeadHint(NOW)).toBeNull();
  });

  it("returns null rather than throwing when storage reads are blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError: storage disabled");
    });
    expect(readLiveLeadHint(NOW)).toBeNull();
  });

  it("swallows a write failure — losing the hint only costs one shift", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => writeLiveLeadHint(true, NOW)).not.toThrow();
  });
});

describe("shouldReserveLiveSlot", () => {
  // The live slot leads whenever a stream is on air, scheduled, or ended
  // within seven days, so an occupied slot is the ordinary state on this site.
  // Reserving is therefore the right guess when we have nothing to go on.
  it("reserves on a first ever visit, when nothing is known yet", () => {
    expect(shouldReserveLiveSlot(NOW)).toBe(true);
  });

  it("reserves when the last visit saw the slot lead", () => {
    writeLiveLeadHint(true, NOW);
    expect(shouldReserveLiveSlot(NOW)).toBe(true);
  });

  it("only declines when a live hint positively says the slot was empty", () => {
    writeLiveLeadHint(false, NOW);
    expect(shouldReserveLiveSlot(NOW)).toBe(false);
  });

  it("goes back to reserving once a negative hint expires", () => {
    writeLiveLeadHint(false, NOW);
    expect(shouldReserveLiveSlot(NOW + LIVE_LEAD_HINT_TTL_MS)).toBe(true);
  });

  it("reserves when storage is unavailable rather than gambling on empty", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError: storage disabled");
    });
    expect(shouldReserveLiveSlot(NOW)).toBe(true);
  });
});
