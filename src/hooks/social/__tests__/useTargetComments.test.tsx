// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const { rpc, fromMock, authState, toast } = vi.hoisted(() => ({
  rpc: vi.fn(),
  fromMock: vi.fn(),
  authState: { user: null as { id: string } | null },
  toast: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc, from: fromMock },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
  useAuthOptional: () => authState,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({ language: "en" }),
}));

import {
  useTargetComments,
  useAddTargetCommentMutation,
  useEditTargetCommentMutation,
  useDeleteTargetCommentMutation,
  useTargetModerationContext,
} from "../useTargetComments";

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

function rpcRow(overrides: Record<string, unknown> = {}) {
  return {
    comment_id: "c-1",
    parent_comment_id: null,
    depth: 0,
    body: "Great rally",
    user_id: "user-9",
    username: "player9",
    display_name: "Player Nine",
    avatar_url: null,
    created_at: "2026-11-24T10:00:00Z",
    updated_at: null,
    is_deleted: false,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  rpc.mockReset();
  fromMock.mockReset();
  toast.mockReset();
  authState.user = null;
  vi.spyOn(console, "error").mockRestore();
});

describe("useTargetComments", () => {
  it("maps RPC rows into the comment shape and passes target args", async () => {
    rpc.mockResolvedValue({ data: [rpcRow()], error: null });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTargetComments("news", "n-1"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages[0]).toHaveLength(1);
    expect(result.current.data?.pages[0][0]).toMatchObject({
      comment_id: "c-1",
      body: "Great rally",
      username: "player9",
      is_deleted: false,
    });
    const call = rpc.mock.calls.find((c) => c[0] === "get_target_comments");
    expect(call?.[1]).toMatchObject({
      p_target_type: "news",
      p_target_id: "n-1",
      p_limit: 50,
    });
    expect(result.current.hasNextPage).toBe(false);
  });

  it("reports a next page when a full page comes back", async () => {
    rpc.mockResolvedValue({
      data: Array.from({ length: 50 }, (_, i) =>
        rpcRow({ comment_id: `c-${i}` }),
      ),
      error: null,
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTargetComments("post", "p-1"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
  });
});

describe("target comment mutations", () => {
  it("add calls add_target_comment with body and parent", async () => {
    authState.user = { id: "user-1" };
    rpc.mockResolvedValue({
      data: { comment_id: "c-new", depth: 1 },
      error: null,
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useAddTargetCommentMutation("blog", "b-1"),
      { wrapper },
    );
    await act(async () => {
      await result.current.mutateAsync({
        body: "Nice post",
        parentCommentId: "c-1",
      });
    });
    const call = rpc.mock.calls.find((c) => c[0] === "add_target_comment");
    expect(call?.[1]).toMatchObject({
      p_target_type: "blog",
      p_target_id: "b-1",
      p_body: "Nice post",
      p_parent_comment_id: "c-1",
    });
  });

  it("add rejects guests before hitting the RPC", async () => {
    authState.user = null;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useAddTargetCommentMutation("blog", "b-1"),
      { wrapper },
    );
    await act(async () => {
      await expect(
        result.current.mutateAsync({ body: "hi" }),
      ).rejects.toThrow("not_authenticated");
    });
    expect(rpc).not.toHaveBeenCalledWith(
      "add_target_comment",
      expect.anything(),
    );
    expect(toast).toHaveBeenCalled();
  });

  it("edit reuses edit_match_comment keyed by comment id", async () => {
    authState.user = { id: "user-1" };
    rpc.mockResolvedValue({ data: { updated: true }, error: null });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useEditTargetCommentMutation("news", "n-1"),
      { wrapper },
    );
    await act(async () => {
      await result.current.mutateAsync({
        commentId: "c-1",
        body: "Edited body",
      });
    });
    expect(rpc).toHaveBeenCalledWith("edit_match_comment", {
      p_comment_id: "c-1",
      p_body: "Edited body",
    });
  });

  it("delete calls delete_target_comment", async () => {
    authState.user = { id: "user-1" };
    rpc.mockResolvedValue({
      data: { deleted: true, acted_as: "owner" },
      error: null,
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useDeleteTargetCommentMutation("news", "n-1"),
      { wrapper },
    );
    await act(async () => {
      await result.current.mutateAsync("c-1");
    });
    const call = rpc.mock.calls.find((c) => c[0] === "delete_target_comment");
    expect(call?.[1]).toMatchObject({ p_comment_id: "c-1" });
  });
});

describe("useTargetModerationContext", () => {
  function stubRoles(rows: { role: string }[]) {
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.in = () => Promise.resolve({ data: rows, error: null });
    fromMock.mockReturnValue(builder);
  }

  it("flags admins from user_roles and never claims match participation", async () => {
    authState.user = { id: "user-1" };
    stubRoles([{ role: "admin" }]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTargetModerationContext(), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isAdmin).toBe(true));
    expect(result.current.isModerator).toBe(false);
    expect(result.current.isMatchParticipant).toBe(false);
    expect(result.current.viewerId).toBe("user-1");
  });

  it("guests get an all-false context without querying roles", async () => {
    authState.user = null;
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTargetModerationContext(), {
      wrapper,
    });
    expect(result.current).toEqual({
      viewerId: null,
      isAdmin: false,
      isModerator: false,
      isMatchParticipant: false,
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("a roles query error leaves the context all-false", async () => {
    authState.user = { id: "user-1" };
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.in = () => Promise.resolve({ data: null, error: new Error("rls") });
    fromMock.mockReturnValue(builder);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTargetModerationContext(), {
      wrapper,
    });
    await waitFor(() => expect(result.current.viewerId).toBe("user-1"));
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isModerator).toBe(false);
  });
});

describe("useTargetComments error paths", () => {
  it("surfaces an RPC error from the comments query", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("boom") });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTargetComments("news", "n-1"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("add mutation rejects and toasts on an RPC error", async () => {
    authState.user = { id: "user-1" };
    rpc.mockResolvedValue({ data: null, error: new Error("insert fail") });
    const { wrapper } = makeWrapper();
    const add = renderHook(() => useAddTargetCommentMutation("news", "n-1"), {
      wrapper,
    });
    await act(async () => {
      await expect(
        add.result.current.mutateAsync({ body: "hi" }),
      ).rejects.toThrow("insert fail");
    });
    expect(toast).toHaveBeenCalled();
  });

  it("edit mutation rejects guests before any RPC", async () => {
    authState.user = null;
    const { wrapper } = makeWrapper();
    const edit = renderHook(
      () => useEditTargetCommentMutation("news", "n-1"),
      { wrapper },
    );
    await act(async () => {
      await expect(
        edit.result.current.mutateAsync({ commentId: "c-1", body: "x" }),
      ).rejects.toThrow("not_authenticated");
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("edit mutation rejects and toasts on an RPC error", async () => {
    authState.user = { id: "user-1" };
    rpc.mockResolvedValue({ data: null, error: new Error("edit fail") });
    const { wrapper } = makeWrapper();
    const edit = renderHook(
      () => useEditTargetCommentMutation("news", "n-1"),
      { wrapper },
    );
    await act(async () => {
      await expect(
        edit.result.current.mutateAsync({ commentId: "c-1", body: "x" }),
      ).rejects.toThrow("edit fail");
    });
    expect(toast).toHaveBeenCalled();
  });

  it("delete mutation rejects guests before any RPC", async () => {
    authState.user = null;
    const { wrapper } = makeWrapper();
    const del = renderHook(
      () => useDeleteTargetCommentMutation("news", "n-1"),
      { wrapper },
    );
    await act(async () => {
      await expect(del.result.current.mutateAsync("c-1")).rejects.toThrow(
        "not_authenticated",
      );
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("delete mutation rejects and toasts on an RPC error", async () => {
    authState.user = { id: "user-1" };
    rpc.mockResolvedValue({ data: null, error: new Error("delete fail") });
    const { wrapper } = makeWrapper();
    const del = renderHook(
      () => useDeleteTargetCommentMutation("news", "n-1"),
      { wrapper },
    );
    await act(async () => {
      await expect(del.result.current.mutateAsync("c-1")).rejects.toThrow(
        "delete fail",
      );
    });
    expect(toast).toHaveBeenCalled();
  });
});
