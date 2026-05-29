// ============================================================================
// Phase 2B — DUPR submit end-to-end (UAT only, GATED behind DUPR_E2E=1).
// ----------------------------------------------------------------------------
// Exercises the REAL dupr-match-submit edge function chain against the DUPR
// UAT environment + the seeded test users, then cleans up by deleting the
// match it created. Validates:
//   - 3-tier permission gate: a global admin CAN submit; a plain viewer CANNOT
//   - DUPR partner API returns a numeric matchCode
//   - the response envelope matches the shared Zod contract (snake_case)
//   - delete action tears the match back down (no junk left in UAT)
//
// This test SUBMITS to DUPR, so it NEVER runs by default. Enable explicitly:
//   DUPR_E2E=1 \
//   PLAYWRIGHT_BASE_URL=https://dupr-uat-review.pickle-hub-pro.pages.dev \
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... \
//   npm run e2e -- tests/dupr-e2e.spec.ts
//
// NOTE: the member-log -> opponent-confirm UI leg (log_club_match /
// confirm_club_match RPCs) is NOT in the current source tree, so it is not
// covered here. Add that leg once those RPCs ship; for now this validates the
// authoritative submit path (admin/organizer -> DUPR).
// ============================================================================

import { test, expect, request } from "@playwright/test";
import { hasAuthEnv, mintSessionForEmail } from "./helpers/supabase-admin";
import { TEST_USERS } from "./helpers/auth";
import {
  DuprCreateSuccessSchema,
  DuprSubmitResponseSchema,
} from "../src/contracts/duprMatchSubmit";

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON =
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const FN_URL = SUPABASE_URL
  ? `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/dupr-match-submit`
  : "";

// DUPR UAT test IDs (see .claude/secrets.local.md): testuser101 = YGONMK,
// testuser103 = XJYKO7. Override via env for other UAT clubs.
const DUPR_ID_A = process.env.DUPR_TEST_ID_A || "YGONMK";
const DUPR_ID_B = process.env.DUPR_TEST_ID_B || "XJYKO7";

async function callSubmit(accessToken: string, payload: unknown) {
  const ctx = await request.newContext({
    extraHTTPHeaders: {
      Authorization: `Bearer ${accessToken}`,
      apikey: ANON!,
      "Content-Type": "application/json",
    },
  });
  const res = await ctx.post(FN_URL, { data: payload as object });
  const body = await res.json().catch(() => null);
  await ctx.dispose();
  return { status: res.status(), body };
}

test.describe("DUPR submit end-to-end (UAT)", () => {
  test.skip(
    process.env.DUPR_E2E !== "1",
    "DUPR_E2E not set — skipping mutating DUPR submit E2E",
  );
  test.skip(!hasAuthEnv() || !ANON, "Supabase mint env not set");

  test("admin submits a singles match to DUPR and deletes it", async () => {
    const internalSource = "ci-e2e";
    const internalMatchId = `e2e-${Date.now()}`;
    const today = new Date().toISOString().slice(0, 10);

    const createPayload = {
      action: "create",
      internal_source: internalSource,
      internal_match_id: internalMatchId,
      match_date: today,
      location: "ThePickleHub CI",
      format: "SINGLES",
      match_type: "RALLY",
      event: "CI E2E",
      team_a: { player1: DUPR_ID_A, game1: 11 },
      team_b: { player1: DUPR_ID_B, game1: 7 },
    };

    // ── Global admin can submit ────────────────────────────────────────────
    const adminSession = await mintSessionForEmail(TEST_USERS.admin);
    const created = await callSubmit(
      adminSession.session.access_token,
      createPayload,
    );

    // Envelope must always match the shared contract (success or error).
    expect(
      DuprSubmitResponseSchema.safeParse(created.body).success,
      `response envelope drift: ${JSON.stringify(created.body)}`,
    ).toBe(true);

    expect(
      created.status,
      `expected 200 create, got ${created.status}: ${JSON.stringify(created.body)}`,
    ).toBe(200);

    const ok = DuprCreateSuccessSchema.safeParse(created.body);
    expect(ok.success, `create success shape: ${JSON.stringify(created.body)}`).toBe(
      true,
    );
    if (ok.success) {
      expect(ok.data.match_code, "matchCode is numeric").toMatch(/^[0-9]+$/);
    }

    // ── Cleanup: delete the match we just created ──────────────────────────
    const del = await callSubmit(adminSession.session.access_token, {
      action: "delete",
      internal_source: internalSource,
      internal_match_id: internalMatchId,
    });
    expect(
      [200, 404].includes(del.status),
      `delete should 200 (or 404 if already gone): ${del.status} ${JSON.stringify(del.body)}`,
    ).toBe(true);
  });

  test("plain viewer is blocked by the permission gate", async () => {
    const viewerSession = await mintSessionForEmail(TEST_USERS.viewer);
    const res = await callSubmit(viewerSession.session.access_token, {
      action: "create",
      internal_source: "ci-e2e",
      internal_match_id: `e2e-denied-${Date.now()}`,
      match_date: new Date().toISOString().slice(0, 10),
      format: "SINGLES",
      team_a: { player1: DUPR_ID_A, game1: 11 },
      team_b: { player1: DUPR_ID_B, game1: 5 },
    });
    // 3-tier gate: a non-admin / non-organizer must be rejected (403),
    // never silently allowed to submit an arbitrary PARTNER match.
    expect(
      [401, 403].includes(res.status),
      `viewer should be forbidden, got ${res.status}: ${JSON.stringify(res.body)}`,
    ).toBe(true);
    expect(DuprSubmitResponseSchema.safeParse(res.body).success).toBe(true);
  });
});
