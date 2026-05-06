// ============================================================================
// dupr-sync — Sprint 3 Phase 2 full implementation
// ----------------------------------------------------------------------------
// Cron: daily 03:00 UTC+7 (= 20:00 UTC previous day) — see config.toml.
//
// Logic:
//   1. Open a dupr_sync_runs row.
//   2. Pick up to 100 profiles where dupr_id IS NOT NULL and dupr_synced_at
//      is null or > 24h old (oldest first, NULL first).
//   3. Re-scrape each via fetchDuprProfile + parseDuprProfile, throttled
//      500ms between requests so we don't hammer DUPR.
//   4. On success: update profiles + append dupr_rating_history snapshot.
//      On failure: set dupr_last_error, leave dupr_synced_at unchanged.
//   5. Backfill match_participants.dupr_rating_before / after for matches
//      played in the last 30 days where the field is still NULL — uses the
//      synced profile_ids' newly-stored history.
//   6. Close the dupr_sync_runs row with totals + duration.
//
// Cron is graceful: per-profile failures are logged but never throw.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/auth.ts";
import {
  parseDuprProfile,
  fetchDuprProfile,
} from "../_shared/dupr-parser.ts";

const PROFILES_PER_RUN = 100;
const THROTTLE_MS_BETWEEN_FETCH = 500;
const BACKFILL_WINDOW_DAYS = 30;

interface ProfileRow {
  id: string;
  dupr_id: string | null;
  dupr_profile_url: string | null;
}

interface MatchParticipantRow {
  match_id: string;
  player_id: string;
  matches: { played_at: string } | null;
}

interface HistoryRow {
  profile_id: string;
  dupr_doubles: number | null;
  recorded_at: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const startedAtMs = Date.now();
  const startedAtIso = new Date(startedAtMs).toISOString();

  // ─── 1. Open sync-run log ─────────────────────────────────────────────
  const { data: runRow, error: runError } = await supabase
    .from("dupr_sync_runs")
    .insert({ started_at: startedAtIso, profiles_total: 0 })
    .select("id")
    .single();

  if (runError || !runRow) {
    console.error("Failed to open dupr_sync_runs row:", runError);
    return jsonResponse(
      { error: "sync_run_open_failed", details: String(runError) },
      500,
    );
  }
  const syncRunId = runRow.id;

  // ─── 2. Pick profiles needing refresh ─────────────────────────────────
  const cutoffIso = new Date(
    startedAtMs - 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: profiles, error: pickError } = await supabase
    .from("profiles")
    .select("id, dupr_id, dupr_profile_url")
    .not("dupr_id", "is", null)
    .or(`dupr_synced_at.is.null,dupr_synced_at.lt.${cutoffIso}`)
    .order("dupr_synced_at", { ascending: true, nullsFirst: true })
    .limit(PROFILES_PER_RUN);

  if (pickError) {
    await closeRun(supabase, syncRunId, startedAtMs, 0, 0, 0, [
      `pick_failed: ${pickError.message}`,
    ]);
    return jsonResponse(
      { error: "profile_pick_failed", sync_run_id: syncRunId },
      500,
    );
  }

  const profilesTotal = profiles?.length ?? 0;
  if (profilesTotal === 0) {
    await closeRun(supabase, syncRunId, startedAtMs, 0, 0, 0, []);
    return jsonResponse({
      sync_run_id: syncRunId,
      profiles_total: 0,
      profiles_ok: 0,
      profiles_failed: 0,
      duration_ms: Date.now() - startedAtMs,
      note: "no profiles due for sync",
    });
  }

  // ─── 3. Refresh each profile (throttled) ──────────────────────────────
  const errors: string[] = [];
  const syncedIds: string[] = [];
  let profilesOk = 0;
  let profilesFailed = 0;

  for (let i = 0; i < (profiles as ProfileRow[]).length; i++) {
    const p = (profiles as ProfileRow[])[i];
    if (i > 0) await sleep(THROTTLE_MS_BETWEEN_FETCH);

    const url =
      p.dupr_profile_url ?? `https://mydupr.com/dupr/players/${p.dupr_id}`;

    try {
      const { html, status } = await fetchDuprProfile(url);
      if (status < 200 || status >= 300) {
        await markFailed(supabase, p.id, `http_${status}`);
        errors.push(`${p.id}:http_${status}`);
        profilesFailed++;
        continue;
      }

      const parsed = parseDuprProfile(html);
      if (
        !parsed ||
        (parsed.singles === null && parsed.doubles === null)
      ) {
        await markFailed(supabase, p.id, "parse_failed");
        errors.push(`${p.id}:parse_failed`);
        profilesFailed++;
        continue;
      }

      const syncedAt = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          dupr_singles: parsed.singles,
          dupr_doubles: parsed.doubles,
          dupr_synced_at: syncedAt,
          dupr_profile_url: url,
          dupr_last_error: null,
        })
        .eq("id", p.id);

      if (updateError) {
        await markFailed(supabase, p.id, `update:${updateError.message}`);
        errors.push(`${p.id}:update`);
        profilesFailed++;
        continue;
      }

      const { error: historyError } = await supabase
        .from("dupr_rating_history")
        .insert({
          profile_id: p.id,
          source: "dupr_scrape",
          dupr_singles: parsed.singles,
          dupr_doubles: parsed.doubles,
        });

      if (historyError) {
        // Non-fatal — profile updated successfully, history is bonus.
        console.warn(`history insert ${p.id}:`, historyError.message);
      }

      profilesOk++;
      syncedIds.push(p.id);
    } catch (e) {
      await markFailed(supabase, p.id, `exception:${String(e)}`);
      errors.push(`${p.id}:exception`);
      profilesFailed++;
    }
  }

  // ─── 4. Backfill match_participants.dupr_rating_before/after ──────────
  if (syncedIds.length > 0) {
    try {
      await backfillRatings(supabase, syncedIds);
    } catch (e) {
      console.warn("backfill failed:", e);
      errors.push(`backfill:${String(e)}`);
    }
  }

  // ─── 5. Close sync-run log ────────────────────────────────────────────
  await closeRun(
    supabase,
    syncRunId,
    startedAtMs,
    profilesTotal,
    profilesOk,
    profilesFailed,
    errors,
  );

  return jsonResponse({
    sync_run_id: syncRunId,
    profiles_total: profilesTotal,
    profiles_ok: profilesOk,
    profiles_failed: profilesFailed,
    duration_ms: Date.now() - startedAtMs,
  });
});

// ─── helpers ───────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function markFailed(
  supabase: SupabaseClient,
  profileId: string,
  reason: string,
): Promise<void> {
  try {
    await supabase
      .from("profiles")
      .update({
        dupr_last_error: reason.substring(0, 500),
        dupr_last_attempt_at: new Date().toISOString(),
      })
      .eq("id", profileId);
  } catch (e) {
    console.warn("markFailed:", e);
  }
}

async function closeRun(
  supabase: SupabaseClient,
  runId: string,
  startedAtMs: number,
  profilesTotal: number,
  profilesOk: number,
  profilesFailed: number,
  errors: string[],
): Promise<void> {
  const finishedAtMs = Date.now();
  await supabase
    .from("dupr_sync_runs")
    .update({
      finished_at: new Date(finishedAtMs).toISOString(),
      profiles_total: profilesTotal,
      profiles_ok: profilesOk,
      profiles_failed: profilesFailed,
      duration_ms: finishedAtMs - startedAtMs,
      error_summary:
        errors.length === 0
          ? null
          : errors.slice(0, 50).join("; ").substring(0, 4000),
    })
    .eq("id", runId);
}

/**
 * Per-profile backfill of match_participants.dupr_rating_before / after.
 *
 * Strategy: for each synced profile, find recent match_participants where
 * the rating fields are NULL, then for each one look up the closest
 * dupr_rating_history snapshot before / after the match's played_at.
 *
 * Uses doubles rating as the canonical "match rating" (most pickleball
 * matches in our app are doubles). Singles backfill not in scope.
 */
async function backfillRatings(
  supabase: SupabaseClient,
  syncedIds: string[],
): Promise<void> {
  const windowCutoffIso = new Date(
    Date.now() - BACKFILL_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Pre-fetch all rating history for synced profiles within the window
  // (+ a small buffer for "before" lookups). Sort newest-first.
  const historyCutoffIso = new Date(
    Date.now() - (BACKFILL_WINDOW_DAYS + 60) * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: history, error: histError } = await supabase
    .from("dupr_rating_history")
    .select("profile_id, dupr_doubles, recorded_at")
    .in("profile_id", syncedIds)
    .gte("recorded_at", historyCutoffIso)
    .order("recorded_at", { ascending: false });

  if (histError) {
    throw new Error(`history_fetch: ${histError.message}`);
  }

  // Group history by profile_id for O(1) lookup per match.
  const historyByProfile = new Map<string, HistoryRow[]>();
  for (const h of (history as HistoryRow[]) ?? []) {
    if (!historyByProfile.has(h.profile_id)) {
      historyByProfile.set(h.profile_id, []);
    }
    historyByProfile.get(h.profile_id)!.push(h);
  }

  // Pull match_participants needing backfill.
  const { data: parts, error: partsError } = await supabase
    .from("match_participants")
    .select("match_id, player_id, matches!inner(played_at, verification_status, is_public)")
    .in("player_id", syncedIds)
    .is("dupr_rating_before", null)
    .gte("matches.played_at", windowCutoffIso)
    .eq("matches.verification_status", "verified");

  if (partsError) {
    throw new Error(`participants_fetch: ${partsError.message}`);
  }

  const updates: Array<{
    match_id: string;
    player_id: string;
    before: number | null;
    after: number | null;
  }> = [];

  for (const p of (parts as MatchParticipantRow[]) ?? []) {
    const playedAt = p.matches?.played_at;
    if (!playedAt) continue;

    const playedMs = new Date(playedAt).getTime();
    const profileHistory = historyByProfile.get(p.player_id) ?? [];

    let before: number | null = null;
    let after: number | null = null;
    // history is sorted DESC by recorded_at — first entry < playedAt is "before".
    for (const h of profileHistory) {
      const recMs = new Date(h.recorded_at).getTime();
      if (recMs < playedMs && before === null) {
        before = h.dupr_doubles;
      }
      if (recMs >= playedMs) {
        after = h.dupr_doubles;
        // keep iterating — profileHistory is DESC, so we want the LAST one >= playedMs (= earliest after)
      }
    }

    updates.push({
      match_id: p.match_id,
      player_id: p.player_id,
      before,
      after,
    });
  }

  // Apply each update. We don't have a bulk upsert API for composite-key
  // updates, so loop sequentially. ~5 rows/profile expected = manageable.
  for (const u of updates) {
    if (u.before === null && u.after === null) continue;
    await supabase
      .from("match_participants")
      .update({
        dupr_rating_before: u.before,
        dupr_rating_after: u.after,
      })
      .eq("match_id", u.match_id)
      .eq("player_id", u.player_id);
  }
}
