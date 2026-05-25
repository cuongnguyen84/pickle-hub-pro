// ============================================================================
// dupr-event-eligibility — gate premium events behind entitlement check
// ----------------------------------------------------------------------------
// Per DUPR RaaS "User Gating" doc:
//   > It is a requirement for partner platforms to provide the option for
//   > Premium Events. When creating or managing events, your system must
//   > check for the PREMIUM_L1 entitlement. If designated as a Premium event
//   > (e.g., DUPR+ only), users without the PREMIUM_L1 tag must be prevented
//   > from registering or participating.
//
// Input (POST JSON):
//   {
//     event_id?: string,              // optional, for audit
//     required: string[],             // e.g., ["BASIC_L1"] or ["PREMIUM_L1","VERIFIED_L1"]
//     resource?: string,              // default "tournaments"
//   }
//
// Output (200):
//   {
//     allowed: boolean,
//     user_entitlements: string[],
//     required: string[],
//     missing: string[],
//   }
//
// Returns 401 if not authenticated, 412 if user has no entitlement cache row
// at all (proxy for "not SSO-connected to DUPR").
//
// verify_jwt = false in config.toml; bearer verified internally.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, getAuthUser, jsonResponse } from "../_shared/auth.ts";

interface Body {
  event_id?: string;
  required?: string[];
  resource?: string;
}

interface EntitlementRow {
  entitlements: Record<string, string[]>;
  expires_at: string;
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

  const required = Array.isArray(body.required) ? body.required : [];
  const resource = body.resource ?? "tournaments";
  if (required.length === 0) {
    return err("missing_required", 400, "missing_required", {
      hint: "Pass at least 1 entitlement code in `required` (e.g. ['PREMIUM_L1'])",
    });
  }

  // Read user's cached entitlements directly (service-role bypasses RLS).
  // Cache is 24h per DUPR spec — if expired, we still read but mark stale.
  const { data: row, error: rowErr } = await supabase
    .from("dupr_user_entitlements")
    .select("entitlements, expires_at")
    .eq("user_id", user.id)
    .maybeSingle<EntitlementRow>();

  if (rowErr) {
    console.error("dupr_user_entitlements read failed:", rowErr);
    return err("entitlement_read_failed", 500, "entitlement_read_failed");
  }
  if (!row) {
    // No row = user hasn't fetched entitlements yet (or never SSO'd properly).
    // Treat as "missing everything required".
    return jsonResponse({
      allowed: false,
      user_entitlements: [],
      required,
      missing: required,
      cache_present: false,
      hint: "User has no entitlement cache. Call POST /functions/v1/dupr-entitlements first or run dupr-entitlements client-side.",
    });
  }

  const cacheFresh = new Date(row.expires_at).getTime() > Date.now();
  const userEnts = new Set<string>(row.entitlements?.[resource] ?? []);
  const missing = required.filter((e) => !userEnts.has(e));
  const allowed = missing.length === 0;

  return jsonResponse({
    allowed,
    user_entitlements: Array.from(userEnts).sort(),
    required,
    missing,
    resource,
    cache_fresh: cacheFresh,
    cache_expires_at: row.expires_at,
    event_id: body.event_id ?? null,
  });
});
