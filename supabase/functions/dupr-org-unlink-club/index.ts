// ============================================================================
// dupr-org-unlink-club — remove a ThePickleHub organization's DUPR club link
// ----------------------------------------------------------------------------
// Input: { organization_id: uuid }.
// Gate:  caller can admin the organization (same logic as link).
//
// Effect: nulls out dupr_club_id, dupr_club_name, dupr_club_role,
//         dupr_linked_at, dupr_linked_by on the row. Does NOT call DUPR — a
//         DUPR club's relationship to a partner is a local concept.
//
// verify_jwt = false in config.toml; bearer verified internally.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, getAuthUser, jsonResponse } from "../_shared/auth.ts";

interface Body {
  organization_id?: string;
}

function err(error: string, status: number, code?: string) {
  return jsonResponse({ error, ...(code ? { code } : {}) }, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return err("method_not_allowed", 405, "method_not_allowed");
  }

  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );
  const user = await getAuthUser(req, supabaseAuth);
  if (!user) return err("unauthorized", 401, "unauthorized");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return err("invalid_json", 400, "invalid_json");
  }

  const orgId = body.organization_id?.trim() ?? "";
  if (!orgId) return err("missing_organization_id", 400, "missing_organization_id");

  // Same gate as the link function.
  const { data: adminRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle<{ role: string }>();

  let canAdmin = !!adminRow;
  if (!canAdmin) {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle<{ organization_id: string | null }>();
    if (profileRow?.organization_id === orgId) {
      const { data: creatorRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "creator"])
        .maybeSingle<{ role: string }>();
      canAdmin = !!creatorRow;
    }
  }
  if (!canAdmin) {
    return err("forbidden", 403, "not_org_admin");
  }

  const { data: updated, error: updateErr } = await supabase
    .from("organizations")
    .update({
      dupr_club_id: null,
      dupr_club_name: null,
      dupr_club_role: null,
      dupr_linked_at: null,
      dupr_linked_by: null,
    })
    .eq("id", orgId)
    .select("id, name, slug, dupr_club_id")
    .maybeSingle();

  if (updateErr) {
    console.error("organizations unlink failed:", updateErr);
    return err("organization_update_failed", 500, "organization_update_failed");
  }
  if (!updated) {
    return err("organization_not_found", 404, "organization_not_found");
  }

  return jsonResponse({ organization: updated });
});
