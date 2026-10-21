// @vitest-environment jsdom
/**
 * "Xem thêm" must APPEND — the launch-night bug (2026-08-29) replaced page 1
 * with page 2 because the cursor lived in the URL and re-ran the single-page
 * query. The stub records the cursor the second call sends and the test
 * asserts both pages are on screen afterwards.
 */
import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const calls: Record<string, unknown>[] = [];
vi.mock("@/integrations/supabase/shop-client", () => ({
  shopRpc: vi.fn(async (_fn: string, args: Record<string, unknown>) => {
    calls.push(args);
    const page2 = args._cursor_at != null;
    return {
      rows: page2
        ? [{ id: "c", created_at: "2026-08-27", title: "C" }]
        : [{ id: "a", created_at: "2026-08-29", title: "A" }, { id: "b", created_at: "2026-08-28", title: "B" }],
      total: 3,
      has_more: !page2,
    };
  }),
}));

import { usePublicSearchPages } from "../usePublicShop";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe("usePublicSearchPages", () => {
  it("appends page 2 under page 1 and sends the last row as the cursor", async () => {
    const { result } = renderHook(() => usePublicSearchPages({ categorySlug: "vot" }), { wrapper });
    await waitFor(() => expect(result.current.data?.pages.length).toBe(1));
    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();
    await waitFor(() => expect(result.current.data?.pages.length).toBe(2));

    const rows = result.current.data!.pages.flatMap((p) => p.rows).map((r) => r.id);
    expect(rows).toEqual(["a", "b", "c"]);
    expect(calls[1]).toMatchObject({ _cursor_at: "2026-08-28", _cursor_id: "b", _category_slug: "vot" });
    expect(result.current.hasNextPage).toBe(false);
  });
});
