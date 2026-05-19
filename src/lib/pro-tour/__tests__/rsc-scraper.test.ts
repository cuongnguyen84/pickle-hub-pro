import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  rscScraperAdapter,
  parseTournamentHtml,
  parsePpaDate,
  PRO_TOUR_HOST_PATTERN,
} from "../adapters/rsc-scraper";

/**
 * Sprint 6 fixture-harvest cycle — verifies the RSC scraper against a
 * captured snapshot of brackets.pickleballtournaments.com.
 *
 * The fixture (workers/pro-tour-scraper/__fixtures__/2026-ppa-finals-mens-doubles.html)
 * was captured via direct curl on 2026-05-11 from the PPA Finals men's
 * doubles top-8 elimination bracket. It contains 3 match records in the
 * initial server-rendered chunk; later rounds require Browser Rendering
 * to click the round buttons and stream additional chunks. Three is
 * enough for parser validation — adding more rounds doesn't change the
 * shape, only the row count.
 *
 * Re-running this harvest for a new tournament: see
 * workers/pro-tour-scraper/README.md → "Fixture harvest cycle".
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(
  __dirname,
  "../../../../workers/pro-tour-scraper/__fixtures__/2026-ppa-finals-mens-doubles.html",
);

const VALID_URL =
  "https://brackets.pickleballtournaments.com/tournaments/ppa-tour-2026-ppa-finals/events/74E8F47A-1E6D-475D-BA42-0D1180B0A851/elimination/69CBE305-F4E2-4F4D-B2E7-D7946A838262";

const LEGACY_UUID_URL =
  "https://brackets.pickleballtournaments.com/tournaments/d7806c39-89b0-4692-970c-b73a835fa60a/events/1B71FDBD-3B56-41EF-A0D6-ADB38837896E/elimination/745D6E6E-5F00-4138-863B-B2BBB8153152";

describe("PRO_TOUR_HOST_PATTERN / validateUrl", () => {
  it("accepts a slug-form brackets URL (current PPA convention)", () => {
    expect(PRO_TOUR_HOST_PATTERN.test(VALID_URL)).toBe(true);
    expect(rscScraperAdapter.validateUrl(VALID_URL)).toBe(true);
  });

  it("accepts a UUID-form brackets URL (legacy)", () => {
    expect(PRO_TOUR_HOST_PATTERN.test(LEGACY_UUID_URL)).toBe(true);
  });

  it("rejects unrelated URLs", () => {
    expect(rscScraperAdapter.validateUrl("https://google.com")).toBe(false);
    expect(
      rscScraperAdapter.validateUrl("https://pickleballtournaments.com/"),
    ).toBe(false);
    expect(
      rscScraperAdapter.validateUrl(
        "https://other.pickleballtournaments.com/tournaments/abc/events/def/elimination/ghi",
      ),
    ).toBe(false);
  });

  it("rejects truncated paths missing required segments", () => {
    expect(
      rscScraperAdapter.validateUrl(
        "https://brackets.pickleballtournaments.com/tournaments/abc",
      ),
    ).toBe(false);
    expect(
      rscScraperAdapter.validateUrl(
        "https://brackets.pickleballtournaments.com/tournaments/abc/events/def",
      ),
    ).toBe(false);
  });
});

describe("parseTournamentHtml — fixture: 2026 PPA Finals men's doubles", () => {
  const html = readFileSync(FIXTURE_PATH, "utf-8");
  const result = parseTournamentHtml(html, VALID_URL);

  it("returns the ppa_tour source provider + source url", () => {
    expect(result.source_provider).toBe("ppa_tour");
    expect(result.source_url).toBe(VALID_URL);
  });

  it("extracts tournament + event names from the page <title>", () => {
    // Page title format: "PPA Tour: 2026 PPA Finals  - Men's Doubles Pro Top 8 Ranked"
    expect(result.tournament_name).toMatch(/PPA Tour: 2026 PPA Finals/i);
    expect(result.tournament_event).toMatch(/Men's Doubles/i);
  });

  it("extracts exactly 3 match records (2 SF + 1 F) from the initial chunk payload", () => {
    // Top-8 ranked draw: Semi-Finals + Gold Medal Match (Final). No
    // earlier rounds in this fixture (only 8 teams). Asserting EXACTLY
    // 3 catches the prior bug where the matchSlice over-extended and
    // the Final's player block was overwritten with SF2's data,
    // producing 3 records but only 2 unique team pairings.
    expect(result.matches.length).toBe(3);
  });

  it("emits a unique external_match_id per match (no duplicates)", () => {
    const ids = result.matches.map((m) => m.external_match_id);
    expect(new Set(ids).size).toBe(ids.length);
    // Spot-check the actual UUIDs from the captured fixture so a
    // future re-shuffle of regex extraction is caught.
    expect(ids).toContain("ab0c3626-06a4-45c2-884f-ac3066c2e348"); // SF1
    expect(ids).toContain("ceef8f47-8b9f-4ff5-93ba-6b0999a6ef45"); // SF2
    expect(ids).toContain("75d916ac-7c0c-478e-9c69-cbccde99a431"); // Final
  });

  it("each match has exactly 2 doubles teams with integer scores", () => {
    for (const m of result.matches) {
      expect(m.team_one.player_external_ids.length).toBe(2);
      expect(m.team_two.player_external_ids.length).toBe(2);
      // Both teams should have the same number of games played
      expect(m.scores_team_one.length).toBe(m.scores_team_two.length);
      for (const s of [...m.scores_team_one, ...m.scores_team_two]) {
        expect(Number.isInteger(s)).toBe(true);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(30);
      }
    }
  });

  it("round_name is canonical SF for semis and F for the final", () => {
    const rounds = result.matches.map((m) => m.round_name).sort();
    // Two semis + one final → ['F','SF','SF']
    expect(rounds).toEqual(["F", "SF", "SF"]);
  });

  it("SF1: Ben Johns + Gabriel Tardio (11,11) def Hayden Patriquin + Christian Alshon (8,9)", () => {
    const sf1 = result.matches.find(
      (m) => m.external_match_id === "ab0c3626-06a4-45c2-884f-ac3066c2e348",
    );
    expect(sf1).toBeDefined();
    expect(sf1!.round_name).toBe("SF");
    expect(sf1!.team_one.player_external_ids).toEqual(["ben-johns", "gabriel-tardio"]);
    expect(sf1!.team_one.seed).toBe(1);
    expect(sf1!.team_two.player_external_ids).toEqual(["hayden-patriquin", "christian-alshon"]);
    expect(sf1!.team_two.seed).toBe(2);
    expect(sf1!.scores_team_one).toEqual([11, 11]);
    expect(sf1!.scores_team_two).toEqual([8, 9]);
    expect(sf1!.winner_team).toBe("one");
    expect(sf1!.played_at).toMatch(/^2026-05-09T17:38:00-07:00$/);
    expect(sf1!.court).toBe("CC");
  });

  it("SF2: Federico Staksrud + Andrei Daescu (11,11) def Connor Garnett + Riley Newman (9,7)", () => {
    const sf2 = result.matches.find(
      (m) => m.external_match_id === "ceef8f47-8b9f-4ff5-93ba-6b0999a6ef45",
    );
    expect(sf2).toBeDefined();
    expect(sf2!.round_name).toBe("SF");
    expect(sf2!.team_one.player_external_ids).toEqual(["federico-staksrud", "andrei-daescu"]);
    expect(sf2!.team_one.seed).toBe(3);
    expect(sf2!.team_two.player_external_ids).toEqual(["connor-garnett", "riley-newman"]);
    expect(sf2!.team_two.seed).toBe(8);
    expect(sf2!.scores_team_one).toEqual([11, 11]);
    expect(sf2!.scores_team_two).toEqual([9, 7]);
    expect(sf2!.winner_team).toBe("one");
    expect(sf2!.played_at).toMatch(/^2026-05-09T15:50:00-07:00$/);
  });

  it("FINAL: Ben Johns + Gabriel Tardio (11,11,11) def Federico Staksrud + Andrei Daescu (8,3,0)", () => {
    const final = result.matches.find(
      (m) => m.external_match_id === "75d916ac-7c0c-478e-9c69-cbccde99a431",
    );
    expect(final).toBeDefined();
    expect(final!.round_name).toBe("F");
    expect(final!.team_one.player_external_ids).toEqual(["ben-johns", "gabriel-tardio"]);
    expect(final!.team_one.seed).toBe(1);
    expect(final!.team_two.player_external_ids).toEqual(["federico-staksrud", "andrei-daescu"]);
    expect(final!.team_two.seed).toBe(3);
    // Final is best-of-5, played to 3 games (11-11-11 sweep)
    expect(final!.scores_team_one).toEqual([11, 11, 11]);
    expect(final!.scores_team_two).toEqual([8, 3, 0]);
    expect(final!.winner_team).toBe("one");
    expect(final!.played_at).toMatch(/^2026-05-10T14:02:00-07:00$/);
  });

  it("each match's played_at is distinct (regression for 'all matches share SF1's date')", () => {
    const dates = result.matches.map((m) => m.played_at);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("dedupes players across matches by external_id slug", () => {
    const ids = result.players.map((p) => p.external_id);
    expect(new Set(ids).size).toBe(ids.length);
    // Final draw includes 7 unique players (Ben Johns + Gabriel Tardio
    // play in both SF and Final but dedupe to one entry each).
    expect(ids.length).toBe(8);
    expect(ids).toContain("ben-johns");
    expect(ids).toContain("gabriel-tardio");
    expect(ids).toContain("federico-staksrud");
    expect(ids).toContain("andrei-daescu");
  });

  it("synthesizes a pickleball.com player URL for each player", () => {
    const ben = result.players.find((p) => p.external_id === "ben-johns");
    expect(ben?.external_url).toBe("https://pickleball.com/players/ben-johns");
    expect(ben?.display_name).toBe("Ben Johns");
  });

  it("populates court name (CC = Center Court for top-tier matches)", () => {
    for (const m of result.matches) {
      expect(m.court).toBe("CC");
    }
  });
});

describe("canonicalRoundName via parseTournamentHtml", () => {
  // Synthetic mini-payloads that exercise each round-title mapping.
  // The fixture only covers SF + F naturally; these guard against
  // future tournaments where R32/QF/etc. are scraped.
  function makeStub(roundTitle: string, bracketType: string): string {
    return [
      '<title>Test - Pro Series - Test Event</title>',
      '<script>self.__next_f.push([1,"',
      `\\"roundId\\":\\"00001X\\",\\"title\\":\\"${roundTitle}\\",`,
      '\\"matches\\":[',
      '{\\"id\\":\\"11111111-1111-1111-1111-111111111111\\",',
      `\\"inBracketType\\":\\"${bracketType}\\",`,
      '\\"date\\":\\"May 10 - 02:00 PM PDT\\",',
      '\\"court\\":\\"CC\\",',
      '\\"teams\\":[',
      '{\\"id\\":\\"22222222-2222-2222-2222-222222222222\\",\\"players\\":[\\"Player A\\",\\"Player B\\"],\\"seedNumber\\":1,\\"games\\":[{\\"score\\":11,\\"isWinner\\":true}],\\"isWinner\\":true},',
      '{\\"id\\":\\"33333333-3333-3333-3333-333333333333\\",\\"players\\":[\\"Player C\\",\\"Player D\\"],\\"seedNumber\\":2,\\"games\\":[{\\"score\\":5,\\"isWinner\\":false}],\\"isWinner\\":false}',
      ']}',
      ']"])',
      '</script>',
    ].join("");
  }

  const VALID_URL =
    "https://brackets.pickleballtournaments.com/tournaments/x/events/AAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA/elimination/BBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB";

  const cases: Array<[string, string, string]> = [
    ["Quarter-Finals", "W", "QF"],
    ["Quarterfinals", "W", "QF"],
    ["QF", "W", "QF"],
    ["Round of 16", "W", "R16"],
    ["Round of 32", "W", "R32"],
    ["Gold Medal Match", "GS", "F"],
    ["Gold Match", "GS", "F"],
    ["Final", "GS", "F"],
    ["Bronze Medal Match", "L", "3P"],
  ];

  for (const [title, bracketType, expectedCode] of cases) {
    it(`maps round title "${title}" → "${expectedCode}"`, () => {
      const html = makeStub(title, bracketType);
      const out = parseTournamentHtml(html, VALID_URL);
      expect(out.matches.length).toBe(1);
      expect(out.matches[0].round_name).toBe(expectedCode);
    });
  }

  it("falls back to inBracketType (W/L/GS) when round title is unrecognized", () => {
    // Codex P2 fix on PR #34: never emit raw title text into round_name —
    // downstream grouping/filtering relies on a bounded vocabulary.
    // bracketType is the stable fallback whenever the canonical map misses.
    const cases: Array<[string, "W" | "L" | "GS"]> = [
      ["Mystery Bracket", "W"],
      ["Cuartos de Final", "L"], // localized label
      ["Round-Robin Group A", "GS"], // novel format
    ];
    for (const [title, bracketType] of cases) {
      const html = makeStub(title, bracketType);
      const out = parseTournamentHtml(html, VALID_URL);
      expect(out.matches[0].round_name).toBe(bracketType);
    }
  });

  it("canonical title wins even when bracketType disagrees", () => {
    // Sanity check: a Semi-Final played on the loser side of a double-
    // elimination bracket would carry inBracketType='L' but title
    // 'Semi-Finals'. The canonical map MUST take precedence — round_name
    // should be 'SF', not 'L'. Otherwise the ordering of the lookup
    // matters for correctness, which it shouldn't.
    const html = makeStub("Semi-Finals", "L");
    const out = parseTournamentHtml(html, VALID_URL);
    expect(out.matches[0].round_name).toBe("SF");
  });

  it("falls back to UNKNOWN when both title and bracketType are missing", () => {
    // Build a stub WITHOUT roundId/title preceding the match
    const html = [
      '<title>Test - Test - Event</title>',
      '<script>self.__next_f.push([1,"',
      '{\\"id\\":\\"11111111-1111-1111-1111-111111111111\\",',
      '\\"date\\":\\"May 10 - 02:00 PM PDT\\",',
      '\\"court\\":\\"CC\\",',
      '\\"teams\\":[',
      '{\\"id\\":\\"22222222-2222-2222-2222-222222222222\\",\\"players\\":[\\"Player A\\"],\\"seedNumber\\":1,\\"games\\":[{\\"score\\":11,\\"isWinner\\":true}],\\"isWinner\\":true},',
      '{\\"id\\":\\"33333333-3333-3333-3333-333333333333\\",\\"players\\":[\\"Player B\\"],\\"seedNumber\\":2,\\"games\\":[{\\"score\\":5,\\"isWinner\\":false}],\\"isWinner\\":false}',
      ']}',
      '"])</script>',
    ].join("");
    const out = parseTournamentHtml(html, VALID_URL);
    expect(out.matches[0].round_name).toBe("UNKNOWN");
  });
});

describe("parsePpaDate", () => {
  it("converts 'May 10 - 02:02 PM PDT' to an ISO string with -07:00 offset", () => {
    const iso = parsePpaDate("May 10 - 02:02 PM PDT");
    expect(iso).toMatch(/^\d{4}-05-10T14:02:00-07:00$/);
  });

  it("converts a morning EDT time correctly", () => {
    const iso = parsePpaDate("Sep 15 - 09:00 AM EDT");
    expect(iso).toMatch(/^\d{4}-09-15T09:00:00-04:00$/);
  });

  it("handles 12:xx AM as 00:xx", () => {
    const iso = parsePpaDate("Jan 01 - 12:30 AM UTC");
    expect(iso).toMatch(/^\d{4}-01-01T00:30:00\+00:00$/);
  });

  it("handles 12:xx PM as 12:xx", () => {
    const iso = parsePpaDate("Jul 04 - 12:15 PM PDT");
    expect(iso).toMatch(/^\d{4}-07-04T12:15:00-07:00$/);
  });

  it("returns null on garbage input", () => {
    expect(parsePpaDate("")).toBeNull();
    expect(parsePpaDate("not a date")).toBeNull();
    expect(parsePpaDate("May 10 - 02:02 PM XYZ")).toBeNull();
  });
});

describe("parseTournamentHtml — defensive cases", () => {
  it("returns empty matches for HTML with no __next_f payload", () => {
    const html = "<html><body><h1>x</h1></body></html>";
    const out = parseTournamentHtml(html, VALID_URL);
    expect(out.matches).toEqual([]);
    expect(out.players).toEqual([]);
  });

  it("falls back to 'Unknown Tournament' when title is missing", () => {
    const out = parseTournamentHtml("<html><body></body></html>", VALID_URL);
    expect(out.tournament_name).toBe("Unknown Tournament");
    expect(out.tournament_event).toBe("Unknown Event");
  });
});
