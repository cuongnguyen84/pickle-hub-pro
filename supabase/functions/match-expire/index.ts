// ============================================================================
// match-expire — Sprint 2 cron implementation
// ----------------------------------------------------------------------------
// Daily 04:00 UTC+7 (21:00 UTC). Sweeps pending matches older than 7 days
// to verification_status = 'expired'. No auth check — invoked by Supabase
// scheduled trigger with service_role context.
//
// Schedule lives in supabase/config.toml [functions.match-expire].schedule.
// Manually invokable via POST /functions/v1/match-expire (no body required).
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // service_role bypasses RLS — required for cross-user UPDATE
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("matches")
    .update({
      verification_status: "expired",
      updated_at: new Date().toISOString(),
    })
    .eq("verification_status", "pending")
    .lt("created_at", sevenDaysAgo)
    .select("id");

  if (error) {
    console.error(
      JSON.stringify({
        function: "match-expire",
        timestamp: new Date().toISOString(),
        error: error.message,
        code: error.code,
      }),
    );
    return jsonResponse(
      { error: "match_expire_failed", details: error.message },
      500,
    );
  }

  const expiredIds = (data ?? []).map((row) => row.id as string);
  console.log(
    JSON.stringify({
      function: "match-expire",
      timestamp: new Date().toISOString(),
      expired_count: expiredIds.length,
      expired_ids: expiredIds,
    }),
  );

  return jsonResponse({ expired_count: expiredIds.length });
});
