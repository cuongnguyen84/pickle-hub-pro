// ============================================================================
// match-confirm  (SKELETON — Sprint 1)
// ----------------------------------------------------------------------------
// Sprint 2 will implement: confirmation logic with the OPPONENT TEAM rule —
// match becomes 'verified' ONLY when ≥1 opponent-team participant confirms
// (not just any non-creator). Disputes flag for moderation.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { getAuthUser, corsHeaders, jsonResponse } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );

  const user = await getAuthUser(req, supabase);
  if (!user) return jsonResponse({ error: "unauthorized" }, 401);

  return jsonResponse({ status: "skeleton", function: "match-confirm", user_id: user.id });
});
