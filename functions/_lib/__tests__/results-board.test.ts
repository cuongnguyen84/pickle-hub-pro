import { describe, expect, it } from "vitest";
import { renderResultsBoard } from "../render/blog-body";

const board = (matches: unknown[]) => ({
  division: "Men's Singles",
  rounds: [{ label: "Quarter Finals", matches }],
});

describe("renderResultsBoard", () => {
  it("renders a completed match with winner, loser and sets", () => {
    const html = renderResultsBoard(
      board([{ winner: "A", loser: "B", sets: [[11, 3], [11, 5]] }]) as never,
    );
    expect(html).toContain('<div class="tl-rb-win">A</div>');
    expect(html).toContain('<div class="tl-rb-lose">B</div>');
    expect(html).toContain("<strong>11</strong>-3");
  });

  it("renders a fixture as two neutral teams — never as a result", () => {
    const html = renderResultsBoard(
      board([{ teamA: "A", teamB: "B", sets: [] }]) as never,
    );
    expect(html).toContain('<div class="tl-rb-team">A</div>');
    expect(html).toContain('<div class="tl-rb-team">B</div>');
    expect(html).not.toContain("tl-rb-win");
    expect(html).not.toContain("tl-rb-lose");
  });
});
