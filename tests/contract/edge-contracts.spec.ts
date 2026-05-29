// ============================================================================
// Phase 2E — Edge function contract tests.
// ----------------------------------------------------------------------------
// Validates that the LIVE dupr-match-submit edge function returns the exact
// envelope shape declared in src/contracts/duprMatchSubmit.ts (the same Zod
// schema the frontend parses with). Catches snake_case vs camelCase drift,
// renamed fields, and the unauthorized/method-not-allowed error envelope.
//
// Default run is NON-MUTATING: it only exercises the auth-reject (401) and
// method-reject (405) paths, which return the error envelope. The full
// success-shape (create/update/delete) is validated by the Phase 2B E2E
// spec under DUPR_E2E so we never write junk DUPR matches from contract CI.
//
// Skips when SUPABASE_URL + anon key env are absent.
// ============================================================================

import { test, expect, request } from "@playwright/test";
import {
  DuprErrorSchema,
  DuprSubmitResponseSchema,
} from "../../src/contracts/duprMatchSubmit";

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON =
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const FN_URL = SUPABASE_URL
  ? `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/dupr-match-submit`
  : "";

test.describe("dupr-match-submit contract", () => {
  test.skip(
    !SUPABASE_URL || !ANON,
    "SUPABASE_URL / anon key not set — skipping contract tests",
  );

  test("unauthorized POST returns the documented error envelope", async () => {
    const ctx = await request.newContext({
      extraHTTPHeaders: {
        // anon key satisfies the gateway but is NOT a valid user token,
        // so getAuthUser() returns null -> err("unauthorized", 401).
        Authorization: `Bearer ${ANON}`,
        apikey: ANON!,
        "Content-Type": "application/json",
      },
    });
    const res = await ctx.post(FN_URL, {
      data: { action: "create", internal_source: "ci", internal_match_id: "x" },
    });
    expect(res.status(), "expected 401 for non-user token").toBe(401);

    const body = await res.json();
    // Must parse as the shared error schema AND as the union.
    const parsed = DuprErrorSchema.safeParse(body);
    expect(
      parsed.success,
      `error envelope drift: ${JSON.stringify(body)}`,
    ).toBe(true);
    expect(DuprSubmitResponseSchema.safeParse(body).success).toBe(true);
    expect(body.error).toBe("unauthorized");
    await ctx.dispose();
  });

  test("wrong method returns the documented error envelope", async () => {
    const ctx = await request.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${ANON}`, apikey: ANON! },
    });
    const res = await ctx.get(FN_URL);
    // 405 from the function, or 401 if the gateway rejects before routing.
    expect([401, 405]).toContain(res.status());
    const body = await res.json().catch(() => null);
    if (body && typeof body === "object" && "error" in body) {
      expect(DuprErrorSchema.safeParse(body).success).toBe(true);
    }
    await ctx.dispose();
  });

  test("OPTIONS preflight returns CORS headers", async () => {
    const ctx = await request.newContext();
    const res = await ctx.fetch(FN_URL, { method: "OPTIONS" });
    expect(res.status()).toBeLessThan(400);
    const allow = res.headers()["access-control-allow-origin"];
    expect(allow, "CORS allow-origin header present").toBeTruthy();
    await ctx.dispose();
  });
});
