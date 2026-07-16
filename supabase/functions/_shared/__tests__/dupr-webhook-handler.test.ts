import { describe, it, expect, beforeEach } from "vitest";
import {
  processDuprWebhook,
  type WebhookStore,
  type WebhookDeps,
  type PartnerFetchResult,
} from "../../dupr-webhook/handler.ts";
import { sha256Hex } from "../../dupr-webhook/security.ts";

// In-memory WebhookStore that enforces the same unique-event-key constraint as
// the production dupr_webhook_events table, so retries of an identical payload
// dedup exactly like Postgres would.
class FakeStore implements WebhookStore {
  private rowsByKey = new Map<string, { id: number; processedAt: string | null; error: string | null }>();
  private keyById = new Map<number, string>();
  private seq = 0;

  token: { user_id: string } | null = { user_id: "user-1" };
  profileError: string | null = null;
  historyError: string | null = null;
  profileUpdates: Array<{ userId: string; update: Record<string, unknown> }> = [];
  historyInserts: Array<{ profileId: string; singles: number | null; doubles: number | null }> = [];

  claimEvent(input: { eventKey: string }) {
    if (this.rowsByKey.has(input.eventKey)) {
      return Promise.resolve({ id: null, duplicate: true, error: null });
    }
    const id = ++this.seq;
    this.rowsByKey.set(input.eventKey, { id, processedAt: null, error: null });
    this.keyById.set(id, input.eventKey);
    return Promise.resolve({ id, duplicate: false, error: null });
  }
  releaseEvent(id: number) {
    const key = this.keyById.get(id);
    if (key) {
      this.rowsByKey.delete(key);
      this.keyById.delete(id);
    }
    return Promise.resolve();
  }
  markProcessed(id: number, nowIso: string, error: string | null = null) {
    const key = this.keyById.get(id);
    if (key) Object.assign(this.rowsByKey.get(key)!, { processedAt: nowIso, error });
    return Promise.resolve();
  }
  findActiveToken() {
    return Promise.resolve(this.token);
  }
  updateProfile(userId: string, update: Record<string, unknown>) {
    if (this.profileError) return Promise.resolve({ error: this.profileError });
    this.profileUpdates.push({ userId, update });
    return Promise.resolve({ error: null });
  }
  insertRatingHistory(input: { profileId: string; singles: number | null; doubles: number | null; recordedAt: string }) {
    if (this.historyError) return Promise.resolve({ error: this.historyError });
    this.historyInserts.push({ profileId: input.profileId, singles: input.singles, doubles: input.doubles });
    return Promise.resolve({ error: null });
  }

  /** Test helper — is this payload still claimed (would a retry dedup)? */
  isClaimed(eventKey: string) {
    return this.rowsByKey.has(eventKey);
  }
}

const KEY = "test-client-key";
const RATING_BODY = JSON.stringify({
  clientId: KEY,
  event: "RATING",
  timestamp: "1778953113",
  message: { duprId: "ABC123", name: "Player" },
});

const partnerFail = (): Promise<PartnerFetchResult> => Promise.reject(new Error("boom"));
const partner500 = (): Promise<PartnerFetchResult> =>
  Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
const partnerOk = (singles = "4.0", doubles = "4.2"): (() => Promise<PartnerFetchResult>) => () =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ status: "SUCCESS", result: { id: "ABC123", ratings: { singles, doubles } } }),
  });

function deps(store: FakeStore, partnerFetch: () => Promise<PartnerFetchResult>): WebhookDeps {
  return { store, partnerFetch, expectedClientKey: KEY, now: () => "2026-07-16T00:00:00.000Z" };
}

describe("processDuprWebhook — transient failure is retryable", () => {
  let store: FakeStore;
  beforeEach(() => {
    store = new FakeStore();
  });

  it("partner 500 → retry same event → partner 200 → rating persisted", async () => {
    // 1. Partner API fails. Must 503 (so DUPR retries) and NOT persist.
    const first = await processDuprWebhook(deps(store, partner500), RATING_BODY);
    expect(first.status).toBe(503);
    expect(first.body.reason).toBe("dupr_pull_failed");
    expect(store.profileUpdates).toHaveLength(0);

    // 2. The claim must be RELEASED so the identical retry can re-process
    //    instead of dedup'ing to "duplicate_event".
    expect(store.isClaimed(await sha256Hex(RATING_BODY))).toBe(false);

    // 3. DUPR retries the identical payload; partner now succeeds.
    const second = await processDuprWebhook(deps(store, partnerOk()), RATING_BODY);
    expect(second.status).toBe(200);
    expect(second.body.status).toBe("ok");
    expect(store.profileUpdates).toHaveLength(1);
    expect(store.profileUpdates[0].update.dupr_singles).toBe(4.0);
    expect(store.profileUpdates[0].update.dupr_doubles).toBe(4.2);
    expect(store.historyInserts).toHaveLength(1);
  });

  it("also releases on a thrown partner error", async () => {
    const r = await processDuprWebhook(deps(store, partnerFail), RATING_BODY);
    expect(r.status).toBe(503);
    const retry = await processDuprWebhook(deps(store, partnerOk()), RATING_BODY);
    expect(retry.body.status).toBe("ok");
    expect(store.profileUpdates).toHaveLength(1);
  });

  it("releases + 503 when the profile write fails, then persists on retry", async () => {
    store.profileError = "db down";
    const first = await processDuprWebhook(deps(store, partnerOk()), RATING_BODY);
    expect(first.status).toBe(503);
    expect(first.body.reason).toBe("profile_update_failed");
    expect(store.profileUpdates).toHaveLength(0);

    store.profileError = null;
    const second = await processDuprWebhook(deps(store, partnerOk()), RATING_BODY);
    expect(second.status).toBe(200);
    expect(store.profileUpdates).toHaveLength(1);
  });

  it("a successfully-processed event dedups (duplicate_event), no double persist", async () => {
    const first = await processDuprWebhook(deps(store, partnerOk()), RATING_BODY);
    expect(first.body.status).toBe("ok");
    const dup = await processDuprWebhook(deps(store, partnerOk()), RATING_BODY);
    expect(dup.body.reason).toBe("duplicate_event");
    expect(store.profileUpdates).toHaveLength(1); // not re-persisted
    expect(store.historyInserts).toHaveLength(1);
  });
});

describe("processDuprWebhook — terminal outcomes ack (200) and keep the claim", () => {
  let store: FakeStore;
  beforeEach(() => {
    store = new FakeStore();
  });

  it("rejects a client_key mismatch without claiming", async () => {
    const r = await processDuprWebhook(
      { store, partnerFetch: partnerOk(), expectedClientKey: "other", now: () => "t" },
      RATING_BODY,
    );
    expect(r.status).toBe(401);
    expect(r.body.reason).toBe("client_key_mismatch");
  });

  it("acks + keeps the claim for an unknown player (retry can't help)", async () => {
    store.token = null;
    const eventKey = await sha256Hex(RATING_BODY);
    const r = await processDuprWebhook(deps(store, partnerOk()), RATING_BODY);
    expect(r.status).toBe(200);
    expect(r.body.reason).toBe("user_not_found");
    expect(store.isClaimed(eventKey)).toBe(true); // still claimed → dedups
  });

  it("acks + keeps the claim on a real-account id mismatch", async () => {
    const mismatch = () =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: "SUCCESS", result: { id: "DIFFERENT", ratings: {} } }),
      });
    const r = await processDuprWebhook(deps(store, mismatch), RATING_BODY);
    expect(r.status).toBe(200);
    expect(r.body.reason).toBe("dupr_id_mismatch");
    expect(store.profileUpdates).toHaveLength(0);
  });
});
