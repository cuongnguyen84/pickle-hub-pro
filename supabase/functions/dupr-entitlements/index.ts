// ============================================================================
// dupr-entitlements — fetch + cache user entitlements from DUPR
// ----------------------------------------------------------------------------
// POSTs to DUPR `POST /subscription/active` with the user's SSO access
// token, caches the response in dupr_user_entitlements (24h TTL per DUPR
// spec), returns the entitlements payload.
//
// On a cache hit the function returns the cached row without round-tripping
// to DUPR. Pass `?force=1` (or body `{ "force": true }`) to bypass cache.
//
// verify_jwt = false in config.toml; bearer verified internally.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, getAuthUser, jsonResponse } from "../_shared/auth.ts";
import { getUserAccessToken, userFetch } from "../_shared/dupr-user-client.ts";

interface SubscriptionEntry {
  status?: string;
  displayName?: string;
  entitlements?: Record<string, string[]>;
}

interface SubscriptionResponse {
  subscriptions?: SubscriptionEntry[];
}

interface EntitlementRow {
  display_name: string | null;
  status: string | null;
  entitlements: Record<string, string[]>;
  fetched_at: string;
  expires_at: string;
}

function err(error: string, status: number, code?: string) {
  return jsonResponse({ error, ...(code ? { code } : {}) }, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST" && req.method !== "GET") {
    return err("method_not_allowed", 405, "method_not_allowed");
  }

  // ─── 1. Auth verification ───────────────────────────────────────────────
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

  // ─── 2. Force flag ──────────────────────────────────────────────────────
  let force = new URL(req.url).searchParams.get("force") === "1";
  if (!force && req.method === "POST") {
    try {
      const body = (await req.json().catch(() => null)) as
        | { force?: boolean }
        | null;
      if (body?.force === true) force = true;
    } catch {
      /* ignore */
    }
  }

  // ─── 3. Cache check ─────────────────────────────────────────────────────
  if (!force) {
    const { data: cached } = await supabase
      .from("dupr_user_entitlements")
      .select("display_name, status, entitlements, fetched_at, expires_at")
      .eq("user_id", user.id)
      .maybeSingle<EntitlementRow>();

    if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
      return jsonResponse({
        ...cached,
        cached: true,
      });
    }
  }

  // ─── 4. Fetch from DUPR ─────────────────────────────────────────────────
  const tokenRow = await getUserAccessToken(supabase, user.id);
  if (!tokenRow) {
    return err("dupr_not_connected", 412, "dupr_not_connected");
  }

  let duprBody: SubscriptionResponse;
  try {
    const res = await userFetch(
      tokenRow.access_token,
      "/subscription/active",
      { method: "POST", body: "{}" },
    );
    if (!res.ok) {
      console.warn("dupr subscription/active non-ok:", res.status);
      return err(`dupr_http_${res.status}`, 502, "dupr_upstream_error");
    }
    duprBody = (await res.json()) as SubscriptionResponse;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("dupr subscription/active fetch failed:", msg);
    return err("dupr_fetch_failed", 502, "dupr_upstream_error");
  }

  // ─── 5. Merge entitlements across active subscriptions ─────────────────
  const merged: Record<string, Set<string>> = {};
  let displayName: string | null = null;
  let status: string | null = null;
  for (const sub of duprBody.subscriptions ?? []) {
    if (sub.displayName && !displayName) displayName = sub.displayName;
    if (sub.status && !status) status = sub.status;
    for (const [resource, list] of Object.entries(sub.entitlements ?? {})) {
      if (!merged[resource]) merged[resource] = new Set<string>();
      for (const e of list) merged[resource].add(e);
    }
  }
  const entitlements: Record<string, string[]> = {};
  for (const [resource, set] of Object.entries(merged)) {
    entitlements[resource] = Array.from(set).sort();
  }

  // ─── 6. Persist cache ───────────────────────────────────────────────────
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { error: upsertError } = await supabase
    .from("dupr_user_entitlements")
    .upsert(
      {
        user_id: user.id,
        display_name: displayName,
        status,
        entitlements,
        fetched_at: now.toISOString(),
        expires_at: expires.toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (upsertError) {
    console.error("dupr_user_entitlements upsert failed:", upsertError);
    // Non-fatal — still return data to caller.
  }

  return jsonResponse({
    display_name: displayName,
    status,
    entitlements,
    fetched_at: now.toISOString(),
    expires_at: expires.toISOString(),
    cached: false,
  });
});
