/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { QuickTableMatch } from "@/hooks/useQuickTable";

const navigate = vi.fn();
const testI18n = vi.hoisted(() => ({ language: "en" as "en" | "vi" }));

vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("@/i18n", () => ({
  useI18n: () => ({
    language: testI18n.language,
    t: {
      quickTable: {
        view: {
          openScoringPage: testI18n.language === "vi" ? "Mở trang chấm điểm" : "Open scoring page",
          editInlineScore: testI18n.language === "vi" ? "Sửa điểm" : "Edit score",
          inputInlineScore: testI18n.language === "vi" ? "Nhập điểm" : "Enter score",
          cancelEdit: testI18n.language === "vi" ? "Hủy" : "Cancel",
          court: testI18n.language === "vi" ? "Sân" : "Court",
          courtName: testI18n.language === "vi" ? "Tên sân" : "Court name",
          courtNamePlaceholder: testI18n.language === "vi" ? "Nhập tên sân" : "Enter court name",
          saveScore: testI18n.language === "vi" ? "Lưu điểm" : "Save score",
        },
      },
    },
  }),
}));

const { default: QuickTableMatchRow } = await import("../QuickTableMatchRow");

const match: QuickTableMatch = {
  id: "match-1",
  table_id: "table-1",
  group_id: null,
  is_playoff: false,
  playoff_round: null,
  playoff_match_number: null,
  bracket_position: null,
  large_playoff_round: null,
  player1_id: "p1",
  player2_id: "p2",
  score1: 11,
  score2: 8,
  winner_id: "p1",
  status: "completed",
  next_match_id: null,
  next_match_slot: null,
  display_order: 0,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
  court_id: null,
  court_name: null,
  start_at: null,
  rr_round_number: 1,
  rr_match_index: 1,
};

afterEach(() => {
  cleanup();
  navigate.mockReset();
});

describe("QuickTable match actions on compact screens", () => {
  it.each([
    { language: "en" as const, openName: "Open scoring page", editName: "Edit score" },
    { language: "vi" as const, openName: "Mở trang chấm điểm", editName: "Sửa điểm" },
  ])("keeps localized accessible names when captions are hidden on mobile ($language)", ({ language, openName, editName }) => {
    testI18n.language = language;
    render(
      <QuickTableMatchRow
        match={match}
        index={0}
        player1={undefined}
        player2={undefined}
        canEdit
        onScoreUpdate={vi.fn()}
        formatPlayerName={() => "Player"}
      />,
    );

    const openScoring = screen.getByRole("button", { name: openName });
    const editScore = screen.getByRole("button", { name: editName });

    expect(openScoring.querySelector("span")?.className).toContain("hidden sm:inline");
    expect(editScore.querySelector("span")?.className).toContain("hidden sm:inline");
    expect(openScoring.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(editScore.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(openScoring.tabIndex).toBe(0);
    expect(editScore.tabIndex).toBe(0);

    openScoring.focus();
    expect(document.activeElement).toBe(openScoring);
    fireEvent.click(openScoring);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("uses the action name that matches whether the score exists", () => {
    testI18n.language = "en";
    const unscoredMatch = { ...match, score1: null, score2: null, winner_id: null, status: "pending" as const };

    render(
      <QuickTableMatchRow
        match={unscoredMatch}
        index={0}
        player1={undefined}
        player2={undefined}
        canEdit
        onScoreUpdate={vi.fn()}
        formatPlayerName={() => "Player"}
      />,
    );

    expect(screen.getByRole("button", { name: "Enter score" })).toBeTruthy();
  });
});

describe("QuickTable inline score commit failure", () => {
  it("keeps entered scores on failure and exits only after commit", async () => {
    testI18n.language = "en";
    const save = vi.fn().mockRejectedValueOnce(new Error("VERSION_CONFLICT")).mockResolvedValueOnce(undefined);
    render(<QuickTableMatchRow match={match} index={0} player1={undefined} player2={undefined}
      canEdit onScoreUpdate={save} formatPlayerName={() => "Player"} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit score" }));
    const scores = screen.getAllByRole("spinbutton");
    fireEvent.change(scores[0], { target: { value: "12" } });
    const saveButton = screen.getByRole("button", { name: "Save score" });
    saveButton.focus();
    fireEvent.click(saveButton);
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect((screen.getAllByRole("spinbutton")[0] as HTMLInputElement).value).toBe("12");
    expect(document.activeElement).toBe(saveButton);
    fireEvent.click(screen.getByRole("button", { name: "Save score" }));
    await waitFor(() => expect(screen.queryAllByRole("spinbutton")).toHaveLength(0));
    expect(save).toHaveBeenLastCalledWith(12, 8);
  });
});

describe("QuickTable score editor keyboard focus", () => {
  it("Escape cancels without saving and restores focus to Edit score", async () => {
    testI18n.language = "en";
    const save = vi.fn();
    render(<QuickTableMatchRow match={match} index={0} player1={undefined} player2={undefined}
      canEdit onScoreUpdate={save} formatPlayerName={() => "Player"} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit score" }));
    const first = screen.getAllByRole("spinbutton")[0];
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "Escape" });
    await waitFor(() => expect(screen.queryAllByRole("spinbutton")).toHaveLength(0));
    expect(save).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Edit score" }));
  });

  it.each(["Cancel", "Save score"])("restores focus after %s closes the inline editor", async (action) => {
    testI18n.language = "en";
    render(<QuickTableMatchRow match={match} index={0} player1={undefined} player2={undefined}
      canEdit onScoreUpdate={vi.fn().mockResolvedValue(undefined)} formatPlayerName={() => "Player"} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit score" }));
    const button = screen.getByRole("button", { name: action });
    button.focus();
    fireEvent.click(button);
    await waitFor(() => expect(screen.queryAllByRole("spinbutton")).toHaveLength(0));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Edit score" }));
  });
});
