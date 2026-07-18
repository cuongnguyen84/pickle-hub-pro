// @vitest-environment jsdom
// Unit tests for the social-events pure helpers pulled into the ARCH-02
// characterization surface: format.ts + myRegistration.ts (localStorage).

import { describe, it, expect, beforeEach } from "vitest";
import {
  formatEventDateRange,
  computeCountdown,
  formatPriceVnd,
  formatLevelRange,
  interp,
} from "../format";
import {
  saveMyRegistration,
  readMyRegistration,
  clearMyRegistration,
} from "../myRegistration";

describe("formatEventDateRange", () => {
  it("vi: weekday title-cased, VN timezone, 'đến' separator", () => {
    // 2026-05-16T12:00Z = 19:00 ICT Saturday
    const s = formatEventDateRange(
      "2026-05-16T12:00:00Z",
      "2026-05-16T14:30:00Z",
      "vi",
    );
    expect(s).toBe("Thứ Bảy, 16/05/2026 — 19:00 đến 21:30");
  });

  it("en: 'to' separator, capitalized weekday", () => {
    const s = formatEventDateRange(
      "2026-05-16T12:00:00Z",
      "2026-05-16T14:30:00Z",
      "en",
    );
    expect(s).toContain("16/05/2026");
    expect(s).toContain("19:00 to 21:30");
  });

  it("invalid dates fall back to raw ISO strings", () => {
    expect(formatEventDateRange("garbage", "2026-05-16T14:30:00Z", "vi")).toBe(
      "garbage — 2026-05-16T14:30:00Z",
    );
  });
});

describe("computeCountdown", () => {
  const start = "2026-05-16T12:00:00Z";
  const end = "2026-05-16T14:00:00Z";

  it("ended when now past end", () => {
    const r = computeCountdown(start, end, "vi", new Date("2026-05-16T15:00:00Z"));
    expect(r.state).toBe("ended");
    expect(r.text).toBeNull();
  });

  it("started when now inside window", () => {
    const r = computeCountdown(start, end, "vi", new Date("2026-05-16T13:00:00Z"));
    expect(r.state).toBe("started");
  });

  it("days out (vi)", () => {
    const r = computeCountdown(start, end, "vi", new Date("2026-05-13T12:00:00Z"));
    expect(r).toMatchObject({ state: "upcoming", text: "3 ngày", days: 3 });
  });

  it("hours out (en, singular)", () => {
    const r = computeCountdown(start, end, "en", new Date("2026-05-16T10:30:00Z"));
    expect(r).toMatchObject({ state: "upcoming", text: "1 hour", hours: 1 });
  });

  it("minutes out, floors to at least 1 phút", () => {
    const r = computeCountdown(start, end, "vi", new Date("2026-05-16T11:59:40Z"));
    expect(r).toMatchObject({ state: "upcoming", text: "1 phút", minutes: 1 });
  });

  it("invalid dates → ended", () => {
    expect(computeCountdown("x", end, "vi", new Date()).state).toBe("ended");
  });
});

describe("formatPriceVnd", () => {
  it("0 / negative → free label", () => {
    expect(formatPriceVnd(0, "vi", "Miễn phí")).toBe("Miễn phí");
    expect(formatPriceVnd(-5, "en", "Free")).toBe("Free");
  });

  it("vi grouping uses dots", () => {
    expect(formatPriceVnd(120000, "vi", "Miễn phí")).toBe("120.000₫");
  });

  it("en grouping uses commas", () => {
    expect(formatPriceVnd(120000, "en", "Free")).toBe("120,000₫");
  });
});

describe("formatLevelRange", () => {
  it("both bounds", () => expect(formatLevelRange(3.5, 4)).toBe("3.5 — 4.0"));
  it("min only", () => expect(formatLevelRange(3.5, null)).toBe("3.5+"));
  it("max only", () => expect(formatLevelRange(null, 4)).toBe("≤ 4.0"));
  it("neither → null", () => expect(formatLevelRange(null, undefined)).toBeNull());
});

describe("interp", () => {
  it("replaces placeholders, keeps unknown keys literal", () => {
    expect(interp("Còn {remaining}/{capacity} chỗ — {x}", { remaining: 3, capacity: 4 })).toBe(
      "Còn 3/4 chỗ — {x}",
    );
  });
});

describe("myRegistration localStorage round-trip", () => {
  beforeEach(() => localStorage.clear());

  it("save → read returns the payload with a 90-day expiry stamped", () => {
    saveMyRegistration("ev-1", {
      magic_token: "tok1",
      registration_id: "r1",
      display_name: "A",
      registered_at: "2026-07-18T00:00:00Z",
    });
    const r = readMyRegistration("ev-1");
    expect(r?.magic_token).toBe("tok1");
    expect(r?.registration_id).toBe("r1");
    expect(new Date(r!.expires_at!).getTime()).toBeGreaterThan(Date.now());
  });

  it("reads the legacy tph-event-magic key with legacy `token` field", () => {
    localStorage.setItem(
      "tph-event-magic:ev-2",
      JSON.stringify({ token: "legacy-tok" }),
    );
    expect(readMyRegistration("ev-2")?.magic_token).toBe("legacy-tok");
  });

  it("expired entry → null", () => {
    localStorage.setItem(
      "pickle-hub:registration:ev-3",
      JSON.stringify({ magic_token: "t", expires_at: "2020-01-01T00:00:00Z" }),
    );
    expect(readMyRegistration("ev-3")).toBeNull();
  });

  it("malformed JSON / missing token → null", () => {
    localStorage.setItem("pickle-hub:registration:ev-4", "{not json");
    expect(readMyRegistration("ev-4")).toBeNull();
    localStorage.setItem("pickle-hub:registration:ev-5", JSON.stringify({ a: 1 }));
    expect(readMyRegistration("ev-5")).toBeNull();
  });

  it("clear removes both new and legacy keys", () => {
    localStorage.setItem("pickle-hub:registration:ev-6", JSON.stringify({ magic_token: "t" }));
    localStorage.setItem("tph-event-magic:ev-6", JSON.stringify({ token: "t" }));
    clearMyRegistration("ev-6");
    expect(readMyRegistration("ev-6")).toBeNull();
  });
});
