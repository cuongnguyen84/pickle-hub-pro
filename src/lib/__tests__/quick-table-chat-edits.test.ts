import { describe, expect, it } from "vitest";
import {
  applyPatch,
  applySpokenEdit,
  dropInventedRoster,
  factualAck,
  findGroupOption,
  messageNeedsModel,
  keepOrAssign,
  lockAdvance,
  nextSlot,
  playoffSummary,
  readUserFacts,
  wantsSingleGroupRoundRobin,
  replyFromDraft,
  type Draft,
  type Entry,
} from "@/lib/quick-table-chat";
import { generateCircleMethodMatches, scheduleMatches } from "@/lib/round-robin";
import { singleGroupPlayoffPlans, seriesDraws } from "@/lib/quick-table-series";

const teams = (names: string[]): Entry[] => names.map((p1) => ({ p1 }));

describe("readUserFacts", () => {
  it("reads groups, name and doubles from the first sentence", () => {
    const facts = readUserFacts("2 bang + playoff, ten giai TEST Grok doi");
    expect(facts.group_count).toBe(2);
    expect(facts.name).toBe("TEST Grok");
    expect(facts.is_doubles).toBe(true);
    expect(facts.player_count).toBeUndefined();
    expect(facts.advance_per_group).toBeUndefined();
  });

  it("top 2 mỗi bảng is an advance rule, not a group count or a roster", () => {
    for (const text of ["top 2 mỗi bảng", "lay 2 nguoi moi bang vao vong trong", "lấy 2 đội mỗi bảng"]) {
      const facts = readUserFacts(text);
      expect(facts.advance_per_group).toBe(2);
      expect(facts.group_count).toBeUndefined();
      expect(facts.player_count).toBeUndefined();
    }
  });

  it("does not treat đổi chỗ as doubles", () => {
    expect(readUserFacts("đổi chỗ An với Bình").is_doubles).toBeUndefined();
  });

  it("mỗi bảng lấy N vào vòng loại trực tiếp is one knockout, with or without accents", () => {
    const sentences = [
      "Giai TEST Grok 3, 8 doi, 2 bang, moi bang lay 2 doi vao vong loai truc tiep",
      "Giải TEST Grok 3, 8 đội, 2 bảng, mỗi bảng lấy 2 đội vào vòng loại trực tiếp",
      "Giải TEST Grok 3, 8 đội, 2 bảng, mỗi bảng lấy 2 đội vào trong",
      "Giải TEST Grok 3, 8 đội, 2 bảng, mỗi bảng lấy 2 đội đi tiếp",
    ];
    for (const text of sentences) {
      const facts = readUserFacts(text);
      expect(facts.name).toBe("TEST Grok 3");
      expect(facts.is_doubles).toBe(true);
      expect(facts.player_count).toBe(8);
      expect(facts.group_count).toBe(2);
      expect(facts.advance_per_group).toBe(2);
      expect(facts.series).toBe(1);
      const locked = applySpokenEdit({}, text);
      expect(locked?.series).toBe(1);
      expect(locked?.series_sizes).toEqual([4]);
      expect(nextSlot({ ...locked!, roster_mode: "later", courts_done: true, options_done: true })).not.toBe("series");
      const ack = factualAck({}, locked!, "vi", text);
      expect(ack).toContain("đúng 2 mỗi bảng");
      expect(ack).not.toContain("Hết vòng bảng");
    }
    const many = readUserFacts("8 đội, 2 bảng, nhiều vòng");
    expect(many.advance_per_group).toBeUndefined();
    expect(many.series).toBeUndefined();
  });
});

describe("lockAdvance", () => {
  it("top 2 from 3 groups is exactly 6, with no extra 3rd places", () => {
    const d = lockAdvance({ is_doubles: false, player_count: 12, group_count: 3, advance_per_group: 2, entries: teams("abcdefghijkl".split("")) });
    expect(d.series).toBe(1);
    expect(d.series_sizes).toEqual([6]);
    expect(nextSlot({ ...d, name: "A", courts_done: true, options_done: true, roster_mode: "now" })).not.toBe("series");
  });
});

describe("placeholder names", () => {
  const waiting: Draft = { is_doubles: true, player_count: 8, group_count: 2, roster_mode: undefined };

  it("dùng tên mẫu and chưa có tên create editable Đội placeholders and leave the roster question", () => {
    for (const text of ["Chưa có tên, dùng tên cặp mẫu giúp mình", "chưa có tên", "dùng tên mẫu"]) {
      const next = applySpokenEdit(waiting, text);
      expect(next?.entries?.map((e) => e.p1)).toEqual(["Đội 1", "Đội 2", "Đội 3", "Đội 4", "Đội 5", "Đội 6", "Đội 7", "Đội 8"]);
      expect(next?.pairing_done).toBe(true);
      expect(nextSlot(next!)).not.toBe("roster");
      const ack = factualAck(waiting, next!, "vi", text);
      expect(ack).toContain("Đội 1");
      expect(ack).not.toBe("Bản nháp chưa đổi.");
      const again = applySpokenEdit(next!, text);
      expect(nextSlot(again!)).not.toBe("roster");
    }
  });

  it("singles placeholders are Người 1…", () => {
    const next = applySpokenEdit({ is_doubles: false, player_count: 4 }, "dùng tên mẫu");
    expect(next?.entries?.map((e) => e.p1)).toEqual(["Người 1", "Người 2", "Người 3", "Người 4"]);
  });
});

describe("applySpokenEdit", () => {
  const start: Draft = {
    is_doubles: false,
    player_count: 8,
    group_count: 1,
    entries: teams(["An", "Bình", "Chi", "Dũng", "Em", "Phong", "Giang", "Hà"]),
  };

  it("swaps two players and a later regroup keeps that order", () => {
    const swapped = applySpokenEdit(start, "đổi chỗ An với Bình");
    expect(swapped?.entries?.map((e) => e.p1)).toEqual(["Bình", "An", "Chi", "Dũng", "Em", "Phong", "Giang", "Hà"]);
    expect(swapped?.group_count).toBe(1);
    const regrouped = applySpokenEdit(swapped!, "chia 2 bảng");
    expect(regrouped?.entries?.map((e) => e.p1)).toEqual(["Bình", "An", "Chi", "Dũng", "Em", "Phong", "Giang", "Hà"]);
    expect(regrouped?.group_count).toBe(2);
  });

  it("renames without reshuffling the rest", () => {
    const next = applySpokenEdit(start, "đổi tên Chi thành Lan");
    expect(next?.entries?.map((e) => e.p1)).toEqual(["An", "Bình", "Lan", "Dũng", "Em", "Phong", "Giang", "Hà"]);
  });
});

describe("keepOrAssign", () => {
  it("keeps indexes on a swap and re-deals in order when the group count changes", () => {
    expect(keepOrAssign([0, 1, 0, 1], 4, 2, 2)).toEqual([0, 1, 0, 1]);
    expect(keepOrAssign([0, 1, 2, 0], 4, 3, 2)).toEqual([0, 1, 0, 1]);
    expect(keepOrAssign([], 4, 0, 2)).toBeNull();
  });
});

describe("factual replies", () => {
  const before: Draft = { is_doubles: true, group_count: 3, entries: teams(["An", "Bình"]) };

  it("does not say it received players when no list arrived", () => {
    const after = applyPatch(before, {});
    const reply = replyFromDraft(before, after, "Đã nhận 16 người.", "vi", "chia 2 bảng");
    expect(reply.toLowerCase()).not.toContain("đã nhận");
    expect(reply).toContain("2 bảng");
  });

  it("does not claim a group change the draft does not show", () => {
    const ack = factualAck(before, before, "vi", "chia 2 bảng");
    expect(ack).toContain("Không chia được 2 bảng");
    expect(ack).not.toContain("Đã chia");
  });

  it("drops an invented roster the user never typed", () => {
    const patch = dropInventedRoster(
      { entries: [{ p1: "Ma" }, { p1: "Ảo" }], player_count: 16, group_count: 2 },
      "top 2 mỗi bảng",
      undefined,
    );
    expect(patch.entries).toBeUndefined();
    expect(patch.player_count).toBeUndefined();
    expect(patch.group_count).toBeUndefined();
  });
});

describe("opening sentence", () => {
  const text = "Giải TEST Grok 1, 6 người đánh đơn, 1 bảng, 2 sân, đánh vòng tròn";
  const bare = "giai TEST Grok 1, 6 nguoi danh don, 1 bang, 2 san, danh vong tron";

  it("keeps the name, singles, one group and two courts", () => {
    for (const line of [text, bare]) {
      const facts = readUserFacts(line);
      expect(facts.name).toBe("TEST Grok 1");
      expect(facts.is_doubles).toBe(false);
      expect(facts.player_count).toBe(6);
      expect(facts.group_count).toBe(1);
      expect(facts.courts).toEqual([1, 2]);
      expect(facts.time_done).toBe(true);
      expect(facts.start_time).toBeUndefined();
      expect(messageNeedsModel(line)).toBe(false);
    }
  });

  it("accepts one group of 6 and does not claim a split it rejected", () => {
    const next = applySpokenEdit({}, text)!;
    expect(next.group_count).toBe(1);
    expect(next.name).toBe("TEST Grok 1");
    expect(findGroupOption(6, 1)?.sizes).toEqual([6]);
    expect(nextSlot(next)).toBe("roster");
    const ack = factualAck({}, next, "vi", text);
    expect(ack).toContain("Đã chia 1 bảng");
    expect(ack).toContain("TEST Grok 1");
    expect(ack).toContain("6 người");
    expect(ack).not.toContain("Không chia được");
    expect(ack).not.toContain("VĐV");
    expect(ack).not.toMatch(/\.\s+\./);
    const ids = ["An", "Bình", "Chi", "Dũng", "Em", "Phong"];
    const matches = generateCircleMethodMatches(ids).map((m, i) => ({
      matchId: `m${i}`, player1: m.player1, player2: m.player2, groupIndex: 0,
    }));
    const sched = scheduleMatches(matches, next.courts!, 1, null);
    expect(new Set(sched.map((s) => s.court))).toEqual(new Set([1, 2]));
  });

  it("does not store 3 groups of 6 people, and does not say it did", () => {
    const line = "6 người, 3 bảng";
    const next = applySpokenEdit({ is_doubles: false }, line)!;
    expect(next.group_count).toBeUndefined();
    const ack = factualAck({ is_doubles: false }, next, "vi", line);
    expect(ack).toContain("Không chia được 3 bảng");
    expect(ack).not.toContain("Đã chia");
    const again = applySpokenEdit(next, line)!;
    const second = factualAck(next, again, "vi", line);
    expect(second).toContain("Không chia được 3 bảng");
    expect(second).not.toBe("Bản nháp chưa đổi.");
  });

  it("reads 3 groups of 6 as 18 people", () => {
    const next = applySpokenEdit({}, "18 người đánh đơn, 3 bảng, mỗi bảng 6 người")!;
    expect(next.player_count).toBe(18);
    expect(next.group_count).toBe(3);
    expect(findGroupOption(18, 3)?.sizes).toEqual([6, 6, 6]);
    const ack = factualAck({}, next, "vi", "18 người đánh đơn, 3 bảng, mỗi bảng 6 người");
    expect(ack).toContain("Đã chia 3 bảng");
    expect(ack).not.toContain("Không chia được");
  });

  it("lists the names it actually received", () => {
    const line = "An\nBình\nChi\nDũng\nEm\nPhong";
    const entries = line.split("\n").map((p1) => ({ p1 }));
    const next = applyPatch({ is_doubles: false }, { entries });
    const ack = factualAck({ is_doubles: false }, next, "vi", line);
    expect(ack).toContain("An");
    expect(ack).toContain("Phong");
    expect(ack).not.toMatch(/\.\s+\./);
    const reply = replyFromDraft({ is_doubles: false }, next, "Đã nhận 6 người.", "vi", line);
    expect(reply).not.toMatch(/\.\s+\./);
  });
});

describe("playoffSummary", () => {
  it("states the exact advance rule", () => {
    const text = playoffSummary({ group_count: 3, advance_per_group: 2, series: 1, series_sizes: [6] }, "vi");
    expect(text).toContain("đúng 2 mỗi bảng");
    expect(text).toContain("không lấy thêm hạng 3");
  });
});

describe("single-group round robin (log 46)", () => {
  const eight = teams(["An", "Bình", "Chi", "Dũng", "Em", "Phong", "Giang", "Hà"]);

  it("detects the format ask in VI and EN phrasings", () => {
    for (const t of [
      "Không chia bảng mà đánh vòng tròn",
      "khong chia bang, danh vong tron",
      "đánh vòng tròn 1 bảng thôi",
      "chỉ đánh vòng tròn, một bảng duy nhất",
      "no groups, just round robin",
      "single group round robin please",
    ]) expect(wantsSingleGroupRoundRobin(t)).toBe(true);
    for (const t of [
      "chia 2 bảng, đánh vòng tròn lấy nhất nhì",
      "đánh vòng tròn 2 bảng",
      "chia 2 bảng",
      "đánh vòng tròn",
    ]) expect(wantsSingleGroupRoundRobin(t)).toBe(false);
  });

  it("pins group_count = 1 from the spoken format ask, never overriding an explicit count", () => {
    expect(readUserFacts("Không chia bảng mà đánh vòng tròn").group_count).toBe(1);
    expect(readUserFacts("đánh vòng tròn 2 bảng").group_count).toBe(2);
    expect(readUserFacts("chia 2 bảng").group_count).toBe(2);
  });

  it("answers the VI format ask by naming round robin and the no-knockout consequence", () => {
    const before: Draft = { is_doubles: true, entries: eight, group_count: 2 };
    const after: Draft = { is_doubles: true, entries: eight, group_count: 1 };
    const ack = factualAck(before, after, "vi", "Không chia bảng mà đánh vòng tròn");
    expect(ack).toContain("Đã chia 1 bảng");
    expect(ack).toContain("vòng tròn");
    expect(ack).toContain("xếp hạng theo điểm");
    expect(ack).not.toContain("không có vòng loại trực tiếp");
  });

  it("answers the EN format ask the same way", () => {
    const before: Draft = { is_doubles: true, entries: eight, group_count: 2 };
    const after: Draft = { is_doubles: true, entries: eight, group_count: 1 };
    const ack = factualAck(before, after, "en", "no groups, just round robin");
    expect(ack).toContain("round-robin group");
    expect(ack).not.toContain("no knockout");
  });

  it("names the format for a plain one-group split too", () => {
    const after: Draft = { is_doubles: true, entries: eight, group_count: 1 };
    const ack = factualAck({}, after, "vi", "1 bảng");
    expect(ack).toContain("Đã chia 1 bảng");
    expect(ack).toContain("Một bảng vòng tròn");
    expect(ack).not.toContain("không có vòng loại trực tiếp");
  });

  it("keeps multi-group wording free of the round-robin claim", () => {
    const after: Draft = { is_doubles: true, entries: eight, group_count: 2 };
    const ack = factualAck({}, after, "vi", "chia 2 bảng");
    expect(ack).toContain("Đã chia 2 bảng");
    expect(ack).not.toContain("vòng tròn");
  });
});

describe("knockout after a single round-robin group", () => {
  const eight = teams(["An", "Bình", "Chi", "Dũng", "Em", "Phong", "Giang", "Hà"]);

  it("parses the advance count said without 'each group'", () => {
    expect(readUserFacts("lấy 4 đội vào trực tiếp").advance_per_group).toBe(4);
    expect(readUserFacts("top 2 vào bán kết").advance_per_group).toBe(2);
    expect(readUserFacts("take 4 into the knockout").advance_per_group).toBe(4);
    expect(readUserFacts("chọn 4 đội vào vòng tròn").advance_per_group).toBeUndefined();
  });

  it("summarizes top-4 and top-2 knockouts with the seed pairings", () => {
    const base: Draft = { is_doubles: true, entries: eight, group_count: 1 };
    expect(playoffSummary({ ...base, advance_per_group: 4 }, "vi")).toContain("Bán kết: đội 1 gặp đội 4, đội 2 gặp đội 3");
    expect(playoffSummary({ ...base, advance_per_group: 2 }, "vi")).toContain("Chung kết: đội 1 gặp đội 2");
    expect(playoffSummary({ ...base, advance_per_group: 4 }, "en")).toContain("seed 1 vs seed 4, seed 2 vs seed 3");
    expect(playoffSummary(base, "vi")).toBe("Một bảng vòng tròn");
  });

  it("states the pairings in the chat reply when the knockout is set in the same turn", () => {
    const before: Draft = { is_doubles: true, entries: eight, group_count: 2 };
    const after: Draft = { is_doubles: true, entries: eight, group_count: 1, advance_per_group: 4 };
    const ack = factualAck(before, after, "vi", "Không chia bảng mà đánh vòng tròn, lấy 4 đội vào trực tiếp");
    expect(ack).toContain("vòng tròn");
    expect(ack).toContain("Bán kết: đội 1 gặp đội 4, đội 2 gặp đội 3");
    expect(ack.match(/vòng tròn/g)?.length).toBeGreaterThanOrEqual(2);
    expect(ack).not.toContain("không có vòng loại trực tiếp");
  });

  it("offers top-4 then top-2 plans for one group, sized to the group", () => {
    expect(singleGroupPlayoffPlans(8)).toEqual([[4], [2]]);
    expect(singleGroupPlayoffPlans(4)).toEqual([[4], [2]]);
    expect(singleGroupPlayoffPlans(3)).toEqual([[2]]);
    expect(singleGroupPlayoffPlans(2)).toEqual([]);
  });
});

describe("round robin with 5, 6 and 7 teams, then a knockout (Cường's cases)", () => {
  const cases = [
    { n: 5, total: 10 },
    { n: 6, total: 15 },
    { n: 7, total: 21 },
  ];
  for (const { n, total } of cases) {
    describe(`${n} teams`, () => {
      const ids = Array.from({ length: n }, (_, i) => `T${i + 1}`);
      const games = generateCircleMethodMatches(ids);

      it(`plays exactly ${total} matches, every pair meeting once`, () => {
        expect(games.length).toBe(total);
        const pairs = new Set(games.map((m) => [m.player1, m.player2].sort().join("|")));
        expect(pairs.size).toBe(total);
        for (const id of ids) expect(games.filter((m) => m.player1 === id || m.player2 === id).length).toBe(n - 1);
      });

      it("odd fields rest exactly one team per round, each team exactly once", () => {
        const rounds = new Map<number, Set<string>>();
        for (const m of games) {
          const s = rounds.get(m.rrRoundNumber) ?? new Set<string>();
          s.add(m.player1); s.add(m.player2);
          rounds.set(m.rrRoundNumber, s);
        }
        if (n % 2 === 1) {
          expect(rounds.size).toBe(n);
          const rests = new Map(ids.map((id) => [id, 0]));
          for (const s of rounds.values()) {
            const resting = ids.filter((id) => !s.has(id));
            expect(resting.length).toBe(1);
            rests.set(resting[0], (rests.get(resting[0]) ?? 0) + 1);
          }
          for (const id of ids) expect(rests.get(id)).toBe(1);
        } else {
          expect(rounds.size).toBe(n - 1);
          for (const s of rounds.values()) expect(s.size).toBe(n);
        }
      });

      // Mô phỏng kết quả tất định: hạt giống thấp thắng mọi trận, thắng 11 điểm,
      // đội thua ghi điểm bằng thứ hạng của mình — số trận thắng phân định hết.
      const stats = new Map(ids.map((id) => [id, { played: 0, won: 0, pf: 0, pd: 0 }]));
      for (const m of games) {
        const a = ids.indexOf(m.player1), b = ids.indexOf(m.player2);
        const w = a < b ? m.player1 : m.player2;
        const l = a < b ? m.player2 : m.player1;
        const loserPoints = Math.max(a, b);
        const ws = stats.get(w)!, ls = stats.get(l)!;
        ws.played += 1; ls.played += 1;
        ws.won += 1;
        ws.pf += 11; ws.pd += 11 - loserPoints;
        ls.pf += loserPoints; ls.pd += loserPoints - 11;
      }
      const rankedIds = [...ids].sort((x, y) => {
        const A = stats.get(x)!, B = stats.get(y)!;
        return B.won - A.won || B.pd - A.pd || B.pf - A.pf;
      });

      it("standings from those results rank T1..Tn in seed order", () => {
        expect(rankedIds).toEqual(ids);
        expect(stats.get(ids[0])?.won).toBe(n - 1);
        expect(stats.get(ids[n - 1])?.won).toBe(0);
      });

      const players = rankedIds.map((id) => ({
        id, name: id, group_id: "g1",
        matches_played: stats.get(id)!.played, matches_won: stats.get(id)!.won,
        point_diff: stats.get(id)!.pd, points_for: stats.get(id)!.pf,
      }));
      const pairSets = (sizes: number[]) =>
        seriesDraws(["g1"], players, sizes)[0].map((p) => [p.player1.playerId, p.player2.playerId].sort().join("|")).sort();

      it("top 4 from these standings meet 1v4 and 2v3 in the semifinals", () => {
        expect(pairSets([4])).toEqual([`${ids[0]}|${ids[3]}`, `${ids[1]}|${ids[2]}`].sort());
      });

      it("top 2 from these standings meet 1v2 in the final", () => {
        expect(pairSets([2])).toEqual([`${ids[0]}|${ids[1]}`]);
      });

      it("chat replies name the format and the pairings for this field size", () => {
        const entries = teams(ids.map((id) => `Đội ${id}`));
        const before: Draft = { is_doubles: true, entries, group_count: 2 };
        const after4: Draft = { is_doubles: true, entries, group_count: 1, advance_per_group: 4 };
        const vi = factualAck(before, after4, "vi", "Không chia bảng mà đánh vòng tròn, lấy 4 đội vào trực tiếp");
        expect(vi).toContain("1 bảng đấu vòng tròn");
        expect(vi).toContain("Bán kết: đội 1 gặp đội 4, đội 2 gặp đội 3");
        const after2: Draft = { ...after4, advance_per_group: 2 };
        const vi2 = factualAck(before, after2, "vi", "Không chia bảng mà đánh vòng tròn, lấy 2 đội vào trực tiếp");
        expect(vi2).toContain("Chung kết: đội 1 gặp đội 2");
        const en = factualAck(before, after4, "en", "no groups, just round robin, take 4 into the knockout");
        expect(en).toContain("round-robin group");
        expect(en).toContain("seed 1 vs seed 4, seed 2 vs seed 3");
      });
    });
  }
});
