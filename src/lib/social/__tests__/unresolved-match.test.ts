import { describe, expect, it } from "vitest";
import { buildAriaLabel } from "../feed-formatters";
import { displayNotes } from "../match-notes";

/**
 * Regression cover for the "unresolved match" state.
 *
 * `matches.winning_team` is NULL while a match is in progress and on the
 * one-sided TBD slots the pro-tour importer creates (#771). Three surfaces
 * derived the loser with `!winnerIsA` / a two-branch ternary, which has no
 * third state — so team B was announced and badged as the winner on every
 * unresolved row. 101 public matches were in that state during the KL Cup.
 *
 * ticker-mode-resolver.ts already carries the same lesson from PR #38.
 */

const teamA = [{ display_name: "Ben Johns", username: "ben", avatar_url: null }];
const teamB = [{ display_name: "Tyson McGuffin", username: "tyson", avatar_url: null }];

function label(winningTeam: "a" | "b" | null, language: "vi" | "en") {
  return buildAriaLabel({
    language,
    teamA: teamA as never,
    teamB: teamB as never,
    scoreA: [11, 6],
    scoreB: [9, 8],
    winningTeam,
    venueName: null,
    playedAt: "2026-09-09T10:00:00Z",
    format: "singles",
  });
}

describe("buildAriaLabel on an unresolved match", () => {
  it("does not name a winner or a loser when winningTeam is null", () => {
    const en = label(null, "en");
    expect(en).not.toContain("won against");
    expect(en).not.toContain("lost to");
    expect(en).toContain("Ben Johns vs Tyson McGuffin");

    const vi = label(null, "vi");
    expect(vi).not.toContain("thắng");
    expect(vi).not.toContain("thua");
    expect(vi).toContain("Ben Johns gặp Tyson McGuffin");
  });

  it("still reads the result out when there is one", () => {
    expect(label("a", "en")).toContain("Ben Johns won against Tyson McGuffin");
    expect(label("b", "en")).toContain("Ben Johns lost to Tyson McGuffin");
    expect(label("a", "vi")).toContain("Ben Johns thắng Tyson McGuffin");
    expect(label("b", "vi")).toContain("Ben Johns thua Tyson McGuffin");
  });
});

describe("displayNotes", () => {
  it("hides the machine state the pro-tour and MLP importers write", () => {
    expect(displayNotes('{"live":true}')).toBeNull();
    expect(displayNotes('  {"format":"mlp_team_matchup","team_a":{}}  ')).toBeNull();
    expect(displayNotes("[1,2,3]")).toBeNull();
  });

  it("keeps a real note, including one that merely starts with a brace", () => {
    expect(displayNotes("Sân ướt, hoãn 20 phút")).toBe("Sân ướt, hoãn 20 phút");
    expect(displayNotes("{not json after all")).toBe("{not json after all");
  });

  it("treats blank and missing notes as nothing to show", () => {
    expect(displayNotes(null)).toBeNull();
    expect(displayNotes(undefined)).toBeNull();
    expect(displayNotes("   ")).toBeNull();
  });
});
