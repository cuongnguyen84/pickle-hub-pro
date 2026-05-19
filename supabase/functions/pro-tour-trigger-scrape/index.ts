// ============================================================================
// pro-tour-trigger-scrape — Sprint 6 admin-gated scrape trigger
// ----------------------------------------------------------------------------
// Bridges the admin UI to the pro-tour-scraper Cloudflare Worker. The
// Worker requires an HMAC signature over the request body (computed from
// the shared SCRAPER_AUTH_SECRET); the secret can't ship to the browser,
// so this edge function does the signing server-side.
//
// Flow:
//   1. Admin UI calls supabase.functions.invoke('pro-tour-trigger-scrape',
//      { body: { tournament_url, watchlist_id? } }) — passing the user's
//      JWT in the Authorization header automatically.
//   2. We verify the bearer token with supabase.auth.getUser() (handles
//      ES256 correctly per the existing CLAUDE.md workaround) and check
//      the user_roles table for admin role.
//   3. We compute HMAC-SHA256(body, SCRAPER_AUTH_SECRET) → hex signature.
//   4. We POST the signed body to PRO_TOUR_SCRAPER_URL/scrape.
//   5. We forward the Worker's JSON response back to the admin UI.
//
// verify_jwt = false in supabase/config.toml because the Edge Functions
// gateway rejects ES256-signed JWTs (project-wide platform mismatch);
// the function verifies the JWT internally instead. This is the same
// pattern the other admin-only functions (api-keys-admin-generate, etc.)
// use, so the security boundary is consistent.
//
// Env vars required:
//   SUPABASE_URL                 — auto-provisioned
//   SUPABASE_ANON_KEY            — auto-provisioned
//   SUPABASE_SERVICE_ROLE_KEY    — auto-provisioned (not used here, but
//                                  kept for parity if a future revision
//                                  needs to write log rows directly)
//   SCRAPER_AUTH_SECRET          — set via `supabase secrets set
//                                  SCRAPER_AUTH_SECRET=<value>`. MUST
//                                  match the value Cuong put on the
//                                  Worker via `wrangler secret put`.
//   PRO_TOUR_SCRAPER_URL         — set via `supabase secrets set
//                                  PRO_TOUR_SCRAPER_URL=https://pro-tour-scraper.<account>.workers.dev`
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getAuthUser, jsonResponse } from "../_shared/auth.ts";

interface TriggerRequest {
  tournament_url: string;
  watchlist_id?: string;
}

interface WorkerResponse {
  ok: boolean;
  log_id?: string;
  matches_extracted?: number;
  players_extracted?: number;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const scraperSecret = Deno.env.get("SCRAPER_AUTH_SECRET");
  const scraperUrl = Deno.env.get("PRO_TOUR_SCRAPER_URL");

  if (!supabaseUrl || !anonKey) {
    return jsonResponse({ error: "Service config missing (Supabase env)" }, 500);
  }
  if (!scraperSecret || !scraperUrl) {
    return jsonResponse(
      {
        error:
          "Worker config missing — set SCRAPER_AUTH_SECRET and PRO_TOUR_SCRAPER_URL via `supabase secrets set`",
      },
      500,
    );
  }

  // Use a user-scoped client so .auth.getUser() AND user_roles SELECT
  // both run with the caller's JWT. The user_roles table has RLS that
  // permits SELECT on own row; admin verification works without the
  // service-role key.
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const user = await getAuthUser(req, supabase);
  if (!user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  // Admin role check. Single-row SELECT with .single() — failure
  // (no row, or role !== 'admin') → 403 with a clear reason so the
  // admin UI can surface it without guessing.
  const { data: roleRow, error: roleErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleErr) {
    return jsonResponse(
      { error: `Role lookup failed: ${roleErr.message}` },
      500,
    );
  }
  if (!roleRow || roleRow.role !== "admin") {
    return jsonResponse({ error: "Forbidden — admin role required" }, 403);
  }

  let payload: TriggerRequest;
  try {
    payload = (await req.json()) as TriggerRequest;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!payload.tournament_url || typeof payload.tournament_url !== "string") {
    return jsonResponse({ error: "tournament_url required" }, 400);
  }

  // Compose the body the Worker expects + sign it. Worker contract is
  // documented in workers/pro-tour-scraper/README.md (the curl example).
  // Note `triggered_by` is hard-coded to 'manual' here — the cron path
  // hits the Worker directly with `triggered_by: 'scheduled'`, never
  // through this function.
  const workerBody = JSON.stringify({
    tournament_url: payload.tournament_url,
    triggered_by: "manual" as const,
    user_id: user.id,
    watchlist_id: payload.watchlist_id ?? null,
  });

  const signature = await hmacSha256Hex(workerBody, scraperSecret);

  let workerRes: Response;
  try {
    workerRes = await fetch(`${scraperUrl}/scrape`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Scraper-Signature": signature,
      },
      body: workerBody,
    });
  } catch (err) {
    // Network-level failure (DNS, connection refused, etc.). Surface
    // the underlying message so admins can tell apart a Worker config
    // problem (404 from CF for the Worker URL) from a real outage.
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse(
      { error: `Worker fetch failed: ${msg}` },
      502,
    );
  }

  // Forward the Worker's response shape verbatim — the admin UI knows
  // how to render { ok, log_id, matches_extracted, players_extracted }
  // or { ok: false, error }. Status code mirrors the Worker's so the
  // UI's response-status handling stays consistent with calling the
  // Worker directly.
  let workerJson: WorkerResponse;
  try {
    workerJson = (await workerRes.json()) as WorkerResponse;
  } catch {
    const text = await workerRes.text();
    return jsonResponse(
      { error: `Worker returned non-JSON: ${text.slice(0, 500)}` },
      502,
    );
  }

  return jsonResponse(workerJson, workerRes.status);
});

/**
 * HMAC-SHA256 over `body` using `secret`, returned as lowercase hex.
 * Matches the Worker's verify_signature() implementation in
 * workers/pro-tour-scraper/src/index.ts.
 */
async function hmacSha256Hex(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
