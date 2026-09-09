import { describe, expect, it } from "vitest";
import {
  eventPhase,
  eventWindow,
  eventsOnLive,
  formatEventDates,
  metaFromRow,
  type ProTourEventMeta,
  type ProTourEventRow,
} from "../pro-tour-events";

const ROW: ProTourEventRow = {
  slug: "ppa-asia-1000-leapmotor-kuala-lumpur-cup-2026",
  name_pattern: "%Leapmotor%Kuala Lumpur%2026%",
  name_en: "PPA Asia 1000 Leapmotor Kuala Lumpur Cup 2026",
  name_vi: "PPA Asia 1000 Leapmotor Kuala Lumpur Cup 2026",
  tier: "PPA Asia 1000",
  tour: "PPA Tour Asia",
  sponsor: "Leapmotor",
  city: "Kuala Lumpur",
  country: "Malaysia",
  country_code: "MY",
  venue: "The Hood, Jalan Ipoh",
  start_date: "2026-09-09",
  end_date: "2026-09-13",
  official_url: "https://www.ppatour-asia.com/tournament/2026/kuala-lumpur-cup/",
  brackets_url: "https://pickleballtournaments.com/tournaments/x/events",
  prize_money: "US$300,000",
  logo_url: "/images/events/kl-cup-2026-badge.png",
  brand_bg: "linear-gradient(135deg, #10283d, #1c405f)",
};

const meta = (over: Partial<ProTourEventMeta> = {}): ProTourEventMeta => ({
  ...metaFromRow(ROW),
  ...over,
});

describe("metaFromRow", () => {
  it("maps snake_case columns and turns nulls into undefined", () => {
    const m = metaFromRow({ ...ROW, sponsor: null, venue: null, prize_money: null, logo_url: null, brand_bg: null });
    expect(m.slug).toBe(ROW.slug);
    expect(m.namePattern).toBe(ROW.name_pattern);
    expect(m.startDate).toBe("2026-09-09");
    expect(m.sponsor).toBeUndefined();
    expect(m.venue).toBeUndefined();
    expect(m.prizeMoney).toBeUndefined();
    expect(m.logoUrl).toBeUndefined();
    expect(m.brandBg).toBeUndefined();
    // Non-null variant keeps values.
    expect(metaFromRow(ROW).brandBg).toContain("linear-gradient");
  });
});

describe("eventPhase / eventWindow", () => {
  const m = meta();
  it("is upcoming before day one (UTC+8 midnight)", () => {
    expect(eventPhase(m, Date.parse("2026-09-08T00:00:00+08:00"))).toBe("upcoming");
  });
  it("is live between the first and last day inclusive", () => {
    expect(eventPhase(m, Date.parse("2026-09-09T09:00:00+08:00"))).toBe("live");
    expect(eventPhase(m, Date.parse("2026-09-13T23:00:00+08:00"))).toBe("live");
  });
  it("is finished after the last evening", () => {
    expect(eventPhase(m, Date.parse("2026-09-14T01:00:00+08:00"))).toBe("finished");
  });
  it("window spans first-day midnight to last-day 23:59:59", () => {
    const { start, end } = eventWindow(m);
    expect(end).toBeGreaterThan(start);
    expect(end - start).toBeGreaterThan(4 * 86_400_000);
  });
});

describe("eventsOnLive", () => {
  const m = meta();
  it("keeps an event from a week before through two weeks after", () => {
    const before = Date.parse("2026-09-03T12:00:00+08:00");
    const after = Date.parse("2026-09-26T12:00:00+08:00");
    expect(eventsOnLive([m], before)).toHaveLength(1);
    expect(eventsOnLive([m], after)).toHaveLength(1);
  });
  it("drops it outside that window and sorts by start date", () => {
    const old = meta({ slug: "old", startDate: "2026-07-01", endDate: "2026-07-05" });
    const now = Date.parse("2026-09-10T12:00:00+08:00");
    expect(eventsOnLive([old, m], now).map((e) => e.slug)).toEqual([m.slug]);
    const b = meta({ slug: "b", startDate: "2026-09-10", endDate: "2026-09-12" });
    expect(eventsOnLive([b, m], now).map((e) => e.slug)).toEqual([m.slug, "b"]);
  });
});

describe("formatEventDates", () => {
  it("same-month ranges, vi and en", () => {
    const m = meta();
    expect(formatEventDates(m, "vi")).toBe("9–13/9/2026");
    expect(formatEventDates(m, "en")).toBe("September 9–13, 2026");
  });
  it("cross-month and cross-year ranges", () => {
    const m = meta({ startDate: "2026-08-30", endDate: "2026-09-02" });
    expect(formatEventDates(m, "vi")).toBe("30/8 – 2/9/2026");
    expect(formatEventDates(m, "en")).toBe("August 30 – September 2, 2026");
    const y = meta({ startDate: "2026-12-30", endDate: "2027-01-02" });
    expect(formatEventDates(y, "vi")).toBe("30/12/2026 – 2/1/2027");
    expect(formatEventDates(y, "en")).toBe("December 30, 2026 – January 2, 2027");
  });
});
