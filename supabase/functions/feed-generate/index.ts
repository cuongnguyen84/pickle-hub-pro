// ============================================================================
// feed-generate  (SKELETON — Sprint 1)
// ----------------------------------------------------------------------------
// Sprint 4 will implement: 4-layer feed (60% followed players' verified
// matches, 25% top venue matches, 10% pro/marquee, 5% sponsored cards),
// 60s per-user cache, cursor pagination.
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

  return jsonResponse({ status: "skeleton", function: "feed-generate", user_id: user.id });
});
