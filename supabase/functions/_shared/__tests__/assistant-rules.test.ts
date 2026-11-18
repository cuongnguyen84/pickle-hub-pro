// Trợ lý AI nổi quanh giải — luật thẻ hành động (brief 27/10/2026, mục 5 + 8).
import { describe, it, expect } from "vitest";
import { buildCard, detectLang, fillFromText, phaseOf, proposeAction, resolveTeam, roleFor, type TableState } from "../../tournament-assistant/rules.ts";

function table(over: Partial<TableState> = {}): TableState {
  return {
    id: "t1", share_id: "abc123", name: "Giải CLB", status: "group_stage", requires_registration: false,
    is_doubles: true, group_count: 2, courts: ["1", "2"], start_time: "08:00", default_sets: 1,
    registration_message: null, group_courts: null,
    groups: [{ id: "gA", name: "A" }, { id: "gB", name: "B" }],
    players: [
      { id: "p1", name: "Nam & Hùng", p1: "Nam", p2: "Hùng", group_id: "gA" },
      { id: "p2", name: "Tú & Long", p1: "Tú", p2: "Long", group_id: "gA" },
      { id: "p3", name: "An & Bình", p1: "An", p2: "Bình", group_id: "gA" },
      { id: "p4", name: "Cường & Dũng", p1: "Cường", p2: "Dũng", group_id: "gB" },
      { id: "p5", name: "Em & Phong", p1: "Em", p2: "Phong", group_id: "gB" },
      { id: "p6", name: "Giang & Hải", p1: "Giang", p2: "Hải", group_id: "gB" },
    ],
    matches: [
      { group_id: "gA", status: "pending", is_playoff: false },
      { group_id: "gB", status: "pending", is_playoff: false },
    ],
    approved_count: 0,
    ...over,
  };
}

describe("cổng quyền", () => {
  it("không phải chủ giải → từ chối, không có thẻ", () => {
    const r = proposeAction(table(), "viewer", { type: "rename_tournament", name: "Mới" }, "vi");
    expect(r).toEqual({ card: null, refused: true });
    expect(proposeAction(table(), "participant", { type: "rename_tournament", name: "Mới" }, "vi").refused).toBe(true);
  });
  it("vai trò do server tính từ creator", () => {
    expect(roleFor("u1", "u1", false)).toBe("owner");
    expect(roleFor("u2", "u1", true)).toBe("participant");
    expect(roleFor("u2", "u1", false)).toBe("viewer");
  });
});

describe("thẻ xác nhận", () => {
  it("đổi tên giải: trước → sau + hoàn tác", () => {
    const card = proposeAction(table(), "owner", { type: "rename_tournament", name: "Giải Tối T7" }, "vi").card!;
    expect(card.lines).toEqual(["Đổi tên giải: Giải CLB → Giải Tối T7"]);
    expect(card.undo).toEqual({ type: "rename_tournament", args: { name: "Giải CLB" } });
    expect(card.blocked).toBeUndefined();
  });
  it("id đội bịa → null", () => {
    expect(buildCard(table(), { type: "rename_team", team_id: "zzz", p1: "X", p2: "Y" }, "vi")).toBeNull();
  });
  it("xoá đội sau bốc thăm: chặn + đề xuất thay đội / bốc lại", () => {
    const card = buildCard(table(), { type: "remove_team", team_id: "p2" }, "vi")!;
    expect(card.blocked?.reason).toContain("Tú & Long");
    expect(card.blocked?.alternatives.map((a) => a.label)).toEqual(["Thay bằng đội khác", "Bốc thăm lại không có đội này"]);
  });
  it("bốc thăm lại khi đã có kết quả: cảnh báo mất kết quả, danger", () => {
    const s = table({ matches: [{ group_id: "gA", status: "completed", is_playoff: false }, { group_id: "gB", status: "pending", is_playoff: false }] });
    expect(phaseOf(s)).toBe("in_play");
    const card = buildCard(s, { type: "rebuild_groups", drop_team_ids: ["p2"] }, "vi")!;
    expect(card.danger).toBe(true);
    expect(card.warnings[0]).toContain("1 trận đã có kết quả");
    expect(card.args).toMatchObject({ drop_team_ids: ["p2"], group_count: 2 });
  });
  it("gán sân cho bảng đang xem", () => {
    const card = buildCard(table(), { type: "set_group_courts", group_courts: [0, 3] }, "vi")!;
    expect(card.args.group_courts).toEqual([null, 3]);
    expect(card.lines).toEqual(["Bảng A → không gán sân", "Bảng B → sân 3"]);
    expect(card.danger).toBe(false);
  });
  it("chia bảng cho giải đăng ký: cần đủ đội đã duyệt", () => {
    const setup = table({ status: "setup", requires_registration: true, groups: [], players: [], matches: [], approved_count: 1 });
    expect(buildCard(setup, { type: "draw_groups" }, "vi")!.blocked).toBeDefined();
    const ok = buildCard({ ...setup, approved_count: 12 }, { type: "draw_groups", group_count: 3 }, "vi")!;
    expect(ok.blocked).toBeUndefined();
    expect(ok.args).toEqual({ group_count: 3 });
  });
  it("giải đã vào playoff: khoá đổi bảng/đội", () => {
    const s = table({ status: "playoff" });
    expect(buildCard(s, { type: "add_team", p1: "X", p2: "Y" }, "vi")!.blocked).toBeDefined();
    expect(buildCard(s, { type: "rebuild_groups" }, "vi")!.blocked).toBeDefined();
  });
});

// Test tay 27/10: model trả id kèm tiền tố / chỉ tên đội / "bảng này" bằng group + courts.
describe("chịu được cách model điền tham số", () => {
  it.each([
    [{ team_id: "p2" }],
    [{ team_id: "team_id=p2" }],
    [{ team_id: "[id:p2]" }],
    [{ team_name: "Tú & Long" }],
    [{ team_name: "tu & long" }],
    [{ team_id: "Tú" }],
  ])("tìm ra đội p2 từ %j", (raw) => {
    expect(resolveTeam(table(), raw)?.id).toBe("p2");
  });
  it("tên mơ hồ → null", () => {
    expect(resolveTeam(table(), { team_name: "&" })).toBeNull();
  });
  it("xoá đội theo tên sau bốc thăm → chặn + phương án", () => {
    const card = buildCard(table(), { type: "remove_team", team_name: "QA Golf" }, "vi");
    expect(card).toBeNull();
    const ok = buildCard(table(), { type: "remove_team", team_name: "Em & Phong" }, "vi")!;
    expect(ok.blocked?.alternatives).toHaveLength(2);
  });
  it("bảng này sân 2: courts [2] + bảng đang xem B", () => {
    const card = buildCard(table(), { type: "set_group_courts", courts: [2] }, "vi", "gB")!;
    expect(card.args.group_courts).toEqual([null, 2]);
  });
  it("group B + courts [2]", () => {
    expect(buildCard(table(), { type: "set_group_courts", group: "B", courts: [2] }, "vi")!.args.group_courts).toEqual([null, 2]);
  });
  it("group_courts [2] một phần tử khi đang xem bảng B → bảng B", () => {
    expect(buildCard(table(), { type: "set_group_courts", group_courts: [2] }, "vi", "gB")!.args.group_courts).toEqual([null, 2]);
  });
  it("chưa lưu danh sách (không đăng ký) → báo xoá trên trang nhập", () => {
    const setup = table({ status: "setup", groups: [], players: [], matches: [] });
    expect(buildCard(setup, { type: "remove_team", team_name: "QA Hotel" }, "vi")!.blocked?.reason).toContain("chưa được lưu");
  });
});

// Test lại 28/10: model trả action chỉ có "type" (log 23:25–23:28) → bù từ câu người dùng.
describe("bù tham số từ câu người dùng", () => {
  const qr = () => table({
    is_doubles: true,
    players: [
      { id: "d", name: "QR Delta", p1: "QR Delta", p2: null, group_id: "gA" },
      { id: "c", name: "QR Charlie", p1: "QR Charlie", p2: null, group_id: "gA" },
      { id: "e", name: "QR Echo", p1: "QR Echo", p2: null, group_id: "gA" },
      { id: "f", name: "QR Fox", p1: "QR Fox", p2: null, group_id: "gB" },
      { id: "g", name: "QR Golf", p1: "QR Golf", p2: null, group_id: "gB" },
      { id: "h", name: "QR Hotel", p1: "QR Hotel", p2: null, group_id: "gB" },
    ],
  });
  const card = (raw: unknown, text: string, view: string | null = null) =>
    buildCard(qr(), fillFromText(qr(), raw, text) as Record<string, unknown>, "vi", view);

  it("đổi tên giải chỉ có type (log 81)", () => {
    expect(card({ type: "rename_tournament" }, "Đổi tên giải thành QA R3 2810 X")!.args).toEqual({ name: "QA R3 2810 X" });
  });
  it("đổi tên đội X thành Y — tên đội một vế", () => {
    const c = card({ type: "rename_team" }, "Đổi tên đội QR Delta thành QR Replacement")!;
    expect(c.args).toEqual({ team_id: "d", p1: "QR Replacement", p2: null });
    expect(c.lines[0]).toContain("QR Delta → QR Replacement");
  });
  it("đổi tên thành 2 VĐV", () => {
    expect(card({ type: "rename_team" }, "Đổi tên đội QR Echo thành Nam & Hùng")!.args).toEqual({ team_id: "e", p1: "Nam", p2: "Hùng" });
  });
  it("xoá đội chỉ có type → vẫn ra cảnh báo + 2 phương án", () => {
    expect(card({ type: "remove_team" }, "Xoá đội QR Charlie khỏi giải")!.blocked?.alternatives).toHaveLength(2);
  });
  it("bốc lại bỏ đội: drop rỗng → lấy đội trong câu, đếm 5", () => {
    const c = card({ type: "rebuild_groups", reshuffle: true, group_count: 2, drop_team_ids: [] }, "Bốc thăm lại các bảng, bỏ đội QR Charlie")!;
    expect(c.args.drop_team_ids).toEqual(["c"]);
    expect(c.lines[0]).toContain("5 đội");
  });
  it("bốc lại không nhắc bỏ đội → không loại ai", () => {
    expect(card({ type: "rebuild_groups" }, "Bốc thăm lại các bảng")!.args.drop_team_ids).toEqual([]);
  });
  it("gán sân chỉ có type: 'sân 2 cho bảng này' + đang xem B", () => {
    expect(card({ type: "set_group_courts" }, "Gán sân 2 cho bảng này", "gB")!.args.group_courts).toEqual([null, 2]);
    expect(card({ type: "set_group_courts" }, "Gán sân 3 cho bảng A")!.args.group_courts).toEqual([3, null]);
  });
  it("ngôn ngữ theo lượt gõ, lượt chỉ có tên riêng lấy lượt trước", () => {
    expect(detectLang(["Đổi tên đội QR Delta thành", "QR Replacement"], "en")).toBe("vi");
    expect(detectLang(["Xoá đội A", "Remove team QA Golf from the tournament"], "vi")).toBe("en");
    expect(detectLang(["QR"], "en")).toBe("en");
  });
});
