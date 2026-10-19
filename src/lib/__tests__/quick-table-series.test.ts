import { describe, expect, it } from "vitest";
import { maxSeries, seriesName, splitIntoSeries } from "@/lib/quick-table-series";

describe("quick-table series", () => {
  it("only clean brackets get more than one series", () => {
    expect(maxSeries(8, 4)).toBe(2); // 32 đội: 16 vào A, 16 vào B
    expect(maxSeries(4, 6)).toBe(3);
    expect(maxSeries(4, 3)).toBe(1);
    expect(maxSeries(6, 4)).toBe(1); // cần vé vớt
    expect(maxSeries(2, 8)).toBe(3); // trần 3 nhánh
  });

  it("names", () => {
    expect(seriesName("series", 1, "vi")).toBe("Series B");
    expect(seriesName("medal", 0, "vi")).toBe("Nhánh Vàng");
    expect(seriesName("medal", 1, "en")).toBe("Silver bracket");
  });

  it("splits ranks 1-2 / 3-4 per group", () => {
    const p = (id: string, g: string, w: number) => ({ id, group_id: g, matches_won: w, point_diff: 0, points_for: 0 });
    const players = [p("a1", "A", 3), p("a4", "A", 0), p("a2", "A", 2), p("a3", "A", 1), p("b1", "B", 3), p("b2", "B", 2), p("b3", "B", 1), p("b4", "B", 0)];
    const s = splitIntoSeries(["A", "B"], players, 2);
    expect(s[0].map((g) => g.map((x) => x.id))).toEqual([["a1", "a2"], ["b1", "b2"]]);
    expect(s[1].map((g) => g.map((x) => x.id))).toEqual([["a3", "a4"], ["b3", "b4"]]);
  });
});
