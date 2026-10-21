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
import { describeReason, isInjectedScriptError } from "../errorReporter";

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

// ============================================================================
// Cloudflare's injected bot probe (2026-08-30 site audit).
// ----------------------------------------------------------------------------
// The largest js_error group in client_errors was a SecurityError thrown by the
// inline `__CF$cv$params` script Cloudflare appends to every HTML response, on
// iOS Safari, reading contentDocument on a frame that had gone cross-origin.
// It is not our code and there is nothing to fix in response to it.
// ============================================================================
describe("isInjectedScriptError blames the filename, not the message", () => {
  const CF_MESSAGE =
    'SecurityError: Blocked a frame with origin "https://www.thepicklehub.net" ' +
    "from accessing a cross-origin frame. Protocols, domains, and ports must match.";

  it("ignores the error when it comes from the document's own inline script", () => {
    // Cloudflare's snippet is inline in the served HTML, so the ErrorEvent
    // blames the page URL itself — never an /assets/ chunk.
    expect(isInjectedScriptError(CF_MESSAGE, "https://www.thepicklehub.net/live/abc")).toBe(true);
    expect(isInjectedScriptError(CF_MESSAGE, undefined)).toBe(true);
  });

  it("still reports the SAME message from our own code, built or in dev", () => {
    // The whole safety of this filter. If our player or embed code ever throws
    // this, we have to hear about it.
    expect(isInjectedScriptError(
      CF_MESSAGE,
      "https://www.thepicklehub.net/assets/LiveWatch-Ck3s9.js",
    )).toBe(false);
    // `npm run dev` serves our modules unbundled from /src/ — the window in
    // which a real cross-origin bug is easiest to catch.
    expect(isInjectedScriptError(CF_MESSAGE, "http://localhost:8080/src/pages/Live.tsx"))
      .toBe(false);
  });

  it("does not touch any other message", () => {
    expect(isInjectedScriptError("TypeError: x is not a function", undefined)).toBe(false);
    expect(isInjectedScriptError("", undefined)).toBe(false);
  });
});
