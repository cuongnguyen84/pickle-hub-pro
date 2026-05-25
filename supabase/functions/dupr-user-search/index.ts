// ============================================================================
// dupr-user-search — unified opponent search
// ----------------------------------------------------------------------------
// Searches BOTH the DUPR Partner API (consented users only) AND the local
// profiles table (any user who has SSO'd ThePickleHub), then merges by
// dupr_id. Returns up to `limit` suggestions for the /match/new opponent
// picker.
//
// Per DUPR consent model (Developer FAQ): partner search only returns
// users who have granted consent to your integration. Until the consented
// pool grows, DUPR-side hits will be sparse — internal profiles fills the
// gap so the picker still shows useful suggestions immediately.
//
// Input (POST JSON):
//   { query: string, limit?: number (default 10, max 25),
//     exclude_user_ids?: uuid[] }
//
// Output:
//   {
//     hits: [{
//       source: "dupr" | "internal" | "both",
//       dupr_id: string | null,
//       full_name: string,
//       singles_rating: number | null,
//       doubles_rating: number | null,
//       user_id: uuid | null,   // ThePickleHub profile id if SSO'd
//       email?: string | null,
//       username?: string | null,
//     }],
//     dupr_total: number,        // total matching on DUPR side (consented)
//     internal_total: number,    // total matching on local profiles
//   }
//
// verify_jwt = false in config.toml; bearer verified internally.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, getAuthUser, jsonResponse } from "../_shared/auth.ts";
import { partnerFetch } from "../_shared/dupr-client.ts";

interface Body {
  query?: string;
  limit?: number;
  exclude_user_ids?: string[];
}

interface DuprHit {
  duprId: string;
  fullName: string;
  singlesRating?: number | null;
  doublesRating?: number | null;
}

interface DuprSearchResp {
  status?: string;
  result?: {
    total?: number;
    hits?: DuprHit[];
  };
}

interface ProfileHit {
  id: string;
  display_name: string | null;
  email: string;
  username: string | null;
  dupr_id: string | null;
  dupr_singles: number | null;
  dupr_doubles: number | null;
}

interface MergedHit {
  source: "dupr" | "internal" | "both";
  dupr_id: string | null;
  full_name: string;
  singles_rating: number | null;
  doubles_rating: number | null;
  user_id: string | null;
  email: string | null;
  username: string | null;
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

  const rawQuery = (body.query ?? "").trim();
  if (rawQuery.length < 2) {
    return jsonResponse({ hits: [], dupr_total: 0, internal_total: 0 });
  }

  const limit = Math.min(Math.max(body.limit ?? 10, 1), 25);
  const excludeIds = new Set<string>([
    user.id,
    ...(body.exclude_user_ids ?? []).filter((s) => typeof s === "string"),
  ]);

  // ─── 1. DUPR Partner API search (consented users only) ─────────────────
  let duprHits: DuprHit[] = [];
  let duprTotal = 0;
  try {
    const res = await partnerFetch(supabase, "/user/v1.0/search", {
      method: "POST",
      body: JSON.stringify({ query: rawQuery, offset: 0, limit }),
    });
    const data = (await res.json().catch(() => null)) as DuprSearchResp | null;
    if (res.ok && data?.status === "SUCCESS") {
      duprHits = data.result?.hits ?? [];
      duprTotal = data.result?.total ?? 0;
    }
  } catch (e) {
    console.warn("dupr search non-fatal:", e);
  }

  // ─── 2. Internal profiles search (ILIKE name + email + dupr_id) ────────
  // Drop @-handle prefix if present so users can paste "@cuong" or "cuong".
  const internalQuery = rawQuery.replace(/^@/, "").toLowerCase();
  const escapedQuery = internalQuery.replace(/%/g, "\\%").replace(/_/g, "\\_");
  const ilike = `%${escapedQuery}%`;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, email, username, dupr_id, dupr_singles, dupr_doubles")
    .or(
      `display_name.ilike.${ilike},email.ilike.${ilike},username.ilike.${ilike},dupr_id.ilike.${ilike}`,
    )
    .limit(limit * 2);

  const internalHits = (profiles ?? []) as ProfileHit[];
  const internalTotal = internalHits.length;

  // ─── 3. Merge by dupr_id (when present) ────────────────────────────────
  const merged = new Map<string, MergedHit>();

  // Seed with internal hits (they have user_id we need for downstream
  // match-proposal calls)
  for (const p of internalHits) {
    if (excludeIds.has(p.id)) continue;
    const key = p.dupr_id ?? `internal:${p.id}`;
    merged.set(key, {
      source: "internal",
      dupr_id: p.dupr_id,
      full_name: p.display_name ?? p.email,
      singles_rating: p.dupr_singles,
      doubles_rating: p.dupr_doubles,
      user_id: p.id,
      email: p.email,
      username: p.username,
    });
  }

  // Overlay DUPR hits: if dupr_id already in merged map → flip source to
  // "both" + fill in any missing rating. Otherwise add as DUPR-only hit
  // (no user_id — downstream UI must surface "this user hasn't joined
  // ThePickleHub yet" or similar).
  for (const h of duprHits) {
    const existing = merged.get(h.duprId);
    if (existing) {
      existing.source = "both";
      existing.singles_rating ??= h.singlesRating ?? null;
      existing.doubles_rating ??= h.doublesRating ?? null;
      if (!existing.full_name || existing.full_name === existing.email) {
        existing.full_name = h.fullName;
      }
    } else {
      merged.set(h.duprId, {
        source: "dupr",
        dupr_id: h.duprId,
        full_name: h.fullName,
        singles_rating: h.singlesRating ?? null,
        doubles_rating: h.doublesRating ?? null,
        user_id: null,
        email: null,
        username: null,
      });
    }
  }

  // Sort: connected (both) > internal > dupr-only. Within each tier,
  // alphabetical by name.
  const tierOf = (h: MergedHit) =>
    h.source === "both" ? 0 : h.source === "internal" ? 1 : 2;
  const sorted = Array.from(merged.values())
    .sort((a, b) => {
      const ta = tierOf(a);
      const tb = tierOf(b);
      if (ta !== tb) return ta - tb;
      return a.full_name.localeCompare(b.full_name);
    })
    .slice(0, limit);

  return jsonResponse({
    hits: sorted,
    dupr_total: duprTotal,
    internal_total: internalTotal,
  });
});
