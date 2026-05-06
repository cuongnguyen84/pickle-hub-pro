// ============================================================================
// dupr-link — Sprint 3 Phase 2 full implementation
// ----------------------------------------------------------------------------
// User-initiated link to a DUPR profile. Accepts a bare DUPR ID or a full
// mydupr.com profile URL, scrapes the public profile page (best-effort),
// extracts singles/doubles ratings, persists to profiles + appends a
// dupr_rating_history snapshot.
//
// JWT verified internally via getAuthUser() helper (ES256/HS256 workaround).
// dupr_rating_history INSERT requires service_role (RLS denies authenticated).
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { getAuthUser, corsHeaders, jsonResponse } from "../_shared/auth.ts";
import {
  parseDuprInput,
  parseDuprProfile,
  fetchDuprProfile,
} from "../_shared/dupr-parser.ts";

interface LinkBody {
  input?: unknown;
}

function err(error: string, status: number, code?: string) {
  return jsonResponse({ error, ...(code ? { code } : {}) }, status);
}

// Debounce window — prevents rapid retry abuse. Spec mentioned "5/hour" but
// dupr_last_attempt_at is a single timestamp column (no per-attempt log
// table), so we enforce a 60-second floor between attempts. Per-attempt
// counting requires a future dupr_link_attempts table.
const ATTEMPT_DEBOUNCE_SECONDS = 60;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return err("method_not_allowed", 405, "method_not_allowed");
  }

  // ─── 1. Auth verification (ES256/HS256 workaround via getAuthUser) ──────
  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );
  const user = await getAuthUser(req, supabaseAuth);
  if (!user) return err("unauthorized", 401, "unauthorized");

  // service_role client for the dupr_rating_history INSERT (RLS deny-default
  // for authenticated) and for atomic profile updates.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // ─── 2. Parse input ─────────────────────────────────────────────────────
  let body: LinkBody;
  try {
    body = (await req.json()) as LinkBody;
  } catch {
    return err("invalid_json", 400, "invalid_json");
  }

  if (typeof body.input !== "string") {
    return err("input_required", 400, "input_required");
  }

  const parsed = parseDuprInput(body.input);
  if (!parsed) {
    return err(
      "invalid_input — provide a DUPR ID or https://mydupr.com/dupr/players/<id> URL",
      400,
      "invalid_input",
    );
  }

  const { duprId } = parsed;
  const duprUrl = `https://mydupr.com/dupr/players/${duprId}`;

  // ─── 3. Rate-limit (debounce window) ────────────────────────────────────
  const { data: existing, error: profileFetchError } = await supabase
    .from("profiles")
    .select("dupr_last_attempt_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileFetchError) {
    return err("profile_lookup_failed", 500, "profile_lookup_failed");
  }

  if (existing?.dupr_last_attempt_at) {
    const lastMs = new Date(existing.dupr_last_attempt_at).getTime();
    const deltaSec = (Date.now() - lastMs) / 1000;
    if (deltaSec < ATTEMPT_DEBOUNCE_SECONDS) {
      return err(
        `rate_limited — wait ${Math.ceil(ATTEMPT_DEBOUNCE_SECONDS - deltaSec)}s before retry`,
        429,
        "rate_limited",
      );
    }
  }

  // ─── 4. Stamp attempt before network call (so retries are throttled even
  //       if the scrape hangs/errors) ──────────────────────────────────────
  const { error: stampError } = await supabase
    .from("profiles")
    .update({
      dupr_last_attempt_at: new Date().toISOString(),
      dupr_profile_url: duprUrl,
    })
    .eq("id", user.id);

  if (stampError) {
    return err("attempt_stamp_failed", 500, "attempt_stamp_failed");
  }

  // ─── 5. Fetch DUPR profile (best-effort scrape) ─────────────────────────
  let html: string;
  let httpStatus: number;
  try {
    const result = await fetchDuprProfile(duprUrl);
    html = result.html;
    httpStatus = result.status;
  } catch (e) {
    await recordError(supabase, user.id, `fetch_failed: ${String(e)}`);
    return err("dupr_fetch_failed", 502, "dupr_fetch_failed");
  }

  if (httpStatus === 404) {
    await recordError(supabase, user.id, "dupr_profile_not_found");
    return err("dupr_profile_not_found", 404, "dupr_profile_not_found");
  }
  if (httpStatus === 403 || httpStatus === 429) {
    await recordError(supabase, user.id, `dupr_rate_limited:${httpStatus}`);
    return err("dupr_rate_limited", 503, "dupr_rate_limited");
  }
  if (httpStatus < 200 || httpStatus >= 300) {
    await recordError(supabase, user.id, `dupr_http_${httpStatus}`);
    return err("dupr_fetch_failed", 502, "dupr_fetch_failed");
  }

  // ─── 6. Parse HTML ──────────────────────────────────────────────────────
  const parsedProfile = parseDuprProfile(html);
  if (
    !parsedProfile ||
    (parsedProfile.singles === null && parsedProfile.doubles === null)
  ) {
    await recordError(supabase, user.id, "dupr_parse_failed");
    return err("dupr_parse_failed", 422, "dupr_parse_failed");
  }

  // ─── 7. Persist rating to profiles ──────────────────────────────────────
  const syncedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      dupr_id: duprId,
      dupr_singles: parsedProfile.singles,
      dupr_doubles: parsedProfile.doubles,
      dupr_synced_at: syncedAt,
      dupr_profile_url: duprUrl,
      dupr_last_error: null,
    })
    .eq("id", user.id);

  if (updateError) {
    return err("profile_update_failed", 500, "profile_update_failed");
  }

  // ─── 8. Append history snapshot (best-effort — don't fail the request
  //       if this errors, the rating is already on profiles) ──────────────
  const { error: historyError } = await supabase
    .from("dupr_rating_history")
    .insert({
      profile_id: user.id,
      source: "dupr_scrape",
      dupr_singles: parsedProfile.singles,
      dupr_doubles: parsedProfile.doubles,
    });

  if (historyError) {
    console.warn("dupr_rating_history insert failed:", historyError);
  }

  // ─── 9. Success response ────────────────────────────────────────────────
  return jsonResponse({
    dupr_id: duprId,
    dupr_singles: parsedProfile.singles,
    dupr_doubles: parsedProfile.doubles,
    dupr_profile_url: duprUrl,
    display_name_hint: parsedProfile.displayName,
    synced_at: syncedAt,
  });
});

// Records an error message on profiles.dupr_last_error so Settings → DUPR
// tab can surface "last attempt failed: <reason>". Best-effort — failure
// to record an error shouldn't change the user-facing response.
async function recordError(
  supabase: SupabaseClient,
  userId: string,
  reason: string,
): Promise<void> {
  try {
    await supabase
      .from("profiles")
      .update({ dupr_last_error: reason })
      .eq("id", userId);
  } catch (e) {
    console.warn("recordError failed:", e);
  }
}
