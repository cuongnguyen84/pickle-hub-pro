import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { requireCronRequest } from "../_shared/cron-auth.ts";
import { cronPostCorsHeaders as corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authError = requireCronRequest(req, Deno.env.get("CRON_SECRET") ?? "");
  if (authError) return authError;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Hard lifecycle cap: a community tournament must not remain live more
    // than 30 days after it was created, even if a late edit refreshed
    // updated_at. This is intentionally based on created_at, not inactivity.
    const MAX_OPEN_AGE_DAYS = 30;
    const createdBefore = new Date(
      Date.now() - MAX_OPEN_AGE_DAYS * 86400000,
    ).toISOString();

    // Archive stale Quick Tables
    const { data: quickTables, error: qtError } = await supabase
      .from("quick_tables")
      .update({ status: "completed" })
      .in("status", ["setup", "group_stage", "playoff"])
      .lt("created_at", createdBefore)
      .select("id");

    if (qtError) {
      console.error("Error archiving quick_tables:", qtError);
    }

    // Archive stale Team Match Tournaments
    const { data: teamMatches, error: tmError } = await supabase
      .from("team_match_tournaments")
      .update({ status: "completed" })
      .in("status", ["registration", "ongoing"])
      .lt("created_at", createdBefore)
      .select("id");

    if (tmError) {
      console.error("Error archiving team_match_tournaments:", tmError);
    }

    // Archive stale Flex Tournaments
    const { data: flexTournaments, error: ftError } = await supabase
      .from("flex_tournaments")
      .update({ status: "completed" })
      .in("status", ["active", "ongoing", "setup"])
      .lt("created_at", createdBefore)
      .select("id");

    if (ftError) {
      console.error("Error archiving flex_tournaments:", ftError);
    }

    // Archive stale Doubles Elimination Tournaments
    const { data: doublesTournaments, error: dtError } = await supabase
      .from("doubles_elimination_tournaments")
      .update({ status: "completed" })
      .in("status", ["setup", "registration_open", "ongoing"])
      .lt("created_at", createdBefore)
      .select("id");

    if (dtError) {
      console.error("Error archiving doubles_elimination_tournaments:", dtError);
    }

    const result = {
      archived_quick_tables: quickTables?.length ?? 0,
      archived_team_matches: teamMatches?.length ?? 0,
      archived_flex_tournaments: flexTournaments?.length ?? 0,
      archived_doubles_tournaments: doublesTournaments?.length ?? 0,
      timestamp: new Date().toISOString(),
    };

    console.log("Auto-archive result:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Auto-archive error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
