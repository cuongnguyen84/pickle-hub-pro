// Fixture-driven tests for the OPEN team-tie parser. The fixture is a
// hand-sized replica of the real delegations page (2 groups → 12 ties, plus 2
// knockout ties that must be skipped), generated to exercise every state the
// live page has shown: a tie in play, a tie decided sub-by-sub, a tie closed
// by the organizers early, a walkover, and a sub-match rendered twice.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ParseGuardError } from "../parse";
import { parseWcOpenTies, type WcOpenTie } from "../parse-ties";

const FIXTURE = resolve(
  __dirname,
  "../../../../workers/wc-open-scraper/__fixtures__/delegations-open-ties.html",
);
const html = readFileSync(FIXTURE, "utf8");

const byId = (ties: WcOpenTie[], n: number): WcOpenTie => {
  const tie = ties.find((t) => t.matchId === `open_team_coed____default__m${n}`);
  if (!tie) throw new Error(`tie m${n} not parsed`);
  return tie;
};

describe("parseWcOpenTies", () => {
  const result = parseWcOpenTies(html, 12);

  it("parses the group ties and skips knockout ties without a group", () => {
    expect(result.ties).toHaveLength(12);
    // m96/m97 render without groupId (knockout) and must not be ingested.
    expect(result.ties.some((t) => /m9[67]$/.test(t.matchId))).toBe(false);
    expect(result.ties.every((t) => t.round === "group")).toBe(true);
  });

  it("marks a tie with a sub-match in play as live, scoring decided subs", () => {
    const m0 = byId(result.ties, 0);
    expect(m0.status).toBe("live");
    expect(m0.homeSlug).toBe("viet_nam");
    expect(m0.awaySlug).toBe("colombia");
    expect(m0.homeScore).toBe(2); // WD + MD won by Vietnam
    expect(m0.awayScore).toBe(0);
    expect(m0.group).toBe("A");
    expect(m0.court).toBe("Sân 1 · CC");
    expect(result.liveTieCount).toBe(1);
  });

  it("keeps the most advanced copy of a sub-match rendered twice", () => {
    // m0's XD#1 appears as scheduled AND in_progress; only the in_progress
    // copy may count, or m0 would not be live with 2 terminal subs.
    const m0 = byId(result.ties, 0);
    expect(m0.status).toBe("live");
  });

  it("finalises a tie when all six sub-matches are decided, counting walkovers", () => {
    const m1 = byId(result.ties, 1);
    expect(m1.status).toBe("final");
    expect(m1.homeScore).toBe(4); // 3 completed + 1 walkover
    expect(m1.awayScore).toBe(2);
  });

  it("trusts a terminal tie-level status even when sub-matches remain", () => {
    const m2 = byId(result.ties, 2);
    expect(m2.status).toBe("final");
    expect(m2.homeScore).toBe(2);
    expect(m2.awayScore).toBe(1);
  });

  it("leaves untouched ties scheduled with null scores", () => {
    const m6 = byId(result.ties, 6);
    expect(m6.status).toBe("scheduled");
    expect(m6.homeScore).toBeNull();
    expect(m6.awayScore).toBeNull();
    expect(m6.startTime).toBe("2026-09-03T08:00:00");
  });

  it("guards on the tie count so a half-rendered schedule never writes", () => {
    expect(() => parseWcOpenTies(html, 96)).toThrow(ParseGuardError);
  });

  it("guards on a page with no tie objects at all", () => {
    expect(() => parseWcOpenTies("<html><body>maintenance</body></html>", 12)).toThrow(
      ParseGuardError,
    );
  });
});
