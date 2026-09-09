import { describe, it, expect } from "vitest";
import {
  classifyEvent,
  collectLiveMatches,
  filterProResults,
  groupProResults,
  playersLine,
  scoreLine,
  type ProResultRow,
} from "../results";

function row(over: Partial<ProResultRow>): ProResultRow {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    slug: over.slug ?? `m-${over.id ?? "x"}`,
    tournament_name: "PPA Asia 1000 Leapmotor Kuala Lumpur Cup 2026",
    tournament_event: "Pro Men's Doubles",
    round_name: "F",
    team_a_score: [11, 11],
    team_b_score: [7, 9],
    winning_team: "a",
    played_at: "2026-09-13T10:00:00Z",
    court_number: null,
    notes: null,
    match_participants: [
      { team: "a", position: 1, profile: { display_name: "Alex Smith", username: "alex" } },
      { team: "a", position: 2, profile: { display_name: "Ben Jones", username: null } },
      { team: "b", position: 1, profile: { display_name: "Trương Vĩnh Hiển", username: null } },
      { team: "b", position: 2, profile: { display_name: "Đỗ Minh Quân", username: null } },
    ],
    ...over,
  };
}

describe("classifyEvent", () => {
  it("maps the source labels to the five pro events", () => {
    expect(classifyEvent("Pro Men's Doubles")).toBe("mens_doubles");
    expect(classifyEvent("Pro Women's Singles")).toBe("womens_singles");
    expect(classifyEvent("Pro Mixed Doubles")).toBe("mixed_doubles");
    expect(classifyEvent("Champions Bracket")).toBe("other");
  });
});

describe("groupProResults", () => {
  it("groups events, orders rounds F-first, and extracts the champion", () => {
    const rows = [
      row({ id: "sf1", round_name: "SF", winning_team: "b" }),
      row({ id: "f1", round_name: "F", winning_team: "a" }),
      row({
        id: "ws-f",
        tournament_event: "Pro Women's Singles",
        round_name: "F",
        winning_team: "b",
      }),
    ];
    const out = groupProResults(rows);
    expect(out.total).toBe(3);
    // Singles ranks before doubles in the event order.
    expect(out.events.map((e) => e.key)).toEqual(["womens_singles", "mens_doubles"]);
    const md = out.events[1];
    expect(md.rounds.map((r) => r.code)).toEqual(["F", "SF"]);
    expect(md.champion && playersLine(md.champion)).toBe("Alex Smith / Ben Jones");
  });

  it("flags Vietnamese players from diacritics and counts their matches", () => {
    const out = groupProResults([row({ id: "f1" })]);
    const match = out.events[0].rounds[0].matches[0];
    expect(match.hasVietnam).toBe(true);
    expect(match.teamB.every((p) => p.isVietnam)).toBe(true);
    expect(match.teamA.some((p) => p.isVietnam)).toBe(false);
    expect(out.vietnamCount).toBe(1);
  });

  it("drops a trailing 0-0 game slot but keeps a real love game", () => {
    const m = groupProResults([
      row({ id: "g", team_a_score: [11, 11, 0], team_b_score: [7, 9, 0] }),
    ]).events[0].rounds[0].matches[0];
    expect(scoreLine(m)).toBe("11-7, 11-9");
  });

  it("keeps only Pro-labelled draws when any exist", () => {
    const out = groupProResults([
      row({ id: "pro" }),
      row({ id: "am", tournament_event: "Men's Doubles 4.0", round_name: "F" }),
    ]);
    expect(out.total).toBe(1);
    expect(out.events).toHaveLength(1);
    expect(out.events[0].name).toBe("Pro Men's Doubles");
  });

  it("keeps everything when no Pro label exists anywhere", () => {
    const out = groupProResults([
      row({ id: "a", tournament_event: "Men's Doubles" }),
      row({ id: "b", tournament_event: "Women's Doubles" }),
    ]);
    expect(out.total).toBe(2);
  });

  it("skips bye/walkover rows with no names on either side", () => {
    const out = groupProResults([
      row({ id: "real" }),
      row({ id: "bye", match_participants: [] }),
    ]);
    expect(out.total).toBe(1);
    expect(out.events[0].matchCount).toBe(1);
  });
});

describe("filterProResults", () => {
  const grouped = groupProResults([
    row({ id: "f1", round_name: "F" }),
    row({
      id: "ws",
      tournament_event: "Pro Women's Singles",
      round_name: "SF",
      match_participants: [
        { team: "a", position: 1, profile: { display_name: "Anna Leigh Waters", username: null } },
        { team: "b", position: 1, profile: { display_name: "Sophia Nhi Huỳnh", username: null } },
      ],
    }),
  ]);

  it("returns the input untouched for an empty query", () => {
    expect(filterProResults(grouped, "  ")).toBe(grouped);
  });

  it("matches diacritic-insensitively and recounts honestly", () => {
    const out = filterProResults(grouped, "truong");
    expect(out.total).toBe(1);
    expect(out.events).toHaveLength(1);
    expect(out.events[0].matchCount).toBe(1);
    expect(out.vietnamCount).toBe(1);
    // "huynh" finds the WS match via the folded "Huỳnh".
    expect(filterProResults(grouped, "HUYNH").total).toBe(1);
  });

  it("returns an empty tree when nobody matches", () => {
    const out = filterProResults(grouped, "nguyen-khong-ton-tai");
    expect(out.total).toBe(0);
    expect(out.events).toHaveLength(0);
  });

  it("flags a live match from notes and sorts it first in its round", () => {
    const out = groupProResults([
      row({ id: "done", round_name: "SF", winning_team: "a", played_at: "2026-09-09T01:00:00Z" }),
      row({ id: "on", round_name: "SF", winning_team: null, notes: '{"live":true}', played_at: "2026-09-09T09:00:00Z" }),
    ]);
    const sf = out.events[0].rounds.find((r) => r.code === "SF")!;
    expect(sf.matches[0].id).toBe("on");
    expect(sf.matches[0].isLive).toBe(true);
    expect(sf.matches[1].isLive).toBe(false);
  });

  it("collectLiveMatches gathers live matches across events with labels", () => {
    const out = groupProResults([
      row({ id: "on1", winning_team: null, notes: '{"live":true}' }),
      row({ id: "on2", tournament_event: "Pro Women's Singles", round_name: "SF", winning_team: null, notes: '{"live":true}' }),
      row({ id: "done" }),
    ]);
    const live = collectLiveMatches(out, "vi");
    expect(live).toHaveLength(2);
    expect(new Set(live.map((m) => m.eventLabel))).toEqual(new Set(["Đôi nam", "Đơn nữ"]));
  });

  it("suffixes qualifier draws so two sections never share a heading", () => {
    const out = groupProResults([
      row({ id: "main" }),
      row({ id: "q", tournament_event: "Pro Men's Doubles Qualifier", round_name: "W", winning_team: null }),
    ]);
    const labels = out.events.map((e) => e.labelVi).sort();
    expect(labels).toEqual(["Đôi nam", "Đôi nam — Vòng loại"]);
  });
});
