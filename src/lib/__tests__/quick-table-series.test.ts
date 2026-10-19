import { describe, expect, it } from "vitest";
import { assignSeries, crossGroupCompare, maxSeries, seriesBracket, seriesName, seriesPlan, seriesPreview } from "@/lib/quick-table-series";
import { groupOptions } from "@/lib/quick-table-chat";
import { BYE_PLAYER_ID } from "@/lib/quick-table-playoff";

/** Giải giả: mỗi bảng có kết quả ngẫu nhiên nhưng cố định. */
function fakeTable(sizes: number[], seed = 1) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const groupIds = sizes.map((_, g) => `g${g}`);
  const players = sizes.flatMap((n, g) =>
    Array.from({ length: n }, (_, i) => {
      const played = n - 1;
      const won = Math.floor(rnd() * (played + 1));
      return { id: `g${g}p${i}`, name: `g${g}p${i}`, group_id: `g${g}`, matches_played: played, matches_won: won, point_diff: Math.round((rnd() - 0.5) * 30), points_for: Math.round(rnd() * 40) };
    }),
  );
  return { groupIds, players };
}

describe("seriesPlan — the examples Cuong asked about", () => {
  const sizes = (n: number, g: number) => groupOptions(n).find((o) => o.groupCount === g)!.sizes;
  it("24 teams", () => {
    expect(seriesPlan(sizes(24, 4), 3)?.map((x) => x.size)).toEqual([8, 8, 8]);
    expect(seriesPlan(sizes(24, 8), 2)?.map((x) => x.size)).toEqual([16, 8]);
  });
  it("26 teams, 8 groups: B = 10 in a 16 draw, 6 byes", () => {
    expect(seriesPlan(sizes(26, 8), 2)).toEqual([{ size: 16, bracket: 16, byes: 0 }, { size: 10, bracket: 16, byes: 6 }]);
  });
  it("28 teams, 6 groups: A 16 with 4 wildcards, B 8 + C 4 or B 12", () => {
    expect(seriesPlan(sizes(28, 6), 2)?.map((x) => [x.size, x.byes])).toEqual([[16, 0], [12, 4]]);
    expect(seriesPlan(sizes(28, 6), 3)?.map((x) => x.size)).toEqual([16, 8, 4]);
  });
});

describe("every team count 6–48, every group split, every series count", () => {
  for (let n = 6; n <= 48; n++) {
    for (const o of groupOptions(n)) {
      if (o.groupCount < 2) continue;
      for (let k = 1; k <= maxSeries(o.sizes); k++) {
        it(`${n} teams · ${o.groupCount} groups · ${k} series`, () => {
          const plan = seriesPlan(o.sizes, k)!;
          expect(plan).not.toBeNull();
          if (k >= 2) expect(plan.reduce((a, x) => a + x.size, 0)).toBe(n); // ai cũng được đánh tiếp
          for (const x of plan) {
            expect(x.size).toBeGreaterThanOrEqual(2);
            expect(x.bracket & (x.bracket - 1)).toBe(0);
            expect(x.byes).toBeLessThan(x.bracket / 2); // không bao giờ BYE gặp BYE
          }

          const { groupIds, players } = fakeTable(o.sizes, n * 31 + k);
          const series = assignSeries(groupIds, players, k);
          expect(series.map((s) => s.length)).toEqual(plan.map((x) => x.size));
          const ids = series.flat().map((p) => p.id);
          expect(new Set(ids).size).toBe(ids.length);

          series.forEach((s, d) => {
            const pairs = seriesBracket(s);
            expect(pairs).toHaveLength(plan[d].bracket / 2);
            const real = pairs.flatMap((p) => [p.player1, p.player2]).filter((x) => x.playerId !== BYE_PLAYER_ID);
            expect(real).toHaveLength(s.length);
            for (const p of pairs) expect(p.player1.playerId === BYE_PLAYER_ID && p.player2.playerId === BYE_PLAYER_ID).toBe(false);
            // BYE thuộc về hạt giống cao nhất
            const byeSeeds = pairs.filter((p) => p.player1.playerId === BYE_PLAYER_ID || p.player2.playerId === BYE_PLAYER_ID)
              .map((p) => Math.min(p.player1.seed, p.player2.seed)).sort((a, b) => a - b);
            expect(byeSeeds).toEqual(Array.from({ length: plan[d].byes }, (_, i) => i + 1));
          });
        });
      }
    }
  }
});

describe("ordering", () => {
  it("series A gets every group's top 2, series B the rest", () => {
    const { groupIds, players } = fakeTable([4, 4, 3, 3], 7);
    const [a, b] = assignSeries(groupIds, players, 2);
    expect(a).toHaveLength(8);
    expect(b).toHaveLength(6);
  });
  it("compares across groups per match, not by totals", () => {
    const three = { id: "x", name: "x", group_id: "a", matches_played: 2, matches_won: 2, point_diff: 10, points_for: 22 };
    const four = { id: "y", name: "y", group_id: "b", matches_played: 3, matches_won: 2, point_diff: 10, points_for: 30 };
    expect(crossGroupCompare(three, four)).toBeLessThan(0); // 2/2 thắng xếp trên 2/3
  });
  it("names", () => {
    expect(seriesName("series", 1, "vi")).toBe("Series B");
    expect(seriesName("medal", 0, "vi")).toBe("Nhánh Vàng");
    expect(seriesName("medal", 1, "en")).toBe("Silver bracket");
  });
});

describe("seriesPreview — bracket per series before the playoff exists", () => {
  it("26 teams in 8 groups, 2 series, nothing played yet", () => {
    const sizes = [4, 4, 3, 3, 3, 3, 3, 3];
    const { groupIds, players } = fakeTable(sizes, 3);
    const zero = players.map((p) => ({ ...p, matches_played: 0, matches_won: 0, point_diff: 0, points_for: 0 }));
    const groups = groupIds.map((id, i) => ({ id, name: "ABCDEFGH"[i] }));
    const pv = seriesPreview(groups, zero, 2, "vi");
    expect(pv.series.map((s) => s.length)).toEqual([15, 15]); // 16 suất: 8+4+2+1
    const name = (id: string | null) => pv.players.find((p) => p.id === id)?.name;
    const a1 = pv.series[0].filter((m) => m.playoff_round === 1).flatMap((m) => [name(m.player1_id), name(m.player2_id)]);
    expect(a1.filter((n) => n?.startsWith("Nhất"))).toHaveLength(8);
    expect(a1.filter((n) => n?.startsWith("Nhì"))).toHaveLength(8);
    const b1 = pv.series[1].filter((m) => m.playoff_round === 1).flatMap((m) => [name(m.player1_id), name(m.player2_id)]);
    expect(b1.filter((n) => n === "BYE")).toHaveLength(6);
    expect(b1.filter((n) => n?.startsWith("Ba"))).toHaveLength(8);
    expect(b1.filter((n) => n?.startsWith("Tư"))).toHaveLength(2);
  });
});
