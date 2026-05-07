// ============================================================================
// dupr-link — Sprint 3 Phase 2 (manual-rating pivot, 2026-05-07)
// ----------------------------------------------------------------------------
// User submits their own DUPR rating numbers via the link-DUPR form. We
// trust the values (range-checked 2.0-7.0) and stamp them on profiles +
// append a snapshot to dupr_rating_history with source='manual'.
//
// Why manual instead of scrape:
//   - DUPR public profile pages are a Vite/React SPA — plain fetch returns
//     an empty <div id="root"></div> shell with no rating data.
//   - DUPR's underlying API requires per-user Bearer auth; no public
//     endpoint exists for third-party rating reads.
//   - Partnership pending (email sent to Ben Van Hout @ DUPR) but ETA
//     2-6 months. We ship Sprint 3 on schedule and revive the scrape path
//     in Sprint 5+ once partnership lands.
//
// JWT verified internally via getAuthUser() helper (ES256/HS256 workaround
// per CLAUDE.md). dupr_rating_history INSERT requires service_role (RLS
// denies authenticated INSERT on history table).
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { getAuthUser, corsHeaders, jsonResponse } from "../_shared/auth.ts";
import {
  validateManualRating,
  normalizeDuprUrl,
  type ManualRatingInput,
} from "../_shared/dupr-validation.ts";

// Debounce window — prevents accidental double-submission. User intent is
// "save my rating once per session", so 60s is generous.
const SUBMIT_DEBOUNCE_SECONDS = 60;

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

  // ─── 1. Auth verification ───────────────────────────────────────────────
  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );
  const user = await getAuthUser(req, supabaseAuth);
  if (!user) return err("unauthorized", 401, "unauthorized");

  // service_role for the dupr_rating_history INSERT (RLS denies authenticated).
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // ─── 2. Parse + validate input ──────────────────────────────────────────
  let body: ManualRatingInput;
  try {
    body = (await req.json()) as ManualRatingInput;
  } catch {
    return err("invalid_json", 400, "invalid_json");
  }

  const validation = validateManualRating(body);
  if (!validation.valid) {
    return err("validation_failed", 400, "validation_failed", {
      errors: validation.errors,
    });
  }

  const { dupr_id, dupr_singles, dupr_doubles, dupr_profile_url } =
    validation.normalized;

  // Auto-build a profile URL when user gave only an ID (gives Phase 3 UI a
  // direct link to the DUPR page so they can verify the rating they typed).
  const finalUrl =
    dupr_profile_url ?? (dupr_id ? normalizeDuprUrl(dupr_id) : null);

  // ─── 3. Debounce: prevent rapid re-submit ───────────────────────────────
  const { data: existing, error: profileFetchError } = await supabase
    .from("profiles")
    .select("dupr_synced_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileFetchError) {
    return err("profile_lookup_failed", 500, "profile_lookup_failed");
  }

  if (existing?.dupr_synced_at) {
    const lastMs = new Date(existing.dupr_synced_at).getTime();
    const deltaSec = (Date.now() - lastMs) / 1000;
    if (deltaSec < SUBMIT_DEBOUNCE_SECONDS) {
      return err(
        `Vui lòng đợi ${Math.ceil(SUBMIT_DEBOUNCE_SECONDS - deltaSec)}s trước khi cập nhật lại`,
        429,
        "rate_limited",
      );
    }
  }

  // ─── 4. Persist to profiles ─────────────────────────────────────────────
  const syncedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      dupr_id: dupr_id, // nullable
      dupr_singles: dupr_singles, // nullable
      dupr_doubles: dupr_doubles, // required
      dupr_synced_at: syncedAt,
      dupr_profile_url: finalUrl, // nullable
      dupr_last_error: null,
    })
    .eq("id", user.id);

  if (updateError) {
    return err("profile_update_failed", 500, "profile_update_failed");
  }

  // ─── 5. Append history snapshot (source='manual') ──────────────────────
  // Best-effort: profile is already updated, history is bonus. Don't fail
  // the request if history INSERT errors (e.g., race on (profile_id,
  // recorded_at) UNIQUE constraint).
  const { error: historyError } = await supabase
    .from("dupr_rating_history")
    .insert({
      profile_id: user.id,
      source: "manual",
      dupr_singles,
      dupr_doubles,
      recorded_at: syncedAt,
    });

  if (historyError) {
    console.warn("dupr_rating_history insert failed:", historyError);
  }

  // ─── 6. Success response ────────────────────────────────────────────────
  return jsonResponse({
    dupr_id,
    dupr_singles,
    dupr_doubles,
    dupr_profile_url: finalUrl,
    synced_at: syncedAt,
    source: "manual",
  });
});
