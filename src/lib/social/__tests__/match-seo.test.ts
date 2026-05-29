import { describe, it, expect } from "vitest";
import {
  buildMatchDescription,
  buildMatchSchema,
  countSetWins,
  formatScoreList,
  roundLabel,
  stripTourPrefix,
} from "../../../../functions/_lib/render/match-seo";

/**
 * Pure helper tests for the /tran-dau/<slug> SEO prerender (Sprint 6
 * SEO audit fixes). Same cross-import pattern seo-helpers.test.ts uses
 * for the profile/feed prerender helpers.
 */

describe("countSetWins", () => {
  it("3-0 sweep", () => {
    expect(countSetWins([11, 11, 11], [8, 3, 0])).toEqual({ a: 3, b: 0 });
  });
  it("2-1 mixed", () => {
    expect(countSetWins([11, 7, 11], [9, 11, 8])).toEqual({ a: 2, b: 1 });
  });
});

describe("formatScoreList", () => {
  it("compact comma-joined", () => {
    expect(formatScoreList([11, 11, 11], [7, 6, 2])).toBe("11-7, 11-6, 11-2");
  });
});

describe("roundLabel + stripTourPrefix", () => {
  it("F → Final / Chung kết", () => {
    expect(roundLabel("F", "en")).toBe("Final");
    expect(roundLabel("F", "vi")).toBe("Chung kết");
  });
  it("strips PPA Tour: prefix", () => {
    expect(stripTourPrefix("PPA Tour: 2026 PPA Finals")).toBe("2026 PPA Finals");
  });
  it("unrecognized round returns verbatim", () => {
    expect(roundLabel("W", "en")).toBe("W");
  });
});

describe("buildMatchDescription", () => {
  const ppaFinal = {
    teamALabel: "Anna Leigh Waters & Anna Bright",
    teamBLabel: "Parris Todd & Rachel Rohrabacher",
    teamAScore: [11, 11, 11],
    teamBScore: [7, 6, 2],
    winningTeam: "a" as const,
    format: "mixed",
    playedAtIso: "2026-05-10T20:00:00Z",
    tournamentName: "PPA Tour 2026 PPA Finals",
    tournamentEvent: "Mixed Doubles Pro",
    roundCode: "F",
    venueName: "",
  };

  it("EN — winner verb 'defeat', set score, tournament + round + date", () => {
    const out = buildMatchDescription(ppaFinal, "en");
    expect(out).toContain("Anna Leigh Waters & Anna Bright defeat Parris Todd & Rachel Rohrabacher");
    expect(out).toContain("3-0"); // set score is always present
    // This pro-tour description exceeds 155ch, so the per-game parenthetical
    // "(11-7, 11-6, 11-2)" is dropped (2026-05-18 Ahrefs ≤155ch fix —
    // see trimToMax in match-seo.ts). The compact short-desc path below
    // verifies the parenthetical is kept when the description fits.
    expect(out.length).toBeLessThanOrEqual(155);
    expect(out).not.toContain("(11-7");
    expect(out).toContain("PPA Tour 2026 PPA Finals");
    expect(out).toContain("Mixed Doubles Pro");
    expect(out).toContain("Final");
    expect(out).toContain("May 10, 2026");
  });

  it("VI — verb 'thắng', round 'Chung kết', date dd/mm/yyyy", () => {
    const out = buildMatchDescription(ppaFinal, "vi");
    expect(out).toContain("thắng");
    expect(out).toContain("3-0");
    expect(out).not.toContain("(11-7"); // trimmed for length (see EN test)
    expect(out).toContain("Chung kết");
    expect(out).toMatch(/ngày \d{2}\/\d{2}\/\d{4}\.$/);
  });

  it("short description keeps the per-game score parenthetical", () => {
    // Community match with short labels + no tournament stays under 155ch,
    // so the full "3-0 (11-7, 11-6, 11-2)" detail is retained.
    const out = buildMatchDescription(
      {
        ...ppaFinal,
        teamALabel: "An",
        teamBLabel: "Bo",
        tournamentName: null,
        tournamentEvent: null,
        roundCode: null,
        venueName: "Q7",
      },
      "en",
    );
    expect(out).toContain("3-0 (11-7, 11-6, 11-2)");
    expect(out.length).toBeLessThanOrEqual(155);
  });

  it("when team B won, leads body with B and reorders score perspective", () => {
    const out = buildMatchDescription(
      {
        ...ppaFinal,
        winningTeam: "b",
        teamAScore: [7, 6, 2],
        teamBScore: [11, 11, 11],
      },
      "en",
    );
    expect(out).toContain("Parris Todd & Rachel Rohrabacher defeat Anna Leigh Waters & Anna Bright");
    expect(out).toContain("3-0"); // per-game parenthetical trimmed (long desc)
  });

  it("unresolved match (winning_team null) — neutral 'vs' sentence", () => {
    const out = buildMatchDescription(
      { ...ppaFinal, winningTeam: null },
      "en",
    );
    expect(out).toContain("vs");
    expect(out).not.toContain("defeat");
  });

  it("community match (no tournament) — falls back to venue + date", () => {
    const out = buildMatchDescription(
      {
        ...ppaFinal,
        tournamentName: null,
        tournamentEvent: null,
        roundCode: null,
        venueName: "Sân Quận 7",
      },
      "vi",
    );
    expect(out).toContain("Sân Quận 7");
    expect(out).not.toContain("PPA");
  });
});

describe("buildMatchSchema", () => {
  const final = {
    url: "https://www.thepicklehub.net/tran-dau/ppa-tour-final",
    description: "Anna Leigh Waters & Anna Bright defeat ...",
    imageUrl: "https://www.thepicklehub.net/og/match/ppa-tour-final.png",
    teamAPlayers: ["Anna Leigh Waters", "Anna Bright"],
    teamBPlayers: ["Parris Todd", "Rachel Rohrabacher"],
    teamAScore: [11, 11, 11],
    teamBScore: [7, 6, 2],
    winningTeam: "a" as const,
    format: "mixed",
    playedAtIso: "2026-05-10T20:00:00Z",
    durationMinutes: 38,
    tournamentName: "PPA Tour 2026 PPA Finals",
    venueName: "Brookhaven Country Club",
    venueCity: "Dallas, TX",
    courtNumber: "Center Court",
    sourceProvider: "ppa_tour" as const,
  };

  it("emits SportsTeam competitors when doubles", () => {
    const out = buildMatchSchema(final);
    const competitors = out.competitor as Array<{ "@type": string; name: string; athlete?: unknown[] }>;
    expect(competitors).toHaveLength(2);
    expect(competitors[0]["@type"]).toBe("SportsTeam");
    expect(competitors[0].name).toBe("Anna Leigh Waters & Anna Bright");
    expect(competitors[0].athlete).toHaveLength(2);
  });

  it("emits Person competitor when singles", () => {
    const out = buildMatchSchema({
      ...final,
      teamAPlayers: ["Tyson McGuffin"],
      teamBPlayers: ["Federico Staksrud"],
      format: "singles",
    });
    const competitors = out.competitor as Array<{ "@type": string }>;
    expect(competitors[0]["@type"]).toBe("Person");
    expect(competitors[1]["@type"]).toBe("Person");
  });

  it("winner points at the winning competitor (SportsTeam, doubles)", () => {
    const out = buildMatchSchema(final);
    const winner = out.winner as { "@type": string; name: string };
    expect(winner["@type"]).toBe("SportsTeam");
    expect(winner.name).toBe("Anna Leigh Waters & Anna Bright");
  });

  it("eventStatus is omitted for past matches (EventCompleted is invalid schema.org)", () => {
    // 2026-05-18 Ahrefs fix: schema.org has no `EventCompleted` status, so
    // past matches omit eventStatus entirely (Google treats absence as
    // "scheduled then happened"). See match-seo.ts.
    expect(buildMatchSchema(final).eventStatus).toBeUndefined();
  });

  it("eventStatus is EventScheduled for future matches", () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    expect(
      buildMatchSchema({ ...final, playedAtIso: future }).eventStatus,
    ).toBe("https://schema.org/EventScheduled");
  });

  it("endDate = startDate + duration_minutes", () => {
    const out = buildMatchSchema(final);
    const start = new Date(final.playedAtIso).getTime();
    const end = new Date(out.endDate as string).getTime();
    expect(end - start).toBe(38 * 60_000);
  });

  it("endDate falls back to 45-min default when duration_minutes missing", () => {
    const out = buildMatchSchema({ ...final, durationMinutes: null });
    const start = new Date(final.playedAtIso).getTime();
    const end = new Date(out.endDate as string).getTime();
    expect(end - start).toBe(45 * 60_000);
  });

  it("location is Place with court nested in venue (containedInPlace)", () => {
    const out = buildMatchSchema(final);
    const loc = out.location as {
      "@type": string;
      name: string;
      containedInPlace?: { "@type": string; name: string };
    };
    expect(loc["@type"]).toBe("Place");
    expect(loc.name).toContain("Center Court");
    expect(loc.containedInPlace?.name).toBe("Brookhaven Country Club");
  });

  it("superEvent uses SportsSeries (no required dates/location)", () => {
    // PR #41 fix: nested SportsEvent without startDate + location
    // produced two Rich Results errors. SportsSeries semantically fits
    // the parent tournament (a series of matches) and only requires
    // `name` per schema.org.
    const out = buildMatchSchema(final);
    const sup = out.superEvent as { "@type": string; name: string };
    expect(sup["@type"]).toBe("SportsSeries");
    expect(sup.name).toBe("PPA Tour 2026 PPA Finals");
  });

  it("omits superEvent when no tournament_name", () => {
    const out = buildMatchSchema({ ...final, tournamentName: null });
    expect(out.superEvent).toBeUndefined();
  });

  it("omits winner when winning_team is null", () => {
    const out = buildMatchSchema({ ...final, winningTeam: null });
    expect(out.winner).toBeUndefined();
  });

  it("emits image (dampens Rich Results image warning)", () => {
    expect(buildMatchSchema(final).image).toBe(
      "https://www.thepicklehub.net/og/match/ppa-tour-final.png",
    );
  });

  it("emits performer mirroring competitor (Rich Results dampener)", () => {
    const out = buildMatchSchema(final);
    expect(out.performer).toEqual(out.competitor);
  });

  it("organizer maps from sourceProvider", () => {
    const cases: Array<["ppa_tour" | "app_tour" | "mlp", string]> = [
      ["ppa_tour", "PPA Tour"],
      ["app_tour", "APP Tour"],
      ["mlp", "Major League Pickleball"],
    ];
    for (const [source, expectedName] of cases) {
      const out = buildMatchSchema({ ...final, sourceProvider: source });
      const org = out.organizer as { "@type": string; name: string };
      expect(org["@type"]).toBe("Organization");
      expect(org.name).toBe(expectedName);
    }
  });

  it("omits organizer for community matches", () => {
    expect(
      buildMatchSchema({ ...final, sourceProvider: "community" }).organizer,
    ).toBeUndefined();
  });

  it("omits organizer when sourceProvider is null", () => {
    expect(
      buildMatchSchema({ ...final, sourceProvider: null }).organizer,
    ).toBeUndefined();
  });
});
