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

import { corsHeaders, jsonResponse } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  return jsonResponse({ status: "skeleton", function: "notification-send", ts: new Date().toISOString() });
});
