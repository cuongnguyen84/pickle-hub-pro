// ============================================================================
// dupr-clubs — fetch + cache user's DUPR club memberships
// ----------------------------------------------------------------------------
// GET https://api.<env>.dupr.gg/user/club/membership with the user's SSO
// access token. Caches in dupr_user_clubs (24h TTL). Replaces all rows
// for the user wholesale on refresh — clubs the user has left disappear.
//
// Pass `?force=1` or body `{ "force": true }` to bypass cache.
//
// Used by:
//   - Frontend (useDuprClubs) for showing which clubs the user can submit
//     matches on behalf of.
//   - dupr-match-submit (PR4) — verifies DIRECTOR/ORGANIZER role before
//     allowing a CLUB-source match.
//
// verify_jwt = false in config.toml; bearer verified internally.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, getAuthUser, jsonResponse } from "../_shared/auth.ts";
import { getUserAccessToken, userFetch } from "../_shared/dupr-user-client.ts";

type ClubRole = "DIRECTOR" | "ORGANIZER" | "PLAYER";

interface MembershipEntry {
  clubId?: number;
  clubName?: string;
  role?: string;
}

interface MembershipResponse {
  membership?: MembershipEntry[];
}

interface CachedRow {
  user_id: string;
  club_id: number;
  club_name: string | null;
  role: ClubRole;
  fetched_at: string;
  expires_at: string;
}

function err(error: string, status: number, code?: string) {
  return jsonResponse({ error, ...(code ? { code } : {}) }, status);
}

function isClubRole(s: unknown): s is ClubRole {
  return s === "DIRECTOR" || s === "ORGANIZER" || s === "PLAYER";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST" && req.method !== "GET") {
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

  // ─── Cache hit ──────────────────────────────────────────────────────────
  if (!force) {
    const { data: cached } = await supabase
      .from("dupr_user_clubs")
      .select("club_id, club_name, role, fetched_at, expires_at")
      .eq("user_id", user.id);

    const rows = (cached ?? []) as Pick<
      CachedRow,
      "club_id" | "club_name" | "role" | "fetched_at" | "expires_at"
    >[];
    const fresh = rows.length > 0 &&
      rows.every((r) => new Date(r.expires_at).getTime() > Date.now());
    if (fresh) {
      return jsonResponse({
        clubs: rows.map(({ expires_at: _e, fetched_at: _f, ...rest }) => rest),
        cached: true,
      });
    }
  }

  // ─── Fetch from DUPR ────────────────────────────────────────────────────
  const tokenRow = await getUserAccessToken(supabase, user.id);
  if (!tokenRow) {
    return err("dupr_not_connected", 412, "dupr_not_connected");
  }

  let dupr: MembershipResponse;
  try {
    const res = await userFetch(tokenRow.access_token, "/user/club/membership");
    if (!res.ok) {
      console.warn("dupr club/membership non-ok:", res.status);
      return err(`dupr_http_${res.status}`, 502, "dupr_upstream_error");
    }
    dupr = (await res.json()) as MembershipResponse;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("dupr club/membership fetch failed:", msg);
    return err("dupr_fetch_failed", 502, "dupr_upstream_error");
  }

  // ─── Normalize + filter ─────────────────────────────────────────────────
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const rows: Omit<CachedRow, "user_id">[] = [];
  for (const m of dupr.membership ?? []) {
    const clubId = typeof m.clubId === "number" ? m.clubId : Number(m.clubId);
    const role = (m.role ?? "").toUpperCase().trim();
    if (!Number.isFinite(clubId) || !isClubRole(role)) continue;
    rows.push({
      club_id: clubId,
      club_name: m.clubName?.trim() ?? null,
      role,
      fetched_at: now.toISOString(),
      expires_at: expires.toISOString(),
    });
  }

  // ─── Replace cache wholesale (clubs user left should disappear) ─────────
  await supabase.from("dupr_user_clubs").delete().eq("user_id", user.id);

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from("dupr_user_clubs")
      .insert(rows.map((r) => ({ user_id: user.id, ...r })));
    if (insertError) {
      console.error("dupr_user_clubs insert failed:", insertError);
      // Non-fatal — still return data to caller.
    }
  }

  return jsonResponse({
    clubs: rows.map(({ expires_at: _e, fetched_at: _f, ...rest }) => rest),
    cached: false,
  });
});
