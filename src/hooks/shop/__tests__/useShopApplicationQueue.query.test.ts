/**
 * The admin application queue, as a query rather than as a screen.
 *
 * Three ways this list quietly misleads a moderator, none of them visible in a
 * screenshot:
 *   * sorting newest-first, so the person who has waited three days stays at
 *     the bottom of the queue forever;
 *   * an "all" filter that still sends a status, or a status filter that does
 *     not send one — either way the queue shows the wrong rows;
 *   * an RLS refusal swallowed into an empty list, which reads as "no hồ sơ"
 *     when it means "you are not allowed to see them".
 *
 * Same shape as useSellerProducts.query.test.ts: react-query is doubled so the
 * hooks are plain builders of options, and the data layer is a recorder.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Call {
  method: string;
  args: unknown[];
}

const calls: Call[] = [];
const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
const invalidateQueries = vi.fn();
let response: { data: unknown; error: unknown } = { data: [], error: null };

vi.mock("@/integrations/supabase/shop-client", () => {
  const record = (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return chain;
    };
  const chain = {
    select: record("select"),
    eq: record("eq"),
    order: record("order"),
    maybeSingle: () => Promise.resolve(response),
    then: (ok: (v: unknown) => unknown, fail?: (e: unknown) => unknown) =>
      Promise.resolve(response).then(ok, fail),
  };
  return {
    shopFrom: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return chain;
    },
    shopRpc: async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return "shop-1";
    },
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => options,
  useMutation: (options: unknown) => options,
  useQueryClient: () => ({ invalidateQueries }),
}));

const { useDecideApplication, useShopApplication, useShopApplicationQueue } = await import(
  "../useShopApplicationQueue"
);

type QueryOptions = { queryKey: unknown[]; enabled?: boolean; queryFn: () => Promise<unknown> };

const buildQueue = useShopApplicationQueue as unknown as (
  status: Parameters<typeof useShopApplicationQueue>[0],
) => QueryOptions;
const buildOne = useShopApplication as unknown as (id: string | null) => QueryOptions;
const buildDecide = useDecideApplication as unknown as () => {
  mutationFn: (p: Record<string, unknown>) => Promise<unknown>;
  onSuccess: () => void;
};

const find = (method: string) => calls.filter((c) => c.method === method);

beforeEach(() => {
  calls.length = 0;
  rpcCalls.length = 0;
  invalidateQueries.mockReset();
  response = { data: [], error: null };
});

describe("the application queue", () => {
  it("puts the longest wait first, and rows that never submitted last", async () => {
    await buildQueue("all").queryFn();

    expect(find("from")[0].args).toEqual(["shop_applications_admin"]);
    expect(find("order")[0].args).toEqual([
      "submitted_at",
      { ascending: true, nullsFirst: false },
    ]);
  });

  it("sends no status filter for 'all', and exactly one otherwise", async () => {
    await buildQueue("all").queryFn();
    expect(find("eq")).toHaveLength(0);

    calls.length = 0;
    await buildQueue("under_review").queryFn();
    expect(find("eq")[0].args).toEqual(["status", "under_review"]);
  });

  it("throws on an RLS refusal instead of showing an empty queue", async () => {
    // "Không có hồ sơ nào" and "anh không được xem hồ sơ nào" look identical on
    // screen; only one of them means there is nothing to do.
    response = { data: null, error: { code: "42501", message: "permission denied" } };
    await expect(buildQueue("all").queryFn()).rejects.toBeTruthy();
  });

  it("answers with a list, not null, when the table returns nothing", async () => {
    response = { data: null, error: null };
    await expect(buildQueue("all").queryFn()).resolves.toEqual([]);
  });
});

describe("one application", () => {
  it("does not read anything until there is an id", () => {
    expect(buildOne(null).enabled).toBe(false);
    expect(buildOne("app-1").enabled).toBe(true);
  });

  it("throws on an error rather than reading as 'hồ sơ không tồn tại'", async () => {
    // The page renders "Không tìm thấy hồ sơ này" for a null row — so an error
    // resolved to null would accuse the applicant of not existing.
    response = { data: null, error: { message: "boom" } };
    await expect(buildOne("app-1").queryFn()).rejects.toBeTruthy();
  });
});

describe("deciding an application", () => {
  it("sends empty notes as NULL and the picked fields as they are", async () => {
    await buildDecide().mutationFn({
      applicationId: "app-1",
      decision: "approve",
      applicantNote: "",
      internalNote: "",
      requestedFields: [],
    });

    expect(rpcCalls[0].fn).toBe("shop_application_decide");
    // '' would be stored as a note the moderator never wrote, and the applicant
    // would receive an empty message.
    expect(rpcCalls[0].args._applicant_note).toBeNull();
    expect(rpcCalls[0].args._internal_note).toBeNull();
    expect(rpcCalls[0].args._requested_fields).toEqual([]);
  });

  it("keeps the note the applicant is going to read, word for word", async () => {
    await buildDecide().mutationFn({
      applicationId: "app-1",
      decision: "request-changes",
      applicantNote: "Ảnh giấy phép bị mờ, chụp lại giúp em",
      internalNote: "gọi rồi",
      requestedFields: ["shop_name", "phone"],
    });

    expect(rpcCalls[0].args._applicant_note).toBe("Ảnh giấy phép bị mờ, chụp lại giúp em");
    expect(rpcCalls[0].args._requested_fields).toEqual(["shop_name", "phone"]);
  });

  it("invalidates the queue after a decision, so the counts are not stale", () => {
    buildDecide().onSuccess();
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["shop", "admin", "applications"],
    });
  });
});
