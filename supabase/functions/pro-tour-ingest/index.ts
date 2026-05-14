// ============================================================================
// pro-tour-ingest — Sprint 6 PR-A  (updated: pending-match backfill)
// ----------------------------------------------------------------------------
// Single ingestion endpoint for pro-tour scrape results. Called by the
// pro-tour-scraper Worker (workers/pro-tour-scraper) after a successful
// page render + parse. Reconciles the parsed TournamentScrapeResult into:
//   1. profiles ghost rows (one per ScrapedPlayer external_id, INSERT ON
//      CONFLICT DO NOTHING via the partial unique index from migration
//      20260510160000)
//   2. matches rows — INSERT for new matches; UPDATE pending→verified when
//      a re-scrape supplies a winner. Verified matches are immutable.
//   3. match_participants rows (one per player on each match, position
//      derived from team order)
//   4. pro_tour_ingestion_logs row tracking matches_imported,
//      players_created, players_matched, duration_ms
//
// Idempotent: re-ingesting the same TournamentScrapeResult is a no-op for
// verified matches and pending matches that still have no winner.
// players_matched counts profiles that already existed.
//
// Auth: service_role key required (the Worker is the only legitimate
// caller; admin UI hits the Worker, not this directly). verify_jwt is
// disabled in supabase/config.toml because the service-role bearer token
// satisfies authorization on its own.
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import type {
  TournamentScrapeResult,
  ScrapedPlayer,
  ScrapedMatch,
  ScrapedTeam,
  SourceProvider,
} from "../_shared/pro-tour-types.ts";

interface IngestRequestBody {
  scrape_result: TournamentScrapeResult;
  triggered_by: "manual" | "scheduled";
  triggered_by_user_id: string | null;
  watchlist_id: string | null;
  duration_ms: number;
}

interface IngestResponse {
  log_id: string;
  matches_imported: number;
  players_created: number;
  players_matched: number;
}

// CORS — admin UI calls go through here too if we ever bypass the Worker.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Pro Tour system profile — matches.recorded_by is NOT NULL UUID FK to
// profiles(id) (Sprint 1 schema). Pro tour matches have no real user
// recording them, so we attribute to a synthetic system profile seeded
// by migration 20260510160002_pro_tour_system_profile.sql. The UUID
// here MUST match the one INSERTed by that migration — if either
// changes, the FK violation surfaces immediately on the next ingest.
const SYSTEM_RECORDER_PROFILE_ID = "11111111-1111-1111-1111-111111111111";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    return jsonResponse({ error: "Service config missing" }, 500);
  }

  // Bearer must be the service role key — the Worker forwards it.
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ") || auth.slice(7) !== serviceKey) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let body: IngestRequestBody;
  try {
    body = (await req.json()) as IngestRequestBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  if (!body.scrape_result || typeof body.scrape_result !== "object") {
    return jsonResponse({ error: "Missing scrape_result" }, 400);
  }

  const supabase = createClient(url, serviceKey);
  const startMs = Date.now();

  // Open the log row in 'running' state so the admin UI sees the
  // attempt mid-flight (esp. for scheduled batches that touch many
  // tournaments). Final status flips below.
  const { data: logRow, error: logErr } = await supabase
    .from("pro_tour_ingestion_logs")
    .insert({
      source_provider: body.scrape_result.source_provider,
      source_url: body.scrape_result.source_url,
      triggered_by: body.triggered_by,
      triggered_by_user_id: body.triggered_by_user_id,
      watchlist_id: body.watchlist_id,
      status: "running",
    })
    .select("id")
    .single();

  if (logErr || !logRow) {
    return jsonResponse(
      { error: `Failed to open log: ${logErr?.message ?? "unknown"}` },
      500,
    );
  }
  const log_id = logRow.id as string;

  try {
    const { players_created, players_matched, externalIdToProfileId } =
      await reconcilePlayers(supabase, body.scrape_result.source_provider, body.scrape_result.players);

    const matches_imported = await reconcileMatches(
      supabase,
      body.scrape_result,
      externalIdToProfileId,
    );

    await supabase
      .from("pro_tour_ingestion_logs")
      .update({
        status: "success",
        matches_imported,
        players_created,
        players_matched,
        duration_ms: Date.now() - startMs + (body.duration_ms ?? 0),
        completed_at: new Date().toISOString(),
      })
      .eq("id", log_id);

    const result: IngestResponse = {
      log_id,
      matches_imported,
      players_created,
      players_matched,
    };
    return jsonResponse(result, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .from("pro_tour_ingestion_logs")
      .update({
        status: "failed",
        error_message: msg,
        duration_ms: Date.now() - startMs + (body.duration_ms ?? 0),
        completed_at: new Date().toISOString(),
        payload: { scrape_result: body.scrape_result },
      })
      .eq("id", log_id);
    return jsonResponse({ error: msg, log_id }, 500);
  }
});

/* ─── Player reconciliation ─────────────────────────────────────────── */

async function reconcilePlayers(
  supabase: ReturnType<typeof createClient>,
  source_provider: SourceProvider,
  players: ScrapedPlayer[],
): Promise<{
  players_created: number;
  players_matched: number;
  externalIdToProfileId: Map<string, string>;
}> {
  const out = new Map<string, string>();
  if (players.length === 0) {
    return { players_created: 0, players_matched: 0, externalIdToProfileId: out };
  }

  // Bulk lookup existing ghosts by (source_provider, external_id).
  const externalIds = players.map((p) => p.external_id);
  const { data: existing, error } = await supabase
    .from("profiles")
    .select("id, external_id")
    .eq("source_provider", source_provider)
    .in("external_id", externalIds);
  if (error) throw new Error(`Player lookup: ${error.message}`);

  const existingByExt = new Map<string, string>();
  for (const row of existing ?? []) {
    existingByExt.set(row.external_id as string, row.id as string);
  }

  let players_created = 0;
  let players_matched = 0;

  for (const p of players) {
    const hit = existingByExt.get(p.external_id);
    if (hit) {
      out.set(p.external_id, hit);
      players_matched += 1;
      continue;
    }
    // Insert ghost. is_ghost=true so the profile doesn't appear in
    // suggested-follows / search by default; ingestion logs surface
    // creation count so admins can review.
    const { data: inserted, error: insErr } = await supabase
      .from("profiles")
      .insert({
        // profiles.id is NOT a FK to auth.users for ghost rows — but the
        // schema does declare REFERENCES auth.users(id). Ghost profile
        // pattern in this codebase (see CreateGhostProfileModal) inserts
        // with a fresh UUID and is_ghost=true. The FK is enforced
        // DEFERRABLE INITIALLY DEFERRED in Sprint 1 migrations to
        // accommodate this. If the FK isn't deferred on prod, this will
        // fail with FK violation; backfill via a one-off ALTER if so.
        id: crypto.randomUUID(),
        // email is NOT NULL in profiles — synthesize a deterministic
        // placeholder so the ghost is reconcilable and re-running is
        // idempotent (the partial unique on source_provider+external_id
        // catches the actual dedupe).
        email: `ghost+${source_provider}+${p.external_id}@thepicklehub.net`,
        username: `ppa-${p.external_id}`,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        country_code: p.country_code,
        is_ghost: true,
        source_provider,
        external_id: p.external_id,
        external_url: p.external_url,
      })
      .select("id")
      .single();
    if (insErr || !inserted) {
      // Race against a sibling ingest? Re-query and reuse if found.
      const { data: retry } = await supabase
        .from("profiles")
        .select("id")
        .eq("source_provider", source_provider)
        .eq("external_id", p.external_id)
        .maybeSingle();
      if (retry) {
        out.set(p.external_id, retry.id as string);
        players_matched += 1;
        continue;
      }
      throw new Error(`Insert ghost failed for ${p.external_id}: ${insErr?.message ?? "unknown"}`);
    }
    out.set(p.external_id, inserted.id as string);
    players_created += 1;
  }

  return { players_created, players_matched, externalIdToProfileId: out };
}

/* ─── Match reconciliation ──────────────────────────────────────────── */

async function reconcileMatches(
  supabase: ReturnType<typeof createClient>,
  scrape: TournamentScrapeResult,
  externalIdToProfileId: Map<string, string>,
): Promise<number> {
  if (scrape.matches.length === 0) return 0;

  // Bulk-check which matches already exist. Fetch id + verification_status
  // so we can promote pending rows to verified when fresh results arrive.
  const externalIds = scrape.matches.map((m) => m.external_match_id);
  const { data: existing, error } = await supabase
    .from("matches")
    .select("id, external_match_id, verification_status")
    .eq("source_provider", scrape.source_provider)
    .in("external_match_id", externalIds);
  if (error) throw new Error(`Match lookup: ${error.message}`);

  const existingByExtId = new Map<string, { id: string; verification_status: string }>();
  for (const row of existing ?? []) {
    existingByExtId.set(row.external_match_id as string, {
      id: row.id as string,
      verification_status: row.verification_status as string,
    });
  }

  let imported = 0;
  for (const match of scrape.matches) {
    const hit = existingByExtId.get(match.external_match_id);

    if (hit) {
      // Verified matches are immutable — results are final, never overwrite.
      if (hit.verification_status === "verified") continue;

      // Pending match: promote to verified only when the scrape now has a winner.
      const winning_team =
        match.winner_team === "one" ? "a" : match.winner_team === "two" ? "b" : null;
      if (winning_team === null) continue; // still no result — nothing new to write

      const updatePayload: Record<string, unknown> = {
        team_a_score: match.scores_team_one,
        team_b_score: match.scores_team_two,
        winning_team,
        verification_status: "verified",
        round_name: match.round_name,
      };
      // Only overwrite played_at / court_number when the scrape provides a value.
      // Keeps the original estimate rather than nullifying it.
      if (match.played_at !== null) updatePayload.played_at = match.played_at;
      if (match.court !== null) updatePayload.court_number = match.court;

      const { error: updateErr } = await supabase
        .from("matches")
        .update(updatePayload)
        .eq("id", hit.id);
      if (updateErr) {
        throw new Error(
          `Update pending match ${match.external_match_id} failed: ${updateErr.message}`,
        );
      }
      imported += 1;
      continue;
    }

    // New match — INSERT as before.
    const inserted = await insertMatchWithParticipants(
      supabase,
      scrape,
      match,
      externalIdToProfileId,
    );
    if (inserted) imported += 1;
  }
  return imported;
}

async function insertMatchWithParticipants(
  supabase: ReturnType<typeof createClient>,
  scrape: TournamentScrapeResult,
  match: ScrapedMatch,
  externalIdToProfileId: Map<string, string>,
): Promise<boolean> {
  // Resolve participant profile ids; bail if any player wasn't reconciled
  // (would yield an orphan match — log via throw so the surrounding
  // try/catch flips the log to failed).
  const teamAIds = match.team_one.player_external_ids
    .map((eid) => externalIdToProfileId.get(eid))
    .filter((id): id is string => Boolean(id));
  const teamBIds = match.team_two.player_external_ids
    .map((eid) => externalIdToProfileId.get(eid))
    .filter((id): id is string => Boolean(id));

  if (teamAIds.length === 0 || teamBIds.length === 0) {
    // Skip silently — this is recoverable; next ingest pass reconciles.
    return false;
  }

  // Compose the matches row. Format heuristic: 2 players per side =
  // doubles, 1 player = singles. The community matches table CHECK
  // accepts 'singles'/'doubles'/'mixed' — pro tour matches default to
  // 'doubles' for the typical PPA Mens Doubles / Mixed Doubles / Pro
  // Singles distinction (mixed handling deferred Sprint 7).
  const format = teamAIds.length === 1 ? "singles" : "doubles";
  const slug = `${scrape.source_provider}-${match.external_match_id}`.toLowerCase();
  const winning_team =
    match.winner_team === "one" ? "a" : match.winner_team === "two" ? "b" : null;

  const { data: matchRow, error: matchErr } = await supabase
    .from("matches")
    .insert({
      slug,
      format,
      match_type: "tournament",
      played_at: match.played_at ?? new Date().toISOString(),
      team_a_score: match.scores_team_one,
      team_b_score: match.scores_team_two,
      winning_team,
      verification_status: winning_team ? "verified" : "pending",
      is_public: true,
      // Required NOT NULL FK to profiles. Synthetic system profile seeded
      // by migration 20260510160002 — see SYSTEM_RECORDER_PROFILE_ID
      // constant for rationale. (Codex P1 fix on PR #29.)
      recorded_by: SYSTEM_RECORDER_PROFILE_ID,
      source_provider: scrape.source_provider,
      source_url: match.source_url,
      external_match_id: match.external_match_id,
      tournament_name: scrape.tournament_name,
      tournament_event: scrape.tournament_event,
      round_name: match.round_name,
      court_number: match.court,
    })
    .select("id")
    .single();

  if (matchErr || !matchRow) {
    // Race against sibling ingest: another writer beat us to the same
    // (source_provider, external_match_id) via the partial unique
    // index (Sprint 6 migration 20260510160000). PostgreSQL surfaces
    // that as SQLSTATE 23505 (unique_violation) which supabase-js
    // exposes via error.code. Codex P1 fix on PR #29: original
    // version swallowed EVERY error as "duplicate" which masked
    // genuine failures (NOT NULL violations, FK violations, RLS
    // denies) under success-no-op semantics — the ingestion log
    // would mark status='success' with matches_imported=0 and the
    // admin Logs tab would have no signal that something went wrong.
    //
    // Resolution: only treat 23505 as a benign skip. Anything else
    // bubbles up so the surrounding try/catch flips the log to
    // status='failed' with the underlying error_message.
    const errCode = (matchErr as { code?: string } | null)?.code;
    if (errCode === "23505") {
      return false;
    }
    throw new Error(
      `Insert match ${match.external_match_id} failed: ${
        matchErr?.message ?? "no row returned (non-23505)"
      }`,
    );
  }

  const participants = [
    ...teamAIds.map((player_id, i) => ({
      match_id: matchRow.id,
      player_id,
      team: "a",
      position: i + 1,
    })),
    ...teamBIds.map((player_id, i) => ({
      match_id: matchRow.id,
      player_id,
      team: "b",
      position: i + 1,
    })),
  ];

  const { error: partErr } = await supabase
    .from("match_participants")
    .insert(participants);
  if (partErr) {
    // Insert participants failed — match row is orphan. Throw so the
    // surrounding try/catch logs status='failed' with the reason.
    throw new Error(
      `Insert participants for match ${matchRow.id} failed: ${partErr.message}`,
    );
  }
  return true;
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// Re-export type bag for the Worker (see _shared/pro-tour-types.ts).
export type {
  ScrapedTeam,
  TournamentScrapeResult,
  ScrapedMatch,
  ScrapedPlayer,
} from "../_shared/pro-tour-types.ts";
