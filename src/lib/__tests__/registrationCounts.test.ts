// Social-proof badge counts. The pre-mortem's #1 predicted failure was doubles
// tables counted against quick_table_registrations (singles rows) → 0 → badge
// silently absent on ~half the brackets. These tests pin: singles→registrations,
// doubles→quick_table_teams, team-match→team_match_teams, all approved-only, and
// counts mapped to the right id.

import { describe, it, expect, beforeEach, vi } from "vitest";

interface RecordedCall {
  table: string;
  filters: Record<string, { op: string; vals?: unknown; val?: unknown }>;
}
const calls: RecordedCall[] = [];
let dataByTable: Record<string, Array<Record<string, string>>> = {};

const fromMock = vi.fn((table: string) => {
  const state: RecordedCall = { table, filters: {} };
  const chain = {
    select: () => chain,
    in: (col: string, vals: unknown) => {
      state.filters[col] = { op: "in", vals };
      return chain;
    },
    eq: (col: string, val: unknown) => {
      state.filters[col] = { op: "eq", val };
      calls.push(state);
      return Promise.resolve({ data: dataByTable[table] ?? [], error: null });
    },
  };
  return chain;
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: unknown[]) => fromMock(...(a as [string])) },
}));

import {
  attachQuickTableApprovedCounts,
  attachTeamMatchApprovedCounts,
} from "@/lib/registrationCounts";

beforeEach(() => {
  calls.length = 0;
  dataByTable = {};
  fromMock.mockClear();
});

describe("attachQuickTableApprovedCounts", () => {
  it("counts singles from registrations, doubles from teams, approved-only", async () => {
    dataByTable = {
      quick_table_registrations: [{ table_id: "s1" }, { table_id: "s1" }, { table_id: "s1" }, { table_id: "s1" }],
      quick_table_teams: [{ table_id: "d1" }, { table_id: "d1" }],
    };

    const out = await attachQuickTableApprovedCounts([
      { id: "s1", is_doubles: false },
      { id: "d1", is_doubles: true },
    ]);

    expect(out.find((t) => t.id === "s1")!.registered_count).toBe(4);
    expect(out.find((t) => t.id === "d1")!.registered_count).toBe(2);

    const regCall = calls.find((c) => c.table === "quick_table_registrations")!;
    expect(regCall.filters.status).toEqual({ op: "eq", val: "approved" });
    expect(regCall.filters.table_id).toEqual({ op: "in", vals: ["s1"] });

    const teamCall = calls.find((c) => c.table === "quick_table_teams")!;
    expect(teamCall.filters.team_status).toEqual({ op: "eq", val: "approved" });
    expect(teamCall.filters.table_id).toEqual({ op: "in", vals: ["d1"] });
  });

  it("a doubles table NEVER queries quick_table_registrations (pre-mortem #1 guard)", async () => {
    await attachQuickTableApprovedCounts([{ id: "d1", is_doubles: true }]);
    expect(calls.some((c) => c.table === "quick_table_registrations")).toBe(false);
    expect(calls.some((c) => c.table === "quick_table_teams")).toBe(true);
  });

  it("skips the query for a table type with no ids (no .in([]))", async () => {
    await attachQuickTableApprovedCounts([{ id: "s1", is_doubles: false }]);
    expect(calls.some((c) => c.table === "quick_table_teams")).toBe(false);
  });

  it("leaves registered_count undefined for a table with zero approved", async () => {
    dataByTable = { quick_table_registrations: [{ table_id: "s1" }] };
    const out = await attachQuickTableApprovedCounts([
      { id: "s1", is_doubles: false },
      { id: "s2", is_doubles: false },
    ]);
    expect(out.find((t) => t.id === "s1")!.registered_count).toBe(1);
    expect(out.find((t) => t.id === "s2")!.registered_count).toBeUndefined();
  });
});

describe("attachTeamMatchApprovedCounts", () => {
  it("counts approved teams by tournament_id, approved-only", async () => {
    dataByTable = {
      team_match_teams: [{ tournament_id: "t1" }, { tournament_id: "t1" }, { tournament_id: "t2" }],
    };
    const out = await attachTeamMatchApprovedCounts([{ id: "t1" }, { id: "t2" }]);

    expect(out.find((t) => t.id === "t1")!.registered_count).toBe(2);
    expect(out.find((t) => t.id === "t2")!.registered_count).toBe(1);

    const c = calls.find((x) => x.table === "team_match_teams")!;
    expect(c.filters.status).toEqual({ op: "eq", val: "approved" });
    expect(c.filters.tournament_id).toEqual({ op: "in", vals: ["t1", "t2"] });
  });

  it("no query and no counts for an empty list", async () => {
    const out = await attachTeamMatchApprovedCounts([]);
    expect(out).toEqual([]);
    expect(calls.length).toBe(0);
  });
});
