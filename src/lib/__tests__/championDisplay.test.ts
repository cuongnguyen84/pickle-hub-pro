import { describe, expect, it } from "vitest";
import { displayChampionName } from "../championDisplay";

// Toàn bộ 22 champion_name thật trên prod 2026-07-27 — filter phải chặn đúng
// 8 tên rác và giữ trọn 14 tên thật. Đổi luật filter thì đổi cả Swift twin
// (MyTournament.displayChampion) và cập nhật bảng này.
const JUNK = ["18", "2", "5", "6", "7", "Player 4", "test4", "VDV 3"];
const REAL = [
  "Đỗ Đăng Khương & Nguyễn Việt Hà",
  "Dư + Khoa",
  "Hà Thu Hoàng & Doan Thuong",
  "Hạnh + Minh",
  "Hoan",
  "Phương + Hùng",
  "Thế Cường, Thanh Huyền",
  "Thiện + Hải",
  "Thu bé - Huyền Xinh",
  "Thức + Tuyết Anh",
  "Trần Minh - Dương Nguyễn",
  "Tùng",
  "Tuyết Anh + Trang",
  "Việt Hùng & Đào Nghị",
];

describe("displayChampionName", () => {
  it.each(JUNK)("hides junk name %j", (name) => {
    expect(displayChampionName(name)).toBeNull();
  });

  it.each(REAL)("keeps real name %j", (name) => {
    expect(displayChampionName(name)).toBe(name);
  });

  it("hides null/undefined/blank and placeholder variants", () => {
    expect(displayChampionName(null)).toBeNull();
    expect(displayChampionName(undefined)).toBeNull();
    expect(displayChampionName("  ")).toBeNull();
    expect(displayChampionName("đội 2")).toBeNull();
    expect(displayChampionName("nguoi choi 3")).toBeNull();
    expect(displayChampionName("TEST")).toBeNull();
  });

  it("trims surrounding whitespace on real names", () => {
    expect(displayChampionName("  Dư + Khoa  ")).toBe("Dư + Khoa");
  });
});
