// ============================================================================
// leaderboard-compute  (SKELETON — Sprint 1)
// ----------------------------------------------------------------------------
// Cron: daily 02:00 UTC+7. Sprint 5 will implement: snapshots for global VN
// + top 10 cities + top 50 venues, periods all_time/monthly/weekly. Phase 1
// formula = DUPR doubles primary + activity tiebreaker (no Skill Score —
// Phase 2). Min 5 verified matches in period to qualify.
// ============================================================================

import { corsHeaders, jsonResponse } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  return jsonResponse({ status: "skeleton", function: "leaderboard-compute", ts: new Date().toISOString() });
});
