import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { localSlotPatch, nextSlot, parseSheet, trustPatch } from "@/lib/quick-table-chat";

describe("parseSheet", () => {
  it("header STT | Tên đội | VĐV 1 | VĐV 2 | SĐT | CLB", () => {
    const rows = [
      ["DANH SÁCH ĐĂNG KÝ"],
      ["STT", "Tên đội", "VĐV 1", "VĐV 2", "SĐT", "CLB"],
      ["1", "Team A", "Nguyễn Văn Nam", "Trần Hùng", "0901234567", "Hà Đông"],
      ["2", "Team B", "Lê Tú", "Phạm Long", "0907654321", ""],
    ];
    expect(parseSheet(rows)).toEqual([
      { p1: "Nguyễn Văn Nam", p2: "Trần Hùng", team: "Hà Đông" },
      { p1: "Lê Tú", p2: "Phạm Long" },
    ]);
  });
  it("one player column holding pairs", () => {
    expect(parseSheet([["#", "Cặp VĐV"], ["1", "Nam - Hùng"], ["2", "Tú & Long"]]))
      .toEqual([{ p1: "Nam", p2: "Hùng" }, { p1: "Tú", p2: "Long" }]);
  });
  it("team name column only", () => {
    expect(parseSheet([["STT", "Tên đội"], ["1", "Sấm Sét"], ["2", "Gió Bão"]]))
      .toEqual([{ p1: "Sấm Sét" }, { p1: "Gió Bão" }]);
  });
  it("no header: number, two names, paid status", () => {
    expect(parseSheet([["1", "Nam", "Hùng", "Đã CK"], ["2", "Tú", "Long", "500.000đ"]]))
      .toEqual([{ p1: "Nam", p2: "Hùng" }, { p1: "Tú", p2: "Long" }]);
  });
  it("round-trips a real xlsx of 26 teams", () => {
    const aoa = [["STT", "Tên đội", "VĐV 1", "VĐV 2"], ...Array.from({ length: 26 }, (_, i) => [String(i + 1), `Đội ${i + 1}`, `A${i + 1} Nguyễn`, `B${i + 1} Trần`])];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "S1");
    const read = XLSX.read(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
    const rows = XLSX.utils.sheet_to_json<string[]>(read.Sheets[read.SheetNames[0]], { header: 1, raw: false, blankrows: false, defval: "" });
    const out = parseSheet(rows);
    expect(out).toHaveLength(26);
    expect(out[25]).toEqual({ p1: "A26 Nguyễn", p2: "B26 Trần" });
  });
});

describe("AI defaults are not trusted", () => {
  it("'8 sân' never sets a start time", () => {
    expect(trustPatch({ courts: [1, 2], start_time: "08:00", series: 1 }, "8 sân", "courts")).toEqual({ courts: [1, 2] });
  });
  it("a file upload cannot pick the series count", () => {
    expect(trustPatch({ entries: [], series: 1, default_sets: 1 }, "STT\tTên", "count")).toEqual({ entries: [] });
  });
  it("explicit mentions pass", () => {
    expect(trustPatch({ start_time: "19:00", series: 2 }, "7h tối, chia nhánh vàng bạc", "name")).toEqual({ start_time: "19:00", series: 2 });
  });
});

describe("localSlotPatch", () => {
  it("courts", () => {
    expect(localSlotPatch("8 sân", "courts")).toEqual({ courts: [1, 2, 3, 4, 5, 6, 7, 8], courts_done: true });
    expect(localSlotPatch("sân 1 đến 4", "courts")).toBeNull();
  });
  it("start time", () => {
    expect(localSlotPatch("7h30", "start_time")?.start_time).toBe("07:30");
    expect(localSlotPatch("19", "start_time")?.start_time).toBe("19:00");
    expect(localSlotPatch("7h tối", "start_time")).toBeNull();
  });
  it("26 teams, 8 groups, uploaded list → asks series before name", () => {
    const entries = Array.from({ length: 26 }, (_, i) => ({ p1: `a${i}`, p2: `b${i}` }));
    expect(nextSlot({ is_doubles: true, entries, player_count: 26, roster_mode: "now", pairing_done: true, group_count: 8 })).toBe("series");
  });
});
