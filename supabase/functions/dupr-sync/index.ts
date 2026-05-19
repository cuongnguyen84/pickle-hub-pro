// ============================================================================
// dupr-sync — Sprint 3 Phase 2 (backfill mode, 2026-05-07)
// ----------------------------------------------------------------------------
// Original Phase 2A purpose: refresh DUPR ratings via HTML scrape of the
// public profile pages. Pivoted to backfill-only because:
//   - DUPR public pages are a Vite/React SPA (empty <div id="root"> shell)
//   - DUPR's underlying API requires per-user Bearer auth
//   - Partnership pending; ETA 2-6 months → defer scrape revival to Sprint 5+
//
// Current behavior: read dupr_rating_history rows (source='manual' or future
// 'dupr_official') and backfill match_participants.dupr_rating_before /
// dupr_rating_after for matches played in the last 90 days where those
// fields are still NULL. This makes Phase 3 PlayerProfile + MatchPage
// dupr-rating columns useful even without an active scrape.
//
// When DUPR partnership lands (Sprint 5+):
//   1. Re-add fetch + parse step BEFORE the backfill (history rows stamped
//      source='dupr_official' instead of 'manual').
//   2. Add dupr_synced_at refresh logic.
//   3. parseDuprProfile / fetchDuprProfile in _shared/dupr-parser.ts are
//      preserved for that revival.
//
// Cron: daily 03:00 UTC+7 (= 20:00 UTC previous day) via Supabase Dashboard.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, jsonResponse } from "../_shared/auth.ts";

const BACKFILL_WINDOW_DAYS = 90;
const HISTORY_BUFFER_DAYS = 60; // extra lookback for "before" rating queries
const UPDATE_BATCH_SIZE = 50;

interface MatchParticipantRow {
  id: string;
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

  // ─── 0. Auth gate ─────────────────────────────────────────────────────
  // Cron-only endpoint. Caller must pass a shared CRON_SECRET in the
  // Authorization header. Set the secret in Function Settings → Secrets
  // (any random string), then reference it from the cron SQL job. This
  // keeps the auth check independent of Supabase service_role key
  // rotations / new secret_key migration.
  //
  // If CRON_SECRET is not set, the function falls back to checking
  // SUPABASE_SERVICE_ROLE_KEY for backwards compat — but production
  // setups should always set CRON_SECRET explicitly.
  const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const auth = req.headers.get("Authorization") ?? "";

  const expectedCron = CRON_SECRET ? `Bearer ${CRON_SECRET}` : "";
  const expectedService = SERVICE_ROLE_KEY ? `Bearer ${SERVICE_ROLE_KEY}` : "";

  const ok =
    (expectedCron && auth === expectedCron) ||
    (expectedService && auth === expectedService);

  if (!ok) {
    return jsonResponse(
      { error: "unauthorized", code: "cron_secret_required" },
      401,
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    SERVICE_ROLE_KEY,
  );

  const startedAtMs = Date.now();
  const startedAtIso = new Date(startedAtMs).toISOString();

  // ─── 1. Open sync-run log ───────────────────────────────────────────────
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

  // ─── 2. List profiles that have a manual DUPR rating ────────────────────
  const { data: profiles, error: pickError } = await supabase
    .from("profiles")
    .select("id")
    .not("dupr_doubles", "is", null)
    .not("dupr_synced_at", "is", null);

  if (pickError) {
    await closeRun(supabase, syncRunId, startedAtMs, 0, 0, [
      `pick_failed: ${pickError.message}`,
    ]);
    return jsonResponse(
      { error: "profile_pick_failed", sync_run_id: syncRunId },
      500,
    );
  }

  const profileIds = (profiles ?? []).map((p: { id: string }) => p.id);
  const profilesTotal = profileIds.length;

  if (profilesTotal === 0) {
    await closeRun(supabase, syncRunId, startedAtMs, 0, 0, []);
    return jsonResponse({
      sync_run_id: syncRunId,
      profiles_total: 0,
      matches_backfilled: 0,
      duration_ms: Date.now() - startedAtMs,
      note: "Backfill mode — DUPR API integration deferred to Sprint 5+ pending partnership",
    });
  }

  // ─── 3. Backfill match_participants ─────────────────────────────────────
  let matchesBackfilled = 0;
  const errors: string[] = [];

  try {
    matchesBackfilled = await backfillRatings(supabase, profileIds);
  } catch (e) {
    console.warn("backfill exception:", e);
    errors.push(`backfill:${String(e)}`);
  }

  // ─── 4. Close sync-run log ──────────────────────────────────────────────
  await closeRun(
    supabase,
    syncRunId,
    startedAtMs,
    profilesTotal,
    matchesBackfilled,
    errors,
  );

  return jsonResponse({
    sync_run_id: syncRunId,
    profiles_total: profilesTotal,
    matches_backfilled: matchesBackfilled,
    duration_ms: Date.now() - startedAtMs,
    note: "Backfill mode — DUPR API integration deferred to Sprint 5+ pending partnership",
  });
});

// ─── helpers ───────────────────────────────────────────────────────────────

async function closeRun(
  supabase: SupabaseClient,
  runId: string,
  startedAtMs: number,
  profilesTotal: number,
  matchesBackfilled: number,
  errors: string[],
): Promise<void> {
  const finishedAtMs = Date.now();
  await supabase
    .from("dupr_sync_runs")
    .update({
      finished_at: new Date(finishedAtMs).toISOString(),
      profiles_total: profilesTotal,
      profiles_ok: matchesBackfilled, // repurposed: rows backfilled this run
      profiles_failed: 0, // never fail per-profile in backfill mode
      duration_ms: finishedAtMs - startedAtMs,
      error_summary:
        errors.length === 0
          ? null
          : errors.slice(0, 50).join("; ").substring(0, 4000),
    })
    .eq("id", runId);
}

/**
 * For each profile in `syncedIds`, find match_participants in the last
 * BACKFILL_WINDOW_DAYS where dupr_rating_before is still NULL, then look
 * up the closest before / at-or-after dupr_rating_history snapshot and
 * update the row.
 *
 * Pre-fetches all rating history for the synced profiles (within the
 * window + a 60-day buffer for "before" lookups) and buckets by profile_id
 * for O(matches) downstream lookup. Updates batched in groups of 50 to
 * keep transaction sizes reasonable.
 *
 * Returns the number of match_participants rows updated.
 */
async function backfillRatings(
  supabase: SupabaseClient,
  syncedIds: string[],
): Promise<number> {
  if (syncedIds.length === 0) return 0;

  const nowMs = Date.now();
  const windowCutoffIso = new Date(
    nowMs - BACKFILL_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const historyCutoffIso = new Date(
    nowMs - (BACKFILL_WINDOW_DAYS + HISTORY_BUFFER_DAYS) * 24 * 60 * 60 * 1000,
  ).toISOString();

  // History bucket: profile_id → DESC-sorted snapshots within window.
  const { data: history, error: histError } = await supabase
    .from("dupr_rating_history")
    .select("profile_id, dupr_doubles, recorded_at")
    .in("profile_id", syncedIds)
    .gte("recorded_at", historyCutoffIso)
    .order("recorded_at", { ascending: false });

  if (histError) {
    throw new Error(`history_fetch: ${histError.message}`);
  }

  const historyByProfile = new Map<string, HistoryRow[]>();
  for (const h of (history as HistoryRow[]) ?? []) {
    if (!historyByProfile.has(h.profile_id)) {
      historyByProfile.set(h.profile_id, []);
    }
    historyByProfile.get(h.profile_id)!.push(h);
  }

  // Match_participants in scope: needs backfill, recent verified match,
  // player synced.
  const { data: parts, error: partsError } = await supabase
    .from("match_participants")
    .select(
      "id, match_id, player_id, matches!inner(played_at, verification_status, is_public)",
    )
    .in("player_id", syncedIds)
    .is("dupr_rating_before", null)
    .gte("matches.played_at", windowCutoffIso)
    .eq("matches.verification_status", "verified");

  if (partsError) {
    throw new Error(`participants_fetch: ${partsError.message}`);
  }

  const updates: Array<{
    id: string;
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
    // History DESC by recorded_at — first entry < playedAt is "before"
    // (closest snapshot strictly before the match). For "after" we want
    // the EARLIEST snapshot at-or-after playedAt → keep overwriting on each
    // match so the loop's last assignment is the smallest qualifying time.
    for (const h of profileHistory) {
      const recMs = new Date(h.recorded_at).getTime();
      if (recMs < playedMs && before === null) {
        before = h.dupr_doubles;
      }
      if (recMs >= playedMs) {
        after = h.dupr_doubles;
      }
    }

    if (before !== null || after !== null) {
      updates.push({ id: p.id, before, after });
    }
  }

  // Apply updates in batches of UPDATE_BATCH_SIZE.
  for (let i = 0; i < updates.length; i += UPDATE_BATCH_SIZE) {
    const slice = updates.slice(i, i + UPDATE_BATCH_SIZE);
    await Promise.all(
      slice.map((u) =>
        supabase
          .from("match_participants")
          .update({
            dupr_rating_before: u.before,
            dupr_rating_after: u.after,
          })
          .eq("id", u.id),
      ),
    );
  }

  return updates.length;
}
