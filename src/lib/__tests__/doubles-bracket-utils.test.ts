import { describe, it, expect } from "vitest";
import {
  nextPowerOf2,
  getBestOfForRound,
  generateSeedPositions,
  generateShareId,
  assignCourtAndTime,
} from "../doubles-bracket-utils";

describe("nextPowerOf2", () => {
  it("rounds up to the next power of two", () => {
    expect(nextPowerOf2(1)).toBe(1);
    expect(nextPowerOf2(2)).toBe(2);
    expect(nextPowerOf2(3)).toBe(4);
    expect(nextPowerOf2(9)).toBe(16);
    expect(nextPowerOf2(16)).toBe(16);
    expect(nextPowerOf2(17)).toBe(32);
  });
});

describe("getBestOfForRound", () => {
  it("final and third_place use the finals format", () => {
    expect(getBestOfForRound("final", "bo1", "bo1", "bo5")).toBe(5);
    expect(getBestOfForRound("third_place", "bo1", "bo1", "bo3")).toBe(3);
    expect(getBestOfForRound("final", "bo5", "bo5", "bo1")).toBe(1);
  });

  it("semifinal uses the semifinals format", () => {
    expect(getBestOfForRound("semifinal", "bo1", "bo5", "bo1")).toBe(5);
    expect(getBestOfForRound("semifinal", "bo1", "bo3", "bo1")).toBe(3);
    expect(getBestOfForRound("semifinal", "bo5", "bo1", "bo5")).toBe(1);
  });

  it("earlier rounds use the early format", () => {
    expect(getBestOfForRound("elimination", "bo3", "bo1", "bo1")).toBe(3);
    expect(getBestOfForRound("quarterfinal", "bo5", "bo1", "bo1")).toBe(5);
    expect(getBestOfForRound("quarterfinal", "bo1", "bo3", "bo5")).toBe(1);
  });
});

describe("generateSeedPositions", () => {
  it.each([2, 4, 8, 16, 32, 64])("bracket %i: every position appears exactly once", (size) => {
    const positions = generateSeedPositions(size);
    expect(positions).toHaveLength(size);
    expect([...positions].sort((a, b) => a - b)).toEqual(
      Array.from({ length: size }, (_, i) => i),
    );
  });

  it("seed 1 and seed 2 land in opposite halves (canonical hardcoded tables)", () => {
    for (const size of [4, 8, 16, 32]) {
      const positions = generateSeedPositions(size);
      // positions[i] = bracket slot of seed i+1
      expect(positions[0]).toBe(0);
      expect(positions[1]).toBe(size - 1);
    }
  });

  it("64 uses the recursive fallback and keeps top seeds apart", () => {
    const positions = generateSeedPositions(64);
    expect(positions[0]).toBe(0);
    expect(positions[1]).toBe(63);
  });
});

describe("generateShareId", () => {
  it("8 lowercase alphanumeric chars", () => {
    const id = generateShareId();
    expect(id).toMatch(/^[a-z0-9]{8}$/);
  });
});

describe("assignCourtAndTime", () => {
  it("fills the least-loaded court and advances its slot", () => {
    const courtNextSlot = new Map<number, number>([
      [1, 1],
      [2, 0],
    ]);
    const r = assignCourtAndTime(courtNextSlot, [1, 2], 18, 0, 30);
    expect(r.courtNumber).toBe(2);
    expect(r.startTime).toBe("18:00");
    expect(courtNextSlot.get(2)).toBe(1);
  });

  it("computes start time from slot index and wraps past midnight", () => {
    const courtNextSlot = new Map<number, number>([[1, 3]]);
    const r = assignCourtAndTime(courtNextSlot, [1], 23, 15, 30);
    // slot 3 → +90 min from 23:15 → 00:45 next day
    expect(r.courtNumber).toBe(1);
    expect(r.startTime).toBe("00:45");
  });
});
