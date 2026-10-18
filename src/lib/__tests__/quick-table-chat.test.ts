import { describe, expect, it } from "vitest";
import {
  applyPatch,
  buildRoster,
  duplicateIndexes,
  groupOptions,
  nextSlot,
  pairEntries,
  previewAssignments,
  type Draft,
} from "@/lib/quick-table-chat";

const teams = (n: number) => Array.from({ length: n }, (_, i) => ({ p1: `A${i}`, p2: `B${i}` }));

describe("nextSlot — hỏi đúng thứ còn thiếu", () => {
  it("walks the happy path in order", () => {
    let d: Draft = {};
    expect(nextSlot(d)).toBe("format");
    d = { ...d, is_doubles: true };
    expect(nextSlot(d)).toBe("count");
    d = { ...d, player_count: 16 };
    expect(nextSlot(d)).toBe("groups");
    d = { ...d, group_count: 4 };
    expect(nextSlot(d)).toBe("roster");
    d = { ...d, roster_mode: "now" };
    expect(nextSlot(d)).toBe("paste");
    d = applyPatch(d, { entries: teams(16) });
    expect(nextSlot(d)).toBe("name");
    d = { ...d, name: "Giải CLB" };
    expect(nextSlot(d)).toBe("options");
    d = { ...d, options_done: true };
    expect(nextSlot(d)).toBe("confirm");
  });

  it("one message with everything goes straight to options", () => {
    const d = applyPatch({}, { is_doubles: true, player_count: 16, group_count: 4, name: "CLB", entries: teams(16) });
    expect(nextSlot(d)).toBe("options");
  });

  it("registration / later skip options", () => {
    const d: Draft = { is_doubles: true, player_count: 16, group_count: 4, roster_mode: "registration", name: "x" };
    expect(nextSlot(d)).toBe("confirm");
  });

  it("flags count mismatch, too many, invalid group count", () => {
    expect(nextSlot(applyPatch({ is_doubles: true }, { player_count: 16, entries: teams(15) }))).toBe("mismatch");
    expect(nextSlot({ is_doubles: true, player_count: 49 })).toBe("too_many");
    expect(nextSlot({ is_doubles: true, player_count: 16, group_count: 5 })).toBe("groups");
  });

  it("asks how to pair when a doubles list has only single names", () => {
    const d = applyPatch({ is_doubles: true }, { entries: [{ p1: "a" }, { p1: "b" }, { p1: "c" }, { p1: "d" }] });
    expect(nextSlot(d)).toBe("pairing");
  });
});

describe("groupOptions", () => {
  it("under 6 → one round-robin group", () => {
    expect(groupOptions(4)).toEqual([{ groupCount: 1, sizes: [4], recommended: true, playoffSize: 0, wildcards: 0 }]);
  });
  it("16 → 4 groups recommended, every option 3–6 per group", () => {
    const opts = groupOptions(16);
    expect(opts.find((o) => o.recommended)?.groupCount).toBe(4);
    for (const o of opts) expect(Math.min(...o.sizes) >= 3 && Math.max(...o.sizes) <= 6).toBe(true);
  });
  it("23 and 48 still have options", () => {
    expect(groupOptions(23).length).toBeGreaterThan(0);
    expect(groupOptions(48).some((o) => o.groupCount === 8)).toBe(true);
  });
});

describe("applyPatch never trusts the model", () => {
  it("drops junk fields and bad values", () => {
    const d = applyPatch({}, {
      player_count: "lots", group_count: 99, start_time: "7pm", courts: [0, 2, 2, "x", 3], default_sets: 2,
      entries: [{ p1: "  Nam  " }, { p1: "" }, { p2: "orphan" }], evil: true,
    });
    expect(d).toEqual({ courts: [2, 3], entries: [{ p1: "Nam" }], roster_mode: "now", pairing_done: false, player_count: 1 });
  });
});

describe("pairing, duplicates, roster", () => {
  const singles = ["a", "b", "c", "d", "e"].map((p1) => ({ p1 }));
  it("sequential pairs and drops the odd one out", () => {
    expect(pairEntries(singles, "sequential")).toEqual([{ p1: "a", p2: "b" }, { p1: "c", p2: "d" }]);
  });
  it("duplicate detection ignores order and case", () => {
    expect([...duplicateIndexes([{ p1: "Nam", p2: "Hùng" }, { p1: "hùng", p2: "nam" }])]).toEqual([1]);
  });
  it("roster + preview match setup page shape, groups balanced", () => {
    const d: Draft = { is_doubles: true, group_count: 4, entries: teams(16) };
    expect(buildRoster(d)[0]).toEqual({ name: "A0 & B0", player1_name: "A0", player2_name: "B0", team: undefined, seed: undefined });
    const a = previewAssignments(d);
    expect(a).toHaveLength(16);
    for (let g = 0; g < 4; g++) expect(a.filter((x) => x === g)).toHaveLength(4);
  });
});
