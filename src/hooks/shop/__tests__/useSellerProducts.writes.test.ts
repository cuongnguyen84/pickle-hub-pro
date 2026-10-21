/**
 * The detail query and the write hooks, run without React.
 *
 * Same recording-stub approach as useSellerProducts.query.test.ts: with
 * react-query mocked to hand back its options, each hook is a plain builder
 * and its queryFn / mutationFn / onSuccess are plain functions. What matters:
 *   * the detail query drops retired variants and orders by position — the
 *     matrix editor must never see a row the seller retired;
 *   * every write hits the RPC it says it does, with the ids it was given;
 *   * every write invalidates the list, or the catalog screen shows stale rows.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Call {
  method: string;
  args: unknown[];
}

const calls: Call[] = [];
let response: { data: unknown[]; error: unknown } = { data: [], error: null };
let rpcResponse: { data: unknown; error: unknown } = { data: null, error: null };

const builder = () => {
  const record = (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return chain;
    };
  const chain = {
    select: record("select"),
    eq: record("eq"),
    limit: record("limit"),
    then: (resolve: (value: typeof response) => unknown) => Promise.resolve(response).then(resolve),
  };
  return chain;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return builder();
    },
    rpc: (fn: string, args: unknown) => {
      calls.push({ method: "rpc", args: [fn, args] });
      return Promise.resolve(rpcResponse);
    },
  },
}));

const invalidated: unknown[] = [];
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => options,
  useMutation: (options: unknown) => options,
  useQueryClient: () => ({
    invalidateQueries: (arg: unknown) => {
      invalidated.push(arg);
    },
    setQueryData: () => {},
  }),
}));

const {
  productKeys,
  useArchiveProduct,
  useCreateProduct,
  useDeleteProducts,
  useProductStatusCounts,
  useSellerProduct,
  useUpdateProductSlug,
} = await import("../useSellerProducts");

type QueryOpts<T> = { queryFn: () => Promise<T>; enabled: boolean };
type MutationOpts<TInput, TOut> = {
  mutationFn: (input: TInput) => Promise<TOut>;
  onSuccess: (data: TOut, input: TInput) => void;
};

const rpc = () => calls.filter((c) => c.method === "rpc");

beforeEach(() => {
  calls.length = 0;
  invalidated.length = 0;
  response = { data: [], error: null };
  rpcResponse = { data: null, error: null };
});

describe("useProductStatusCounts", () => {
  it("asks product_status_counts for the shop and defaults to {} when the RPC returns nothing", async () => {
    const q = useProductStatusCounts("shop-1") as unknown as QueryOpts<Record<string, number>>;
    expect(q.enabled).toBe(true);
    expect(await q.queryFn()).toEqual({});
    expect(rpc()[0]?.args).toEqual(["product_status_counts", { _shop_id: "shop-1" }]);
  });

  it("is disabled without a shop", () => {
    const q = useProductStatusCounts(null) as unknown as QueryOpts<unknown>;
    expect(q.enabled).toBe(false);
  });
});

describe("useSellerProduct", () => {
  // Aliased away from its `use` name: outside React it is a plain builder,
  // and rules-of-hooks should not read this helper as a component.
  const buildDetailQuery = useSellerProduct as unknown as (id: string) => unknown;
  const detail = () => buildDetailQuery("p-1") as QueryOpts<{
    id: string;
    variants: { id: string; position: number }[];
    media: { id: string; position: number }[];
    mediaCount: number;
  } | null>;

  it("drops retired variants and sorts the rest by position", async () => {
    response = {
      data: [
        {
          id: "p-1",
          name: "Vợt",
          product_variants: [
            { id: "v-late", position: 2, retired_at: null },
            { id: "v-retired", position: 0, retired_at: "2026-08-01" },
            { id: "v-first", position: 1, retired_at: null },
          ],
          product_media: [
            { id: "m-2", position: 2 },
            { id: "m-1", position: 1 },
          ],
        },
      ],
      error: null,
    };
    const row = await detail().queryFn();
    expect(row?.variants.map((v) => v.id)).toEqual(["v-first", "v-late"]);
    expect(row?.media.map((m) => m.id)).toEqual(["m-1", "m-2"]);
    expect(row?.mediaCount).toBe(2);
    expect(row).not.toHaveProperty("product_variants");
    expect(calls.find((c) => c.method === "eq")?.args).toEqual(["id", "p-1"]);
  });

  it("returns null for an unknown product and throws the query error", async () => {
    expect(await detail().queryFn()).toBeNull();
    response = { data: [], error: new Error("boom") };
    await expect(detail().queryFn()).rejects.toThrow("boom");
  });
});

describe("write hooks", () => {
  it("useCreateProduct gửi compare_at_price_vnd là null khi ô trống, số khi có", async () => {
    const draft = {
      title: "Vợt", description: "", category_slug: "vot", condition: "new" as const, specs: {},
      price_vnd: "1000000", compare_at_price_vnd: "", stock_on_hand: "",
    };
    const m = useCreateProduct("shop-1") as unknown as MutationOpts<{ clientToken: string; draft: typeof draft }, unknown>;
    await m.mutationFn({ clientToken: "tok", draft });
    await m.mutationFn({ clientToken: "tok", draft: { ...draft, compare_at_price_vnd: " 1250000 " } });
    const payloads = rpc().map((c) => (c.args[1] as { _payload: { compare_at_price_vnd: unknown } })._payload.compare_at_price_vnd);
    expect(payloads).toEqual([null, 1250000]);
  });

  it("useUpdateProductSlug calls product_slug_update and invalidates detail + list", async () => {
    rpcResponse = { data: "vot-moi", error: null };
    const m = useUpdateProductSlug("p-1") as unknown as MutationOpts<string, string>;
    expect(await m.mutationFn("vot-moi")).toBe("vot-moi");
    expect(rpc()[0]?.args).toEqual(["product_slug_update", { _product_id: "p-1", _slug: "vot-moi" }]);
    m.onSuccess("vot-moi", "vot-moi");
    expect(invalidated).toEqual([{ queryKey: productKeys.one("p-1") }, { queryKey: productKeys.all }]);
  });

  it("useArchiveProduct picks archive vs unarchive from the flag", async () => {
    const m = useArchiveProduct() as unknown as MutationOpts<{ productId: string; archived: boolean }, string>;
    await m.mutationFn({ productId: "p-1", archived: false });
    await m.mutationFn({ productId: "p-2", archived: true });
    expect(rpc().map((c) => c.args)).toEqual([
      ["product_archive", { _product_id: "p-1" }],
      ["product_unarchive", { _product_id: "p-2" }],
    ]);
    m.onSuccess("ok", { productId: "p-1", archived: false });
    expect(invalidated[0]).toEqual({ queryKey: productKeys.one("p-1") });
  });

  it("useDeleteProducts sends every id in one RPC and refreshes the list", async () => {
    rpcResponse = { data: ["p-1", "p-2"], error: null };
    const m = useDeleteProducts() as unknown as MutationOpts<string[], string[]>;
    expect(await m.mutationFn(["p-1", "p-2"])).toEqual(["p-1", "p-2"]);
    expect(rpc()[0]?.args).toEqual(["products_delete", { _product_ids: ["p-1", "p-2"] }]);
    m.onSuccess(["p-1", "p-2"], ["p-1", "p-2"]);
    expect(invalidated).toEqual([{ queryKey: productKeys.all }]);
  });

  it("surfaces the RPC error instead of swallowing it", async () => {
    rpcResponse = { data: null, error: { message: "42501" } };
    const m = useDeleteProducts() as unknown as MutationOpts<string[], string[]>;
    await expect(m.mutationFn(["p-1"])).rejects.toEqual({ message: "42501" });
  });
});
