import { describe, it, expect } from "vitest";
import {
  formatFormatLabel,
  formatTypeLabel,
  formatStatusLabel,
  statusBadgeClass,
  formatMatchWhen,
  groupTeams,
  buildAriaLabel,
  type FeedParticipant,
} from "../feed-formatters";

/**
 * Pure unit tests for feed-formatters. Project's vitest config is node-only
 * (no jsdom), so component-level rendering tests are out of scope; these
 * cover the bilingual label resolution + score row math + aria-label builder
 * that drive FeedMatchCard.
 */

describe("formatFormatLabel", () => {
  it("returns ĐÔI/DOUBLES depending on language", () => {
    expect(formatFormatLabel("doubles", "vi")).toBe("ĐÔI");
    expect(formatFormatLabel("doubles", "en")).toBe("DOUBLES");
  });
  it("returns ĐƠN/SINGLES", () => {
    expect(formatFormatLabel("singles", "vi")).toBe("ĐƠN");
    expect(formatFormatLabel("singles", "en")).toBe("SINGLES");
  });
  it("returns mixed labels", () => {
    expect(formatFormatLabel("mixed", "vi")).toBe("ĐÔI NAM-NỮ");
    expect(formatFormatLabel("mixed", "en")).toBe("MIXED");
  });
  it("falls back to uppercase for unknown formats", () => {
    expect(formatFormatLabel("triples" as never, "vi")).toBe("TRIPLES");
  });
});

describe("formatTypeLabel", () => {
  it("translates rec → CASUAL/GIAO LƯU", () => {
    expect(formatTypeLabel("rec", "vi")).toBe("GIAO LƯU");
    expect(formatTypeLabel("rec", "en")).toBe("CASUAL");
  });
  it("translates tournament", () => {
    expect(formatTypeLabel("tournament", "vi")).toBe("GIẢI ĐẤU");
    expect(formatTypeLabel("tournament", "en")).toBe("TOURNAMENT");
  });
  it("preserves open_play in both locales", () => {
    expect(formatTypeLabel("open_play", "vi")).toBe("OPEN PLAY");
    expect(formatTypeLabel("open_play", "en")).toBe("OPEN PLAY");
  });
});

describe("formatStatusLabel + statusBadgeClass", () => {
  it("returns the verified label with bullet glyph", () => {
    expect(formatStatusLabel("verified", "vi")).toBe("● ĐÃ XÁC THỰC");
    expect(formatStatusLabel("verified", "en")).toBe("● VERIFIED");
    expect(statusBadgeClass("verified")).toBe("verified");
  });
  it("returns the disputed label with warning glyph", () => {
    expect(formatStatusLabel("disputed", "vi")).toBe("⚠ TRANH CHẤP");
    expect(formatStatusLabel("disputed", "en")).toBe("⚠ DISPUTED");
    expect(statusBadgeClass("disputed")).toBe("disputed");
  });
  it("collapses unknown status into pending badge variant", () => {
    expect(statusBadgeClass("rejected")).toBe("pending");
  });
});

describe("formatMatchWhen", () => {
  // 2026-05-05 19:30 local — the test runs in whatever TZ the CI uses;
  // we construct the ISO with explicit zero offset to keep day=5 stable.
  const may5 = "2026-05-05T19:30:00";

  it("formats VI desktop with full month name", () => {
    expect(formatMatchWhen(may5, "vi", "desktop")).toBe(
      "5 THÁNG 5 · 19:30",
    );
  });
  it("formats EN desktop with 12h time", () => {
    expect(formatMatchWhen(may5, "en", "desktop")).toBe("MAY 5 · 7:30 PM");
  });
  it("formats VI mobile compact", () => {
    expect(formatMatchWhen(may5, "vi", "mobile")).toBe("5/5 · 19:30");
  });
  it("returns empty string for invalid date input", () => {
    expect(formatMatchWhen("not-a-date", "vi")).toBe("");
  });
});

describe("groupTeams", () => {
  const make = (
    id: string,
    team: "a" | "b",
    position: number,
  ): FeedParticipant => ({
    player_id: id,
    team,
    position,
    username: `u-${id}`,
    display_name: `User ${id}`,
    avatar_url: null,
    is_ghost: false,
    dupr_doubles: null,
  });

  it("splits participants by team and sorts by position", () => {
    const result = groupTeams([
      make("1", "b", 2),
      make("2", "a", 2),
      make("3", "b", 1),
      make("4", "a", 1),
    ]);
    expect(result.teamA.map((p) => p.player_id)).toEqual(["4", "2"]);
    expect(result.teamB.map((p) => p.player_id)).toEqual(["3", "1"]);
  });

  it("returns empty arrays when participants is null/undefined", () => {
    expect(groupTeams(null)).toEqual({ teamA: [], teamB: [] });
    expect(groupTeams(undefined)).toEqual({ teamA: [], teamB: [] });
  });
});

describe("buildAriaLabel", () => {
  const a: FeedParticipant = {
    player_id: "1",
    team: "a",
    position: 1,
    username: "tran-thi-b",
    display_name: "Trần Thị B",
    avatar_url: null,
    is_ghost: false,
    dupr_doubles: 4.2,
  };
  const b: FeedParticipant = {
    player_id: "2",
    team: "b",
    position: 1,
    username: "pham-quang",
    display_name: "Phạm Quang",
    avatar_url: null,
    is_ghost: false,
    dupr_doubles: 4.05,
  };

  it("VI singles label uses thắng/thua verbs", () => {
    const out = buildAriaLabel({
      language: "vi",
      teamA: [a],
      teamB: [b],
      scoreA: [11],
      scoreB: [7],
      winningTeam: "a",
      venueName: "The Pickle Court",
      playedAt: "2026-05-05T19:30:00",
      format: "singles",
    });
    expect(out).toContain("Trần Thị B thắng Phạm Quang");
    expect(out).toContain("11-7");
    expect(out).toContain("The Pickle Court");
  });

  it("EN doubles label joins teammates with 'and'", () => {
    const a2: FeedParticipant = { ...a, player_id: "1b", display_name: "Hoàng D" };
    const b2: FeedParticipant = { ...b, player_id: "2b", display_name: "Lê C" };
    const out = buildAriaLabel({
      language: "en",
      teamA: [a, a2],
      teamB: [b, b2],
      scoreA: [11, 11],
      scoreB: [9, 7],
      winningTeam: "a",
      venueName: null,
      playedAt: "2026-05-05T14:00:00",
      format: "doubles",
    });
    expect(out).toContain("Trần Thị B and Hoàng D");
    expect(out).toContain("Phạm Quang and Lê C");
    expect(out).toContain("11–9, 11–7");
  });
});
