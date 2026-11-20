// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { en } from "@/i18n/en";
vi.mock("@/i18n", () => ({ useI18n: () => ({ t: en, language: "en" }) }));
import PlayoffBracket, { type BracketMatch } from "../PlayoffBracket";
const match: BracketMatch = {
  id: "m1", player1_id: "a", player2_id: "b", score1: 11, score2: 7, winner_id: "a",
  status: "completed", playoff_round: 1, playoff_match_number: 1, bracket_position: null,
  next_match_id: null, next_match_slot: null,
};
afterEach(cleanup);
it("preserves playoff editor on failed commit and closes it after successful retry", async () => {
  const save = vi.fn().mockRejectedValueOnce(new Error("VERSION_CONFLICT")).mockResolvedValueOnce(undefined);
  render(<MemoryRouter><PlayoffBracket matches={[match]} players={[{ id: "a", name: "A" }, { id: "b", name: "B" }]}
    canEdit onScoreUpdate={save} /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: en.quickTable.playoff.editScore }));
  const inputs = screen.getAllByRole("textbox");
  fireEvent.change(inputs[0], { target: { value: "12" } });
  fireEvent.click(screen.getByRole("button", { name: en.common.save }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect((screen.getAllByRole("textbox")[0] as HTMLInputElement).value).toBe("12");
  fireEvent.click(screen.getByRole("button", { name: en.common.save }));
  await waitFor(() => expect(screen.queryAllByRole("textbox")).toHaveLength(0));
  expect(save).toHaveBeenLastCalledWith("m1", 12, 7);
});
