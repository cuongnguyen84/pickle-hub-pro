import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  divisionDraft, divisionLists, divisionsAsked, fallbackReply, nextSlot, rankSeriesOffer, teamLists, unmetWantsDivisions, type Draft,
} from "@/lib/quick-table-chat";
import { addedPlayerSlot } from "@/lib/quick-table-utils";
import { divisionReply } from "../../../supabase/functions/quick-table-chat/division-reply.ts";

// Nguyên văn tin nhắn của quick_table_chat_log id 117 (11/11/2026 13:07 ICT), giữ cả khoảng trắng thừa.
const LOG117 = `Trình A 
A quang 
A hiệp pix
A tráng
Hải Mđ 
A thắng 
A Tùng Dương
 A Giang 
A Tiến
TRÌNH B
C Trang Đt
Dương 
Hiệp gà 
Lợi
A Duy 
A Phong 
A Hòa 
A Tuấn Đậu`;

describe("ca log 117: tiêu đề Trình A / TRÌNH B là hai hạng", () => {
  it("divisionsAsked nhận đúng hai trình, nhãn chuẩn hoá", () => {
    expect(divisionsAsked(LOG117, "vi")).toEqual(["Trình A", "Trình B"]);
    expect(divisionsAsked(LOG117, "en")).toEqual(["Trình A", "Trình B"]);
  });

  it("mỗi trình giữ đúng 8 tên của nó, không gộp 16", () => {
    const lists = divisionLists(LOG117)!;
    expect(lists.map((l) => l.names.length)).toEqual([8, 8]);
    expect(lists[0].names).toContain("A Giang");
    expect(lists[1].names[0]).toBe("C Trang Đt");
    expect(teamLists(LOG117)).toBeNull(); // không phải chip Team A / Team B
  });

  it("các tiêu đề khác cùng kiểu", () => {
    const names = (n: number, p: string) => Array.from({ length: n }, (_, i) => `${p}${i + 1}`).join("\n");
    expect(divisionsAsked(`Hạng A\n${names(4, "Nam")}\nHạng B\n${names(4, "Hùng")}`, "vi")).toEqual(["Hạng A", "Hạng B"]);
    expect(divisionsAsked(`Division 1:\n${names(4, "Ann")}\ndivision 2:\n${names(4, "Bob")}`, "en")).toEqual(["Division 1", "Division 2"]);
  });

  it("danh sách 16 tên không có tiêu đề KHÔNG thành hai hạng", () => {
    const plain = LOG117.split("\n").filter((l) => !/trình/i.test(l)).join("\n");
    expect(divisionsAsked(plain, "vi")).toBeNull();
    expect(divisionLists(plain)).toBeNull();
  });

  it("nháp hạng đầu: chỉ tên Trình A, bỏ số đội cả sự kiện, hỏi ghép cặp", () => {
    const before: Draft = { is_doubles: true, player_count: 8, courts: [1, 2], courts_done: true };
    const d = divisionDraft(before, divisionLists(LOG117)![0].names);
    expect(d.entries).toHaveLength(8);
    expect(d.entries!.map((e) => e.p1)).not.toContain("Lợi");
    expect(d.courts).toEqual([1, 2]);
    expect(nextSlot(d)).toBe("pairing");
  });

  it("hạng sau: tên chung + danh sách Trình B, giữ sân/giờ", () => {
    const first: Draft = {
      is_doubles: true, name: "anh em trẻ Yamaha", group_count: 2, courts: [1, 2], courts_done: true, time_done: true,
      pairing_done: true, options_done: true, entries: [{ p1: "A quang", p2: "A tráng" }, { p1: "A thắng", p2: "A Tiến" }],
    };
    const d = divisionDraft(first, divisionLists(LOG117)![1].names, "anh em trẻ Yamaha — Trình B");
    expect(d.name).toBe("anh em trẻ Yamaha — Trình B");
    expect(d.entries!.map((e) => e.p1)).toEqual(["C Trang Đt", "Dương", "Hiệp gà", "Lợi", "A Duy", "A Phong", "A Hòa", "A Tuấn Đậu"]);
    expect(d.group_count).toBeUndefined();
    expect(nextSlot(d)).toBe("pairing");
  });

  it("unmet nhiều hạng: client và server đều nói luật, kể cả khi model trả câu ghép cặp", () => {
    expect(unmetWantsDivisions("Muốn nhiều hạng trong một giải")).toBe(true);
    expect(unmetWantsDivisions("Muốn DreamBreaker khi hòa")).toBe(false);
    expect(fallbackReply("unsupported", "Muốn nhiều hạng trong một giải", "vi", LOG117)).toMatch(/Mỗi hạng một giải riêng \(Trình A, Trình B\)/);
    expect(divisionReply("fill", "Muốn nhiều hạng trong một giải", "vi")).toMatch(/^Mỗi hạng một giải riêng/);
    expect(divisionReply("fill", "Muốn nhiều hạng trong một giải; Muốn DreamBreaker khi hòa", "en")).toMatch(/DreamBreaker/);
    expect(divisionReply("fill", "Muốn DreamBreaker khi hòa", "vi")).toBeNull();
    expect(divisionReply("team_match", "Muốn nhiều hạng trong một giải", "vi")).toBeNull();
  });
});

describe("chip mỗi thứ hạng bảng một vòng (ca Yamaha 11/11)", () => {
  const eight: Draft = { is_doubles: true, player_count: 8, group_count: 2 };

  it("đổi tên, không còn chữ 'hạng' trơn", () => {
    const src = readFileSync("src/pages/QuickTableChat.tsx", "utf8");
    expect(src).toContain('seriesByRank: "Mỗi thứ hạng bảng một vòng"');
    expect(src).toContain('seriesByRank: "One playoff per group place"');
    expect(src).not.toContain('"Mỗi hạng một vòng"');
  });

  it("8 đội 2 bảng: bốn vòng 2 đội → phải cảnh báo", () => {
    expect(rankSeriesOffer(eight, false)).toEqual({ sizes: [2, 2, 2, 2], twoOnly: true });
    expect(rankSeriesOffer({ ...eight, player_count: 16, group_count: 4 }, false)).toMatchObject({ twoOnly: false });
  });

  it("ẩn khi đang chia nhiều hạng/trình", () => {
    expect(rankSeriesOffer(eight, true)).toBeNull();
  });
});

describe("thêm đội tay vào bảng (ca Giải đôi 11/11)", () => {
  const gA = "ga", gB = "gb";
  // Sau khi xoá A2: A1, A3–A6 (display_order 0, 2–5), B1–B7 (6–12).
  const players = [
    { group_id: gA, team: "A1", display_order: 0 },
    ...[3, 4, 5, 6].map((k, i) => ({ group_id: gA, team: `A${k}`, display_order: i + 2 })),
    ...[1, 2, 3, 4, 5, 6, 7].map((k, i) => ({ group_id: gB, team: `B${k}`, display_order: i + 6 })),
  ];

  it("thêm lại vào bảng A thành A2, đúng chỗ trống thứ tự, tách 2 VĐV", () => {
    expect(addedPlayerSlot(players, gA, "A", "A Thuần Tú & C Nga")).toEqual({
      team: "A2", display_order: 1, player1_name: "A Thuần Tú", player2_name: "C Nga",
    });
  });

  it("không có lỗ mã: mã kế tiếp, xếp cuối (không 999)", () => {
    expect(addedPlayerSlot(players, gB, "B", "Nam")).toEqual({ team: "B8", display_order: 13, player1_name: "Nam", player2_name: null });
    expect(addedPlayerSlot([...players, { group_id: gA, team: null, display_order: 999 }], gB, "B", "X").display_order).toBe(13);
  });

  it("bảng không dùng mã thì giữ team của người dùng / để trống", () => {
    const plain = [{ group_id: gA, team: null, display_order: 0 }, { group_id: gA, team: "CLB Q7", display_order: 1 }];
    expect(addedPlayerSlot(plain, gA, "A", "Nam / Hùng")).toEqual({ team: null, display_order: 2, player1_name: "Nam", player2_name: "Hùng" });
    expect(addedPlayerSlot(plain, gA, "A", "Nam", "CLB Q1").team).toBe("CLB Q1");
  });
});
