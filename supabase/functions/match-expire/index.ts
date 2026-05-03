// ============================================================================
// match-expire  (SKELETON — Sprint 1)
// ----------------------------------------------------------------------------
// Cron: daily 04:00 UTC+7. Sprint 2 will implement:
//   UPDATE matches SET verification_status = 'expired'
//   WHERE verification_status = 'pending' AND created_at < NOW() - INTERVAL '7 days'
// ============================================================================

import { corsHeaders, jsonResponse } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  return jsonResponse({ status: "skeleton", function: "match-expire", ts: new Date().toISOString() });
});
