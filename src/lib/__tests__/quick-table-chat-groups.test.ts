import { describe, expect, it } from "vitest";
import {
  applyPatch, groupDraft, groupLists, groupSizes, nextSlot, pairEntries, previewAssignments,
  unsupportedFormatNote, type Draft, type Entry,
} from "@/lib/quick-table-chat";

// Ca báo cáo 21:30 15/11/2026: người tổ chức dán danh sách đội đã chia sẵn theo
// "Bảng A" / "Bảng B" và muốn các đội vào đúng bảng đó ngay từ đầu.
const CASE = `Bảng A
Nguyễn Văn Chuẩn P1 - Đặng Bùi Bình K4
Trần Văn An P2 - Lê Văn Bình K3
Phạm Văn Cường P1 - Đỗ Văn Dũng K4
Hoàng Văn Em P3 - Vũ Văn Phúc K2
Bảng B
Nguyễn Tiến Tuấn P3 - Nguyễn Phương Dũng K4
Trịnh Văn Hà P2 - Ngô Văn Khải K3
Đặng Văn Long P1 - Bùi Văn Minh K4`;

describe("ca 15/11: dán danh sách chia sẵn theo Bảng A / Bảng B", () => {
  it("groupLists nhận đúng 2 bảng, nhãn chuẩn hoá, chỉ số A=0 B=1", () => {
    const lists = groupLists(CASE)!;
    expect(lists.map((l) => l.label)).toEqual(["Bảng A", "Bảng B"]);
    expect(lists.map((l) => l.group)).toEqual([0, 1]);
    expect(lists.map((l) => l.names.length)).toEqual([4, 3]);
    expect(lists[0].names[0]).toContain("Nguyễn Văn Chuẩn");
    expect(lists[1].names[0]).toContain("Nguyễn Tiến Tuấn");
  });

  it("groupDraft: đội giữ đúng bảng đã chia, số bảng = số tiêu đề, cỡ bảng lệch vẫn đúng", () => {
    const d = groupDraft({}, groupLists(CASE)!);
    expect(d.group_count).toBe(2);
    expect(d.entries).toHaveLength(7);
    expect(d.entries!.slice(0, 4).every((e) => e.group === 0)).toBe(true);
    expect(d.entries!.slice(4).every((e) => e.group === 1)).toBe(true);
    expect(d.entries![0].p1).toContain("Nguyễn Văn Chuẩn");
    expect(d.entries![0].p2).toContain("Đặng Bùi Bình");
    expect(d.is_doubles).toBe(true);
    // Cỡ bảng thật 4/3 (không ép đều 4/4 hay 3/3) để tính vòng loại theo số thật.
    expect(groupSizes(d)).toEqual([4, 3]);
    // Cách chia đã có → không hỏi lại bước chia bảng.
    expect(nextSlot(d)).not.toBe("groups");
  });

  it("previewAssignments giữ nguyên 100% bảng đã gán sẵn", () => {
    const d = groupDraft({}, groupLists(CASE)!);
    expect(previewAssignments(d)).toEqual([0, 0, 0, 0, 1, 1, 1]);
  });

  it("tiêu đề tiếng Anh và đánh số: Group A / Bảng 1, Bảng 2", () => {
    const en = groupLists("Group A\nAn - Bình\nChi - Dũng\nEm - Phúc\nGroup B\nGia - Hà\nKhải - Long\nMinh - Nam");
    expect(en?.map((l) => l.label)).toEqual(["Group A", "Group B"]);
    const num = groupLists("Bảng 1\nAn - Bình\nChi - Dũng\nEm - Phúc\nBảng 2\nGia - Hà\nKhải - Long\nMinh - Nam");
    expect(num?.map((l) => l.group)).toEqual([0, 1]);
  });

  it("không nhận nhầm: danh sách trơn, hạng/trình, đội MLP, gán sân theo bảng", () => {
    expect(groupLists("Nam\nHùng\nTuấn\nDũng")).toBeNull();
    expect(groupLists("Trình A\nAn\nBình\nChi\nTrình B\nDũng\nEm\nPhúc")).toBeNull();
    expect(groupLists("Đội A\nAn\nBình\nChi\nĐội B\nDũng\nEm\nPhúc")).toBeNull();
    expect(groupLists("Bảng A sân 1, Bảng B sân 2")).toBeNull();
    expect(groupLists("Bảng A\nAn - Bình\nChi - Dũng\nEm - Phúc")).toBeNull(); // mới 1 bảng
  });
});

describe("bảng gán sẵn: các đường liên quan", () => {
  it("previewAssignments: đội chưa gán lấp vào bảng ít đội nhất, đội đã gán không xê dịch", () => {
    const d: Draft = {
      group_count: 2,
      entries: [
        { p1: "A1", group: 0 }, { p1: "A2", group: 0 }, { p1: "A3", group: 0 },
        { p1: "B1", group: 1 }, { p1: "Mới 1" }, { p1: "Mới 2" },
      ],
    };
    expect(previewAssignments(d)).toEqual([0, 0, 0, 1, 1, 1]);
  });

  it("không có gán sẵn nào → chia như cũ (cỡ bảng lệch tối đa 1)", () => {
    const entries: Entry[] = Array.from({ length: 7 }, (_, i) => ({ p1: `P${i}` }));
    const out = previewAssignments({ group_count: 2, entries });
    const sizes = [0, 1].map((g) => out.filter((x) => x === g).length).sort();
    expect(sizes).toEqual([3, 4]);
  });

  it("ghép đôi khi mọi người đều có bảng: ghép trong bảng, cặp giữ đúng bảng", () => {
    const singles: Entry[] = [
      { p1: "A1", group: 0 }, { p1: "A2", group: 0 }, { p1: "A3", group: 0 }, { p1: "A4", group: 0 },
      { p1: "B1", group: 1 }, { p1: "B2", group: 1 }, { p1: "B3", group: 1 }, { p1: "B4", group: 1 },
    ];
    const pairs = pairEntries(singles, "sequential");
    expect(pairs).toHaveLength(4);
    expect(pairs.slice(0, 2).every((e) => e.group === 0)).toBe(true);
    expect(pairs.slice(2).every((e) => e.group === 1)).toBe(true);
    expect(pairs[0]).toMatchObject({ p1: "A1", p2: "A2" });
  });

  it("applyPatch giữ group hợp lệ, bỏ group rác", () => {
    const d = applyPatch({}, { entries: [{ p1: "X", group: 1 }, { p1: "Y", group: 99 }, { p1: "Z", group: -1 }] });
    expect(d.entries![0].group).toBe(1);
    expect(d.entries![1].group).toBeUndefined();
    expect(d.entries![2].group).toBeUndefined();
  });
});

describe("gán bảng theo câu mô tả: nói thẳng chưa hỗ trợ + chỉ cách dán", () => {
  it("khớp câu gán đích danh", () => {
    const vi = unsupportedFormatNote("cho Nam - Hùng vào bảng A nhé", "vi")!;
    expect(vi).toContain("chưa gán sẵn đội vào từng bảng theo câu mô tả");
    expect(vi).toContain("Bảng A");
    expect(unsupportedFormatNote("add Team X to group B", "en")).toContain("can't pre-assign teams");
  });

  it("không khớp câu hỏi thường về bảng", () => {
    expect(unsupportedFormatNote("ai đang nhất bảng a", "vi")).toBeNull();
    expect(unsupportedFormatNote("chia 2 bảng nhé", "vi")).toBeNull();
    expect(unsupportedFormatNote("đổi chỗ Nam với Hùng", "vi")).toBeNull();
    expect(unsupportedFormatNote("bảng A sân 1, bảng B sân 2", "vi")).toBeNull();
  });
});
