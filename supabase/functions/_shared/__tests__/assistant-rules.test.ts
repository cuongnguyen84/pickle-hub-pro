// Trợ lý AI nổi quanh giải — luật thẻ hành động (brief 27/10/2026, mục 5 + 8).
import { describe, it, expect } from "vitest";
import { buildCard, phaseOf, proposeAction, roleFor, type TableState } from "../../tournament-assistant/rules.ts";

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
