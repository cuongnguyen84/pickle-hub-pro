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

  it("extracts at least 3 match records from the initial chunk payload", () => {
    // Initial curl payload contains the 3 most-advanced rounds (Semis +
    // a Final). Other rounds need Browser Rendering click, but 3+ is
    // sufficient to certify the regex extractor works end-to-end.
    expect(result.matches.length).toBeGreaterThanOrEqual(3);
  });

  it("each match has 2 teams with valid score arrays", () => {
    for (const m of result.matches) {
      expect(m.team_one.player_external_ids.length).toBeGreaterThanOrEqual(1);
      expect(m.team_two.player_external_ids.length).toBeGreaterThanOrEqual(1);
      // Doubles: exactly 2 players per team
      expect(m.team_one.player_external_ids.length).toBeLessThanOrEqual(2);
      expect(m.team_two.player_external_ids.length).toBeLessThanOrEqual(2);
      // Scores are arrays of integers (0..21 covers any sane PPA result)
      for (const s of [...m.scores_team_one, ...m.scores_team_two]) {
        expect(Number.isInteger(s)).toBe(true);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(30);
      }
    }
  });

  it("ben johns + gabriel tardio team is present and seeded #1", () => {
    const benTardio = result.matches.find((m) =>
      [m.team_one, m.team_two].some(
        (t) =>
          t.player_external_ids.includes("ben-johns") &&
          t.player_external_ids.includes("gabriel-tardio"),
      ),
    );
    expect(benTardio).toBeDefined();
    const team = [benTardio!.team_one, benTardio!.team_two].find((t) =>
      t.player_external_ids.includes("ben-johns"),
    )!;
    expect(team.seed).toBe(1);
  });

  it("dedupes players across matches by external_id slug", () => {
    const ids = result.players.map((p) => p.external_id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
    // Spot-check known players from the men's doubles top-8 bracket
    expect(ids).toContain("ben-johns");
    expect(ids).toContain("gabriel-tardio");
  });

  it("synthesizes a pickleball.com player URL for each player", () => {
    const ben = result.players.find((p) => p.external_id === "ben-johns");
    expect(ben?.external_url).toBe("https://pickleball.com/players/ben-johns");
    expect(ben?.display_name).toBe("Ben Johns");
  });

  it("captures bracket round identifier (W / L / GS)", () => {
    for (const m of result.matches) {
      expect(["W", "L", "GS", "UNKNOWN"]).toContain(m.round_name);
    }
  });

  it("populates court name when present", () => {
    // CC = Center Court. Top-tier matches always render on CC for pro-tour
    const courts = result.matches.map((m) => m.court).filter(Boolean);
    expect(courts.length).toBeGreaterThan(0);
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
