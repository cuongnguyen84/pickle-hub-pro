import { describe, expect, it } from "vitest";
import { playoffStartTime, schedulePlayoff, type PlayoffSlotMatch } from "@/lib/quick-table-playoff-schedule";

/** Cây đầy đủ cho 1 nhánh: size ô, byeMatches = số trận vòng 1 là BYE (đã xong). */
function tree(division: number, size: number, byeMatches = 0): PlayoffSlotMatch[] {
  const out: PlayoffSlotMatch[] = [];
  let prev: PlayoffSlotMatch[] = [];
  for (let round = 1, n = size / 2; n >= 1; round++, n /= 2) {
    const cur = Array.from({ length: n }, (_, i) => ({
      id: `d${division}r${round}m${i + 1}`, division, round, matchNumber: i + 1,
      done: round === 1 && i < byeMatches, nextMatchId: null as string | null,
    }));
    prev.forEach((p, i) => { p.nextMatchId = cur[Math.floor(i / 2)].id; });
    out.push(...cur);
    prev = cur;
  }
  return out;
}

describe("schedulePlayoff", () => {
  // giải test AI 1: A 32 đội (16 trận vòng 1), B 12 đội trong cây 16 (4 BYE → 4 trận thật), 8 sân
  const matches = [...tree(0, 32), ...tree(1, 16, 4)];
  const plan = schedulePlayoff(matches, [1, 2, 3, 4, 5, 6, 7, 8], "10:00");
  const at = (id: string) => plan.find((p) => p.matchId === id)!;

  it("rounds of the series follow each other, and B's short first round is topped up with A's round 2", () => {
    const slot = (s: number) => plan.filter((p) => p.slot === s).map((p) => p.matchId.slice(0, 4));
    expect(slot(0)).toEqual(Array(8).fill("d0r1"));
    expect(slot(1)).toEqual(Array(8).fill("d0r1"));
    expect(slot(2)).toEqual([...Array(4).fill("d1r1"), ...Array(4).fill("d0r2")]);
    expect(at("d0r1m1").startAt).toBe("10:00");
    expect(at("d1r1m5").startAt).toBe("10:40");
  });
  it("never schedules a match before the matches that feed it, never double-books a court, skips BYEs", () => {
    const byId = new Map(matches.map((m) => [m.id, m]));
    for (const p of plan) {
      for (const f of matches.filter((m) => m.nextMatchId === p.matchId && !m.done)) expect(at(f.id).slot).toBeLessThan(p.slot);
    }
    const keys = plan.map((p) => `${p.slot}:${p.court}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(plan.some((p) => byId.get(p.matchId)!.done)).toBe(false);
    expect(plan).toHaveLength(matches.filter((m) => !m.done).length);
  });
  it("no courts → nothing to schedule; start after the last group match", () => {
    expect(schedulePlayoff(matches, [], "10:00")).toEqual([]);
    expect(playoffStartTime(["07:00", "09:40", null], "07:00")).toBe("10:00");
    expect(playoffStartTime([null], "07:00")).toBe("07:00");
  });
});
