import { describe, expect, it } from "vitest";
import {
  MAX_WEBHOOK_BODY_BYTES,
  parseJsonObject,
  readBoundedBody,
  secretsMatch,
  sha256Hex,
} from "../../../supabase/functions/dupr-webhook/security";

describe("DUPR webhook security", () => {
  it("reads a bounded webhook body", async () => {
    const body = JSON.stringify({ event: "RATING" });
    const request = new Request("https://example.test/dupr-webhook", {
      method: "POST",
      body,
    });

    expect(await readBoundedBody(request)).toBe(body);
  });

  it("rejects declared and streamed bodies over the limit", async () => {
    const declared = new Request("https://example.test/dupr-webhook", {
      method: "POST",
      headers: { "content-length": String(MAX_WEBHOOK_BODY_BYTES + 1) },
      body: "{}",
    });
    const streamed = new Request("https://example.test/dupr-webhook", {
      method: "POST",
      body: "x".repeat(MAX_WEBHOOK_BODY_BYTES + 1),
    });

    expect(await readBoundedBody(declared)).toBeNull();
    expect(await readBoundedBody(streamed)).toBeNull();
  });

  it("compares callback secrets without an early equality return", () => {
    expect(secretsMatch("partner-key", "partner-key")).toBe(true);
    expect(secretsMatch("partner-key", "partner-kex")).toBe(false);
    expect(secretsMatch("short", "partner-key")).toBe(false);
  });

  it("accepts only JSON objects as webhook envelopes", () => {
    expect(parseJsonObject('{"event":"RATING"}')).toEqual({ event: "RATING" });
    expect(parseJsonObject("null")).toBeNull();
    expect(parseJsonObject("[]")).toBeNull();
    expect(parseJsonObject("not-json")).toBeNull();
  });

  it("produces stable SHA-256 event keys", async () => {
    expect(await sha256Hex("same-payload")).toBe(await sha256Hex("same-payload"));
    expect(await sha256Hex("same-payload")).not.toBe(await sha256Hex("other-payload"));
  });
});
