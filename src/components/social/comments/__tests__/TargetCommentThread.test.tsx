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
    deleteMutateSync: vi.fn(),
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isLoading: false,
    isFetchingNextPage: false,
    navigateSpy: vi.fn(),
  },
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => hooksState.navigateSpy };
});

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
    isLoading: hooksState.isLoading,
    fetchNextPage: hooksState.fetchNextPage,
    hasNextPage: hooksState.hasNextPage,
    isFetchingNextPage: hooksState.isFetchingNextPage,
  }),
  useAddTargetCommentMutation: () => ({
    mutateAsync: hooksState.addMutate,
    mutate: vi.fn(),
    isPending: false,
  }),
  useEditTargetCommentMutation: () => ({
    mutateAsync: hooksState.editMutate,
    mutate: vi.fn(),
    isPending: false,
  }),
  useDeleteTargetCommentMutation: () => ({
    mutateAsync: hooksState.deleteMutate,
    mutate: hooksState.deleteMutateSync,
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
  hooksState.hasNextPage = false;
  hooksState.isLoading = false;
  hooksState.isFetchingNextPage = false;
  hooksState.navigateSpy.mockClear();
  hooksState.addMutate.mockClear();
  hooksState.editMutate.mockClear();
  hooksState.deleteMutate.mockClear();
  hooksState.deleteMutateSync.mockClear();
  hooksState.fetchNextPage.mockClear();
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

describe("TargetCommentThread interactions", () => {
  it("shows the empty state when there are no comments", () => {
    authState.user = { id: "user-1" };
    hooksState.comments = [];
    renderThread();
    expect(screen.getByText("No comments yet. Be the first.")).toBeTruthy();
  });

  it("submits a top-level comment through the add mutation", async () => {
    authState.user = { id: "user-1" };
    hooksState.comments = [];
    renderThread();
    fireEvent.change(screen.getByPlaceholderText("Write a comment…"), {
      target: { value: "First!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));
    expect(hooksState.addMutate).toHaveBeenCalledWith({
      body: "First!",
      parentCommentId: null,
    });
  });

  it("submits a reply with the parent id and closes the reply box", async () => {
    authState.user = { id: "user-1" };
    hooksState.comments = [comment()];
    renderThread();
    fireEvent.click(screen.getByText("Reply"));
    fireEvent.change(screen.getByPlaceholderText("Write a reply…"), {
      target: { value: "Agreed" },
    });
    const postButtons = screen.getAllByRole("button", { name: /^post$/i });
    fireEvent.click(postButtons[postButtons.length - 1]);
    expect(hooksState.addMutate).toHaveBeenCalledWith({
      body: "Agreed",
      parentCommentId: "c-1",
    });
  });

  it("edits an own comment through the edit mutation", async () => {
    authState.user = { id: "user-9" };
    hooksState.comments = [comment()];
    renderThread();
    fireEvent.click(screen.getByText("Edit"));
    const boxes = screen.getAllByLabelText("Comment body");
    fireEvent.change(boxes[boxes.length - 1], {
      target: { value: "Edited body" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(hooksState.editMutate).toHaveBeenCalledWith({
      commentId: "c-1",
      body: "Edited body",
    });
  });

  it("deletes an own comment through the delete mutation", () => {
    authState.user = { id: "user-9" };
    hooksState.comments = [comment()];
    renderThread();
    fireEvent.click(screen.getByText("Delete"));
    expect(hooksState.deleteMutateSync).toHaveBeenCalledWith("c-1");
  });

  it("renders nested replies under their parent", () => {
    hooksState.comments = [
      comment(),
      comment({
        comment_id: "c-2",
        parent_comment_id: "c-1",
        depth: 1,
        body: "Nested reply",
        user_id: "user-8",
        username: "player8",
        display_name: "Player Eight",
      }),
    ];
    renderThread();
    expect(screen.getByText("Great rally")).toBeTruthy();
    expect(screen.getByText("Nested reply")).toBeTruthy();
  });

  it("marks edited comments and renders avatar images", () => {
    hooksState.comments = [
      comment({
        updated_at: "2026-11-24T11:00:00Z",
        avatar_url: "https://example.com/a.png",
      }),
    ];
    renderThread();
    expect(screen.getByText(/· edited/)).toBeTruthy();
  });

  it("load-more button fetches the next page", () => {
    hooksState.comments = [comment()];
    hooksState.hasNextPage = true;
    renderThread();
    fireEvent.click(screen.getByText("Load more comments"));
    expect(hooksState.fetchNextPage).toHaveBeenCalled();
  });

  it("deleted comments show the tombstone body text", () => {
    hooksState.comments = [comment({ is_deleted: true })];
    renderThread();
    expect(screen.getByText("This comment was deleted.")).toBeTruthy();
  });

  it("guest sign-in button navigates to login with a redirect", () => {
    hooksState.comments = [];
    renderThread();
    fireEvent.click(screen.getByText("Sign in to comment"));
    expect(hooksState.navigateSpy).toHaveBeenCalledWith(
      expect.stringContaining("/login?redirect="),
    );
  });

  it("shows a loading spinner while comments load", () => {
    hooksState.isLoading = true;
    const { container } = renderThread();
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("load-more button shows a loading label while fetching", () => {
    hooksState.comments = [comment()];
    hooksState.hasNextPage = true;
    hooksState.isFetchingNextPage = true;
    renderThread();
    expect(screen.getByText("Loading…")).toBeTruthy();
  });
});
