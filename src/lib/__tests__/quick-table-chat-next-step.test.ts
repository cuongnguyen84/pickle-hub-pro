// Chủ duyệt 30/10: dán danh sách xong phải gợi ý cách chia; "ít nhất N trận" ra kế hoạch cụ thể.
import { describe, expect, it } from "vitest";
import {
  applySpokenEdit, chatFacts, factualAck, groupChoices, groupSuggestion, messageNeedsModel,
  minMatchesAsked, nextSlot, splitForMinMatches, type Draft,
} from "@/lib/quick-table-chat";
import { clipReply } from "../../../supabase/functions/_shared/clip";

const names = (n: number) => Array.from({ length: n }, (_, i) => ({ p1: `Nam${i}`, p2: `Hung${i}` }));

describe("list paste → concrete group proposal", () => {
  it("18 teams: ack + groups question names the recommended split", () => {
    const before: Draft = { is_doubles: true };
    const entries = names(18);
    const list = entries.map((e) => `${e.p1} - ${e.p2}`).join("\n");
    const after: Draft = { ...before, entries, player_count: 18, roster_mode: "now", pairing_done: true };
    expect(nextSlot(after)).toBe("groups");
    expect(factualAck(before, after, "vi", list)).toMatch(/^Đã nhận 18 đội/);
    const rec = groupChoices(18).find((o) => o.recommended)!;
    const vi = groupSuggestion(after, "vi")!;
    expect(vi).toContain(`Mình gợi ý ${rec.groupCount} bảng ×`);
    expect(vi).toContain("(khuyên dùng)");
    expect(vi).toContain("Chọn bên dưới hoặc nói số bảng");
    expect(groupSuggestion(after, "en")).toMatch(new RegExp(`^I suggest ${rec.groupCount} groups ×.*\\(recommended\\)`));
  });
  it("re-paste stays idempotent", () => {
    const entries = names(6);
    const d: Draft = { is_doubles: true, entries, player_count: 6, pairing_done: true };
    const list = entries.map((e) => `${e.p1} - ${e.p2}`).join("\n");
    expect(factualAck(d, d, "vi", list)).toContain("không cộng trùng");
  });
});

describe("ít nhất N trận / at least N matches", () => {
  it("detects VI + EN", () => {
    expect(minMatchesAsked("làm sao cho mỗi người được chơi ít nhất 2 trận là được")).toBe(2);
    expect(minMatchesAsked("mỗi đội tối thiểu 3 trận")).toBe(3);
    expect(minMatchesAsked("at least 2 matches per team?")).toBe(2);
    expect(minMatchesAsked("chia 3 bảng")).toBeNull();
  });
  it("picks a split whose smallest group gives ≥ N games", () => {
    for (const [n, k] of [[10, 2], [18, 2], [18, 4], [24, 3], [12, 5]]) {
      const o = splitForMinMatches(n, k)!;
      expect(o.sizes.reduce((a, b) => a + b, 0)).toBe(n);
      expect(Math.min(...o.sizes) - 1).toBeGreaterThanOrEqual(k);
    }
    expect(splitForMinMatches(5, 3)!.groupCount).toBe(1);
    expect(splitForMinMatches(20, 9)).toBeNull();
  });
  it("keeps the current split when it already satisfies N", () => {
    expect(splitForMinMatches(10, 2, 3)!.groupCount).toBe(3);
  });
  it("real log 30/10: 10 singles, answered locally with a plan, flow continues", () => {
    const text = "làm sao cho mỗi người được chơi ít nhất 2 trận là được";
    const d: Draft = { is_doubles: false, player_count: 10 };
    expect(messageNeedsModel(text)).toBe(false);
    const next = applySpokenEdit(d, text)!;
    expect(next.is_doubles).toBe(false);
    expect(next.group_count).toBeGreaterThanOrEqual(2);
    const ack = factualAck(d, next, "vi", text);
    expect(ack).toMatch(/Để mỗi người đánh ít nhất 2 trận: \d+ bảng × [\d–]+ người — vòng bảng mỗi người đánh [\d–]+ trận/);
    expect(nextSlot(next)).not.toBe("groups");
  });
  it("explicit group count wins; impossible request says so", () => {
    expect(applySpokenEdit({ is_doubles: true, player_count: 18 }, "chia 3 bảng, mỗi đội ít nhất 2 trận")!.group_count).toBe(3);
    const d: Draft = { is_doubles: true, player_count: 20 };
    const next = applySpokenEdit(d, "at least 9 matches per team")!;
    expect(factualAck(d, next, "en", "at least 9 matches per team")).toMatch(/no split where every team plays at least 9/);
  });
  it("chatFacts gives the model matches per entry", () => {
    expect(chatFacts({ is_doubles: true, player_count: 12 }, "vi")).toMatch(/mỗi đội đánh đúng S−1 trận/);
    expect(chatFacts({ is_doubles: true, player_count: 12 }, "vi")).toMatch(/Vòng bảng mỗi đội đánh \d+ trận/);
  });
});

describe("clipReply", () => {
  it("leaves short replies alone", () => expect(clipReply("  Xong rồi.  ", 50)).toBe("Xong rồi."));
  it("cuts at the last sentence end, never mid-sentence", () => {
    const s = "Câu một rất ngắn. Câu hai cũng ngắn thôi. Câu ba thì dài hơn nhiều và sẽ bị cắt mất ở đây";
    const out = clipReply(s, 60);
    expect(out).toBe("Câu một rất ngắn. Câu hai cũng ngắn thôi.");
  });
  it("no sentence boundary → cut at a word with an ellipsis", () => {
    const out = clipReply("một hai ba bốn năm sáu bảy tám chín mười", 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out).toMatch(/^một hai ba bốn năm…$/);
  });
});
