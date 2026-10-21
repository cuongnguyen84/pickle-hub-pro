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
  replyFromDraft,
  type Draft,
  type Entry,
} from "@/lib/quick-table-chat";
import { generateCircleMethodMatches, scheduleMatches } from "@/lib/round-robin";

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
