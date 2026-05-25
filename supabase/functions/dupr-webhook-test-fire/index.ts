// ============================================================================
// dupr-webhook-test-fire — synthesize a DUPR RATING webhook for demo
// ----------------------------------------------------------------------------
// PR3 demo helper. Synthesizes a payload mimicking the DUPR RATING webhook
// shape and POSTs it to our own /functions/v1/dupr-webhook endpoint. Used
// during the partnership demo so the reviewer sees a RATING event flow
// end-to-end without having to wait for DUPR UAT to actually push.
//
// Two auth modes:
//   1. SERVICE-ROLE bearer  → can fire for any { user_id } in the body
//      (admin / operator). Required for running from curl in a screencast.
//   2. USER JWT  → can fire ONLY against the calling user's own row.
//      Lets the DuprDashboard fire a test event with the same auth the
//      user already has — no service-role exposure to the SPA.
//
// Body:
//   { user_id?: string, singles?: number, doubles?: number }
// In user-JWT mode, user_id is ignored and forced to the calling user.
//
// verify_jwt = false in config.toml; auth verified internally.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, getAuthUser, jsonResponse } from "../_shared/auth.ts";

interface BodyShape {
  user_id?: string;
  singles?: number;
  doubles?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const auth = (req.headers.get("Authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  let body: BodyShape;
  try {
    body = (await req.json()) as BodyShape;
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  let targetUserId: string | null = null;
  let authMode: "service" | "user" = "service";

  if (serviceKey && auth === serviceKey) {
    // Service-role mode — operator can target any user_id.
    targetUserId = body.user_id ?? null;
    if (!targetUserId) {
      return jsonResponse({ error: "missing_user_id" }, 400);
    }
  } else {
    // User-JWT mode — caller must be authenticated; forced to self.
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );
    const user = await getAuthUser(req, supabaseAuth);
    if (!user) return jsonResponse({ error: "unauthorized" }, 401);
    targetUserId = user.id;
    authMode = "user";
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    serviceKey,
  );

  // Resolve dupr_id from the user_id so the receiver finds the row.
  const { data: tokenRow, error: tokenErr } = await supabase
    .from("dupr_user_tokens")
    .select("dupr_id")
    .eq("user_id", targetUserId!)
    .is("revoked_at", null)
    .maybeSingle<{ dupr_id: string }>();

  if (tokenErr || !tokenRow) {
    return jsonResponse({ error: "user_not_connected" }, 412);
  }

  // Build a payload that matches the DUPR RATING webhook contract
  // (clientId == DUPR_CLIENT_KEY in UAT — see dupr-webhook receiver).
  const clientKey = Deno.env.get("DUPR_CLIENT_KEY") ?? "";
  if (!clientKey) {
    return jsonResponse({ error: "client_key_missing" }, 500);
  }

  const payload = {
    clientId: clientKey,
    event: "RATING",
    timestamp: String(Math.floor(Date.now() / 1000)),
    message: {
      duprId: tokenRow.dupr_id,
      name: "[test-fire] synthetic",
      rating: {
        singles: body.singles ?? null,
        doubles: body.doubles ?? null,
        singlesReliability: 0.92,
        doublesReliability: 0.95,
        matchId: 0,
      },
    },
  };

  // POST to our own receiver. We use the public URL (functions/v1/dupr-webhook)
  // so the path through DUPR's auth-less ingress is exercised exactly as in
  // production. The receiver uses service_role for its DB writes — no
  // authorization header is needed.
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const webhookUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/dupr-webhook`;

  let receiverBody: unknown;
  let receiverStatus = 0;
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    receiverStatus = res.status;
    receiverBody = await res.json().catch(() => null);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("test-fire failed:", msg);
    return jsonResponse({ error: msg }, 502);
  }

  return jsonResponse({
    fired: true,
    auth_mode: authMode,
    payload,
    receiver: { status: receiverStatus, body: receiverBody },
  });
});
