import { describe, expect, it } from "vitest";
import { factualAck, fallbackReply, mergeTm, nextTmSlot, pairTeamLists, teamLists, tmAnswer, tmPlayoffCount, unsupportedFormatNote, wantsTeamMatch } from "@/lib/quick-table-chat";

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

// Anh duyệt 06/11 21:30 («ok theo ý em đi»): crossover / play-in = chưa hỗ trợ; dán Team A / Team B phải hỏi rõ.
describe("crossover / play-in roadmap is unsupported, nearest = groups → single-elim playoff", () => {
  const roadmap = "Bảng 1: A, B, C\nBảng 2: D, E, F\nPhase 1 vòng tròn → Phase 2 crossover → Phase 3 play-in";
  it.each([
    [roadmap, "vi"],
    ["làm vòng giao giữa các bảng rồi play-in", "vi"],
    ["Phase 1 round robin, Phase 2 crossover, Phase 3 play in round", "en"],
    ["add a play-in stage before the bracket", "en"],
  ] as const)("%s", (text, lang) => {
    const note = unsupportedFormatNote(text, lang)!;
    expect(note).toMatch(lang === "vi" ? /chưa được hỗ trợ/ : /aren't supported yet/);
    expect(note).toMatch(lang === "vi" ? /vòng tròn.*loại trực tiếp/ : /round-robin.*single-elimination/);
    expect(note).not.toMatch(/loại kép|double elim/i);
  });

  it.each(["teams play in 4 groups", "vòng giao lưu cuối tuần", "16 đội chia 4 bảng, nhất bảng A đấu chéo nhì bảng B"])("%s → not flagged", (text) => {
    expect(unsupportedFormatNote(text, "en")).toBeNull();
  });

  it("factualAck leads with unsupported and never says 'Got/Đã nhận N teams' for the roadmap paste", () => {
    const entries = ["Nam", "Hùng", "Tuấn", "Minh", "Long", "Phúc"].map((p1) => ({ p1 }));
    const vi = factualAck({}, { entries }, "vi", `Nam\nHùng\nTuấn\nMinh\nLong\nPhúc\nPhase 2 crossover, Phase 3 play-in`);
    expect(vi.startsWith("Lộ trình nhiều giai đoạn")).toBe(true);
    expect(vi).not.toMatch(/Đã nhận/);
    const en = factualAck({}, { entries }, "en", `Nam\nHùng\nTuấn\nMinh\nLong\nPhúc\nthen crossover and play-in`);
    expect(en).toContain("aren't supported yet");
    expect(en).not.toMatch(/\bGot\b|\bAdded\b/);
  });

  it("empty-reply fallback reads the user's text when unmet lost the keyword", () => {
    expect(fallbackReply("unsupported", "multi-stage format", "en", "Phase 3 play-in")).toContain("crossover / play-in");
    expect(fallbackReply("unsupported", null, "vi", "có vòng crossover")).toContain("chưa được hỗ trợ");
  });
});

describe("Team A / Team B paste", () => {
  const names = (k: string, n: number) => Array.from({ length: n }, (_, i) => `${k}${i + 1}`);
  const paste = `Team A\n${names("a", 22).map((x, i) => `${i + 1}. ${x}`).join("\n")}\nTeam B:\n${names("b", 22).join("\n")}`;

  it("detects two labeled lists without pairing anyone", () => {
    const l = teamLists(paste)!;
    expect(l.map((x) => [x.label, x.names.length])).toEqual([["Team A", 22], ["Team B", 22]]);
    expect(l[0].names[0]).toBe("a1");
  });

  it("detects Đội A / Đội B inline lists (VI)", () => {
    expect(teamLists("Đội A: Nam, Hùng, Tuấn, Minh\nĐội B: Long, Phúc, Huy, Khoa")?.map((x) => x.names.length)).toEqual([4, 4]);
  });

  it.each(["Đội 1: Nam, Hùng\nĐội 2: Tuấn, Minh", "Nam - Hùng\nTuấn - Minh\nLong - Phúc", "Team A\nNam\nHùng\nTuấn"])("%s → not two team lists", (text) => {
    expect(teamLists(text)).toBeNull();
  });

  it("pairs only in the mode the user picked", () => {
    const l = teamLists(paste)!;
    expect(pairTeamLists(l, "across")[0]).toEqual({ p1: "a1", p2: "b1" });
    const within = pairTeamLists(l, "within");
    expect(within).toHaveLength(22);
    expect(within[0]).toEqual({ p1: "a1", p2: "a2", team: "Team A" });
    expect(within[11].team).toBe("Team B");
  });

  it("MLP flow seeds team count; roster > 20 is asked again", () => {
    expect(nextTmSlot(mergeTm({}, { team_count: 2, roster: 22 }))).toBe("roster");
    expect(mergeTm({}, { team_count: 2, roster: 6 })).toEqual({ team_count: 2, roster: 6 });
  });
});
