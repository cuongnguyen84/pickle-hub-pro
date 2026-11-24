// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const { authState, hooksState } = vi.hoisted(() => ({
  authState: { user: null as { id: string } | null },
  hooksState: {
    comments: [] as Record<string, unknown>[],
    addMutate: vi.fn(async () => ({})),
    editMutate: vi.fn(async () => ({})),
    deleteMutate: vi.fn(async () => ({})),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
  useAuthOptional: () => authState,
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({ language: "en" }),
}));

vi.mock("@/hooks/social/useMentionAutocomplete", () => ({
  useMentionAutocomplete: () => ({ data: [] }),
}));

vi.mock("@/components/social/comments/viewer-profile", () => ({
  useViewerProfile: () => ({
    username: "me",
    display_name: "Me Myself",
    avatar_url: null,
  }),
}));

vi.mock("@/hooks/social/useTargetComments", () => ({
  useTargetComments: () => ({
    data: { pages: [hooksState.comments] },
    isLoading: false,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  }),
  useAddTargetCommentMutation: () => ({
    mutateAsync: hooksState.addMutate,
    isPending: false,
  }),
  useEditTargetCommentMutation: () => ({
    mutateAsync: hooksState.editMutate,
    isPending: false,
  }),
  useDeleteTargetCommentMutation: () => ({
    mutateAsync: hooksState.deleteMutate,
    isPending: false,
  }),
  useTargetModerationContext: () => ({
    viewerId: authState.user?.id ?? null,
    isAdmin: false,
    isModerator: false,
    isMatchParticipant: false,
  }),
}));

import { TargetCommentThread } from "../TargetCommentThread";

function renderThread() {
  const qc = new QueryClient();
  const ui: ReactNode = (
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TargetCommentThread targetType="news" targetId="n-1" />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(<>{ui}</>);
}

function comment(overrides: Record<string, unknown> = {}) {
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
  authState.user = null;
  hooksState.comments = [];
  hooksState.addMutate.mockClear();
  hooksState.deleteMutate.mockClear();
});

describe("TargetCommentThread", () => {
  it("guests see the comments and a sign-in prompt instead of the input", () => {
    hooksState.comments = [comment()];
    renderThread();
    expect(screen.getByText("Great rally")).toBeTruthy();
    expect(screen.getByText("Sign in to comment")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Write a comment…")).toBeNull();
  });

  it("signed-in users get the comment input", () => {
    authState.user = { id: "user-1" };
    hooksState.comments = [];
    renderThread();
    expect(screen.getByPlaceholderText("Write a comment…")).toBeTruthy();
  });

  it("renders a tombstone for deleted comments", () => {
    hooksState.comments = [comment({ is_deleted: true, body: "gone" })];
    renderThread();
    expect(screen.getByText("Deleted")).toBeTruthy();
    expect(screen.queryByText("gone")).toBeNull();
  });

  it("shows edit and delete on the viewer's own comment", () => {
    authState.user = { id: "user-9" };
    hooksState.comments = [comment()];
    renderThread();
    expect(screen.getByText("Edit")).toBeTruthy();
    expect(screen.getByText("Delete")).toBeTruthy();
  });

  it("hides edit and delete on someone else's comment", () => {
    authState.user = { id: "user-1" };
    hooksState.comments = [comment()];
    renderThread();
    expect(screen.queryByText("Delete")).toBeNull();
  });

  it("renders nothing without a QueryClient (bare article test trees)", () => {
    const { container } = render(
      <MemoryRouter>
        <TargetCommentThread targetType="news" targetId="n-1" />
      </MemoryRouter>,
    );
    expect(container.textContent).toBe("");
  });

  it("reply flow opens a reply input under the comment", () => {
    authState.user = { id: "user-1" };
    hooksState.comments = [comment()];
    renderThread();
    fireEvent.click(screen.getByText("Reply"));
    expect(screen.getByPlaceholderText("Write a reply…")).toBeTruthy();
  });
});
