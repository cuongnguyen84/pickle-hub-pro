// ============================================================================
// dupr-org-link-club — link a ThePickleHub organization to a DUPR club (PR5)
// ----------------------------------------------------------------------------
// Input (POST JSON):
//   {
//     organization_id: uuid,
//     dupr_club_id:    string,   // the DUPR clubId from /user/club/membership
//     dupr_club_name?: string,   // displayed in UI; defaults to live lookup
//   }
//
// Gate (in order):
//   1. Caller authenticated.
//   2. Caller can admin the organization (RPC user_can_admin_organization).
//   3. Caller has a fresh dupr_user_clubs row for the proposed clubId with
//      role DIRECTOR or ORGANIZER. We refresh from DUPR if the cache is
//      stale — never trust a stale role.
//   4. Single-club-per-org — partial UNIQUE index on organizations.dupr_club_id
//      enforces this at the DB layer; we surface the conflict cleanly.
//
// Returns the updated organization row's DUPR fields.
//
// verify_jwt = false in config.toml; bearer verified internally.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, getAuthUser, jsonResponse } from "../_shared/auth.ts";
import { getUserAccessToken, userFetch } from "../_shared/dupr-user-client.ts";

interface Body {
  organization_id?: string;
  dupr_club_id?: string | number;
  dupr_club_name?: string;
}

interface MembershipEntry {
  clubId?: number | string;
  clubName?: string;
  role?: string;
}

interface MembershipResponse {
  membership?: MembershipEntry[];
}

function err(error: string, status: number, code?: string, details?: unknown) {
  return jsonResponse(
    { error, ...(code ? { code } : {}), ...(details ? { details } : {}) },
    status,
  );
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
  const duprClubId = body.dupr_club_id !== undefined
    ? String(body.dupr_club_id).trim()
    : "";

  if (!orgId) return err("missing_organization_id", 400, "missing_organization_id");
  if (!duprClubId) return err("missing_dupr_club_id", 400, "missing_dupr_club_id");

  // ─── 1. Gate: can the caller admin the org? ────────────────────────────
  // We forward the caller's JWT via the service-role client so the RPC
  // sees auth.uid() correctly (SECURITY DEFINER pins to caller). For
  // service-role flows, RPCs read auth.uid() as NULL — so we instead pass
  // the user_id explicitly and re-implement the gate here.
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
    return err("forbidden", 403, "not_org_admin", {
      hint: "Caller must be platform admin, or admin/creator of the org.",
    });
  }

  // ─── 2. Live-fetch caller's club memberships from DUPR ────────────────
  // We do NOT trust a stale dupr_user_clubs row — the user could have lost
  // DIRECTOR role yesterday.
  const tokenRow = await getUserAccessToken(supabase, user.id);
  if (!tokenRow) {
    return err("dupr_not_connected", 412, "dupr_not_connected");
  }

  let membership: MembershipEntry[];
  try {
    const res = await userFetch(tokenRow.access_token, "/user/club/membership");
    if (!res.ok) {
      return err(`dupr_http_${res.status}`, 502, "dupr_upstream_error");
    }
    const data = (await res.json()) as MembershipResponse;
    membership = data.membership ?? [];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("user/club/membership fetch failed:", msg);
    return err("dupr_fetch_failed", 502, "dupr_upstream_error");
  }

  const match = membership.find(
    (m) => String(m.clubId ?? "").trim() === duprClubId,
  );
  if (!match) {
    return err("club_not_in_membership", 403, "club_not_in_membership", {
      hint: "User must be DIRECTOR or ORGANIZER of this club on DUPR side.",
    });
  }
  const role = (match.role ?? "").toUpperCase().trim();
  if (role !== "DIRECTOR" && role !== "ORGANIZER") {
    return err("insufficient_role", 403, "insufficient_role", { role });
  }
  const liveClubName = match.clubName?.trim() ?? null;

  // ─── 3. Conflict check — another org has already claimed this clubId ──
  const { data: existingClaim } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("dupr_club_id", duprClubId)
    .neq("id", orgId)
    .maybeSingle<{ id: string; name: string }>();
  if (existingClaim) {
    return err("club_already_linked", 409, "club_already_linked", {
      other_organization: existingClaim,
    });
  }

  // ─── 4. Persist ─────────────────────────────────────────────────────────
  const now = new Date().toISOString();
  const { data: updated, error: updateErr } = await supabase
    .from("organizations")
    .update({
      dupr_club_id: duprClubId,
      dupr_club_name: body.dupr_club_name?.trim() || liveClubName,
      dupr_club_role: role,
      dupr_linked_at: now,
      dupr_linked_by: user.id,
    })
    .eq("id", orgId)
    .select("id, name, slug, dupr_club_id, dupr_club_name, dupr_club_role, dupr_linked_at, dupr_linked_by")
    .maybeSingle();

  if (updateErr) {
    console.error("organizations update failed:", updateErr);
    // 23505 unique violation → race; retry by reporting cleanly.
    if ((updateErr as { code?: string }).code === "23505") {
      return err("club_already_linked", 409, "club_already_linked");
    }
    return err("organization_update_failed", 500, "organization_update_failed");
  }
  if (!updated) {
    return err("organization_not_found", 404, "organization_not_found");
  }

  // Also keep the dupr_user_clubs cache fresh for subsequent calls.
  await supabase
    .from("dupr_user_clubs")
    .upsert(
      {
        user_id: user.id,
        club_id: Number(duprClubId),
        club_name: liveClubName,
        role,
        fetched_at: now,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "user_id,club_id" },
    );

  return jsonResponse({ organization: updated });
});
