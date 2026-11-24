// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { renderHook, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const { rpc, authState, state } = vi.hoisted(() => ({
  rpc: vi.fn(),
  authState: { user: null as { id: string } | null },
  state: {
    result: { data: [] as unknown[], error: null as unknown },
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
  useAuthOptional: () => authState,
}));

import { useFeedResults, useFeedTimeline } from "../useFeedTimeline";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const BASE = {
  published_at: "2026-11-24T09:00:00Z",
  ranked_at: "2026-11-24T09:00:00Z",
  score: 1.5,
  slug: null,
  format: null,
  match_type: null,
  verification_status: null,
  venue_name: null,
  team_a_score: null,
  team_b_score: null,
  winning_team: null,
  participants: null,
  kudos_count: null,
  viewer_kudoed: null,
  comment_count: null,
  source_provider: null,
  source_url: null,
  tournament_name: null,
  tournament_event: null,
  round_name: null,
  notes: null,
  title: null,
  excerpt: null,
  cover_image_url: null,
  category: null,
  duration_seconds: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  authState.user = null;
  state.result = { data: [], error: null };
  rpc.mockImplementation(() => Promise.resolve(state.result));
});

afterEach(() => cleanup());

describe("useFeedResults row normalization", () => {
  it("maps match, result, blog and video rows and drops unknown types", async () => {
    state.result = {
      data: [
        {
          ...BASE,
          item_type: "match",
          item_id: "m-1",
          slug: "match-slug",
          format: "doubles",
          participants: [{ name: "A" }],
          team_a_score: [11],
          team_b_score: [9],
          winning_team: "A",
          kudos_count: 3,
          viewer_kudoed: true,
          comment_count: 2,
        },
        {
          ...BASE,
          item_type: "result",
          item_id: "r-1",
          slug: "result-slug",
          source_provider: "ppa",
          tournament_name: "PPA Tour",
          category: "0",
        },
        {
          ...BASE,
          item_type: "blog",
          item_id: "b-1",
          slug: "luat-goi-bong-out-ly-hoang-nam-fair-play",
          title: "Luật gọi bóng OUT",
        },
        {
          ...BASE,
          item_type: "video",
          item_id: "v-1",
          title: "Highlight",
          category: "short",
          duration_seconds: 42,
        },
        { ...BASE, item_type: "embed", item_id: "x-1" },
      ],
      error: null,
    };
    const { result } = renderHook(() => useFeedResults(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const items = result.current.data ?? [];
    expect(items.map((i) => i.type)).toEqual([
      "match",
      "result",
      "blog",
      "video",
    ]);
    const blog = items[2];
    if (blog.type === "blog") {
      expect(blog.lang).toBe("vi");
      expect(blog.slug).toBe("luat-goi-bong-out-ly-hoang-nam-fair-play");
      // RPC rows carry no canonical slug; Feed.tsx stamps it later.
      expect(blog.canonical_slug).toBeUndefined();
    }
    const video = items[3];
    if (video.type === "video") {
      expect(video.video_type).toBe("short");
    }
    expect(rpc).toHaveBeenCalledWith("get_feed_recent_results", {
      p_limit: 12,
    });
  });

  it("defaults a video row with an unknown category to long", async () => {
    state.result = {
      data: [{ ...BASE, item_type: "video", item_id: "v-9", category: "weird" }],
      error: null,
    };
    const { result } = renderHook(() => useFeedResults(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const item = (result.current.data ?? [])[0];
    if (item?.type === "video") {
      expect(item.video_type).toBe("long");
    } else {
      throw new Error("expected a video item");
    }
  });

  it("returns an empty list when the results RPC errors", async () => {
    state.result = { data: [], error: new Error("not applied yet") };
    const { result } = renderHook(() => useFeedResults(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data ?? []).toHaveLength(0);
  });
});

describe("useFeedTimeline", () => {
  it("normalizes the first page and merges EN blog items by score", async () => {
    state.result = {
      data: [
        {
          ...BASE,
          item_type: "blog",
          item_id: "b-1",
          slug: "bai-viet-tieng-viet",
          title: "Bài viết",
          score: 0.1,
        },
      ],
      error: null,
    };
    const { result } = renderHook(() => useFeedTimeline(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const page = result.current.data?.pages[0] ?? [];
    const viBlog = page.find((i) => i.type === "blog" && i.lang === "vi");
    expect(viBlog).toBeDefined();
    // A short DB page is the final page: no next cursor.
    expect(result.current.hasNextPage).toBe(false);
    expect(rpc).toHaveBeenCalledWith(
      "get_feed_timeline",
      expect.objectContaining({ p_limit: 20 }),
    );
  });

  it("propagates a timeline RPC error", async () => {
    state.result = { data: [], error: new Error("rpc down") };
    const { result } = renderHook(() => useFeedTimeline(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
