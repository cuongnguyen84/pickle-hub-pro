import { describe, it, expect } from "vitest";
import { slotAvailability } from "../slotCapacity";

describe("slotAvailability", () => {
  it("open slot", () => {
    expect(slotAvailability(4, 1)).toEqual({ taken: 1, remaining: 3, full: false });
  });

  it("undefined count treated as 0 taken", () => {
    expect(slotAvailability(4, undefined)).toEqual({ taken: 0, remaining: 4, full: false });
  });

  it("exactly full", () => {
    expect(slotAvailability(2, 2)).toEqual({ taken: 2, remaining: 0, full: true });
  });

  it("overbooked clamps remaining to 0 and stays full", () => {
    expect(slotAvailability(2, 5)).toEqual({ taken: 5, remaining: 0, full: true });
  });

  it("zero-capacity slot is always full", () => {
    expect(slotAvailability(0, 0)).toEqual({ taken: 0, remaining: 0, full: true });
  });
});
