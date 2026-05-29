// ============================================================================
// Phase 3C — unit tests for the DUPR seeding math (pure functions).
// ----------------------------------------------------------------------------
// rankBySeed + seedCoverage drive bracket seeding from DUPR ratings. They're
// pure (no I/O), but the module imports the supabase client at the top for
// fetchDuprSeeds, so we mock that import to keep the test environment clean.
// ============================================================================

import { describe, it, expect, vi } from "vitest";

// seedFromDupr imports `supabase` from the client module at load time; mock it
// so importing the pure helpers doesn't try to spin up a real client.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  rankBySeed,
  seedCoverage,
  type SeedablePlayer,
} from "../seedFromDupr";

type Ratings = Map<
  string,
  { rating: number | null; syncedAt: string | null; isApprox?: boolean }
>;

const recentIso = new Date().toISOString();
const staleIso = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();

function ratings(
  entries: Record<
    string,
    { rating: number | null; syncedAt?: string | null; isApprox?: boolean }
  >,
): Ratings {
  const m: Ratings = new Map();
  for (const [id, v] of Object.entries(entries)) {
    m.set(id, { rating: v.rating, syncedAt: v.syncedAt ?? null, isApprox: v.isApprox });
  }
  return m;
}

describe("rankBySeed", () => {
  it("orders by DUPR descending and assigns seeds 1..n", () => {
    const players: SeedablePlayer[] = [
      { id: "a", name: "Alpha" },
      { id: "b", name: "Bravo" },
      { id: "c", name: "Charlie" },
    ];
    const ranked = rankBySeed(
      players,
      ratings({ a: { rating: 4.0 }, b: { rating: 4.5 }, c: { rating: 3.0 } }),
    );
    expect(ranked.map((p) => p.name)).toEqual(["Bravo", "Alpha", "Charlie"]);
    expect(ranked.map((p) => p.seed)).toEqual([1, 2, 3]);
  });

  it("ranks rated players above unrated ones", () => {
    const ranked = rankBySeed(
      [
        { id: "x", name: "NoRating" },
        { id: "y", name: "Rated" },
      ],
      ratings({ y: { rating: 3.2 } }),
    );
    expect(ranked[0].name).toBe("Rated");
    expect(ranked[1].dupr).toBeNull();
  });

  it("manual seed override wins outright", () => {
    const ranked = rankBySeed(
      [
        { id: "top", name: "TopDupr" },
        { id: "man", name: "ManualOne", manualSeed: 1 },
      ],
      ratings({ top: { rating: 5.0 } }),
    );
    expect(ranked[0].name).toBe("ManualOne");
    expect(ranked[0].seed).toBe(1);
  });

  it("falls back to Vietnamese-locale alphabetical when both unrated", () => {
    const ranked = rankBySeed(
      [
        { id: null, name: "Bình" },
        { id: null, name: "An" },
      ],
      ratings({}),
    );
    expect(ranked.map((p) => p.name)).toEqual(["An", "Bình"]);
  });

  it("flags stale ratings and propagates isApprox", () => {
    const ranked = rankBySeed(
      [
        { id: "s", name: "Stale" },
        { id: "f", name: "Fresh" },
      ],
      ratings({
        s: { rating: 4.0, syncedAt: staleIso },
        f: { rating: 4.2, syncedAt: recentIso, isApprox: true },
      }),
    );
    const byName = Object.fromEntries(ranked.map((p) => [p.name, p]));
    expect(byName["Stale"].isStale).toBe(true);
    expect(byName["Fresh"].isStale).toBe(false);
    expect(byName["Fresh"].isApprox).toBe(true);
  });

  it("does not mutate the input array", () => {
    const players: SeedablePlayer[] = [
      { id: "a", name: "Alpha" },
      { id: "b", name: "Bravo" },
    ];
    const snapshot = JSON.stringify(players);
    rankBySeed(players, ratings({ a: { rating: 3 }, b: { rating: 4 } }));
    expect(JSON.stringify(players)).toBe(snapshot);
  });
});

describe("seedCoverage", () => {
  it("summarises rated / unrated / stale / approx + coverage pct", () => {
    const ranked = rankBySeed(
      [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
        { id: "c", name: "C" },
        { id: "d", name: "D" },
      ],
      ratings({
        a: { rating: 4.0, syncedAt: recentIso },
        b: { rating: 3.5, syncedAt: staleIso },
        c: { rating: 3.0, syncedAt: recentIso, isApprox: true },
        // d: unrated
      }),
    );
    const cov = seedCoverage(ranked);
    expect(cov.total).toBe(4);
    expect(cov.withDupr).toBe(3);
    expect(cov.withoutDupr).toBe(1);
    expect(cov.stale).toBe(1);
    expect(cov.approx).toBe(1);
    expect(cov.coveragePct).toBeCloseTo(0.75, 5);
  });

  it("coveragePct is 0 for an empty field (no divide-by-zero)", () => {
    const cov = seedCoverage([]);
    expect(cov.total).toBe(0);
    expect(cov.coveragePct).toBe(0);
  });
});
