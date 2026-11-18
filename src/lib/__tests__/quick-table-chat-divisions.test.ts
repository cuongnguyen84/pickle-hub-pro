import { describe, expect, it } from "vitest";
import { applyPatch, divisionBase, divisionsAsked, factualAck, fallbackReply, nextDivisionDraft, nextSlot, replyFromDraft, unsupportedFormatNote, wantsRankSeries, type Draft } from "@/lib/quick-table-chat";

// Ca Anora Reunion 09/11: 2 hạng beginner + intermediate trong một giải → mỗi hạng một giải, tạo tiếp hạng sau.
describe("chat → nhiều hạng = chuỗi giải liên tiếp", () => {
  it.each([
    ["giải Anora Reunion 2 hạng beginner và intermediate", ["Beginner", "Intermediate"]],
    ["mình muốn tổ chức beginner + intermediate + advanced", ["Beginner", "Intermediate", "Advanced"]],
    ["hai hạng open và advanced", ["Open", "Advanced"]],
    ["chia trình 3.0 và 3.5", ["3.0", "3.5"]],
    ["giải có 2 hạng", ["Hạng 1", "Hạng 2"]],
    ["giải này nhiều hạng", ["Hạng 1", "Hạng 2"]],
    ["nam nữ riêng nhé", ["Nam", "Nữ"]],
    ["trung bình và nâng cao", ["Trung bình", "Nâng cao"]],
    ["Anora Reunion 2 hạng (beginner + intermediate), mỗi bảng lấy 2 vào vòng loại", ["Beginner", "Intermediate"]],
  ])("VI: %s", (text, labels) => {
    expect(divisionsAsked(text, "vi")).toEqual(labels);
  });

  it.each([
    ["one tournament with beginner and intermediate divisions", ["Beginner", "Intermediate"]],
    ["we need 3 divisions", ["Division 1", "Division 2", "Division 3"]],
    ["separate men and women", ["Men's", "Women's"]],
  ])("EN: %s", (text, labels) => {
    expect(divisionsAsked(text, "en")).toEqual(labels);
  });

  it.each([
    "mỗi hạng một vòng loại",
    "nhất bảng vào series A, nhì vào series B",
    "mỗi bảng lấy 2 hạng đầu",
    "hạng ba được vé vớt",
    "2 hạng vào vòng loại trực tiếp",
    "16 đôi chia 4 bảng",
    "Nam - Hùng, Tuấn - Nữ",
    "HCMC Open 2026 cuối tuần",
    "one series per place",
  ])("không nhầm: %s", (text) => {
    expect(divisionsAsked(text, "vi")).toBeNull();
  });

  it("'mỗi hạng một vòng loại' vẫn là chia vòng loại theo thứ hạng", () => {
    expect(wantsRankSeries("mỗi hạng một vòng loại")).toBe(true);
    expect(unsupportedFormatNote("mỗi hạng một vòng loại", "vi")).toBeNull();
  });

  it("không phải ngõ cụt: nói luật một giải một hạng + hứa tạo tiếp hạng sau (VI + EN)", () => {
    const vi = fallbackReply("unsupported", "Muốn nhiều hạng trong một giải", "vi", "Anora Reunion 2 hạng beginner và intermediate");
    expect(vi).toMatch(/Mỗi hạng một giải riêng/);
    expect(vi).toMatch(/Beginner trước/);
    expect(vi).toMatch(/tạo tiếp Intermediate/);
    expect(vi).not.toMatch(/chỉnh ở trang giải/);
    const en = factualAck({}, { is_doubles: true }, "en", "beginner and intermediate in one event");
    expect(en).toMatch(/One tournament per division/);
    expect(en).toMatch(/offer Intermediate/);
  });

  const first: Draft = {
    is_doubles: true, name: "Anora Reunion — Beginner", group_count: 2, courts: [1, 2], courts_done: true, start_time: "08:00",
    default_sets: 3, series: 1, options_done: true, pairing_done: true,
    entries: Array.from({ length: 10 }, (_, i) => ({ p1: `A${i}`, p2: `B${i}` })), player_count: 10,
  };

  it("tên hạng sau dùng tên chung + hậu tố, kể cả khi giải đầu đặt tên trơn", () => {
    const labels = ["Beginner", "Intermediate"];
    expect(divisionBase("Anora Reunion — Beginner", labels)).toBe("Anora Reunion");
    expect(divisionBase("Anora Reunion (Beginner)", labels)).toBe("Anora Reunion");
    expect(divisionBase("Anora Reunion Tournament", labels)).toBe("Anora Reunion Tournament");
  });

  it("cùng danh sách: chỉ đổi tên, sẵn sàng tạo luôn", () => {
    const d = nextDivisionDraft(first, "Anora Reunion — Intermediate", true);
    expect(d).toEqual({ ...first, name: "Anora Reunion — Intermediate" });
    expect(nextSlot(d)).toBe("confirm");
  });

  it("danh sách khác: giữ thể thức/sân/giờ/số set, hỏi lại danh sách", () => {
    const d = nextDivisionDraft(first, "Anora Reunion — Intermediate", false);
    expect(d).toMatchObject({ is_doubles: true, courts: [1, 2], start_time: "08:00", default_sets: 3, name: "Anora Reunion — Intermediate" });
    expect(d.entries).toBeUndefined();
    expect(d.group_count).toBeUndefined();
    expect(nextSlot(d)).toBe("count");
  });

  it("danh sách khác: 10 đội rồi dán 20 tên vẫn hỏi cách ghép cặp", () => {
    const d = applyPatch(nextDivisionDraft(first, "Anora Reunion — Intermediate", false), { player_count: 10 });
    const names = Array.from({ length: 20 }, (_, i) => ({ p1: `Người ${i + 1}` }));
    const pasted = applyPatch(d, { entries: names });
    expect(nextSlot(pasted)).toBe("pairing");
  });
});

// Ca log 116 (10/11/2026): người dùng liệt kê 6 hạng từng dòng kèm số đội, kèm
// DreamBreaker + tranh hạng 3. Intent bị xếp "fill", reply rỗng — không ai trả
// lời. Fixture dùng nguyên văn user_text của log (không có dữ kiện cá nhân).
const LOG116 = "Create a round robin format only 1 bracket, for pickleball tournament for our tournament, we are the host and organizer, fixed partners. Create as well a dreambreaker, just incase there's a tie, and this will be point system. Create this per categorty, premiliminary, seeding, semi-finals, battle for 3rd, championship match.\n\n6 Novice Mens\n6 Novice Women\n6 Low Intemediate Womens\n6 Low Intermediate Mens\n6 High Intermediate Mens\n6 Mixed Doubles Open Category";

describe("ca log 116: hạng liệt kê từng dòng kèm số đội", () => {
  it("divisionsAsked bắt đủ 6 nhãn hạng như người dùng viết", () => {
    expect(divisionsAsked(LOG116, "en")).toEqual([
      "Novice Mens", "Novice Women", "Low Intemediate Womens",
      "Low Intermediate Mens", "High Intermediate Mens", "Mixed Doubles Open Category",
    ]);
  });

  it("nhánh fill vẫn gọi tên luật mỗi hạng một giải dù reply của AI rỗng", () => {
    const ack = replyFromDraft({}, {}, "", "en", LOG116);
    expect(ack).toMatch(/One tournament per division/);
    expect(ack).toMatch(/Novice Mens first/);
  });

  it("fallback theo unmet vẫn gọi tên luật mỗi hạng một giải", () => {
    const note = fallbackReply("unsupported", "Muốn nhiều hạng trong một giải", "en", LOG116);
    expect(note).toMatch(/One tournament per division/);
  });

  it("không nhầm danh sách người chơi có số đầu dòng là hạng", () => {
    expect(divisionsAsked("6 Nam\n6 Hung\n6 Tuan\n6 Linh", "vi")).toBeNull();
    expect(divisionsAsked("8 teams round robin, 2 groups", "en")).toBeNull();
  });

  it("DreamBreaker trong giải thường: gọi đích danh chưa hỗ trợ + thay thế gần nhất", () => {
    const note = unsupportedFormatNote("add a dreambreaker just in case there's a tie", "en");
    expect(note).toMatch(/DreamBreaker/);
    expect(note).toMatch(/MLP/);
    const vi = fallbackReply("unsupported", "Muốn DreamBreaker khi hòa", "vi", "thêm dreambreaker khi hòa nhé");
    expect(vi).toMatch(/DreamBreaker/);
    expect(vi).toMatch(/chưa có/);
  });

  it("tranh hạng 3 trong giải thường: gọi đích danh chưa hỗ trợ", () => {
    expect(unsupportedFormatNote("semi-finals, battle for 3rd, championship match", "en")).toMatch(/3rd-place match isn't available/);
    expect(unsupportedFormatNote("có trận tranh hạng 3 không", "vi")).toMatch(/Trận tranh hạng 3 chưa có/);
  });
});
