/**
 * What the moderation screens actually send, and what they invalidate after.
 *
 * The queue and the contact channels are RPCs with positional-looking named
 * arguments, and every one of them has a way to go wrong that looks fine on
 * screen:
 *   * a filter that is not sent at all shows another shop's rows;
 *   * an empty note stored as '' instead of NULL turns "no note" into a note;
 *   * a client token regenerated per attempt makes a retry a second decision;
 *   * a decision that does not invalidate the namespace leaves a moderator
 *     looking at counts that already moved.
 *
 * Same shape as useSellerProducts.query.test.ts: react-query is doubled so the
 * hooks are plain builders of options, and the RPC layer is a recorder.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
const invalidateQueries = vi.fn();

vi.mock("@/integrations/supabase/shop-client", () => ({
  shopRpc: async (fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args });
    return null;
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => options,
  useMutation: (options: unknown) => options,
  useQueryClient: () => ({ invalidateQueries }),
}));

const {
  useContactHistory,
  useContactQueue,
  useDecideContact,
  useModerationQueue,
} = await import("../useProductModeration");

/** The hooks are option builders here, not hooks — aliased so eslint's
 *  rules-of-hooks does not read these helpers as components. */
type QueryOptions = { queryKey: unknown[]; enabled?: boolean; queryFn: () => Promise<unknown> };
type MutationOptions<T> = { mutationFn: (p: T) => Promise<unknown>; onSuccess: () => void };

const buildQueue = useModerationQueue as unknown as (
  f: Parameters<typeof useModerationQueue>[0],
) => QueryOptions;
const buildContactQueue = useContactQueue as unknown as (
  state: Parameters<typeof useContactQueue>[0],
) => QueryOptions;
const buildContactHistory = useContactHistory as unknown as (id: string | null) => QueryOptions;
const buildDecideContact = useDecideContact as unknown as () => MutationOptions<
  Parameters<ReturnType<typeof useDecideContact>["mutate"]>[0]
>;

beforeEach(() => {
  calls.length = 0;
  invalidateQueries.mockReset();
});

describe("the product moderation queue", () => {
  it("sends every filter it was given, and a page size the server can cap", async () => {
    await buildQueue({
      status: "pending_review",
      shopId: "shop-1",
      categorySlug: "vot",
      cursorAt: "2026-08-17T00:00:00Z",
      cursorId: "prod-9",
    }).queryFn();

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      fn: "product_moderation_queue",
      args: {
        _status: "pending_review",
        _shop_id: "shop-1",
        _category_slug: "vot",
        _cursor_at: "2026-08-17T00:00:00Z",
        _cursor_id: "prod-9",
        _limit: 25,
      },
    });
  });

  it("sends an absent filter as null, never as undefined", async () => {
    // An argument PostgREST does not receive falls back to the RPC's default,
    // which for _shop_id is "every shop" — the opposite of an empty filter.
    await buildQueue({ status: "needs_changes" }).queryFn();

    const args = calls[0].args;
    expect(args._shop_id).toBeNull();
    expect(args._category_slug).toBeNull();
    expect(args._cursor_at).toBeNull();
    expect(Object.values(args).every((v) => v !== undefined)).toBe(true);
  });

  it("keys the cache by the filters, so a status change is not a cache hit", () => {
    const a = buildQueue({ status: "pending_review" }).queryKey;
    const b = buildQueue({ status: "rejected" }).queryKey;
    expect(a).not.toEqual(b);
  });
});

describe("contact channel moderation", () => {
  it("asks for one state at a time", async () => {
    await buildContactQueue("pending_review").queryFn();
    expect(calls[0]).toEqual({
      fn: "shop_contact_moderation_queue",
      args: { _state: "pending_review" },
    });
  });

  it("does not ask for the history of no channel", async () => {
    expect(buildContactHistory(null).enabled).toBe(false);
    expect(buildContactHistory("ch-1").enabled).toBe(true);

    await buildContactHistory("ch-1").queryFn();
    expect(calls[0]).toEqual({
      fn: "shop_contact_moderation_history",
      args: { _channel_id: "ch-1" },
    });
  });

  it("stores an empty note as NULL, and passes the attempt's token through", async () => {
    const decide = buildDecideContact();
    await decide.mutationFn({
      channelId: "ch-1",
      decision: "approve",
      expectedVersion: 3,
      note: "",
      internalNote: "  ",
      clientToken: "tok-abc",
    });

    expect(calls[0].fn).toBe("shop_contact_decide");
    // '' is a note the seller never wrote; NULL is the absence of one.
    expect(calls[0].args._note).toBeNull();
    expect(calls[0].args._expected_version).toBe(3);
    // The token IS the idempotency key: a new one per retry decides twice.
    expect(calls[0].args._client_token).toBe("tok-abc");
  });

  it("keeps a note that was written", async () => {
    await buildDecideContact().mutationFn({
      channelId: "ch-1",
      decision: "reject",
      expectedVersion: 1,
      note: "Số này không gọi được",
      internalNote: "gọi 2 lần",
      clientToken: "tok-1",
    });

    expect(calls[0].args._note).toBe("Số này không gọi được");
    expect(calls[0].args._internal_note).toBe("gọi 2 lần");
  });

  it("invalidates the whole moderation namespace after a decision", () => {
    // The decision changes the row, the counts and the history. A screen
    // holding two of the three is how a moderator decides the same thing twice.
    buildDecideContact().onSuccess();

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["shop", "admin", "moderation"] });
  });
});
