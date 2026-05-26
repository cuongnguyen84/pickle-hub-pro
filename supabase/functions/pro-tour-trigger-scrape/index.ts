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

  // Fire-and-forget the Worker call via EdgeRuntime.waitUntil so this
  // handler returns to the admin UI in <1s while the Worker keeps
  // running in the background (MLP multi-day path is 30-90s).
  //
  // Belt-and-braces: even if waitUntil isn't honored by this runtime
  // and the Worker call gets cancelled, the pre-log row inserted above
  // means the admin Logs tab still shows the attempt. The 'running'
  // row will simply sit there until the next manual scrape or until the
  // cleanup job (Sprint 7+) marks orphan running rows as 'failed'. The
  // admin can then re-trigger.
  const scrapePromise: Promise<void> = (async () => {
    try {
      const res = await fetch(`${scraperUrl}/scrape`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Scraper-Signature": signature,
        },
        body: workerBody,
      });
      const txt = await res.text();
      if (!res.ok) {
        console.error(
          `[pro-tour-trigger-scrape] Worker non-2xx (${res.status}): ${txt.slice(0, 500)}`,
        );
        // Worker didn't reach the ingest path → it can't mark the log
        // failed itself. Update it here so the admin Logs tab doesn't
        // stay stuck on 'running' forever.
        if (preLogId && serviceKey) {
          await markLogFailed(
            supabaseUrl,
            serviceKey,
            preLogId,
            `Worker HTTP ${res.status}: ${txt.slice(0, 1000)}`,
          ).catch((e) => console.error(`markLogFailed: ${e}`));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[pro-tour-trigger-scrape] Worker fetch threw: ${msg}`);
      if (preLogId && serviceKey) {
        await markLogFailed(
          supabaseUrl,
          serviceKey,
          preLogId,
          `Trigger function fetch error: ${msg}`,
        ).catch((e) => console.error(`markLogFailed: ${e}`));
      }
    }
  })();

  const runtime = (globalThis as {
    EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
  }).EdgeRuntime;
  if (runtime?.waitUntil) {
    runtime.waitUntil(scrapePromise);
  } else {
    // Fallback: no waitUntil. Don't strand the promise — at least keep
    // it alive long enough for the response to flush, then let Deno
    // tear down. This loses long Worker calls but is the safest
    // fallback for environments that don't expose waitUntil.
    void scrapePromise;
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
