import { describe, expect, it } from "vitest";
import {
  applyPatch,
  applySpokenEdit,
  dropInventedRoster,
  factualAck,
  keepOrAssign,
  lockAdvance,
  nextSlot,
  playoffSummary,
  readUserFacts,
  replyFromDraft,
  type Draft,
  type Entry,
} from "@/lib/quick-table-chat";

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
});

describe("lockAdvance", () => {
  it("top 2 from 3 groups is exactly 6, with no extra 3rd places", () => {
    const d = lockAdvance({ is_doubles: false, player_count: 12, group_count: 3, advance_per_group: 2, entries: teams("abcdefghijkl".split("")) });
    expect(d.series).toBe(1);
    expect(d.series_sizes).toEqual([6]);
    expect(nextSlot({ ...d, name: "A", courts_done: true, options_done: true, roster_mode: "now" })).not.toBe("series");
  });
});

describe("applySpokenEdit", () => {
  const start: Draft = {
    is_doubles: false,
    player_count: 4,
    group_count: 3,
    entries: teams(["An", "Bình", "Chi", "Dũng"]),
  };

  it("swaps two players and a later regroup keeps that order", () => {
    const swapped = applySpokenEdit(start, "đổi chỗ An với Bình");
    expect(swapped?.entries?.map((e) => e.p1)).toEqual(["Bình", "An", "Chi", "Dũng"]);
    expect(swapped?.group_count).toBe(3);
    const regrouped = applySpokenEdit(swapped!, "chia 2 bảng");
    expect(regrouped?.entries?.map((e) => e.p1)).toEqual(["Bình", "An", "Chi", "Dũng"]);
    expect(regrouped?.group_count).toBe(2);
  });

  it("renames without reshuffling the rest", () => {
    const next = applySpokenEdit(start, "đổi tên Chi thành Lan");
    expect(next?.entries?.map((e) => e.p1)).toEqual(["An", "Bình", "Lan", "Dũng"]);
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

describe("playoffSummary", () => {
  it("states the exact advance rule", () => {
    const text = playoffSummary({ group_count: 3, advance_per_group: 2, series: 1, series_sizes: [6] }, "vi");
    expect(text).toContain("đúng 2 mỗi bảng");
    expect(text).toContain("không lấy thêm hạng 3");
  });
});
