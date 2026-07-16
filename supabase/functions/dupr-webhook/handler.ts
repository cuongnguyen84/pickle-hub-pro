// ============================================================================
// dupr-webhook core — Deno-free so it can be unit-tested under vitest.
// ----------------------------------------------------------------------------
// All side effects go through an injected WebhookStore + partnerFetch, so the
// full retry sequence (partner 500 → DUPR retries same payload → partner 200 →
// rating persisted) is exercisable without a live Deno/Supabase runtime.
//
// Retry contract with DUPR: DUPR retries on any non-2xx response. A TRANSIENT
// failure (partner API unreachable, our DB write failed) therefore must:
//   1. RELEASE the claim row (so the retry's identical event_key can re-insert
//      and re-process instead of dedup'ing to "duplicate_event"), and
//   2. return a non-2xx status so DUPR actually retries.
// A TERMINAL outcome (unknown event, unknown player, id mismatch) keeps the
// claim + returns 200 so DUPR stops — a retry could never succeed.
// ============================================================================

import { parseJsonObject, secretsMatch, sha256Hex } from "./security.ts";

const RATING_MIN = 2.0;
const RATING_MAX = 7.0;

export function parseRating(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < RATING_MIN || n > RATING_MAX) return null;
  return Math.round(n * 100) / 100;
}

export interface DuprUserDetail {
  status?: string;
  result?: {
    id?: string;
    ratings?: {
      singles?: number | string | null;
      doubles?: number | string | null;
    };
  };
}

interface RatingPayload {
  clientId?: string | number;
  event?: string;
  message?: { duprId?: string };
}

/** Result of claiming (inserting) the event row. */
export interface ClaimResult {
  /** Row id when the claim succeeded, else null. */
  id: number | null;
  /** True when the exact payload was already claimed (unique-key clash). */
  duplicate: boolean;
  /** Non-null when the insert failed for a reason other than duplicate. */
  error: string | null;
}

export interface PartnerFetchResult {
  ok: boolean;
  json(): Promise<unknown>;
}

/** Narrow persistence surface — real impl wraps supabase-js, tests fake it. */
export interface WebhookStore {
  claimEvent(input: {
    topic: string;
    duprId: string | null;
    clientFingerprint: string;
    eventKey: string;
    payload: Record<string, unknown>;
  }): Promise<ClaimResult>;
  /** Remove a claim so a retry can re-process (transient failure only). */
  releaseEvent(id: number): Promise<void>;
  markProcessed(id: number, nowIso: string, error?: string | null): Promise<void>;
  findActiveToken(duprId: string): Promise<{ user_id: string } | null>;
  updateProfile(
    userId: string,
    update: Record<string, unknown>,
  ): Promise<{ error: string | null }>;
  insertRatingHistory(input: {
    profileId: string;
    singles: number | null;
    doubles: number | null;
    recordedAt: string;
  }): Promise<{ error: string | null }>;
}

export interface WebhookDeps {
  store: WebhookStore;
  partnerFetch(path: string): Promise<PartnerFetchResult>;
  expectedClientKey: string;
  now(): string;
}

export interface WebhookResult {
  status: number;
  body: Record<string, unknown>;
}

const ok = (body: Record<string, unknown>): WebhookResult => ({ status: 200, body });

export async function processDuprWebhook(
  deps: WebhookDeps,
  rawBody: string,
): Promise<WebhookResult> {
  const parsed = parseJsonObject(rawBody);
  if (!parsed) return { status: 400, body: { error: "invalid_json" } };
  const payload = parsed as RatingPayload;

  if (!deps.expectedClientKey) {
    return { status: 503, body: { status: "error", reason: "server_misconfigured" } };
  }

  const incomingClientId = String(payload.clientId ?? "");
  const event = String(payload.event ?? "");
  const duprId = payload.message?.duprId ?? null;

  // clientId == the PUBLIC frontend key — a cheap spam filter, NOT auth.
  if (!secretsMatch(incomingClientId, deps.expectedClientKey)) {
    return { status: 401, body: { status: "ignored", reason: "client_key_mismatch" } };
  }

  const eventKey = await sha256Hex(rawBody);
  const clientFingerprint = (await sha256Hex(incomingClientId)).slice(0, 16);
  const claim = await deps.store.claimEvent({
    topic: event,
    duprId,
    clientFingerprint,
    eventKey,
    payload: { ...(payload as Record<string, unknown>), clientId: "[redacted]" },
  });

  if (claim.duplicate) return ok({ status: "ok", reason: "duplicate_event" });
  if (claim.error || claim.id === null) {
    return { status: 503, body: { status: "error", reason: "event_claim_failed" } };
  }
  const id = claim.id;
  const nowIso = deps.now();

  // Handshake events — ack but no-op.
  if (event === "REGISTRATION" || event === "RATING_SEED") {
    await deps.store.markProcessed(id, nowIso);
    return ok({ status: "ok", reason: `${event}_acknowledged` });
  }
  if (event !== "RATING") {
    await deps.store.markProcessed(id, nowIso, "unsupported_event");
    return ok({ status: "ignored", reason: "unsupported_event" });
  }
  if (!duprId) {
    await deps.store.markProcessed(id, nowIso, "missing_dupr_id");
    return ok({ status: "ignored", reason: "missing_dupr_id" });
  }

  const tokenRow = await deps.store.findActiveToken(duprId);
  if (!tokenRow) {
    await deps.store.markProcessed(id, nowIso, "user_not_found");
    return ok({ status: "ignored", reason: "user_not_found" });
  }

  // Pull the AUTHORITATIVE rating. A failure here is TRANSIENT — release the
  // claim and 503 so DUPR retries and the next attempt can persist.
  let detail: DuprUserDetail | null = null;
  try {
    const res = await deps.partnerFetch(`/user/v1.0/${duprId}`);
    detail = (await res.json().catch(() => null)) as DuprUserDetail | null;
    if (!res.ok || detail?.status !== "SUCCESS" || !detail.result?.id) {
      await deps.store.releaseEvent(id);
      return { status: 503, body: { status: "error", reason: "dupr_pull_failed" } };
    }
  } catch {
    await deps.store.releaseEvent(id);
    return { status: 503, body: { status: "error", reason: "dupr_pull_failed" } };
  }

  // A payload duprId that maps to a linked user but a DIFFERENT real account is
  // terminal — a retry can't fix it.
  if (String(detail.result.id).toUpperCase() !== String(duprId).toUpperCase()) {
    await deps.store.markProcessed(id, nowIso, "dupr_id_mismatch");
    return ok({ status: "ignored", reason: "dupr_id_mismatch" });
  }

  const singles = parseRating(detail.result.ratings?.singles);
  const doubles = parseRating(detail.result.ratings?.doubles);

  const profileUpdate: Record<string, unknown> = {
    dupr_synced_at: nowIso,
    dupr_last_error: null,
    dupr_last_attempt_at: nowIso,
  };
  if (singles !== null) profileUpdate.dupr_singles = singles;
  if (doubles !== null) profileUpdate.dupr_doubles = doubles;

  const profile = await deps.store.updateProfile(tokenRow.user_id, profileUpdate);
  if (profile.error) {
    // Our DB write failed — TRANSIENT. Release + 503 so the retry re-persists
    // (previously this ack'd 200 and the rating was lost for the event).
    await deps.store.releaseEvent(id);
    return { status: 503, body: { status: "error", reason: "profile_update_failed" } };
  }

  if (singles !== null || doubles !== null) {
    const history = await deps.store.insertRatingHistory({
      profileId: tokenRow.user_id,
      singles,
      doubles,
      recordedAt: nowIso,
    });
    if (history.error) {
      // History is best-effort telemetry; the profile is already updated, so a
      // retry would double-persist. Ack.
      console.warn("dupr_rating_history insert failed:", history.error);
    }
  }

  await deps.store.markProcessed(id, nowIso);
  return ok({ status: "ok", dupr_id: duprId, singles, doubles });
}
