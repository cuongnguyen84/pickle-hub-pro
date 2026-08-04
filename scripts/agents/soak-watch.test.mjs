// Pins the two pieces of logic that decide whether a soak reverts production:
// what counts as the same error (fingerprint) and what counts as a new one.
// The network layer is deliberately untested — it is a fetch wrapper; these
// are the parts that can be wrong while looking right.
import { describe, it, expect } from "vitest";
import { fingerprint, newSignatures, isoOrThrow } from "./soak-watch.mjs";

describe("isoOrThrow", () => {
  // captured_at comes from a caller-supplied JSON file and is interpolated
  // into SQL that runs on prod — a quote must not be able to survive.
  it("canonicalises a valid timestamp", () => {
    expect(isoOrThrow("2026-08-04T05:00:00Z", "since")).toBe("2026-08-04T05:00:00.000Z");
  });

  it("rejects garbage instead of querying a nonsense window", () => {
    expect(() => isoOrThrow("'; DROP TABLE client_errors;--", "since")).toThrow(/valid timestamp/);
    expect(() => isoOrThrow("", "since")).toThrow(/valid timestamp/);
  });
});

describe("fingerprint", () => {
  it("groups the same error across occurrences", () => {
    const a = fingerprint("Cannot read x of undefined", "at Foo (a.js:1)\nat Bar");
    const b = fingerprint("Cannot read x of undefined", "at Foo (a.js:1)\nat Baz");
    expect(a).toBe(b); // differing deeper frames must not split one bug in two
  });

  it("separates different messages and different top frames", () => {
    expect(fingerprint("A", "at Foo")).not.toBe(fingerprint("B", "at Foo"));
    expect(fingerprint("A", "at Foo")).not.toBe(fingerprint("A", "at Bar"));
  });

  it("survives null message and stack", () => {
    expect(fingerprint(null, null)).toBe("|");
  });
});

describe("newSignatures", () => {
  const baseline = new Set([fingerprint("known boom", "at Old (x.js:1)")]);

  it("ignores errors already in the baseline", () => {
    const rows = [{ message: "known boom", stack: "at Old (x.js:1)", recorded_at: "t1" }];
    expect(newSignatures(baseline, rows)).toEqual([]);
  });

  it("reports an unseen signature with its count and first sighting", () => {
    const rows = [
      { message: "fresh boom", stack: "at New (y.js:2)", recorded_at: "t1", url: "/live" },
      { message: "fresh boom", stack: "at New (y.js:2)", recorded_at: "t2", url: "/live" },
      { message: "known boom", stack: "at Old (x.js:1)", recorded_at: "t3" },
    ];
    const out = newSignatures(baseline, rows);
    expect(out).toHaveLength(1);
    expect(out[0].count).toBe(2);
    expect(out[0].first_seen).toBe("t1");
    expect(out[0].sample_url).toBe("/live");
  });

  it("returns nothing for an empty window", () => {
    expect(newSignatures(baseline, [])).toEqual([]);
  });
});
