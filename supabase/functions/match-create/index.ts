// ============================================================================
// match-create  (SKELETON — Sprint 1)
// ----------------------------------------------------------------------------
// Sprint 2 will implement: rate limit, score validation, slug generation,
// match insert, participants insert, opponent notifications.
//
// Sprint 1 ships the skeleton + auth check only so the function exists in
// the Supabase project and config.toml route is wired.
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

  return jsonResponse({ status: "skeleton", function: "match-create", user_id: user.id });
});
