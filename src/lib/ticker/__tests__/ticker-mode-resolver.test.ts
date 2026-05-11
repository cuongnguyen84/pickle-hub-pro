import { describe, it, expect } from "vitest";
import {
  countSetWins,
  formatProMatchTicker,
  formatRoundLabel,
  lastNameFromDisplayName,
  resolveTickerMode,
  stripTournamentPrefix,
} from "../ticker-mode-resolver";

describe("countSetWins", () => {
  it("3-0 sweep — A wins all three games", () => {
    expect(countSetWins([11, 11, 11], [8, 3, 0])).toEqual({ a: 3, b: 0 });
  });

  it("3-0 sweep when B wins (mirror)", () => {
    expect(countSetWins([8, 3, 0], [11, 11, 11])).toEqual({ a: 0, b: 3 });
  });

  it("2-0 best-of-3 (semis short format)", () => {
    expect(countSetWins([11, 11], [8, 9])).toEqual({ a: 2, b: 0 });
  });

  it("2-1 split — A wins games 1+3, B wins game 2", () => {
    expect(countSetWins([11, 7, 11], [9, 11, 8])).toEqual({ a: 2, b: 1 });
  });

  it("element 0 counts as a played game (not skipped)", () => {
    // [8,3,0] vs [11,11,11] — game 3 score 0 should still count B's
    // win for that game. Spec explicitly calls out this edge case
    // because the source uses 0 for played-but-zero, "" for unplayed
    // (parser drops "" before this layer ever sees it).
    expect(countSetWins([8, 3, 0], [11, 11, 11])).toEqual({ a: 0, b: 3 });
  });

  it("ties count for neither side", () => {
    expect(countSetWins([11, 5], [11, 11])).toEqual({ a: 0, b: 1 });
  });

  it("uneven array lengths — missing position treated as 0", () => {
    // Defensive: if for some reason team_a_score has fewer entries
    // than team_b_score, the missing slot is implicitly 0.
    expect(countSetWins([11], [9, 11])).toEqual({ a: 1, b: 1 });
  });

  it("empty arrays → 0:0", () => {
    expect(countSetWins([], [])).toEqual({ a: 0, b: 0 });
  });
});

describe("lastNameFromDisplayName", () => {
  it("two-word name → last word", () => {
    expect(lastNameFromDisplayName("Ben Johns")).toBe("Johns");
  });

  it("multi-word name → last word", () => {
    expect(lastNameFromDisplayName("Anna Leigh Waters")).toBe("Waters");
  });

  it("Vietnamese 3-part name → last word", () => {
    expect(lastNameFromDisplayName("Nguyễn Văn A")).toBe("A");
  });

  it("mononym returns whole name", () => {
    expect(lastNameFromDisplayName("Pelé")).toBe("Pelé");
  });

  it("trims surrounding whitespace", () => {
    expect(lastNameFromDisplayName("  Federico  Staksrud  ")).toBe("Staksrud");
  });

  it("collapses multiple internal spaces", () => {
    expect(lastNameFromDisplayName("Connor   Garnett")).toBe("Garnett");
  });

  it("null / undefined / empty → empty string", () => {
    expect(lastNameFromDisplayName(null)).toBe("");
    expect(lastNameFromDisplayName(undefined)).toBe("");
    expect(lastNameFromDisplayName("")).toBe("");
    expect(lastNameFromDisplayName("   ")).toBe("");
  });
});

describe("formatRoundLabel", () => {
  it("F → Final / Chung kết", () => {
    expect(formatRoundLabel("F", "en")).toBe("Final");
    expect(formatRoundLabel("F", "vi")).toBe("Chung kết");
  });

  it("SF → Semifinal / Bán kết", () => {
    expect(formatRoundLabel("SF", "en")).toBe("Semifinal");
    expect(formatRoundLabel("SF", "vi")).toBe("Bán kết");
  });

  it("QF → Quarterfinal / Tứ kết", () => {
    expect(formatRoundLabel("QF", "en")).toBe("Quarterfinal");
    expect(formatRoundLabel("QF", "vi")).toBe("Tứ kết");
  });

  it("R16 / R32 / R64 / 3P all map to canonical labels", () => {
    expect(formatRoundLabel("R16", "en")).toBe("Round of 16");
    expect(formatRoundLabel("R32", "vi")).toBe("Vòng 1/16");
    expect(formatRoundLabel("R64", "en")).toBe("Round of 64");
    expect(formatRoundLabel("3P", "vi")).toBe("Tranh hạng 3");
  });

  it("unrecognized code returns verbatim (graceful fallback)", () => {
    expect(formatRoundLabel("W", "en")).toBe("W");
    expect(formatRoundLabel("Group A", "vi")).toBe("Group A");
  });

  it("null / undefined / empty → empty string", () => {
    expect(formatRoundLabel(null, "en")).toBe("");
    expect(formatRoundLabel(undefined, "vi")).toBe("");
    expect(formatRoundLabel("", "en")).toBe("");
  });
});

describe("stripTournamentPrefix", () => {
  it("strips 'PPA Tour:' prefix", () => {
    expect(stripTournamentPrefix("PPA Tour: 2026 PPA Finals")).toBe("2026 PPA Finals");
  });

  it("strips 'APP Tour:' and 'MLP Tour:' prefixes too", () => {
    expect(stripTournamentPrefix("APP Tour: 2026 Major")).toBe("2026 Major");
    expect(stripTournamentPrefix("MLP Tour: Atlanta Slam")).toBe("Atlanta Slam");
  });

  it("case-insensitive on the tour name", () => {
    expect(stripTournamentPrefix("ppa tour: lower-case")).toBe("lower-case");
  });

  it("leaves non-prefixed names unchanged", () => {
    expect(stripTournamentPrefix("PPL Vietnam Open 2026")).toBe("PPL Vietnam Open 2026");
  });

  it("null / undefined → empty string", () => {
    expect(stripTournamentPrefix(null)).toBe("");
    expect(stripTournamentPrefix(undefined)).toBe("");
  });
});

describe("resolveTickerMode", () => {
  it("any live → live mode", () => {
    expect(
      resolveTickerMode({ liveCount: 1, upcomingCount: 0, matchCount: 0, blogCount: 5 }),
    ).toBe("live");
  });

  it("any upcoming → live mode", () => {
    expect(
      resolveTickerMode({ liveCount: 0, upcomingCount: 1, matchCount: 0, blogCount: 5 }),
    ).toBe("live");
  });

  it("no live, has matches → matches mode", () => {
    expect(
      resolveTickerMode({ liveCount: 0, upcomingCount: 0, matchCount: 3, blogCount: 5 }),
    ).toBe("matches");
  });

  it("no live, no matches → blog mode", () => {
    expect(
      resolveTickerMode({ liveCount: 0, upcomingCount: 0, matchCount: 0, blogCount: 5 }),
    ).toBe("blog");
  });

  it("empty across the board → empty mode", () => {
    expect(
      resolveTickerMode({ liveCount: 0, upcomingCount: 0, matchCount: 0, blogCount: 0 }),
    ).toBe("empty");
  });
});

describe("formatProMatchTicker", () => {
  const benTardioVsStaksrudDaescu = {
    match_id: "75d916ac-7c0c-478e-9c69-cbccde99a431",
    slug: "ppa-tour-75d916ac",
    tournament_name: "PPA Tour: 2026 PPA Finals",
    round_name: "F",
    team_a_score: [11, 11, 11],
    team_b_score: [8, 3, 0],
    winning_team: "a" as const,
    team_a_lastnames: ["Johns", "Tardio"],
    team_b_lastnames: ["Staksrud", "Daescu"],
  };

  it("EN — Final lead, winner-first body, 3:0 score", () => {
    const item = formatProMatchTicker(benTardioVsStaksrudDaescu, "en");
    expect(item.lead).toBe("2026 PPA Finals - Final");
    expect(item.body).toBe("Johns/Tardio 3:0 Staksrud/Daescu");
    expect(item.href).toBe("/tran-dau/ppa-tour-75d916ac");
    expect(item.id).toBe("match-75d916ac-7c0c-478e-9c69-cbccde99a431");
  });

  it("VI — round label localized to 'Chung kết'", () => {
    const item = formatProMatchTicker(benTardioVsStaksrudDaescu, "vi");
    expect(item.lead).toBe("2026 PPA Finals - Chung kết");
    // Body stays the same — names + score format don't translate
    expect(item.body).toBe("Johns/Tardio 3:0 Staksrud/Daescu");
  });

  it("when team B won, body still leads with the winner pair", () => {
    const item = formatProMatchTicker(
      { ...benTardioVsStaksrudDaescu, winning_team: "b", team_a_score: [8, 3, 0], team_b_score: [11, 11, 11] },
      "en",
    );
    // B won, so body should lead with Staksrud/Daescu and read "3:0"
    expect(item.body).toBe("Staksrud/Daescu 3:0 Johns/Tardio");
  });

  it("SF round label, 2:0 best-of-3", () => {
    const item = formatProMatchTicker(
      {
        ...benTardioVsStaksrudDaescu,
        match_id: "ab0c3626-06a4-45c2-884f-ac3066c2e348",
        slug: "ppa-tour-ab0c3626",
        round_name: "SF",
        team_a_score: [11, 11],
        team_b_score: [8, 9],
        team_b_lastnames: ["Patriquin", "Alshon"],
      },
      "en",
    );
    expect(item.lead).toBe("2026 PPA Finals - Semifinal");
    expect(item.body).toBe("Johns/Tardio 2:0 Patriquin/Alshon");
  });

  it("falls back to placeholder when team last names missing", () => {
    const item = formatProMatchTicker(
      {
        ...benTardioVsStaksrudDaescu,
        team_a_lastnames: [],
        team_b_lastnames: [],
      },
      "en",
    );
    expect(item.body).toBe("Team A 3:0 Team B");
  });

  it("VI fallback uses Vietnamese team placeholder", () => {
    const item = formatProMatchTicker(
      {
        ...benTardioVsStaksrudDaescu,
        team_a_lastnames: [],
        team_b_lastnames: [],
      },
      "vi",
    );
    expect(item.body).toBe("Đội A 3:0 Đội B");
  });

  it("singles match — single name per side, no slash", () => {
    const item = formatProMatchTicker(
      {
        ...benTardioVsStaksrudDaescu,
        team_a_lastnames: ["Tardio"],
        team_b_lastnames: ["Johns"],
      },
      "en",
    );
    expect(item.body).toBe("Tardio 3:0 Johns");
  });

  it("missing tournament_name — round label still rendered as lead", () => {
    const item = formatProMatchTicker(
      { ...benTardioVsStaksrudDaescu, tournament_name: null },
      "en",
    );
    expect(item.lead).toBe("Final");
  });

  it("missing round_name — tournament shown as lead alone", () => {
    const item = formatProMatchTicker(
      { ...benTardioVsStaksrudDaescu, round_name: null },
      "en",
    );
    expect(item.lead).toBe("2026 PPA Finals");
  });
});
