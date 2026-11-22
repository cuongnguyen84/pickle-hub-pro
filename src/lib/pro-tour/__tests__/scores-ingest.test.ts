import { describe, expect, it } from "vitest";
import { parsePpaScoresFeed, dedupeScrapedMatches, recordedGames } from "../adapters/ppa-scores-feed";
import { parseMlpEventMatchups } from "../adapters/mlp-event-matchups";
import {
  BACKFILL_END,
  BACKFILL_START,
  chunkScrape,
  parseMlpDateLabel,
  parseMlpEventUuid,
  parseMlpSchedule,
  parsePpaEventId,
  parsePpaSchedule,
  rangesOverlap,
  secretsReady,
  selectCoverageEvents,
} from "../ingest-plan";
import type { ScrapedMatch } from "../types";

const DAYTONA = {
  eventId: "12a61e43-1dc7-4d48-a926-10d3aa1a66cb",
  tournamentName: "Daytona Beach Open 2026",
  sourceUrl: "https://www.ppatour.com/events/2026/proton-daytona-beach-open/",
  fallbackDate: "2026-11-22",
};

function ppaMatch(over: Record<string, unknown> = {}) {
  return {
    id: "a2fa268a-0a99-4e4c-941d-53fe640b626e",
    division: "Women's Doubles",
    roundLabel: "Semi-Finals",
    court: "CC",
    dateKey: "2026-11-21",
    status: "final",
    teams: [
      { players: ["Anna Bright", "Anna Leigh Waters"], seed: 1, games: [11, 11, 0], winner: true },
      { players: ["Mari Humberg", "Milan Rane"], seed: 6, games: [4, 1, 0], winner: false },
    ],
    ...over,
  };
}

describe("parsePpaScoresFeed", () => {
  it("keeps a completed main-draw match and drops the unplayed game", () => {
    const result = parsePpaScoresFeed({ tournamentId: DAYTONA.eventId, matches: [ppaMatch()] }, DAYTONA);
    expect(result.source_provider).toBe("ppa_tour");
    expect(result.tournament_name).toBe("Daytona Beach Open 2026");
    expect(result.matches).toHaveLength(1);
    const match = result.matches[0];
    expect(match.external_match_id).toBe("a2fa268a-0a99-4e4c-941d-53fe640b626e");
    expect(match.round_name).toBe("SF");
    expect(match.winner_team).toBe("one");
    expect(match.scores_team_one).toEqual([11, 11]);
    expect(match.scores_team_two).toEqual([4, 1]);
    expect(match.played_at).toBe("2026-11-21T12:00:00.000Z");
    expect(match.tournament_event_override).toBe("Pro Women's Doubles");
    expect(result.players.map((p) => p.external_id).sort()).toEqual([
      "anna-bright",
      "anna-leigh-waters",
      "mari-humberg",
      "milan-rane",
    ]);
  });

  it("maps Finals, Quarter Finals and Round 64 onto the feed's round codes", () => {
    const result = parsePpaScoresFeed(
      {
        tournamentId: DAYTONA.eventId,
        matches: [
          ppaMatch({ id: "11111111-1111-1111-1111-111111111111", roundLabel: "Finals" }),
          ppaMatch({ id: "22222222-2222-2222-2222-222222222222", roundLabel: "Quarter Finals" }),
          ppaMatch({ id: "33333333-3333-3333-3333-333333333333", roundLabel: "Round 64", division: "Men's Singles", teams: [
            { players: ["Hunter Johnson"], seed: 3, games: [11, 11], winner: true },
            { players: ["Ben Johns"], seed: 1, games: [8, 9], winner: false },
          ] }),
        ],
      },
      DAYTONA,
    );
    expect(result.matches.map((m) => m.round_name)).toEqual(["F", "QF", "R64"]);
    expect(result.matches[2].tournament_event_override).toBe("Pro Men's Singles");
  });

  it("skips a scheduled final, a qualifying draw, and a challenger division", () => {
    const result = parsePpaScoresFeed(
      {
        tournamentId: DAYTONA.eventId,
        matches: [
          ppaMatch({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", roundLabel: "Finals", status: "scheduled", dateKey: "9999-12-31", teams: [
            { players: ["Anna Bright", "Anna Leigh Waters"], games: [null, null, null], winner: false },
            { players: ["Tyra Hurricane Black", "Jorja Johnson"], games: [null, null, null], winner: false },
          ] }),
          ppaMatch({ id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", division: "Men's Singles Qualifying" }),
          ppaMatch({ id: "cccccccc-cccc-cccc-cccc-cccccccccccc", division: "PRO MEN'S SINGLES - MAIN DRAW" }),
          ppaMatch({ id: "dddddddd-dddd-dddd-dddd-dddddddddddd", division: "Men's Singles Challenger" }),
        ],
      },
      DAYTONA,
    );
    expect(result.matches.map((m) => m.external_match_id)).toEqual(["cccccccc-cccc-cccc-cccc-cccccccccccc"]);
    expect(result.matches[0].tournament_event_override).toBe("Pro Men's Singles");
  });

  it("refuses a feed whose tournament id does not match the event", () => {
    expect(() => parsePpaScoresFeed({ tournamentId: "other", matches: [ppaMatch()] }, DAYTONA)).toThrow(
      "score_event_id_mismatch",
    );
  });

  it("keeps a live match without inventing a winner", () => {
    const result = parsePpaScoresFeed(
      {
        tournamentId: DAYTONA.eventId,
        matches: [ppaMatch({ status: "live", teams: [
          { players: ["Anna Bright"], games: [8, null], winner: false },
          { players: ["Kiora Kunimoto"], games: [6, null], winner: false },
        ] })],
      },
      DAYTONA,
    );
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].winner_team).toBeNull();
    expect(result.matches[0].notes).toBe('{"live":true}');
    expect(result.matches[0].scores_team_one).toEqual([8]);
  });
});

describe("dedupeScrapedMatches", () => {
  function row(id: string, winner: "one" | "two" | null, games: number[]): ScrapedMatch {
    return {
      external_match_id: id,
      round_name: "F",
      team_one: { seed: null, player_external_ids: ["a"] },
      team_two: { seed: null, player_external_ids: ["b"] },
      scores_team_one: games,
      scores_team_two: games.map(() => 0),
      winner_team: winner,
      court: null,
      played_at: "2026-11-21T12:00:00.000Z",
      source_url: "https://example.test",
    };
  }

  it("collapses the same external id and keeps the copy that has a winner", () => {
    const first = row("same-id", null, [11]);
    const richer = row("same-id", "one", [11, 11]);
    const other = row("other-id", "two", [11]);
    const out = dedupeScrapedMatches([first, richer, other, { ...richer, external_match_id: "  " }]);
    expect(out.map((m) => m.external_match_id)).toEqual(["same-id", "other-id"]);
    expect(out[0].winner_team).toBe("one");
    expect(out[0].scores_team_one).toEqual([11, 11]);
  });

  it("is stable when the same payload is parsed twice", () => {
    const feed = { tournamentId: DAYTONA.eventId, matches: [ppaMatch(), ppaMatch()] };
    const once = parsePpaScoresFeed(feed, DAYTONA);
    const twice = parsePpaScoresFeed(feed, DAYTONA);
    expect(twice).toEqual(once);
    expect(once.matches).toHaveLength(1);
  });
});

describe("recordedGames", () => {
  it("drops a trailing 0-0 and keeps a real 11-0", () => {
    expect(recordedGames([11, 0, 0], [0, 11, 0])).toEqual({ a: [11, 0], b: [0, 11] });
  });
});

describe("parseMlpEventMatchups", () => {
  const payload = {
    results: {
      system_matchups: [
        {
          matchup_date: "2026-11-01",
          divisions: [
            {
              matchups: [
                {
                  uuid: "c2b55ebc-fafa-4d32-b697-cc66c9b93771",
                  team_one_title: "Asia International",
                  team_two_title: "Australia",
                  team_one_uuid: "4eb3d92c-36a7-4a74-8538-8ea4e2628626",
                  team_two_uuid: "2506c9d8-764d-4b00-a2ef-a9a2263860f8",
                  team_one_abbreviation: "ASINT",
                  team_two_abbreviation: "AUS",
                  team_one_logo: { url: "https://images.example/asia.png" },
                  team_two_logo: { url: "https://images.example/aus.png" },
                  team_one_score: 1,
                  team_two_score: 3,
                  planned_start_date: "2026-11-01T15:00:00Z",
                  venue: "Brookhaven Country Club",
                  matchup_status: "COMPLETED_MATCHUP_STATUS",
                  winner: 2,
                  round_text: "Finals",
                  in_bracket_type: "W",
                  matches: [
                    {
                      match_abbreviation: "WD",
                      team_one_player_one_name: "Lingwei Kong",
                      team_one_player_two_name: "Rika Fujiwara",
                      team_two_player_one_name: "Danni-Elle Townsend",
                      team_two_player_two_name: "Sahra Dennehy",
                      team_one_game_one_score: 9,
                      team_two_game_one_score: 11,
                    },
                    {
                      match_abbreviation: "DB",
                      team_one_game_one_score: 0,
                      team_two_game_one_score: 0,
                    },
                  ],
                },
                {
                  uuid: "c2b55ebc-fafa-4d32-b697-cc66c9b93771",
                  team_one_title: "Asia International",
                  team_two_title: "Australia",
                  team_one_uuid: "4eb3d92c-36a7-4a74-8538-8ea4e2628626",
                  team_two_uuid: "2506c9d8-764d-4b00-a2ef-a9a2263860f8",
                  team_one_score: 0,
                  team_two_score: 1,
                  matchup_status: "COMPLETED_MATCHUP_STATUS",
                  winner: 2,
                  round_text: "Semi-Finals",
                  matches: [
                    {
                      match_abbreviation: "WD",
                      team_one_player_one_name: "Lingwei Kong",
                      team_two_player_one_name: "Danni-Elle Townsend",
                      team_one_game_one_score: 5,
                      team_two_game_one_score: 11,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  };

  it("imports the completed final once and encodes the MLP card notes", () => {
    const result = parseMlpEventMatchups(payload, {
      eventUrl: "https://majorleaguepickleball.co/events-2026/mlp-nations-cup/",
      tournamentName: "MLP Nations Cup",
    });
    expect(result).not.toBeNull();
    expect(result!.source_provider).toBe("mlp");
    expect(result!.tournament_name).toBe("MLP Nations Cup");
    expect(result!.matches).toHaveLength(1);
    const match = result!.matches[0];
    expect(match.external_match_id).toBe("mlp-c2b55ebc-fafa-4d32-b697-cc66c9b93771");
    expect(match.round_name).toBe("F");
    expect(match.winner_team).toBe("two");
    expect(match.played_at).toBe("2026-11-01T15:00:00Z");
    const notes = JSON.parse(match.notes ?? "{}") as { format: string; games: Array<{ label: string }> };
    expect(notes.format).toBe("mlp_team_matchup");
    expect(notes.games.map((g) => g.label)).toEqual(["WD"]);
  });

  it("keeps an in-progress 2–1 matchup live and does not crown the leader", () => {
    const result = parseMlpEventMatchups(
      {
        results: {
          system_matchups: [
            {
              matchup_date: "2026-11-01",
              divisions: [
                {
                  matchups: [
                    {
                      uuid: "11111111-2222-3333-4444-555555555555",
                      team_one_title: "Asia International",
                      team_two_title: "Australia",
                      team_one_uuid: "4eb3d92c-36a7-4a74-8538-8ea4e2628626",
                      team_two_uuid: "2506c9d8-764d-4b00-a2ef-a9a2263860f8",
                      team_one_score: 2,
                      team_two_score: 1,
                      matchup_status: "IN_PROGRESS_MATCHUP_STATUS",
                      winner: null,
                      round_text: "Round 1",
                      planned_start_date: "2026-11-01T18:00:00Z",
                      matches: [
                        {
                          match_abbreviation: "WD",
                          team_one_player_one_name: "Lingwei Kong",
                          team_two_player_one_name: "Danni-Elle Townsend",
                          team_one_game_one_score: 11,
                          team_two_game_one_score: 7,
                        },
                        {
                          match_abbreviation: "MD",
                          team_one_player_one_name: "Quang Duong",
                          team_two_player_one_name: "Hayden Patriquin",
                          team_one_game_one_score: 6,
                          team_two_game_one_score: 4,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      {
        eventUrl: "https://majorleaguepickleball.co/events-2026/mlp-nations-cup/",
        tournamentName: "MLP Nations Cup",
      },
    );
    expect(result).not.toBeNull();
    expect(result!.matches).toHaveLength(1);
    const match = result!.matches[0];
    expect(match.external_match_id).toBe("mlp-11111111-2222-3333-4444-555555555555");
    expect(match.winner_team).toBeNull();
    const notes = JSON.parse(match.notes ?? "{}") as { format: string; live?: boolean };
    expect(notes.format).toBe("mlp_team_matchup");
    expect(notes.live).toBe(true);
  });

  it("returns null when the payload has no matchup list", () => {
    expect(parseMlpEventMatchups({}, { eventUrl: "https://example.test", tournamentName: "MLP" })).toBeNull();
  });
});

describe("ingest plan", () => {
  const catalog = [
    {
      key: "daytona-beach-open-2026",
      name: "Daytona Beach Open 2026",
      title: "Proton Daytona Beach Open 2026",
      start_date: "2026-11-16",
      end_date: "2026-11-22",
      event_id: "12a61e43-1dc7-4d48-a926-10d3aa1a66cb",
      result_source: "https://www.ppatour.com/api/scores/?event=12a61e43-1dc7-4d48-a926-10d3aa1a66cb",
      source: "https://www.ppatour.com/events/2026/proton-daytona-beach-open/",
    },
    {
      key: "old",
      name: "Somewhere 2025",
      start_date: "2025-11-01",
      end_date: "2025-11-05",
      event_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      result_source: "https://www.ppatour.com/api/scores/?event=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    },
    {
      key: "app-bangkok",
      title: "APP Bangkok",
      start_date: "2026-11-17",
      end_date: "2026-11-22",
      enabled: true,
    },
  ];

  it("selects Oct–Nov 2026 scores-feed events and names them from the catalog", () => {
    const picked = selectCoverageEvents(catalog, BACKFILL_START, BACKFILL_END);
    expect(picked.map((e) => e.eventId)).toEqual(["12a61e43-1dc7-4d48-a926-10d3aa1a66cb"]);
    expect(picked[0].tournamentName).toBe("Daytona Beach Open 2026");
    expect(picked[0].fallbackDate).toBe("2026-11-22");
  });

  it("reads the PPA schedule JSON-LD and an event id from the event page", () => {
    const html = `<script type="application/ld+json">{"@type":"ItemList","itemListElement":[{"@type":"ListItem","item":{"@type":"SportsEvent","name":"Proton Daytona Beach Open","startDate":"2026-11-16","endDate":"2026-11-22","url":"https://www.ppatour.com/events/2026/proton-daytona-beach-open/"}}]}</script>`;
    expect(parsePpaSchedule(html)).toEqual([
      {
        name: "Proton Daytona Beach Open",
        start: "2026-11-16",
        end: "2026-11-22",
        url: "https://www.ppatour.com/events/2026/proton-daytona-beach-open/",
      },
    ]);
    expect(parsePpaEventId('{"eventId":"12a61e43-1dc7-4d48-a926-10d3aa1a66cb"}')).toBe(
      "12a61e43-1dc7-4d48-a926-10d3aa1a66cb",
    );
  });

  it("parses MLP menu dates, including a month boundary, and the event uuid", () => {
    expect(parseMlpDateLabel("Oct 30-Nov 1", 2026)).toEqual({ start: "2026-10-30", end: "2026-11-01" });
    expect(parseMlpDateLabel("July 30 – Aug 2", 2026)).toEqual({ start: "2026-07-30", end: "2026-08-02" });
    const html = `<a href="https://majorleaguepickleball.co/events-2026/mlp-nations-cup/"><b>Dallas (Nations Cup):</b>  Oct 30-Nov 1</a>
<a href="https://majorleaguepickleball.co/events-2026/mlp-nations-cup/"><b>Dallas (Nations Cup):</b>  Oct 30-Nov 1</a>`;
    const events = parseMlpSchedule(html);
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe("MLP Dallas (Nations Cup)");
    expect(events[0].start).toBe("2026-10-30");
    expect(rangesOverlap(events[0].start, events[0].end, BACKFILL_START, BACKFILL_END)).toBe(true);
    expect(parseMlpEventUuid('phpObj = {"scoreTickerEventUuid":"90442752-2dc4-426b-ab12-95316b0dfeac"}')).toBe(
      "90442752-2dc4-426b-ab12-95316b0dfeac",
    );
  });

  it("treats a missing service-role key as not ready", () => {
    expect(secretsReady({})).toBe(false);
    expect(secretsReady({ SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "  " })).toBe(false);
    expect(secretsReady({ SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "key" })).toBe(true);
  });

  it("keeps each chunk's players limited to that chunk", () => {
    const result = parsePpaScoresFeed(
      {
        tournamentId: DAYTONA.eventId,
        matches: [
          ppaMatch(),
          ppaMatch({
            id: "99999999-9999-9999-9999-999999999999",
            teams: [
              { players: ["Hunter Johnson"], seed: 1, games: [11, 11], winner: true },
              { players: ["Ben Johns"], seed: 2, games: [5, 7], winner: false },
            ],
          }),
        ],
      },
      DAYTONA,
    );
    const chunks = chunkScrape(result, 1);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].players.map((p) => p.display_name)).not.toContain("Ben Johns");
    expect(chunks[1].players.map((p) => p.display_name).sort()).toEqual(["Ben Johns", "Hunter Johnson"]);
  });
});
