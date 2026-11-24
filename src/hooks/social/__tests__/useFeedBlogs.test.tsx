// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { renderHook, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const { fromMock, chain, state } = vi.hoisted(() => {
  const chain: Record<string, unknown> = {};
  const state = {
    result: { data: [] as unknown[], error: null as unknown },
  };
  return { fromMock: vi.fn(() => chain), chain, state };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: fromMock },
}));

import { useFeedBlogs } from "../useFeedBlogs";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const VI_ROW = {
  id: "11111111-2222-3333-4444-555555555555",
  slug: "luat-goi-bong-out-ly-hoang-nam-fair-play",
  alternate_en_slug: "line-call-rules-ly-hoang-nam-fair-play",
  title: "Luật gọi bóng OUT",
  excerpt: "Tóm tắt",
  cover_image_url: "https://example.com/hero.webp",
  category: "rules",
  published_at: "2026-11-24T10:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  state.result = { data: [], error: null };
  for (const method of ["select", "eq", "gte", "order"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.limit = vi.fn(() => Promise.resolve(state.result));
});

afterEach(() => cleanup());

describe("useFeedBlogs", () => {
  it("maps a VI row to a blog item keyed by the canonical slug", async () => {
    state.result = { data: [VI_ROW], error: null };
    const { result } = renderHook(() => useFeedBlogs("vi"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const items = result.current.data ?? [];
    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item.type).toBe("blog");
    if (item.type === "blog") {
      expect(item.slug).toBe("luat-goi-bong-out-ly-hoang-nam-fair-play");
      expect(item.canonical_slug).toBe(
        "line-call-rules-ly-hoang-nam-fair-play",
      );
      expect(item.cursor_id).toBe(VI_ROW.id);
      expect(item.lang).toBe("vi");
    }
    expect(fromMock).toHaveBeenCalledWith("vi_blog_posts");
  });

  it("keeps canonical_slug null when the pair shares one slug", async () => {
    state.result = {
      data: [{ ...VI_ROW, alternate_en_slug: null }],
      error: null,
    };
    const { result } = renderHook(() => useFeedBlogs("vi"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const item = (result.current.data ?? [])[0];
    if (item?.type === "blog") {
      expect(item.canonical_slug).toBeNull();
    } else {
      throw new Error("expected a blog item");
    }
  });

  it("skips VI rows without a published_at", async () => {
    state.result = {
      data: [{ ...VI_ROW, published_at: null }],
      error: null,
    };
    const { result } = renderHook(() => useFeedBlogs("vi"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data ?? []).toHaveLength(0);
  });

  it("propagates a supabase error", async () => {
    state.result = { data: [], error: new Error("db down") };
    const { result } = renderHook(() => useFeedBlogs("vi"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("returns EN blog items from the static metadata", async () => {
    const { result } = renderHook(() => useFeedBlogs("en"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const items = result.current.data ?? [];
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.type).toBe("blog");
      if (item.type === "blog") {
        expect(item.lang).toBe("en");
        expect(item.cursor_id).toBe(`en-blog:${item.slug}`);
      }
    }
    expect(fromMock).not.toHaveBeenCalled();
  });
});
