import { describe, expect, it } from "vitest";
import {
  applyPatch,
  applySpokenEdit,
  fallbackReply,
  factualAck,
  groupCourtsLine,
  readUserFacts,
  trustPatch,
  type Draft,
  type Entry,
} from "@/lib/quick-table-chat";

const teams = (n: number): Entry[] =>
  Array.from({ length: n }, (_, i) => ({ p1: `Team ${i + 1}` }));

// Ca thật 01:51 ngày 22/10/2026 (quick_table_chat_log id 41): người dùng đã
// nạp 11 đội, đặt tên giải, đang ở bước options thì xin gán sân theo bảng.
// AI trả intent unsupported + reply rỗng, hội thoại đứt.
const FAILING_SENTENCE =
  "Group A plays in court 1, Group B plays in court 2, Group C plays in court 3";

describe("group → court assignment (yêu cầu từng bị bỏ qua 22/10)", () => {
  it("parses the exact failing English sentence into pins", () => {
    const facts = readUserFacts(FAILING_SENTENCE);
    expect(facts.group_courts).toEqual([1, 2, 3]);
  });

  it("applies pins to the draft, unions the courts and answers the courts step", () => {
    const before: Draft = {
      is_doubles: true,
      entries: teams(11),
      player_count: 11,
      group_count: 3,
      name: "Reinart's Pickleball Tournament",
      courts_done: true,
    };
    const next = applyPatch(before, readUserFacts(FAILING_SENTENCE));
    expect(next.group_courts).toEqual([1, 2, 3]);
    expect(next.courts).toEqual([1, 2, 3]);
    expect(next.courts_done).toBe(true);
    expect(factualAck(before, next, "en", FAILING_SENTENCE)).toContain(
      "Group A → court 1",
    );
    expect(groupCourtsLine(next, "en")).toBe(
      "Group A → court 1 · Group B → court 2 · Group C → court 3",
    );
  });

  it("parses Vietnamese phrasings, with and without accents", () => {
    expect(readUserFacts("bảng A sân 1, bảng B sân 2").group_courts).toEqual([1, 2]);
    expect(readUserFacts("bang A choi san 3, bang B san 4").group_courts).toEqual([3, 4]);
    expect(readUserFacts("sân 5 cho bảng C").group_courts).toEqual([null, null, 5]);
  });

  it("AI patch path: model group_courts (0 = unpinned) is sanitized and applied", () => {
    const next = applyPatch({ group_count: 3 }, { group_courts: [5, 0, 2] });
    expect(next.group_courts).toEqual([5, null, 2]);
    expect(next.courts).toEqual([2, 5]);
  });

  it("trustPatch only keeps pins when the message mentions courts AND groups", () => {
    const kept = trustPatch({ group_courts: [1, 2] }, FAILING_SENTENCE, "options");
    expect(kept.group_courts).toEqual([1, 2]);
    const dropped = trustPatch({ group_courts: [1, 2] }, "chia 3 bảng nhé", "groups");
    expect(dropped.group_courts).toBeUndefined();
  });

  it("'mỗi bảng một sân' auto-assigns known courts in order", () => {
    const draft: Draft = { group_count: 3, courts: [2, 4, 6], courts_done: true };
    const next = applySpokenEdit(draft, "mỗi bảng một sân nhé");
    expect(next?.group_courts).toEqual([2, 4, 6]);
  });

  it("spoken edit handles the failing sentence without the model", () => {
    const draft: Draft = { group_count: 3, entries: teams(11), player_count: 11 };
    const next = applySpokenEdit(draft, FAILING_SENTENCE);
    expect(next?.group_courts).toEqual([1, 2, 3]);
  });
});

describe("fallbackReply — unsupported không bao giờ im lặng", () => {
  it("echoes the unmet request and suggests the manual alternative (EN)", () => {
    const reply = fallbackReply(
      "unsupported",
      "Muốn Group A chơi sân 1, Group B chơi sân 2, Group C chơi sân 3",
      "en",
    );
    expect(reply.length).toBeGreaterThan(0);
    expect(reply).toContain("sân 1");
    expect(reply.toLowerCase()).toContain("can't do that yet");
  });

  it("works in Vietnamese and for off_topic", () => {
    expect(fallbackReply("unsupported", null, "vi")).toContain("chưa hỗ trợ");
    expect(fallbackReply("off_topic", null, "vi").length).toBeGreaterThan(0);
    expect(fallbackReply("off_topic", null, "en").length).toBeGreaterThan(0);
  });
});
