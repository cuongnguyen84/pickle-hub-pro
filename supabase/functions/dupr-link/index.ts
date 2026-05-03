// ============================================================================
// dupr-link  (SKELETON — Sprint 1)
// ----------------------------------------------------------------------------
// Sprint 3 will implement: validate DUPR ID, attempt scrape of public DUPR
// profile (matching scripts/parse-dupr.py logic), persist singles/doubles
// rating + dupr_synced_at on profiles. On failure, queue for manual review.
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

  return jsonResponse({ status: "skeleton", function: "dupr-link", user_id: user.id });
});
