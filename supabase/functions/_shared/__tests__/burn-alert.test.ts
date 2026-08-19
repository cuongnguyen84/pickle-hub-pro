import { describe, expect, it } from "vitest";
import {
  DEFAULT_BURN_CONFIG,
  burnMessageLines,
  evalBurn,
  isQuietHoursICT,
  type BurnState,
} from "../burn-alert";

// 12:00 ICT = 05:00 UTC (daytime) · 23:00 ICT = 16:00 UTC (quiet)
const DAY = new Date("2026-08-03T05:00:00Z");
const NIGHT = new Date("2026-08-03T16:00:00Z");
const ok: { volume: BurnState; budget: BurnState } = { volume: "ok", budget: "ok" };
const burningBoth: { volume: BurnState; budget: BurnState } = { volume: "burning", budget: "burning" };

describe("isQuietHoursICT", () => {
  it("22:00–07:00 ICT is quiet, boundaries exact", () => {
    expect(isQuietHoursICT(new Date("2026-08-03T15:00:00Z"))).toBe(true); // 22:00 ICT
    expect(isQuietHoursICT(new Date("2026-08-03T23:59:00Z"))).toBe(true); // 06:59 ICT
    expect(isQuietHoursICT(new Date("2026-08-03T00:00:00Z"))).toBe(false); // 07:00 ICT
    expect(isQuietHoursICT(new Date("2026-08-03T14:59:00Z"))).toBe(false); // 21:59 ICT
  });
});

describe("P1 volume layer (fingerprint-independent)", () => {
  it("fires p1 on ok→burning at the threshold", () => {
    const [vol] = evalBurn(25, 50, ok, DAY);
    expect(vol.newState).toBe("burning");
    expect(vol.alert).toBe("p1");
  });

  it("multi-fingerprint outage shape triggers it (the gap the spike alert misses)", () => {
    // 30 errors of 15 different fingerprints — per-fingerprint spike (≥3) sees nothing.
    const [vol] = evalBurn(30, 30, ok, DAY);
    expect(vol.alert).toBe("p1");
  });

  it("hysteresis: stays burning until below half the threshold, then recovers once", () => {
    const [still] = evalBurn(15, 50, burningBoth, DAY); // 15 ≥ 25/2 → hold
    expect(still.newState).toBe("burning");
    expect(still.alert).toBeNull();
    const [rec] = evalBurn(12, 50, burningBoth, DAY); // 12 < 12.5 → recover
    expect(rec.newState).toBe("ok");
    expect(rec.alert).toBe("recovery");
  });

  it("P1 fires even during quiet hours", () => {
    const [vol] = evalBurn(40, 60, ok, NIGHT);
    expect(vol.alert).toBe("p1");
  });
});

describe("P2 budget layer (24h detection vs 30d budget)", () => {
  it("fires p2 at ≥2× daily budget", () => {
    // budget 3000/30 = 100/day → 200/24h = 2.0×
    const [, budget] = evalBurn(0, 200, ok, DAY);
    expect(budget.newState).toBe("burning");
    expect(budget.alert).toBe("p2");
    expect(budget.burnRate).toBe(2);
  });

  it("below 2× does not enter; between 1× and 2× does not exit (hysteresis)", () => {
    const [, noEnter] = evalBurn(0, 150, ok, DAY);
    expect(noEnter.alert).toBeNull();
    expect(noEnter.newState).toBe("ok");
    const [, hold] = evalBurn(0, 150, burningBoth, DAY); // 1.5× — still burning
    expect(hold.newState).toBe("burning");
    expect(hold.alert).toBeNull();
    const [, rec] = evalBurn(0, 90, burningBoth, DAY); // 0.9× → recovery
    expect(rec.alert).toBe("recovery");
  });

  it("night quiet HOLDS p2 entry without persisting state, so 07:00 re-fires", () => {
    const [, night] = evalBurn(0, 300, ok, NIGHT);
    expect(night.alert).toBeNull();
    expect(night.heldByQuietHours).toBe(true);
    expect(night.newState).toBe("ok"); // NOT persisted as burning
    // Next daytime run with same numbers fires normally.
    const [, morning] = evalBurn(0, 300, ok, DAY);
    expect(morning.alert).toBe("p2");
  });

  it("recovery is NOT held by quiet hours", () => {
    const [, rec] = evalBurn(0, 50, burningBoth, NIGHT);
    expect(rec.alert).toBe("recovery");
    expect(rec.heldByQuietHours).toBe(false);
  });
});

describe("burnMessageLines — first line carries full meaning, VI, P1/P2 in words", () => {
  it("p1 first line has level, count, window, threshold", () => {
    const [vol] = evalBurn(47, 200, ok, DAY);
    const first = burnMessageLines(vol)[0];
    expect(first).toContain("P1");
    expect(first).toContain("47 lỗi/60 phút");
    expect(first).toContain("ngưỡng 25");
  });

  it("p2 first line has burn-rate and 30d budget", () => {
    const [, budget] = evalBurn(0, 210, ok, DAY);
    const first = burnMessageLines(budget)[0];
    expect(first).toContain("P2");
    expect(first).toContain("2.1×");
    expect(first).toContain(String(DEFAULT_BURN_CONFIG.budget30d));
  });

  it("recovery message exists for both slo keys", () => {
    const [vol, budget] = evalBurn(0, 0, burningBoth, DAY);
    expect(burnMessageLines(vol)[0]).toContain("✅");
    expect(burnMessageLines(budget)[0]).toContain("✅");
  });

  it("steady state emits nothing", () => {
    const [vol, budget] = evalBurn(0, 10, ok, DAY);
    expect(burnMessageLines(vol)).toEqual([]);
    expect(burnMessageLines(budget)).toEqual([]);
  });
});
