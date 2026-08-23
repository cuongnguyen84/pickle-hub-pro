import { describe, it, expect } from "vitest";
import { fetchAllRows } from "../sitemap-helpers";

/**
 * Regression guard for the 2026-08-23 sitemap-news truncation: PostgREST
 * caps a response at 1000 rows, so a single `.limit(5000)` silently served
 * only the 500 newest news URLs. fetchAllRows must keep paging past 1000.
 */
function fakeTable(total: number) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  const calls: [number, number][] = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    return { data: rows.slice(from, to + 1), error: null };
  };
  return { page, calls };
}

describe("fetchAllRows", () => {
  it("pages past the 1000-row PostgREST cap", async () => {
    const { page, calls } = fakeTable(1531);
    const out = await fetchAllRows<{ id: number }>(page);
    expect(out).toHaveLength(1531);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("stops after one call when the table is small", async () => {
    const { page, calls } = fakeTable(42);
    expect(await fetchAllRows(page)).toHaveLength(42);
    expect(calls).toHaveLength(1);
  });

  it("stops on an exact multiple of the page size without duplicating rows", async () => {
    const { page } = fakeTable(2000);
    expect(await fetchAllRows(page)).toHaveLength(2000);
  });

  it("returns what it has instead of throwing when a page errors", async () => {
    let n = 0;
    const out = await fetchAllRows<{ id: number }>(async (from) => {
      if (n++ === 1) return { data: null, error: { message: "boom" } };
      return {
        data: Array.from({ length: 1000 }, (_, i) => ({ id: from + i })),
        error: null,
      };
    });
    expect(out).toHaveLength(1000);
  });
});
