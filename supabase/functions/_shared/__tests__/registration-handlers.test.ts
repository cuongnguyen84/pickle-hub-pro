// ARCH-02 increment 1: cancel/reactivate registration handlers.
// Pins the exact HTTP status + `code` for every branch — the caller
// (PlayerRegistration.tsx) switches on `code`, so these ARE the contract.

import { describe, it, expect } from "vitest";
import {
  processCancelRegistration,
  type CancelStore,
} from "../../cancel-registration/handler.ts";
import {
  processReactivateRegistration,
  type ReactivateStore,
} from "../../reactivate-registration/handler.ts";

const TOKEN = "123e4567-e89b-42d3-a456-426614174000";
const REG_ID = "9f8e7d6c-5b4a-4321-8765-fedcba987654";
const noLog = () => {};
// Fixed clock: events compare start_at against this.
const NOW = Date.parse("2026-07-18T00:00:00Z");
const now = () => NOW;
const FUTURE = "2026-07-19T00:00:00Z";
const PAST = "2026-07-17T00:00:00Z";

function cancelStore(overrides: Partial<CancelStore> = {}): CancelStore {
  return {
    getRegistrationIdByToken: async () => ({ id: REG_ID, error: null }),
    getRegistration: async () => ({
      row: { id: REG_ID, event_id: "ev1", status: "registered", cancelled_at: null },
      error: null,
    }),
    getEvent: async () => ({
      row: { id: "ev1", slug: "ev", status: "published", start_at: FUTURE },
      error: null,
    }),
    cancelRegistration: async () => ({ error: null }),
    ...overrides,
  };
}

function reactivateStore(overrides: Partial<ReactivateStore> = {}): ReactivateStore {
  return {
    getRegistrationIdByToken: async () => ({ id: REG_ID, error: null }),
    getRegistration: async () => ({
      row: { id: REG_ID, event_id: "ev1", status: "cancelled", cancelled_at: PAST },
      error: null,
    }),
    getEvent: async () => ({
      row: { id: "ev1", status: "published", start_at: FUTURE, max_players: 16 },
      error: null,
    }),
    reactivateRpc: async () => ({ outcome: "reactivated", error: null }),
    ...overrides,
  };
}

describe("processCancelRegistration", () => {
  it("rejects malformed magic_token", async () => {
    const r = await processCancelRegistration({ magic_token: "nope" }, cancelStore(), noLog, now);
    expect([r.status, r.body.code]).toEqual([400, "invalid_magic_token"]);
  });

  it("404 not_found when token has no secret row", async () => {
    const r = await processCancelRegistration(
      { magic_token: TOKEN },
      cancelStore({ getRegistrationIdByToken: async () => ({ id: null, error: null }) }),
      noLog,
      now,
    );
    expect([r.status, r.body.code]).toEqual([404, "not_found"]);
  });

  it("500 lookup_failed when secret lookup errors", async () => {
    const r = await processCancelRegistration(
      { magic_token: TOKEN },
      cancelStore({ getRegistrationIdByToken: async () => ({ id: null, error: "boom" }) }),
      noLog,
      now,
    );
    expect([r.status, r.body.code]).toEqual([500, "lookup_failed"]);
  });

  it("404 registration_missing when registration row gone", async () => {
    const r = await processCancelRegistration(
      { magic_token: TOKEN },
      cancelStore({ getRegistration: async () => ({ row: null, error: null }) }),
      noLog,
      now,
    );
    expect([r.status, r.body.code]).toEqual([404, "registration_missing"]);
  });

  it("409 already_cancelled on second cancel", async () => {
    const r = await processCancelRegistration(
      { magic_token: TOKEN },
      cancelStore({
        getRegistration: async () => ({
          row: { id: REG_ID, event_id: "ev1", status: "cancelled", cancelled_at: PAST },
          error: null,
        }),
      }),
      noLog,
      now,
    );
    expect([r.status, r.body.code]).toEqual([409, "already_cancelled"]);
  });

  it("idempotent 200 when the whole event is cancelled", async () => {
    const r = await processCancelRegistration(
      { magic_token: TOKEN },
      cancelStore({
        getEvent: async () => ({
          row: { id: "ev1", slug: "ev", status: "cancelled", start_at: FUTURE },
          error: null,
        }),
      }),
      noLog,
      now,
    );
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, already_cancelled: true });
  });

  it("409 event_completed", async () => {
    const r = await processCancelRegistration(
      { magic_token: TOKEN },
      cancelStore({
        getEvent: async () => ({
          row: { id: "ev1", slug: "ev", status: "completed", start_at: FUTURE },
          error: null,
        }),
      }),
      noLog,
      now,
    );
    expect([r.status, r.body.code]).toEqual([409, "event_completed"]);
  });

  it("409 event_started when start_at is in the past (and on invalid dates)", async () => {
    for (const start_at of [PAST, "garbage"]) {
      const r = await processCancelRegistration(
        { magic_token: TOKEN },
        cancelStore({
          getEvent: async () => ({
            row: { id: "ev1", slug: "ev", status: "published", start_at },
            error: null,
          }),
        }),
        noLog,
        now,
      );
      expect([r.status, r.body.code]).toEqual([409, "event_started"]);
    }
  });

  it("500 update_failed when the UPDATE errors", async () => {
    const r = await processCancelRegistration(
      { magic_token: TOKEN },
      cancelStore({ cancelRegistration: async () => ({ error: "boom" }) }),
      noLog,
      now,
    );
    expect([r.status, r.body.code]).toEqual([500, "update_failed"]);
  });

  it("success returns ok + cancelled_at, truncates reason to 280 chars", async () => {
    let saved: { reason: string | null } | undefined;
    const r = await processCancelRegistration(
      { magic_token: TOKEN, reason: "x".repeat(500) },
      cancelStore({
        cancelRegistration: async (input) => {
          saved = input;
          return { error: null };
        },
      }),
      noLog,
      now,
    );
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(typeof r.body.cancelled_at).toBe("string");
    expect(saved?.reason).toHaveLength(280);
  });
});

describe("processReactivateRegistration", () => {
  it("rejects malformed magic_token", async () => {
    const r = await processReactivateRegistration({ magic_token: "nope" }, reactivateStore(), noLog, now);
    expect([r.status, r.body.code]).toEqual([400, "invalid_magic_token"]);
  });

  it("404 not_found when token has no secret row", async () => {
    const r = await processReactivateRegistration(
      { magic_token: TOKEN },
      reactivateStore({ getRegistrationIdByToken: async () => ({ id: null, error: null }) }),
      noLog,
      now,
    );
    expect([r.status, r.body.code]).toEqual([404, "not_found"]);
  });

  it("idempotent 200 already_active when not cancelled", async () => {
    const r = await processReactivateRegistration(
      { magic_token: TOKEN },
      reactivateStore({
        getRegistration: async () => ({
          row: { id: REG_ID, event_id: "ev1", status: "registered", cancelled_at: null },
          error: null,
        }),
      }),
      noLog,
      now,
    );
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, already_active: true });
  });

  it("event guard rails: cancelled/completed/draft/started", async () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ status: "cancelled", start_at: FUTURE }, "event_cancelled"],
      [{ status: "completed", start_at: FUTURE }, "event_completed"],
      [{ status: "draft", start_at: FUTURE }, "event_not_open"],
      [{ status: "published", start_at: PAST }, "event_started"],
    ];
    for (const [ev, code] of cases) {
      const r = await processReactivateRegistration(
        { magic_token: TOKEN },
        reactivateStore({
          getEvent: async () => ({
            row: { id: "ev1", max_players: 16, ...ev } as never,
            error: null,
          }),
        }),
        noLog,
        now,
      );
      expect([r.status, r.body.code]).toEqual([409, code]);
    }
  });

  it("maps RPC outcomes to the pinned contract", async () => {
    const cases: Array<[string, number, Record<string, unknown>]> = [
      ["reactivated", 200, { ok: true }],
      ["already_active", 200, { ok: true, already_active: true }],
      ["event_full", 409, { error: "event_full", code: "event_full" }],
      ["not_found", 404, { error: "registration_missing", code: "registration_missing" }],
      ["???", 500, { error: "update_failed", code: "update_failed" }],
    ];
    for (const [outcome, status, body] of cases) {
      const r = await processReactivateRegistration(
        { magic_token: TOKEN },
        reactivateStore({ reactivateRpc: async () => ({ outcome, error: null }) }),
        noLog,
        now,
      );
      expect(r.status).toBe(status);
      expect(r.body).toEqual(body);
    }
  });

  it("500 update_failed when the RPC errors", async () => {
    const r = await processReactivateRegistration(
      { magic_token: TOKEN },
      reactivateStore({ reactivateRpc: async () => ({ outcome: null, error: "boom" }) }),
      noLog,
      now,
    );
    expect([r.status, r.body.code]).toEqual([500, "update_failed"]);
  });
});
