import { describe, it, expect } from "vitest";
import {
  processPush,
  TOKEN_PAGE_SIZE,
  type FcmSendResult,
  type PushStore,
  type PushTokenRow,
} from "../../send-push-notification/handler.ts";

// In-memory PushStore that enforces the same range() paging contract as
// PostgREST (never returns more than the requested window), so broadcasts
// larger than the 1000-row cap are exercised for real.
class FakeStore implements PushStore {
  rows: PushTokenRow[] = [];
  deleted: string[] = [];
  fetchError: string | null = null;
  deleteError: string | null = null;
  pageCalls = 0;

  fetchTokensPage(userIds: string[] | null, from: number, to: number) {
    this.pageCalls++;
    if (this.fetchError) {
      return Promise.resolve({ rows: [], error: this.fetchError });
    }
    const filtered = userIds
      ? this.rows.filter((r) => userIds.includes(r.user_id))
      : this.rows;
    return Promise.resolve({ rows: filtered.slice(from, to + 1), error: null });
  }

  deleteTokens(ids: string[]) {
    if (this.deleteError) return Promise.resolve({ error: this.deleteError });
    this.deleted.push(...ids);
    this.rows = this.rows.filter((r) => !ids.includes(r.id));
    return Promise.resolve({ error: null });
  }
}

function seed(store: FakeStore, count: number, userPrefix = "user") {
  for (let i = 0; i < count; i++) {
    store.rows.push({
      id: `id-${i}`,
      user_id: `${userPrefix}-${i % 3}`,
      token: `tok-${i}`,
    });
  }
}

const okSend = () => Promise.resolve<FcmSendResult>({ ok: true });

describe("processPush", () => {
  it("rejects a request with no title or no target", async () => {
    const store = new FakeStore();
    expect((await processPush({ user_ids: ["u"] }, store, okSend)).status).toBe(400);
    expect((await processPush({ title: "t" }, store, okSend)).status).toBe(400);
    expect((await processPush({ title: "t", user_ids: [] }, store, okSend)).status).toBe(400);
  });

  it("broadcast pages past the PostgREST 1000-row cap", async () => {
    const store = new FakeStore();
    seed(store, TOKEN_PAGE_SIZE + 5);

    let sends = 0;
    const result = await processPush(
      { broadcast: true, title: "t", body: "b" },
      store,
      () => {
        sends++;
        return Promise.resolve({ ok: true });
      },
    );

    expect(result.status).toBe(200);
    expect(result.body.sent).toBe(TOKEN_PAGE_SIZE + 5);
    expect(sends).toBe(TOKEN_PAGE_SIZE + 5);
    expect(store.pageCalls).toBe(2);
  });

  it("dry_run returns counts without sending", async () => {
    const store = new FakeStore();
    seed(store, 7); // 7 tokens across 3 users

    let sends = 0;
    const result = await processPush(
      { broadcast: true, dry_run: true, title: "t" },
      store,
      () => {
        sends++;
        return Promise.resolve({ ok: true });
      },
    );

    expect(result.body).toEqual({ dry_run: true, total_tokens: 7, total_users: 3 });
    expect(sends).toBe(0);
  });

  it("user_ids path only targets the requested users", async () => {
    const store = new FakeStore();
    seed(store, 9); // user-0..user-2, 3 tokens each

    const sentTokens: string[] = [];
    const result = await processPush(
      { user_ids: ["user-1"], title: "t" },
      store,
      (token) => {
        sentTokens.push(token);
        return Promise.resolve({ ok: true });
      },
    );

    expect(result.body.sent).toBe(3);
    expect(sentTokens).toEqual(["tok-1", "tok-4", "tok-7"]);
  });

  it("prunes only tokens FCM reports as unregistered", async () => {
    const store = new FakeStore();
    seed(store, 4);

    const result = await processPush(
      { broadcast: true, title: "t" },
      store,
      (token) => {
        if (token === "tok-1") {
          return Promise.resolve({ ok: false, unregistered: true, message: "UNREGISTERED" });
        }
        if (token === "tok-2") {
          return Promise.resolve({ ok: false, unregistered: false, message: "quota" });
        }
        return Promise.resolve({ ok: true });
      },
    );

    expect(result.body.sent).toBe(2);
    expect(result.body.pruned).toBe(1);
    expect(store.deleted).toEqual(["id-1"]);
    expect(result.body.errors).toHaveLength(2);
  });

  it("a rejected send is counted as an error, not a crash", async () => {
    const store = new FakeStore();
    seed(store, 2);

    const result = await processPush(
      { broadcast: true, title: "t" },
      store,
      (token) =>
        token === "tok-0"
          ? Promise.reject(new Error("network down"))
          : Promise.resolve({ ok: true }),
    );

    expect(result.status).toBe(200);
    expect(result.body.sent).toBe(1);
    expect(result.body.errors).toEqual(["Token tok-0...: network down"]);
    expect(store.deleted).toEqual([]);
  });

  it("surfaces a fetch failure as 500", async () => {
    const store = new FakeStore();
    store.fetchError = "boom";
    const result = await processPush({ broadcast: true, title: "t" }, store, okSend);
    expect(result.status).toBe(500);
  });

  it("reports a failed prune without losing the send result", async () => {
    const store = new FakeStore();
    seed(store, 1);
    store.deleteError = "rls";

    const result = await processPush(
      { broadcast: true, title: "t" },
      store,
      () => Promise.resolve({ ok: false, unregistered: true, message: "UNREGISTERED" }),
    );

    expect(result.body.pruned).toBe(0);
    expect(result.body.errors).toContain("Prune failed: rls");
  });
});
