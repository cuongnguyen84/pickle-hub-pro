/**
 * What the list query actually sends.
 *
 * These are the four ways a catalog list quietly lies, all of which are
 * invisible in a screenshot:
 *   * counting the page instead of the catalog;
 *   * sorting after the page arrives, so the important row stays on page 4;
 *   * paging with the wrong offset, so a row is shown twice or never;
 *   * dropping the seller's `%` into a LIKE pattern as a wildcard.
 *
 * So the query is built against a recording stub and inspected, rather than
 * trusted because the screen looked right with eight products in it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Call {
  method: string;
  args: unknown[];
}

const calls: Call[] = [];
let response: { data: unknown[]; error: unknown; count: number | null } = {
  data: [],
  error: null,
  count: 0,
};

const builder = () => {
  const record = (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return chain;
    };
  const chain = {
    select: record("select"),
    eq: record("eq"),
    neq: record("neq"),
    in: record("in"),
    ilike: record("ilike"),
    order: record("order"),
    limit: record("limit"),
    range: record("range"),
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
      return Promise.resolve({ data: { draft: 2 }, error: null });
    },
  },
}));

const { escapeLike } = await import("@/integrations/supabase/shop-client");
const { EMPTY_FILTERS, PAGE_SIZE, PRODUCT_SORTS, useSellerProducts, hasActiveFilter } =
  await import("../useSellerProducts");

/**
 * Run the hook's queryFn without React.
 *
 * With useQuery mocked to return its argument, the hook is a plain builder of
 * query options and its queryFn is a plain async function — which is the part
 * under test. Aliased away from its `use` name so eslint's rules-of-hooks does
 * not read this helper as a component calling a hook, which it is not.
 */
const buildListQuery = useSellerProducts as unknown as (
  shopId: string,
  filters: Parameters<typeof useSellerProducts>[1],
) => { queryFn: () => Promise<unknown> };

const runQuery = async (filters: Parameters<typeof useSellerProducts>[1]) =>
  await buildListQuery("shop-1", filters).queryFn();

vi.mock("@tanstack/react-query", () => ({
  // The hook is only used here as a builder of query options; returning them
  // verbatim keeps the test free of a QueryClient and a renderer.
  useQuery: (options: unknown) => options,
  useMutation: (options: unknown) => options,
  useQueryClient: () => ({ invalidateQueries: () => {}, setQueryData: () => {} }),
}));

const find = (method: string) => calls.filter((c) => c.method === method);

beforeEach(() => {
  calls.length = 0;
  response = { data: [], error: null, count: 0 };
});

describe("escapeLike", () => {
  it("makes a wildcard a literal — a search for 50% is a search for 50%", () => {
    expect(escapeLike("50%")).toBe("50\\%");
    expect(escapeLike("a_b")).toBe("a\\_b");
  });

  it("escapes the backslash first, or it escapes the escapes", () => {
    expect(escapeLike("a\\%")).toBe("a\\\\\\%");
  });

  it("leaves ordinary Vietnamese text alone", () => {
    expect(escapeLike("Vợt carbon T700")).toBe("Vợt carbon T700");
  });
});

describe("the list query", () => {
  it("asks the database for the total, not the page length", async () => {
    response = { data: [{ id: "1" }], error: null, count: 137 };
    const result = (await runQuery(EMPTY_FILTERS)) as { total: number; rows: unknown[] };

    const select = find("select")[0];
    expect(select.args[1]).toMatchObject({ count: "exact" });
    // 137 total from one row of data: proof the number is not len(rows).
    expect(result.total).toBe(137);
    expect(result.rows).toHaveLength(1);
  });

  it("scopes to the shop before anything else", async () => {
    await runQuery(EMPTY_FILTERS);
    expect(find("eq")[0].args).toEqual(["shop_id", "shop-1"]);
  });

  it("sorts in Postgres, with a tiebreaker so pages do not overlap", async () => {
    await runQuery(EMPTY_FILTERS);
    const orders = find("order");
    expect(orders[0].args[0]).toBe(PRODUCT_SORTS.action.column);
    // Without the second key, two rows sharing an action_rank can swap between
    // page 1 and page 2 — one shown twice, one never.
    expect(orders[1].args[0]).toBe("id");
  });

  it("pages with an inclusive range that matches the page size", async () => {
    await runQuery({ ...EMPTY_FILTERS, page: 2 });
    expect(find("range")[0].args).toEqual([2 * PAGE_SIZE, 2 * PAGE_SIZE + PAGE_SIZE - 1]);
  });

  it("escapes the seller's search before it becomes a pattern", async () => {
    await runQuery({ ...EMPTY_FILTERS, search: "giảm 50%" });
    expect(find("ilike")[0].args).toEqual(["title", "%giảm 50\\%%"]);
  });

  it("sends no search filter at all for whitespace", async () => {
    await runQuery({ ...EMPTY_FILTERS, search: "   " });
    expect(find("ilike")).toHaveLength(0);
  });

  it("only filters by status and category when one is chosen", async () => {
    await runQuery(EMPTY_FILTERS);
    expect(find("eq")).toHaveLength(1);

    calls.length = 0;
    await runQuery({ ...EMPTY_FILTERS, status: "needs_changes", category: "vot" });
    const eqs = find("eq").map((c) => c.args);
    expect(eqs).toContainEqual(["status", "needs_changes"]);
    expect(eqs).toContainEqual(["category_slug", "vot"]);
  });

  it("computes the page count from the total, not from what arrived", async () => {
    response = { data: [{ id: "1" }], error: null, count: 41 };
    const result = (await runQuery(EMPTY_FILTERS)) as { pageCount: number };
    expect(result.pageCount).toBe(Math.ceil(41 / PAGE_SIZE));
  });

  it("throws rather than rendering an empty catalog on an error", async () => {
    response = { data: [], error: { message: "boom", code: "42501" }, count: null };
    await expect(runQuery(EMPTY_FILTERS)).rejects.toBeTruthy();
  });

  it("never selects internal_note into the browser", async () => {
    await runQuery(EMPTY_FILTERS);
    expect(String(find("select")[0].args[0])).not.toContain("internal_note");
  });
});

describe("hasActiveFilter", () => {
  it("is false for the default view", () => {
    expect(hasActiveFilter(EMPTY_FILTERS)).toBe(false);
  });

  it("is true once anything narrows the list", () => {
    expect(hasActiveFilter({ ...EMPTY_FILTERS, search: "vot" })).toBe(true);
    expect(hasActiveFilter({ ...EMPTY_FILTERS, status: "draft" })).toBe(true);
    expect(hasActiveFilter({ ...EMPTY_FILTERS, category: "vot" })).toBe(true);
  });

  it("ignores sort and page — neither hides a product", () => {
    expect(hasActiveFilter({ ...EMPTY_FILTERS, sort: "title", page: 3 })).toBe(false);
  });
});
