import { describe, expect, it } from "vitest";
import {
  buildCourtData,
  type DashboardMatch,
} from "@/lib/dashboard-courts";

const match = (
  id: string,
  courtNumber: number,
  displayOrder: number,
  overrides: Partial<DashboardMatch> = {},
): DashboardMatch => ({
  id,
  courtNumber,
  courtName: null,
  teamA: `Team A ${id}`,
  teamB: `Team B ${id}`,
  scoreA: null,
  scoreB: null,
  status: "pending",
  startTime: null,
  displayOrder,
  groupName: "A",
  roundNumber: 1,
  phase: "group",
  matchNumber: null,
  ...overrides,
});

describe("buildCourtData", () => {
  it("keeps sparse Quick Table court identifiers instead of expanding a range", () => {
    const courts = buildCourtData(
      [
        match("m7", 7, 0),
        match("m8", 8, 1),
        match("m9", 9, 2),
        match("m13", 13, 3),
        match("stale", 12, 4),
      ],
      {
        type: "quick-table",
        configuredCourts: [8, 7, 9, 13],
      },
    );

    expect(courts.map((court) => court.courtNumber)).toEqual([7, 8, 9, 13]);
  });

  it("keeps configured Quick Table courts visible even before they have a match", () => {
    const courts = buildCourtData(
      [match("m7", 7, 0)],
      {
        type: "quick-table",
        configuredCourts: [7, 8, 9, 13],
      },
    );

    expect(courts.map((court) => court.courtNumber)).toEqual([7, 8, 9, 13]);
    expect(courts.find((court) => court.courtNumber === 13)?.nextMatch).toBeNull();
  });

  it("preserves count-based courts for doubles elimination tournaments", () => {
    const courts = buildCourtData([], {
      type: "doubles-elimination",
      courtCount: 4,
    });

    expect(courts.map((court) => court.courtNumber)).toEqual([1, 2, 3, 4]);
  });

  it("selects the live match and the following pending match per court", () => {
    const live = match("live", 7, 0, {
      status: "live",
      scoreA: 4,
      scoreB: 2,
    });
    const next = match("next", 7, 1);

    const [court] = buildCourtData([live, next], {
      type: "quick-table",
      configuredCourts: [7],
    });

    expect(court.liveMatch?.id).toBe("live");
    expect(court.nextMatch?.id).toBe("next");
  });
});
