// ============================================================================
// Date and time helpers — the three ways they can mislead
// ----------------------------------------------------------------------------
// Small functions, used on surfaces where being wrong is not cosmetic: a
// tournament card, a match time, "how long ago" on a feed item. Three failures
// are worth pinning:
//
//   · a null or unparseable date must produce a placeholder, never "NaN" or
//     "Invalid Date" on a page;
//   · relative time must not round a future into the past — "2m ago" for
//     something that has not happened yet is worse than no label;
//   · the boundaries between minutes, hours and days must land on one side.
//
// The clock is frozen, because a test that reads Date.now() twice is a test
// that fails at midnight once a year.
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { formatDate, formatTime, formatRelative } from "../format-datetime";

const NOW = new Date("2026-08-13T10:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("formatDate", () => {
  it("splits a date into the parts a card renders", () => {
    const out = formatDate("2026-08-13T10:00:00.000Z");
    expect(out.d).toBe("13");
    expect(out.m).toBe("AUG");
    expect(out.full).toContain("2026");
  });

  it("pads a single-digit day so a column of dates lines up", () => {
    expect(formatDate("2026-08-03T10:00:00.000Z").d).toBe("03");
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["an empty string", ""],
    ["nonsense", "not-a-date"],
  ])("shows a placeholder for %s rather than Invalid Date", (_label, input) => {
    const out = formatDate(input as string | null | undefined);
    expect(out).toEqual({ d: "—", m: "—", full: "" });
    expect(JSON.stringify(out)).not.toMatch(/nan|invalid/i);
  });
});

describe("formatTime", () => {
  it("renders a 24-hour clock, zero-padded", () => {
    expect(formatTime("2026-08-13T09:05:00.000Z")).toMatch(/^\d{2}:\d{2}$/);
  });

  it.each([["null", null], ["undefined", undefined], ["nonsense", "nope"]])(
    "renders nothing at all for %s",
    (_label, input) => {
      expect(formatTime(input as string | null | undefined)).toBe("");
    },
  );
});

describe("formatRelative", () => {
  const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

  it("says now inside the first minute, in both directions", () => {
    expect(formatRelative(at(0))).toBe("now");
    expect(formatRelative(at(20_000))).toBe("now");
    expect(formatRelative(at(-20_000))).toBe("now");
  });

  it("never describes a future moment in the past tense", () => {
    // "2m ago" for something that has not happened is the failure this exists
    // to prevent — a viewer plans around it.
    for (const ms of [2 * 60_000, 3 * 3_600_000, 4 * 86_400_000]) {
      expect(formatRelative(at(ms))).toMatch(/^in /);
      expect(formatRelative(at(ms))).not.toMatch(/ago/);
    }
  });

  it("uses minutes, then hours, then days, and crosses each boundary once", () => {
    expect(formatRelative(at(-5 * 60_000))).toBe("5m ago");
    expect(formatRelative(at(-59 * 60_000))).toBe("59m ago");
    // 60 minutes is an hour, not "60m ago".
    expect(formatRelative(at(-60 * 60_000))).toBe("1h ago");
    expect(formatRelative(at(-23 * 3_600_000))).toBe("23h ago");
    expect(formatRelative(at(-24 * 3_600_000))).toBe("1d ago");
    expect(formatRelative(at(-9 * 86_400_000))).toBe("9d ago");
  });

  it("mirrors the same boundaries into the future", () => {
    expect(formatRelative(at(5 * 60_000))).toBe("in 5m");
    expect(formatRelative(at(60 * 60_000))).toBe("in 1h");
    expect(formatRelative(at(24 * 3_600_000))).toBe("in 1d");
  });

  it.each([["null", null], ["undefined", undefined], ["nonsense", "soon"]])(
    "renders nothing for %s",
    (_label, input) => {
      expect(formatRelative(input as string | null | undefined)).toBe("");
    },
  );
});

describe("formatRelative — Vietnamese", () => {
  const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

  // Until 2026-08-19 this helper had no locale at all and returned "10h ago"
  // on every Vietnamese page across seven surfaces, for an audience that is
  // ~95% Vietnamese. These pin the strings so it cannot silently regress to
  // English again.
  it("says vừa xong inside the first minute, in both directions", () => {
    for (const ms of [0, 20_000, -20_000]) {
      expect(formatRelative(at(ms), "vi")).toBe("vừa xong");
    }
  });

  it("puts the unit before the marker for the past", () => {
    expect(formatRelative(at(-5 * 60_000), "vi")).toBe("5 phút trước");
    expect(formatRelative(at(-3 * 3_600_000), "vi")).toBe("3 giờ trước");
    expect(formatRelative(at(-4 * 86_400_000), "vi")).toBe("4 ngày trước");
  });

  it("uses the trong-prefix for the future, not a past-tense suffix", () => {
    // Vietnamese marks the future with a prefix where English uses "in", so
    // the string differs in shape and not merely in vocabulary.
    expect(formatRelative(at(5 * 60_000), "vi")).toBe("trong 5 phút");
    expect(formatRelative(at(3 * 3_600_000), "vi")).toBe("trong 3 giờ");
    expect(formatRelative(at(4 * 86_400_000), "vi")).toBe("trong 4 ngày");
    for (const ms of [2 * 60_000, 3 * 3_600_000, 4 * 86_400_000]) {
      expect(formatRelative(at(ms), "vi")).not.toContain("trước");
    }
  });

  it("keeps English as the default so an un-migrated caller is unchanged", () => {
    expect(formatRelative(at(-5 * 60_000))).toBe("5m ago");
    expect(formatRelative(at(-5 * 60_000), "en")).toBe("5m ago");
  });

  it("returns empty for a missing or unparseable value in either locale", () => {
    for (const lang of ["vi", "en"] as const) {
      expect(formatRelative(null, lang)).toBe("");
      expect(formatRelative(undefined, lang)).toBe("");
      expect(formatRelative("not-a-date", lang)).toBe("");
    }
  });
});
