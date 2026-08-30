// Browser JS errors and CSP reports. Successful ingestion returns 204; invalid
// or abusive requests get an explicit status that browser reporters can ignore.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { getAuthUser } from "../_shared/auth.ts";
import { clientEventCorsHeaders as corsHeaders } from "../_shared/cors.ts";
import {
  MAX_CLIENT_ERROR_BODY_BYTES,
  getClientErrorIp,
  hashClientErrorIdentity,
  parseClientErrorType,
  parseCspClientErrors,
  parseJsClientError,
  type ClientErrorInsert,
} from "../_shared/client-errors.ts";

const RATE_WINDOW_SECONDS = 10 * 60;
const AUTHENTICATED_EVENT_LIMIT = 60;
const ANONYMOUS_EVENT_LIMIT = 120;

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
}

function empty(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers: { ...corsHeaders, ...headers } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return empty(204);
  if (req.method !== "POST") return empty(405, { Allow: "POST, OPTIONS" });

  const type = parseClientErrorType(new URL(req.url).searchParams.get("type"));
  if (!type) return empty(400);

  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_CLIENT_ERROR_BODY_BYTES) {
    return empty(413);
  }

  let body: unknown;
  try {
    const payload = await req.text();
    if (!payload) return empty(400);
    if (new TextEncoder().encode(payload).byteLength > MAX_CLIENT_ERROR_BODY_BYTES) {
      return empty(413);
    }
    body = JSON.parse(payload);
  } catch {
    return empty(400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return empty(503);

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const user = await getAuthUser(req, authClient);
  const clientIp = getClientErrorIp(req);
  if (!user && !clientIp) return empty(400);

  const userAgent = req.headers.get("user-agent");
  const parsed = type === "csp_violation"
    ? parseCspClientErrors(body, user?.id ?? null, userAgent)
    : parseJsClientError(type, body, user?.id ?? null, userAgent);
  if (parsed.tooLarge) return empty(413);
  // Everything in the batch was third-party injected code (see
  // isThirdPartyCspReport). The request was well-formed and we understood it —
  // it just describes software we do not ship — so this is a 204, not the 400
  // we return for a body we could not parse. It also returns BEFORE the rate
  // limiter, so Facebook's in-app browser scripts no longer spend the budget
  // that a real error from the same reader needs.
  if (parsed.rows.length === 0 && parsed.injectedCount > 0) {
    // The one trace of a dropped report. These rows are unrecoverable once
    // filtered, so the drop rate has to be visible somewhere or a filter that
    // starts eating too much would look exactly like a quiet week.
    console.log(`log-client-event dropped ${parsed.injectedCount} third-party report(s)`);
    return empty(204);
  }
  if (parsed.rawCount === 0 || parsed.rows.length === 0) return empty(400);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const identity = user ? `user:${user.id}` : `ip:${clientIp}`;
  const identityHash = await hashClientErrorIdentity(identity);
  const eventLimit = user ? AUTHENTICATED_EVENT_LIMIT : ANONYMOUS_EVENT_LIMIT;
  const { data: rateData, error: rateError } = await serviceClient
    .rpc("consume_client_error_rate_limit", {
      p_identity_hash: identityHash,
      // Charge for what we are about to store, not for what the browser sent:
      // a mixed batch must not spend a real reader's budget on the injected
      // half of it. Never below 1 — we only reach here with rows to insert.
      p_event_count: Math.max(parsed.rawCount - parsed.injectedCount, 1),
      p_limit: eventLimit,
      p_window_seconds: RATE_WINDOW_SECONDS,
    })
    .single<RateLimitResult>();

  if (rateError || !rateData) {
    console.warn("log-client-event rate limit unavailable", rateError?.message ?? "no result");
    return empty(503);
  }
  if (!rateData.allowed) {
    return empty(429, { "Retry-After": String(rateData.retry_after_seconds) });
  }

  const { error: insertError } = await serviceClient
    .from("client_errors")
    .insert(parsed.rows as ClientErrorInsert[]);
  if (insertError) {
    console.warn("log-client-event insert failed", insertError.message);
    return empty(503);
  }

  return empty(204, { "X-RateLimit-Remaining": String(rateData.remaining) });
});
