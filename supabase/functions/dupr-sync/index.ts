// ============================================================================
// dupr-sync  (SKELETON — Sprint 1)
// ----------------------------------------------------------------------------
// Cron: daily 03:00 UTC+7. Sprint 3 will implement: refresh ratings for
// profiles with dupr_id whose dupr_synced_at < NOW() - 24h, throttle 100
// profiles/run, backfill match_participants.dupr_rating_before/after for
// recently verified matches.
//
// This is a CRON function — invoked by GitHub Actions or Supabase scheduled
// edge runs, not by user clicks. No auth check needed; runs with implicit
// service-role context. Skeleton just returns acknowledgement.
// ============================================================================

import { corsHeaders, jsonResponse } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  return jsonResponse({ status: "skeleton", function: "dupr-sync", ts: new Date().toISOString() });
});
