import { describe, expect, it } from "vitest";
import { mergeTm, nextTmSlot, tmAnswer, tmPlayoffCount, unsupportedFormatNote, wantsTeamMatch } from "@/lib/quick-table-chat";

// Anh chốt 06/11: «vòng tròn đổi partner» = giải định dạng MLP → chat tạo Team Match, không từ chối.
describe("chat → MLP Team Match", () => {
  it.each([
    "làm vòng tròn đổi partner cho 10 người",
    "tạo giải MLP 8 đội",
    "giải đồng đội MLP cuối tuần",
    "giải đồng đội cho CLB",
    "đấu đối kháng giữa các CLB",
    "đánh đôi xoay cặp liên tục",
    "mỗi trận đổi đồng đội",
    "đổi cặp sau mỗi trận",
    "round robin rotating partners for 10 people",
    "create a team match for 6 teams",
    "partner swap format please",
    "americano style",
    "Major League Pickleball style event",
  ])("%s → Team Match intent", (text) => {
    expect(wantsTeamMatch(text)).toBe(true);
  });

  it.each([
    "đổi cặp 3 thành Nam - Tuấn",
    "đổi chỗ Nam với Hùng",
    "swap Nam with Hung",
    "16 đôi chia 4 bảng",
    "giải loại kép 8 đội",
  ])("%s → stays a group-stage edit, not MLP", (text) => {
    expect(wantsTeamMatch(text)).toBe(false);
  });

  it("double elimination is still unsupported", () => {
    expect(unsupportedFormatNote("double elimination", "en")).toContain("isn't supported yet");
  });

  it("asks only for what is missing: teams → roster → format → name → confirm", () => {
    let d = tmAnswer({}, "làm vòng tròn đổi partner cho 10 người", "vi");
    expect(d).toEqual({ format: "round_robin" });
    expect(nextTmSlot(d)).toBe("teams");
    d = tmAnswer(d, "6", "vi");
    expect(d.team_count).toBe(6);
    expect(nextTmSlot(d)).toBe("roster");
    d = tmAnswer(d, "4 người", "vi");
    expect(nextTmSlot(d)).toBe("name");
    d = tmAnswer(d, "Giải CLB Hà Đông", "vi");
    expect(d).toEqual({ format: "round_robin", team_count: 6, roster: 4, name: "Giải CLB Hà Đông" });
    expect(nextTmSlot(d)).toBe("confirm");
  });

  it("reads several facts in one message (VI + EN)", () => {
    expect(tmAnswer({}, "giải MLP 8 đội, mỗi đội 4 người, vòng tròn rồi playoff", "vi"))
      .toEqual({ team_count: 8, roster: 4, format: "rr_playoff" });
    expect(tmAnswer({}, "team match, 4 teams, 6 players per team, knockout, called Spring Cup", "en"))
      .toEqual({ team_count: 4, roster: 6, format: "single_elimination", name: "Spring Cup" });
  });

  it("«bạn chọn giúp» fills defaults but keeps what the user said", () => {
    const d = tmAnswer({ team_count: 6 }, "bạn chọn giúp", "vi");
    expect(d).toEqual({ team_count: 6, roster: 4, format: "round_robin", name: "Giải đồng đội MLP" });
    expect(tmAnswer({}, "you choose", "en").name).toBe("MLP team match");
  });

  it("knockout needs 4/8/16… teams — otherwise the format is asked again", () => {
    expect(mergeTm({ team_count: 6 }, { format: "single_elimination" }).format).toBeUndefined();
    expect(mergeTm({ team_count: 8 }, { format: "single_elimination" }).format).toBe("single_elimination");
  });

  it("rejects out-of-range numbers the RPC would refuse", () => {
    expect(mergeTm({}, { team_count: 1, roster: 30 })).toEqual({});
  });

  it("playoff size = largest power of two ≤ teams (TeamMatchSetup default)", () => {
    expect([2, 3, 4, 6, 10, 25].map(tmPlayoffCount)).toEqual([2, 2, 4, 4, 8, 16]);
  });
});
