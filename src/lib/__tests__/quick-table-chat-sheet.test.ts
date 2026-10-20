import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { googleSheetRef, localSlotPatch, looksLikeNameList, mergeRoster, nextSlot, parseSheet, trustPatch } from "@/lib/quick-table-chat";

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
  it("Cuong's file: Team | Vận động viên 1 | Vận động viên 2", () => {
    expect(parseSheet([["Team", "Vận động viên 1", "Vận động viên 2"], ["Team 01", "Nguyễn Minh Anh", "Trần Quốc Bảo"], ["Team 02", "Lê Hoàng Nam", "Phạm Đức Huy"]]))
      .toEqual([{ p1: "Nguyễn Minh Anh", p2: "Trần Quốc Bảo" }, { p1: "Lê Hoàng Nam", p2: "Phạm Đức Huy" }]);
  });
  it("unknown headers: numbered team labels are skipped", () => {
    expect(parseSheet([["Mã", "Người 1", "Người 2"], ["Team 01", "Nguyễn Minh Anh", "Trần Quốc Bảo"], ["Team 02", "Lê Hoàng Nam", "Phạm Đức Huy"]]).slice(-2))
      .toEqual([{ p1: "Nguyễn Minh Anh", p2: "Trần Quốc Bảo" }, { p1: "Lê Hoàng Nam", p2: "Phạm Đức Huy" }]);
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

import { applyPatch, chatFacts, customGroupOption, draftSeriesPlan, groupChoices, wantsRankSeries } from "@/lib/quick-table-chat";

describe("Cuong's 44-team chat: 11 groups of 4, Gold 16, rest Silver + Bronze", () => {
  const base = { is_doubles: true, player_count: 44 };
  it("11 groups is a valid choice and offered as the 4-per-group chip", () => {
    expect(customGroupOption(44, 11)?.sizes).toEqual(Array(11).fill(4));
    expect(groupChoices(44).some((o) => o.groupCount === 11)).toBe(true);
    expect(customGroupOption(44, 20)).toBeNull(); // bảng 2 đội
    expect(nextSlot({ ...base, group_count: 11 })).toBe("series");
  });
  it("custom sizes from the AI skip the series question", () => {
    const d = applyPatch({ ...base, group_count: 11 }, { series_sizes: [16, 0, 0], series_style: "medal" });
    expect(d.series_sizes).toEqual([16, 14, 14]);
    expect(draftSeriesPlan(d)?.map((s) => [s.size, s.byes])).toEqual([[16, 0], [14, 2], [14, 2]]);
    expect(nextSlot(d)).toBe("roster");
  });
  it("facts carry the real numbers for the question 'how do 11 groups qualify?'", () => {
    const f = chatFacts({ ...base, group_count: 11 }, "vi");
    expect(f).toContain("11 bảng × 4 đội: playoff 1 nhánh lấy nhất + nhì 11 bảng = 22 + 10 đội hạng 3 tốt nhất = 32 → cây 32; 12 đội bị loại.");
    expect(f).toContain("Đang chọn: 11 bảng × 4.");
    expect(f).toContain("3 nhánh theo luật mặc định: KHÔNG chia được. Muốn 3 nhánh thì đặt cỡ tuỳ chỉnh, ví dụ Series A: 16 đội; Series B: 14 đội (2 miễn vòng 1); Series C: 14 đội (2 miễn vòng 1).");
  });
  it("a filename is not the user mentioning a time", () => {
    expect(trustPatch({ start_time: "10:44" }, "", "count")).toEqual({});
  });
  it("mỗi hạng một nhánh: nhất vào A, nhì vào B, ba vào C, tư vào D", () => {
    expect(wantsRankSeries("nhất nhì đánh A, ba tư đánh B")).toBe(false);
    expect(wantsRankSeries("mỗi hạng một nhánh, nhất vào A nhì vào B")).toBe(true);
    const patch = trustPatch({ series: 2 }, "nhất bảng vào A, nhì bảng vào B, ba vào C", "count");
    expect(patch.series_mode).toBe("by_rank");
    expect(patch.series).toBeUndefined();
    const d = applyPatch({ is_doubles: true, player_count: 32, group_count: 8 }, { series_mode: "by_rank" });
    expect(d.series_sizes).toEqual([8, 8, 8, 8]);
    expect(d.series).toBe(4);
    expect(nextSlot(d)).toBe("roster");
    expect(chatFacts({ is_doubles: true, player_count: 32, group_count: 8 }, "vi")).toContain("Mỗi hạng một nhánh: Series A: 8 đội; Series B: 8 đội; Series C: 8 đội; Series D: 8 đội.");
  });
});

describe("uploads that are not a roster", () => {
  it("reads a Google Sheet link, including a published one and its gid", () => {
    expect(googleSheetRef("danh sách https://docs.google.com/spreadsheets/d/1AbCdefGHIjklmnop/edit#gid=3"))
      .toEqual({ id: "1AbCdefGHIjklmnop", gid: "3", published: false });
    expect(googleSheetRef("https://docs.google.com/spreadsheets/d/e/2PACX-1vabcdefghij/pubhtml")?.published).toBe(true);
    expect(googleSheetRef("https://example.com/spreadsheets/d/1AbCdefGHIjklmnop")).toBeNull();
  });
  it("a payment sheet is not a name list; two pair lines are", () => {
    expect(looksLikeNameList("STT\tTiền\n1\t500.000\n2\t200.000")).toBe(false);
    expect(looksLikeNameList("Nam - Hùng\nTú - Long")).toBe(true);
  });
  it("a second photo adds names and drops ones already there", () => {
    const merged = mergeRoster(
      [{ p1: "Nam", p2: "Hùng" }, { p1: "Tú", p2: "Long" }],
      [{ p1: "Nam", p2: "Hùng" }, { p1: "Lan", p2: "Mai" }],
    );
    expect(merged.map((e) => e.p1)).toEqual(["Nam", "Tú", "Lan"]);
  });
});
