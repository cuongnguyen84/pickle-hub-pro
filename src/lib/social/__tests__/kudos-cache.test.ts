import { describe, it, expect } from "vitest";
import {
  patchFeedPages,
  type FeedPagesShape,
} from "../kudos-cache";

/**
 * Pure row-update tests for the optimistic kudos patcher. The hook owns
 * the cache walk; this file pins the row-shape transform so a regression
 * in the inner map is caught without spinning up React Query.
 */

interface Row {
  match_id: string;
  kudos_count?: number;
  viewer_kudoed?: boolean;
  // Extra fields ensure we don't drop unrelated columns.
  slug?: string;
  played_at?: string;
}

const seed = (rows: Row[][]): FeedPagesShape<Row> => ({
  pages: rows,
  pageParams: rows.map((_, i) => (i === 0 ? null : { foo: i })),
});

describe("patchFeedPages", () => {
  it("kudo (+1, true) increments count and flips viewer_kudoed", () => {
    const data = seed([
      [
        { match_id: "a", kudos_count: 3, viewer_kudoed: false, slug: "alpha" },
      ],
    ]);
    const out = patchFeedPages(data, "a", { count: 1, kudoed: true });
    expect(out.pages?.[0][0]).toEqual({
      match_id: "a",
      kudos_count: 4,
      viewer_kudoed: true,
      slug: "alpha",
    });
  });

  it("unkudo (-1, false) decrements count and flips viewer_kudoed", () => {
    const data = seed([
      [{ match_id: "a", kudos_count: 5, viewer_kudoed: true }],
    ]);
    const out = patchFeedPages(data, "a", { count: -1, kudoed: false });
    expect(out.pages?.[0][0].kudos_count).toBe(4);
    expect(out.pages?.[0][0].viewer_kudoed).toBe(false);
  });

  it("clamps kudos_count to 0 floor on stale unkudo", () => {
    // If the cached count is already 0 (cache freshly hydrated, never had
    // kudos) and the user somehow triggers unkudo, the optimistic delta
    // shouldn't go negative — server will correct on success anyway.
    const data = seed([
      [{ match_id: "a", kudos_count: 0, viewer_kudoed: true }],
    ]);
    const out = patchFeedPages(data, "a", { count: -1, kudoed: false });
    expect(out.pages?.[0][0].kudos_count).toBe(0);
  });

  it("treats undefined kudos_count as 0 baseline", () => {
    const data = seed([[{ match_id: "a" }]]);
    const out = patchFeedPages(data, "a", { count: 1, kudoed: true });
    expect(out.pages?.[0][0].kudos_count).toBe(1);
    expect(out.pages?.[0][0].viewer_kudoed).toBe(true);
  });

  it("skips non-matching rows on the same page", () => {
    const data = seed([
      [
        { match_id: "a", kudos_count: 1, viewer_kudoed: false, slug: "alpha" },
        { match_id: "b", kudos_count: 7, viewer_kudoed: true, slug: "bravo" },
      ],
    ]);
    const out = patchFeedPages(data, "a", { count: 1, kudoed: true });
    // a patched
    expect(out.pages?.[0][0].kudos_count).toBe(2);
    expect(out.pages?.[0][0].viewer_kudoed).toBe(true);
    // b untouched (not even shape-wise — slug preserved)
    expect(out.pages?.[0][1]).toEqual({
      match_id: "b",
      kudos_count: 7,
      viewer_kudoed: true,
      slug: "bravo",
    });
  });

  it("patches the same match across multiple pages", () => {
    // Realistic when a viewer scrolled a long Trending list and the same
    // match somehow surfaced in two cached infinite-query keys (e.g.,
    // following + trending caches both held by the queryClient).
    const data = seed([
      [{ match_id: "a", kudos_count: 1, viewer_kudoed: false }],
      [
        { match_id: "x", kudos_count: 9, viewer_kudoed: true },
        { match_id: "a", kudos_count: 1, viewer_kudoed: false },
      ],
    ]);
    const out = patchFeedPages(data, "a", { count: 1, kudoed: true });
    expect(out.pages?.[0][0].kudos_count).toBe(2);
    expect(out.pages?.[1][1].kudos_count).toBe(2);
    expect(out.pages?.[1][0].kudos_count).toBe(9); // unrelated row safe
  });

  it("returns input untouched when pages is undefined", () => {
    const data: FeedPagesShape<Row> = { pageParams: [null] };
    const out = patchFeedPages(data, "a", { count: 1, kudoed: true });
    expect(out).toBe(data);
  });

  it("does not mutate the input object", () => {
    const data = seed([
      [{ match_id: "a", kudos_count: 1, viewer_kudoed: false }],
    ]);
    const before = JSON.stringify(data);
    patchFeedPages(data, "a", { count: 1, kudoed: true });
    expect(JSON.stringify(data)).toBe(before);
  });
});
