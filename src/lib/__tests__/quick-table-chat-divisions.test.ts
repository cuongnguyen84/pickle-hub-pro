import { describe, expect, it } from "vitest";
import { applyPatch, divisionBase, divisionsAsked, factualAck, fallbackReply, nextDivisionDraft, nextSlot, unsupportedFormatNote, wantsRankSeries, type Draft } from "@/lib/quick-table-chat";

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
    expect(vi).toMatch(/tạo luôn Intermediate/);
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
