import { describe, expect, it } from "vitest";
import { renderResultsBoard } from "../render/blog-body";

const board = (matches: unknown[]) => ({
  division: "Men's Singles",
  rounds: [{ label: "Quarter Finals", matches }],
});

describe("renderResultsBoard", () => {
  it("renders a completed match as a table row with winner, loser and sets", () => {
    const html = renderResultsBoard(
      board([{ winner: "A", loser: "B", sets: [[11, 3], [11, 5]] }]) as never,
    );
    // Topical Authority proposal 4: scores ship as a real <table> in the bot
    // HTML (Match - Score - Winner - Note), not nested divs.
    expect(html).toContain("<table");
    expect(html).toContain("<th>Match</th><th>Score</th><th>Winner</th><th>Note</th>");
    expect(html).toContain("<td><strong>A</strong> — B</td>");
    expect(html).toContain("<strong>11</strong>-3");
    expect(html).toContain("<td>A</td>");
  });

  it("renders a fixture as two neutral teams — never as a result", () => {
    const html = renderResultsBoard(
      board([{ teamA: "A", teamB: "B", sets: [] }]) as never,
    );
    expect(html).toContain("<td>A — B</td>");
    expect(html).toContain("<td>Fixture</td>");
    expect(html).not.toContain("<strong>A</strong>");
    expect(html).not.toContain("tl-rb-win");
    expect(html).not.toContain("tl-rb-lose");
  });
});
