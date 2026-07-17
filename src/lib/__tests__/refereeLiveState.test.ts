// ARCH-04 scoring S2 — the referee live-state persistence envelope.
// parseLiveState must never crash on garbage: a corrupt/stale blob falls
// back to null (fresh setup screen), and missing optional sections default
// to empty so older partial blobs stay loadable.

import { describe, it, expect } from "vitest";
import {
  makeLiveState,
  parseLiveState,
  startState,
  applyRally,
} from "../refereeScoring";

const freshState = () =>
  startState({ mode: "sideOut", isSingles: false, winTarget: 11, firstServer: "a" });

const envelope = () =>
  makeLiveState({
    state: applyRally(freshState(), "a"),
    history: [freshState()],
    usedReg: { a: 1, b: 0 },
    usedMed: { a: 0, b: 1 },
    notes: { a: "net cord", b: "" },
  });

describe("makeLiveState / parseLiveState round-trip", () => {
  it("round-trips through JSON (string input)", () => {
    const env = envelope();
    expect(parseLiveState(JSON.stringify(env))).toEqual(env);
  });

  it("round-trips an already-parsed jsonb object (supabase returns objects)", () => {
    const env = envelope();
    expect(parseLiveState(JSON.parse(JSON.stringify(env)))).toEqual(env);
  });
});

describe("parseLiveState rejects garbage", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["empty string", ""],
    ["non-json string", "not json {"],
    ["number", 42],
    ["array", []],
    ["empty object", {}],
    ["wrong version", { ...envelope(), v: 2 }],
    ["missing state", { v: 1 }],
    ["state without scores", { v: 1, state: { serving: "a" } }],
    ["state with bad serving side", { v: 1, state: { a: 1, b: 0, serving: "x", winTarget: 11 } }],
  ])("%s -> null", (_label, input) => {
    expect(parseLiveState(input)).toBeNull();
  });
});

describe("parseLiveState defaults missing optional sections", () => {
  it("fills history/timeouts/notes for a minimal valid envelope", () => {
    const minimal = { v: 1, state: freshState() };
    const parsed = parseLiveState(minimal);
    expect(parsed).not.toBeNull();
    expect(parsed!.history).toEqual([]);
    expect(parsed!.usedReg).toEqual({ a: 0, b: 0 });
    expect(parsed!.usedMed).toEqual({ a: 0, b: 0 });
    expect(parsed!.notes).toEqual({ a: "", b: "" });
  });

  it("replaces malformed sections with defaults instead of failing", () => {
    const parsed = parseLiveState({
      v: 1,
      state: freshState(),
      history: "oops",
      usedReg: { a: "1" },
      notes: 7,
    });
    expect(parsed!.history).toEqual([]);
    expect(parsed!.usedReg).toEqual({ a: 0, b: 0 });
    expect(parsed!.notes).toEqual({ a: "", b: "" });
  });
});
