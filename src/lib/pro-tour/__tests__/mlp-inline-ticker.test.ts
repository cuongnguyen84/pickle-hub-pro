import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseMlpFromInlineTicker,
  extractInlineTickerMatchups,
  extractTournamentName,
  type MlpMatchupNotes,
} from "../adapters/mlp-inline-ticker";

/**
 * Post-2026-07 MLP page redesign — the event page inlines the full
 * matchup payload (phpObj.initialTicker) instead of embedding a
 * brackets.pickleballteamleagues.com iframe.
 *
 * The fixture is a trimmed capture of
 * https://majorleaguepickleball.co/events-2026/mlp-san-diego-2026/
 * (curl, 2026-07-22): 2 completed matchups kept out of 29, each with
 * 5 game slots (WD/MD/MXD1/MXD2/DB — DB unplayed in both since the
 * matchups ended 4-0).
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(
  resolve(__dirname, "__fixtures__/mlp-inline-ticker-2026-san-diego.html"),
  "utf8",
);

const EVENT_URL = "https://majorleaguepickleball.co/events-2026/mlp-san-diego-2026/";

describe("extractInlineTickerMatchups", () => {
  it("finds the inline ticker matchups", () => {
    const matchups = extractInlineTickerMatchups(FIXTURE);
    expect(matchups).not.toBeNull();
    expect(matchups).toHaveLength(2);
    expect(matchups![0].teamOneTitle).toBe("Columbus Sliders");
  });

  it("returns null when no ticker is present (pre-redesign pages)", () => {
    expect(extractInlineTickerMatchups("<html><body>old page</body></html>")).toBeNull();
  });
});

describe("parseMlpFromInlineTicker", () => {
  const result = parseMlpFromInlineTicker(
    FIXTURE,
    EVENT_URL,
    extractTournamentName(FIXTURE),
  )!;

  it("parses both completed matchups", () => {
    expect(result).not.toBeNull();
    expect(result.source_provider).toBe("mlp");
    expect(result.tournament_name).toBe("MLP San Diego");
    expect(result.matches).toHaveLength(2);
  });

  it("maps teams, scores and winner", () => {
    const m = result.matches[0];
    const notes = JSON.parse(m.notes!) as MlpMatchupNotes;
    expect(notes.format).toBe("mlp_team_matchup");
    expect(notes.team_a.name).toBe("Columbus Sliders");
    expect(notes.team_b.name).toBe("Orlando Squeeze");
    expect(notes.team_a.matchup_wins).toBe(4);
    expect(notes.team_b.matchup_wins).toBe(0);
    expect(m.winner_team).toBe("one");
    expect(m.external_match_id).toMatch(/^mlp-[a-f0-9-]+-vs-[a-f0-9-]+$/);
  });

  it("extracts the 4 played games with labels and lineups, skipping the unplayed DB slot", () => {
    const notes = JSON.parse(result.matches[0].notes!) as MlpMatchupNotes;
    expect(notes.games.map((g) => g.label)).toEqual(["WD", "MD", "MXD1", "MXD2"]);
    const wd = notes.games[0];
    expect(wd.score_a).toBe(11);
    expect(wd.score_b).toBe(2);
    expect(wd.winner).toBe("a");
    expect(wd.players_a).toEqual(["Parris Todd", "Tyra Hurricane Black"]);
    expect(wd.players_b).toEqual(["Alex Walker", "Milan Rane"]);
  });

  it("throws when the ticker belongs to another event (global-ticker page)", () => {
    // The WP site injects the ACTIVE event's ticker into every event page —
    // an Orlando page carries San Diego matchups. moduleSubTitle names the
    // real event, so a mismatched page title must be rejected.
    expect(() =>
      parseMlpFromInlineTicker(FIXTURE, EVENT_URL, "MLP Orlando"),
    ).toThrow(/belongs to another event/);
  });

  it("creates team + player ghost profiles", () => {
    const teamIds = result.players.map((p) => p.external_id);
    expect(teamIds).toContain("columbus-sliders");
    expect(teamIds).toContain("orlando-squeeze");
    expect(teamIds).toContain("parris-todd");
    const team = result.players.find((p) => p.external_id === "columbus-sliders")!;
    expect(team.avatar_url).toMatch(/^https?:\/\//);
  });
});
