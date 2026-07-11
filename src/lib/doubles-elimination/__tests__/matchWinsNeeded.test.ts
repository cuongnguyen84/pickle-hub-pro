import { describe, it, expect } from "vitest";
import { matchWinsNeeded } from "../matchWinsNeeded";

describe("matchWinsNeeded", () => {
  it("computes wins needed for valid best-of values", () => {
    expect(matchWinsNeeded(1)).toBe(1);
    expect(matchWinsNeeded(3)).toBe(2);
    expect(matchWinsNeeded(5)).toBe(3);
    expect(matchWinsNeeded(7)).toBe(4);
  });

  // Regression: a null/invalid best_of used to yield Math.ceil(null/2) === 0,
  // so winsNeeded was 0 and the match completed after zero games won.
  it("returns null for a missing or invalid best_of (never 0)", () => {
    expect(matchWinsNeeded(null)).toBeNull();
    expect(matchWinsNeeded(undefined)).toBeNull();
    expect(matchWinsNeeded(0)).toBeNull();
    expect(matchWinsNeeded(-3)).toBeNull();
    expect(matchWinsNeeded(NaN)).toBeNull();
  });
});
