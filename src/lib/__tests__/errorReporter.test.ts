/** @vitest-environment jsdom */
// ============================================================================
// The reporter's own failure mode.
// ----------------------------------------------------------------------------
// This file exists because the unhandledrejection handler used to be the one
// unguarded expression in a module whose stated contract is that it cannot
// throw: `JSON.stringify(reason).slice(0, 1000)`. Every case below is a value
// that made that line throw, which cost us the rejection AND logged a bogus
// js_error in its place (seen in client_errors, 06–18/08/2026).
//
// The assertions are deliberately about SHAPE, not exact wording: what has to
// hold forever is "a non-empty string, no throw", not any given phrasing.
// ============================================================================
import { describe, expect, it } from "vitest";
import { describeReason } from "../errorReporter";

describe("describeReason survives every rejection reason", () => {
  it("prefers an Error's message, and falls back to its name", () => {
    expect(describeReason(new Error("boom"))).toBe("boom");
    expect(describeReason(new TypeError(""))).toBe("TypeError");
  });

  it("passes a string through, but never returns an empty one", () => {
    expect(describeReason("plain failure")).toBe("plain failure");
    expect(describeReason("")).not.toBe("");
  });

  it("names the two values JSON.stringify silently turns into undefined", () => {
    // `JSON.stringify(undefined)` is undefined, not "undefined" — the original
    // TypeError. `null` stringifies fine but reads as nothing in the table.
    expect(describeReason(undefined)).toMatch(/undefined/);
    expect(describeReason(null)).toMatch(/null/);
  });

  it("serialises an ordinary object", () => {
    expect(describeReason({ code: 42, hint: "retry" })).toBe('{"code":42,"hint":"retry"}');
  });

  it("does not throw on a circular structure, and still says something", () => {
    const circular: Record<string, unknown> = { name: "request" };
    circular.self = circular;
    const message = describeReason(circular);
    expect(typeof message).toBe("string");
    expect(message.length).toBeGreaterThan(0);
    expect(message).toContain("name");
  });

  it("replaces the useless {} with the object's shape", () => {
    // A DOMException, an ErrorEvent and several Supabase error shapes all
    // serialise to "{}" — a string, technically, and unusable in triage.
    class Weird {
      get hidden() {
        return 1;
      }
    }
    expect(describeReason(new Weird())).toBe("Weird");
    expect(describeReason(new DOMException("aborted", "AbortError"))).not.toBe("{}");
  });

  it("does not throw on a null-prototype object, where String() also throws", () => {
    const bare = Object.create(null) as object;
    expect(() => describeReason(bare)).not.toThrow();
    expect(describeReason(bare)).toBeTruthy();
  });

  it("does not throw on a poisoned toString", () => {
    const poisoned = {
      toString() {
        throw new Error("nope");
      },
    };
    expect(() => describeReason(poisoned)).not.toThrow();
    expect(describeReason(poisoned)).toBeTruthy();
  });

  it("does not throw on the primitives JSON.stringify rejects", () => {
    // BigInt makes JSON.stringify throw; a function and a symbol make it
    // return undefined. All three used to reach `.slice`.
    expect(() => describeReason(10n)).not.toThrow();
    expect(describeReason(10n)).toBeTruthy();
    expect(() => describeReason(() => undefined)).not.toThrow();
    expect(describeReason(() => undefined)).toBeTruthy();
    expect(() => describeReason(Symbol("tag"))).not.toThrow();
    expect(describeReason(Symbol("tag"))).toBeTruthy();
  });
});
