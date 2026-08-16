import { describe, expect, it } from "vitest";
import {
  PRO_CALENDAR_2026,
  proCalendarStatus,
  vnTodayIso,
} from "../pro-calendar-2026";

/**
 * Regression cover for the 2026-08-16 site audit.
 *
 * Two defects shipped with the /tournaments calendar hub (17eee851):
 *   1. `todayIso` was derived from `new Date().toISOString()` (UTC) while the
 *      calendar's startDate/endDate are VN-local dates — so between 00:00 and
 *      07:00 ICT every event status was a day behind, in the React table and
 *      in the SportsEvent JSON-LD emitted by the SSR bot path.
 *   2. Every curated event was published with `organizer: "PPA Tour Asia"`,
 *      including the Heineken Pickleball World Cup in Da Nang, which is not a
 *      PPA Tour Asia event.
 */
describe("vnTodayIso", () => {
  it("returns the VN calendar date, not the UTC one, during the 00:00–07:00 ICT window", () => {
    // 2026-08-29T18:30Z === 2026-08-30 01:30 ICT — VN is already on the 30th.
    expect(vnTodayIso(new Date("2026-08-29T18:30:00Z"))).toBe("2026-08-30");
    expect(new Date("2026-08-29T18:30:00Z").toISOString().slice(0, 10)).toBe(
      "2026-08-29",
    );
  });

  it("agrees with UTC once ICT and UTC share a calendar day", () => {
    expect(vnTodayIso(new Date("2026-08-30T09:00:00Z"))).toBe("2026-08-30");
  });

  it("rolls over exactly at 17:00Z (00:00 ICT)", () => {
    expect(vnTodayIso(new Date("2026-08-29T16:59:59Z"))).toBe("2026-08-29");
    expect(vnTodayIso(new Date("2026-08-29T17:00:00Z"))).toBe("2026-08-30");
  });

  it("emits a well-formed YYYY-MM-DD in every runtime", () => {
    expect(vnTodayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("proCalendarStatus with VN-local today", () => {
  const worldCup = PRO_CALENDAR_2026.find(
    (e) => e.id === "pickleball-world-cup-2026",
  )!;

  it("calls the World Cup live on its VN opening morning", () => {
    // 01:30 ICT on 30/08 — opening day in Da Nang.
    const today = vnTodayIso(new Date("2026-08-29T18:30:00Z"));
    expect(proCalendarStatus(worldCup, today)).toBe("live");
  });

  it("calls it upcoming the VN evening before", () => {
    const today = vnTodayIso(new Date("2026-08-29T10:00:00Z"));
    expect(proCalendarStatus(worldCup, today)).toBe("upcoming");
  });

  it("calls it past on the VN morning after the final day", () => {
    const today = vnTodayIso(new Date("2026-09-06T18:30:00Z"));
    expect(proCalendarStatus(worldCup, today)).toBe("past");
  });
});

describe("PRO_CALENDAR_2026 organizer attribution", () => {
  it("leaves the organizer blank on the two events PPA Tour Asia does not organise", () => {
    // Heineken World Cup Da Nang — not a PPA Tour Asia event at all.
    // Hong Kong Slam — sanctioned by PPA Tour Asia, organised by F-Sports
    // Promotions per our own preview post. Guessing either would publish a
    // false entity claim in structured data.
    for (const id of ["pickleball-world-cup-2026", "hong-kong-slam-2026"]) {
      const ev = PRO_CALENDAR_2026.find((e) => e.id === id)!;
      expect(ev, `${id} missing from the calendar`).toBeDefined();
      expect(ev.organizer, `${id} must not claim an organizer`).toBeUndefined();
    }
  });

  it("attributes every PPA Tour Asia Open to PPA Tour Asia", () => {
    const ppa = PRO_CALENDAR_2026.filter((e) => e.tier.startsWith("PPA Asia"));
    expect(ppa.length).toBeGreaterThan(0);
    for (const ev of ppa) {
      expect(ev.organizer, `${ev.id} is missing its organizer`).toBe(
        "PPA Tour Asia",
      );
    }
  });

  it("never emits an empty or whitespace-only organizer", () => {
    for (const ev of PRO_CALENDAR_2026) {
      if (ev.organizer !== undefined) {
        expect(ev.organizer.trim().length, `${ev.id}`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps every event's dates ordered and ISO-shaped", () => {
    for (const ev of PRO_CALENDAR_2026) {
      expect(ev.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ev.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ev.endDate >= ev.startDate, `${ev.id} ends before it starts`).toBe(
        true,
      );
    }
  });
});
