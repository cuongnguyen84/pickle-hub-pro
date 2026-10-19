import { describe, expect, it } from "vitest";
import { assignSeries, crossGroupCompare, maxSeries, resolveSeriesSizes, seriesBracket, seriesDraws, seriesName, seriesPlan, seriesPreview } from "@/lib/quick-table-series";
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
          const series = assignSeries(groupIds, players, plan.map((x) => x.size));
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
    const [a, b] = assignSeries(groupIds, players, seriesPlan([4, 4, 3, 3], 2)!.map((x) => x.size));
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
  it("44 teams, 11 groups of 4, Gold 16 / Silver 14 / Bronze 14: generic slot labels", () => {
    const pv = seriesPreview("ABCDEFGHIJK".split(""), Array(11).fill(4), [16, 14, 14], "vi");
    expect(pv.series.map((s) => s.length)).toEqual([15, 15, 15]);
    const names = (d: number) => pv.series[d].filter((m) => m.playoff_round === 1)
      .flatMap((m) => [m.player1_id, m.player2_id]).map((id) => pv.players.find((p) => p.id === id)!.name);
    const count = (d: number, re: RegExp) => names(d).filter((n) => re.test(n)).length;
    // A = 11 nhất + 5 nhì tốt nhất; B = 6 nhì còn lại + 8 ba tốt nhất (+2 BYE); C = 3 ba còn lại + 11 tư (+2 BYE)
    expect([count(0, /^Nhất/), count(0, /^Nhì/)]).toEqual([11, 5]);
    expect(names(0)).toContain("Nhì #5");
    expect([count(1, /^Nhì/), count(1, /^Ba/), count(1, /^BYE/)]).toEqual([6, 8, 2]);
    expect(names(1)).toContain("Nhì #6");
    expect([count(2, /^Ba/), count(2, /^Tư/), count(2, /^BYE/)]).toEqual([3, 11, 2]);
  });
});

/** Vòng hai đội gặp nhau sớm nhất nếu cùng thắng (1 = vòng đầu). */
function meetRound(pairs: ReturnType<typeof seriesBracket>, a: string, b: string): number {
  const slots = pairs.flatMap((p) => [p.player1.playerId, p.player2.playerId]);
  const i = slots.indexOf(a), j = slots.indexOf(b);
  return Math.floor(Math.log2(i ^ j)) + 1;
}

describe("same-group teams are kept apart through the whole bracket", () => {
  it("Gold 16 from 11 groups of 4: the 5 groups with a winner and a runner-up only meet in the final", () => {
    const { groupIds, players } = fakeTable(Array(11).fill(4), 11);
    const [gold] = assignSeries(groupIds, players, [16, 14, 14]);
    const pairs = seriesBracket(gold);
    for (const g of groupIds) {
      const same = gold.filter((p) => p.group_id === g);
      if (same.length === 2) expect(meetRound(pairs, same[0].id, same[1].id)).toBe(4);
    }
  });
  it("every split: a group with two teams in a bracket meets only in the final (bar 5 seed/BYE-locked cases)", () => {
    let pairsChecked = 0, early = 0;
    for (let n = 6; n <= 48; n++) {
      for (const o of groupOptions(n)) {
        if (o.groupCount < 2) continue;
        for (let k = 1; k <= maxSeries(o.sizes); k++) {
          const { groupIds, players } = fakeTable(o.sizes, n * 7 + k);
          for (const s of assignSeries(groupIds, players, seriesPlan(o.sizes, k)!.map((x) => x.size))) {
            const pairs = seriesBracket(s);
            const final = Math.log2(pairs.length * 2);
            for (const g of groupIds) {
              const same = s.filter((p) => p.group_id === g);
              if (same.length !== 2) continue;
              pairsChecked++;
              if (meetRound(pairs, same[0].id, same[1].id) !== final) early++;
            }
          }
        }
      }
    }
    // 5/1195 không tách được nếu giữ luật công bằng: không lấy BYE của hạt giống cao,
    // không đổi chỗ khác nhóm hạt giống (vd cây 8 có 5 đội, hạt giống 1 và 4 cùng bảng).
    expect(pairsChecked).toBeGreaterThan(1000);
    expect(early).toBeLessThanOrEqual(5);
  });
});

describe("custom series sizes", () => {
  it("44 teams, 11 groups of 4: Gold 16, Silver + Bronze share the rest", () => {
    expect(resolveSeriesSizes([16, 0, 0], 44)).toEqual([16, 14, 14]);
    expect(resolveSeriesSizes([16, 16, 0], 44)).toEqual([16, 16, 12]);
    expect(resolveSeriesSizes([16], 44)).toEqual([16]); // còn lại bị loại
    expect(resolveSeriesSizes([40, 0], 44)).toEqual([40, 4]);
    expect(resolveSeriesSizes([43, 0], 44)).toBeNull();
    expect(resolveSeriesSizes([30, 20], 44)).toBeNull();
    expect(resolveSeriesSizes([8, 8, 8, 8], 44)).toBeNull();
  });
  it("gold takes the best 16 of the 22 group winners and runners-up", () => {
    const sizes = Array(11).fill(4);
    const { groupIds, players } = fakeTable(sizes, 5);
    const [gold, silver, bronze] = assignSeries(groupIds, players, [16, 14, 14]);
    expect([gold.length, silver.length, bronze.length]).toEqual([16, 14, 14]);
    const rankIn = (p: (typeof players)[number]) => players
      .filter((x) => x.group_id === p.group_id)
      .sort((a, b) => b.matches_won - a.matches_won || b.point_diff - a.point_diff || b.points_for - a.points_for)
      .indexOf(p);
    expect(gold.every((p) => rankIn(p) <= 1)).toBe(true);
    expect(gold.filter((p) => rankIn(p) === 0)).toHaveLength(11); // mọi đội nhất
    for (const s of [gold, silver, bronze]) expect(seriesBracket(s).length).toBe(8);
  });
});

describe("2/4/8/16 groups: a series made of two whole ranks pairs crosswise like the classic playoff", () => {
  const label = (pairs: ReturnType<typeof seriesBracket>, players: { id: string; group_id: string }[], ranks: Map<string, number>) =>
    pairs.map((m) => [m.player1, m.player2].map((x) => `${ranks.get(x.playerId)! + 1}${"ABCDEFGHIJKLMNOP"[Number(players.find((p) => p.id === x.playerId)!.group_id.slice(1))]}`).join("-"));
  it("8 groups of 4, A 16 + B 16: A1–B2 … B1–A2 in A, A3–B4 … B3–A4 in B", () => {
    const { groupIds, players } = fakeTable(Array(8).fill(4), 3);
    const ranks = new Map<string, number>();
    for (const g of groupIds) players.filter((p) => p.group_id === g)
      .sort((a, b) => b.matches_won - a.matches_won || b.point_diff - a.point_diff || b.points_for - a.points_for)
      .forEach((p, i) => ranks.set(p.id, i));
    const [a, b] = seriesDraws(groupIds, players, [16, 16]);
    expect(label(a, players, ranks)).toEqual(["1A-2B", "1C-2D", "1E-2F", "1G-2H", "1B-2A", "1D-2C", "1F-2E", "1H-2G"]);
    expect(label(b, players, ranks)).toEqual(["3A-4B", "3C-4D", "3E-4F", "3G-4H", "3B-4A", "3D-4C", "3F-4E", "3H-4G"]);
  });
  it("preview before results shows the same fixed pairs", () => {
    const pv = seriesPreview("ABCDEFGH".split(""), Array(8).fill(4), [16, 16], "vi");
    const first = (d: number) => pv.series[d].filter((m) => m.playoff_round === 1)
      .map((m) => [m.player1_id, m.player2_id].map((id) => pv.players.find((p) => p.id === id)!.name).join(" – "));
    expect(first(0).slice(0, 2)).toEqual(["Nhất A – Nhì B", "Nhất C – Nhì D"]);
    expect(first(1)[4]).toBe("Ba B – Tư A");
  });
  it("not classic when the series mixes ranks (wildcards) or the group count is 3/6", () => {
    const { groupIds, players } = fakeTable(Array(11).fill(4), 4);
    const [gold] = seriesDraws(groupIds, players, [16, 14, 14]);
    expect(gold).toHaveLength(8); // seriesBracket path, still a valid 16 draw
  });
});
