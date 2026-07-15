// ============================================================================
// notification-send  (SKELETON — Sprint 1)
// ----------------------------------------------------------------------------
// Internal helper invoked by other functions (match-create, match-confirm,
// kudos triggers, etc.) — not directly by client. Sprint 4 will implement:
// insert notifications row, send Capacitor push (when iOS shipped),
// queue weekly email digest entries.
//
// BLOCKED: notifications table schema decision (Option A/B/C in Sprint 1
// PR). This skeleton can be wired once that resolves.
// ============================================================================

import { jsonResponse } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const expected = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!expected) {
    console.error("[notification-send] SUPABASE_SERVICE_ROLE_KEY is not configured");
    return jsonResponse({ error: "service_auth_not_configured" }, 503);
  }
  const presented = (req.headers.get("Authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (presented !== expected) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  return jsonResponse({ status: "skeleton", function: "notification-send", ts: new Date().toISOString() });
});
