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

  // Insert a "running" log row UP FRONT so the admin Logs tab shows the
  // scrape attempt immediately, regardless of whether the Worker call
  // succeeds, fails, or never reports back. The Worker (via the ingest
  // function on success, or directly on render failure) updates this row
  // when it finishes. If the row stays "running" beyond ~3 minutes it
  // means the Worker didn't report back and the admin can dig into the
  // Worker tail.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  let preLogId: string | null = null;
  if (serviceKey) {
    try {
      const insRes = await fetch(`${supabaseUrl}/rest/v1/pro_tour_ingestion_logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          source_provider: /majorleaguepickleball\.co/i.test(payload.tournament_url)
            ? "mlp"
            : "ppa_tour",
          source_url: payload.tournament_url,
          triggered_by: "manual",
          triggered_by_user_id: user.id,
          watchlist_id: payload.watchlist_id ?? null,
          status: "running",
        }),
      });
      if (insRes.ok) {
        const inserted = (await insRes.json()) as Array<{ id: string }>;
        preLogId = inserted[0]?.id ?? null;
      } else {
        console.error(
          `[pro-tour-trigger-scrape] Pre-log insert failed (${insRes.status}): ${(await insRes.text()).slice(0, 300)}`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[pro-tour-trigger-scrape] Pre-log insert threw: ${msg}`);
    }
  }

  // Compose the body the Worker expects + sign it. Worker contract is
  // documented in workers/pro-tour-scraper/README.md. Pass the pre-log id
  // so the Worker can UPDATE that row instead of inserting a fresh one.
  const workerBody = JSON.stringify({
    tournament_url: payload.tournament_url,
    triggered_by: "manual" as const,
    user_id: user.id,
    watchlist_id: payload.watchlist_id ?? null,
    log_id: preLogId,
  });

  const signature = await hmacSha256Hex(workerBody, scraperSecret);

  // Race the Worker call against a short window so we can synchronously
  // surface fast failures (401 bad signature, 422 unsupported URL,
  // immediate 5xx) to the admin UI as actual errors — instead of always
  // pretending everything's queued and only revealing the truth via the
  // Logs tab (Codex P1 fix on PR #163).
  //
  // Resolution:
  //   - If the Worker responds within FAST_FAIL_MS, forward its real
  //     status + body to the admin UI verbatim. Successful long scrapes
  //     never fit in this window so they fall through to the queued
  //     path naturally.
  //   - If the window elapses, hand the still-pending promise to
  //     EdgeRuntime.waitUntil so the Worker keeps running, and return
  //     the 202 queued response. The Worker (on success) or this
  //     function's failure handler (if the Worker eventually fails)
  //     updates the pre-log row so the Logs tab reflects the real
  //     outcome later.
  const FAST_FAIL_MS = 4_000;

  // Capture worker fetch promise so we can both race it AND keep it
  // alive on the queued path.
  const workerFetchPromise = fetch(`${scraperUrl}/scrape`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Scraper-Signature": signature,
    },
    body: workerBody,
  });

  // A second promise that just settles when the window elapses, used as
  // the race timeout sentinel.
  const fastFailTimeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), FAST_FAIL_MS),
  );

  let fastResult: Response | "timeout";
  try {
    fastResult = await Promise.race([workerFetchPromise, fastFailTimeout]);
  } catch (err) {
    // fetch threw before timeout — surface the error synchronously.
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[pro-tour-trigger-scrape] Worker fetch threw fast: ${msg}`);
    if (preLogId && serviceKey) {
      await markLogFailed(
        supabaseUrl,
        serviceKey,
        preLogId,
        `Trigger function fetch error: ${msg}`,
      ).catch((e) => console.error(`markLogFailed: ${e}`));
    }
    return jsonResponse(
      { ok: false, error: `Worker fetch failed: ${msg}`, log_id: preLogId },
      502,
    );
  }

  if (fastResult !== "timeout") {
    // Worker responded within FAST_FAIL_MS. Forward verbatim so the
    // admin UI sees real status + body (matches the pre-fire-and-forget
    // behavior the reviewer asked for).
    const txt = await fastResult.text();
    let workerJson: WorkerResponse;
    try {
      workerJson = JSON.parse(txt) as WorkerResponse;
    } catch {
      workerJson = {
        ok: false,
        error: `Worker returned non-JSON: ${txt.slice(0, 500)}`,
      };
    }
    if (!fastResult.ok || workerJson.ok === false) {
      // Mark log failed so the Logs tab matches the toast.
      if (preLogId && serviceKey) {
        await markLogFailed(
          supabaseUrl,
          serviceKey,
          preLogId,
          workerJson.error ?? `Worker HTTP ${fastResult.status}: ${txt.slice(0, 1000)}`,
        ).catch((e) => console.error(`markLogFailed: ${e}`));
      }
    }
    return jsonResponse(
      { ...workerJson, log_id: preLogId },
      fastResult.status,
    );
  }

  // Timed out waiting for fast response → assume slow success path is
  // in progress. Detach the still-pending fetch via waitUntil so the
  // Worker keeps running, and return queued.
  const tailPromise: Promise<void> = workerFetchPromise
    .then(async (res) => {
      const txt = await res.text();
      if (!res.ok) {
        console.error(
          `[pro-tour-trigger-scrape] Worker non-2xx after timeout (${res.status}): ${txt.slice(0, 500)}`,
        );
        if (preLogId && serviceKey) {
          await markLogFailed(
            supabaseUrl,
            serviceKey,
            preLogId,
            `Worker HTTP ${res.status}: ${txt.slice(0, 1000)}`,
          ).catch((e) => console.error(`markLogFailed: ${e}`));
        }
      }
    })
    .catch(async (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[pro-tour-trigger-scrape] Worker fetch threw after timeout: ${msg}`);
      if (preLogId && serviceKey) {
        await markLogFailed(
          supabaseUrl,
          serviceKey,
          preLogId,
          `Trigger function fetch error after queue: ${msg}`,
        ).catch((e) => console.error(`markLogFailed: ${e}`));
      }
    });

  const runtime = (globalThis as {
    EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
  }).EdgeRuntime;
  if (runtime?.waitUntil) {
    runtime.waitUntil(tailPromise);
  } else {
    void tailPromise;
  }

  return jsonResponse(
    {
      ok: true,
      queued: true,
      log_id: preLogId,
      matches_extracted: 0,
      players_extracted: 0,
      note:
        "Scrape queued. Logs tab now shows a 'running' row that updates to success/failed on completion (30-90s).",
    },
    202,
  );
});

/**
 * PATCH the pre-created log row to status='failed'. Used by the trigger
 * function as a safety net when the Worker fetch itself fails or
 * returns non-2xx without reaching the ingest path that owns logs.
 */
async function markLogFailed(
  supabaseUrl: string,
  serviceKey: string,
  logId: string,
  errorMessage: string,
): Promise<void> {
  await fetch(`${supabaseUrl}/rest/v1/pro_tour_ingestion_logs?id=eq.${logId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      status: "failed",
      error_message: errorMessage.slice(0, 4000),
      completed_at: new Date().toISOString(),
    }),
  });
}

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
