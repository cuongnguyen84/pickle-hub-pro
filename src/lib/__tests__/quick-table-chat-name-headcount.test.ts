import { describe, expect, it } from "vitest";
import {
  applyPatch,
  applySpokenEdit,
  cleanTournamentName,
  clarifyDoublesCount,
  factualAck,
  headcountAsk,
  headcountChoices,
  nameAnswer,
  nextSlot,
  pendingDoublesHeadcount,
  readUserFacts,
  replyFromDraft,
  type Draft,
} from "@/lib/quick-table-chat";

const TITLE = "Vườn Phe Pickleball Mini game tháng 11";

describe("tournament name from an image — strip leading OCR filler, then confirm", () => {
  it("drops 'đấu là' and 'là' left in front of the real title", () => {
    for (const raw of [`đấu là ${TITLE}`, `là ${TITLE}`, `Giải đấu là ${TITLE}`, `ĐẤU LÀ ${TITLE}`]) {
      const cleaned = cleanTournamentName(raw);
      expect(cleaned.name).toBe(TITLE);
      expect(cleaned.lowConfidence).toBe(true);
    }
    expect(cleanTournamentName(`la ${TITLE}`).name).toBe(TITLE);
    expect(cleanTournamentName("Giải CLB Hà Đông")).toEqual({ name: "Giải CLB Hà Đông", lowConfidence: false });
  });

  it("reads 'Giải đấu là …' as the title and marks it unconfirmed", () => {
    const facts = readUserFacts(`Giải đấu là ${TITLE}, 16 đội`);
    expect(facts.name).toBe(TITLE);
    expect(facts.name_needs_confirm).toBe(true);
    expect(facts.player_count).toBe(16);
  });

  it("keeps an explicit 'tên giải là' without asking again", () => {
    const facts = readUserFacts(`tên giải là ${TITLE}`);
    expect(facts.name).toBe(TITLE);
    expect(facts.name_needs_confirm).toBeUndefined();
  });

  it("a name from an image is cleaned and blocks saving until the user confirms", () => {
    const ready: Draft = {
      is_doubles: true, player_count: 16, group_count: 4, series: 1,
      roster_mode: "later", courts_done: true,
    };
    const named = applyPatch(ready, { name: `là ${TITLE}`, name_from_image: true });
    expect(named.name).toBe(TITLE);
    expect(named.name_needs_confirm).toBe(true);
    expect(named.name_from_image).toBe(true);
    expect(nextSlot(named)).toBe("name");
    const accepted = applyPatch(named, { name_needs_confirm: false });
    expect(accepted.name).toBe(TITLE);
    expect(accepted.name_needs_confirm).toBeUndefined();
    expect(nextSlot(accepted)).toBe("confirm");
  });

  it("a low-confidence name that was not from an image still has to be confirmed", () => {
    const named = applyPatch({}, { name: `đấu là ${TITLE}` });
    expect(named.name).toBe(TITLE);
    expect(named.name_needs_confirm).toBe(true);
    expect(nameAnswer(`đấu là ${TITLE}`)).toEqual({ name: TITLE, needsConfirm: true });
    expect(nameAnswer(TITLE)).toEqual({ name: TITLE, needsConfirm: false });
  });
});

describe("doubles headcount — N vận động viên / người / VĐV is not N teams", () => {
  const phrases = ["32 vận động viên", "32 người", "32 VĐV", "32 players", "32 people"];

  it("asks whether N is players or teams and suggests N/2 plus a pairs list", () => {
    for (const text of phrases) {
      const after = applySpokenEdit({ is_doubles: true }, text)!;
      expect(after.player_count).toBeUndefined();
      expect(after.headcount_pending).toBe(32);
      expect(nextSlot(after)).toBe("count");
      const ask = headcountAsk(32, "vi");
      expect(ask).toContain("32 là số vận động viên hay số đội");
      expect(ask).toContain("16 đội");
      expect(ask).toContain("Nam - Hùng");
      expect(ask).not.toMatch(/16\.5|15\.5/);
      const reply = replyFromDraft(
        { is_doubles: true },
        after,
        "Đã nhận 32 người, mình sẽ hỏi cách ghép cặp.",
        "vi",
        text,
      );
      expect(reply).toContain("16 đội");
      expect(reply).not.toContain("ghép cặp");
      expect(headcountChoices(32, "vi").map((c) => c.teams)).toEqual([16, 32]);
    }
  });

  it("does not ask when they already said teams", () => {
    const after = applySpokenEdit({ is_doubles: true }, "32 đội")!;
    expect(after.player_count).toBe(32);
    expect(after.headcount_pending).toBeUndefined();
    expect(nextSlot(after)).toBe("groups");
    expect(factualAck({ is_doubles: true }, after, "vi", "32 đội")).not.toContain("hay số đội");
  });

  it("an odd number of players leaves one person over and suggests the even split", () => {
    const after = applySpokenEdit({ is_doubles: true }, "31 vận động viên")!;
    expect(pendingDoublesHeadcount(after)).toBe(31);
    const ask = headcountAsk(31, "vi");
    expect(ask).toContain("thừa 1");
    expect(ask).toContain("15 đội");
    expect(ask).toContain("thêm 1 người thành 16 đội");
    expect(ask).not.toContain("15.5");
    expect(headcountChoices(31, "vi")).toEqual([
      { label: "15 đội (bỏ 1 người)", teams: 15, fromPlayers: true },
      { label: "31 đội", teams: 31, fromPlayers: false },
    ]);
    expect(headcountAsk(31, "en")).toContain("1 left over");
    expect(headcountAsk(31, "en")).toContain("15 teams");
  });

  it("singles keeps N as players, and picking doubles afterwards asks", () => {
    const singles = applySpokenEdit({ is_doubles: false }, "32 vận động viên")!;
    expect(singles.player_count).toBe(32);
    expect(singles.headcount_pending).toBeUndefined();
    expect(nextSlot(singles)).toBe("groups");
    expect(factualAck({ is_doubles: false }, singles, "vi", "32 vận động viên")).toContain("32 người");
    const beforeFormat = applySpokenEdit({}, "32 VĐV")!;
    expect(nextSlot(beforeFormat)).toBe("format");
    expect(beforeFormat.player_count).toBe(32);
    const doubles = clarifyDoublesCount({ ...beforeFormat, is_doubles: true });
    expect(doubles.player_count).toBeUndefined();
    expect(doubles.headcount_pending).toBe(32);
    expect(nextSlot(doubles)).toBe("count");
    const back = clarifyDoublesCount({ ...doubles, is_doubles: false });
    expect(back.player_count).toBe(32);
    expect(nextSlot(back)).toBe("groups");
  });
});
