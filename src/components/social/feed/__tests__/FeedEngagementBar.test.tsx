// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const { authState, countsState, toggleMutate, navigateSpy } = vi.hoisted(
  () => ({
    authState: { user: null as { id: string } | null },
    countsState: {
      data: {
        kudos_count: 3,
        comment_count: 2,
        viewer_kudoed: false,
      } as {
        kudos_count: number;
        comment_count: number;
        viewer_kudoed: boolean;
      },
    },
    toggleMutate: vi.fn(),
    navigateSpy: vi.fn(),
  }),
);

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
  useAuthOptional: () => authState,
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({ language: "en" }),
}));

vi.mock("@/hooks/social/useEngagement", () => ({
  useEngagementCounts: () => ({ data: countsState.data }),
  useToggleTargetKudos: () => ({
    mutate: toggleMutate,
    isPending: false,
  }),
}));

vi.mock("@/components/social/comments/TargetCommentThread", () => ({
  TargetCommentThread: () => <div data-testid="thread-stub" />,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateSpy };
});

import { FeedEngagementBar } from "../FeedEngagementBar";

function renderBar() {
  const qc = new QueryClient();
  const ui: ReactNode = (
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <FeedEngagementBar targetType="post" targetId="p-1" />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(<>{ui}</>);
}

afterEach(() => {
  cleanup();
  authState.user = null;
  countsState.data = { kudos_count: 3, comment_count: 2, viewer_kudoed: false };
  toggleMutate.mockClear();
  navigateSpy.mockClear();
});

describe("FeedEngagementBar", () => {
  it("shows kudos and comment counts to guests", () => {
    renderBar();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("Comments")).toBeTruthy();
  });

  it("sends guests to login when they tap the heart", () => {
    renderBar();
    fireEvent.click(screen.getByLabelText("Like"));
    expect(navigateSpy).toHaveBeenCalledWith(
      expect.stringContaining("/login?redirect="),
    );
    expect(toggleMutate).not.toHaveBeenCalled();
  });

  it("toggles kudos for signed-in users", () => {
    authState.user = { id: "user-1" };
    renderBar();
    fireEvent.click(screen.getByLabelText("Like"));
    expect(toggleMutate).toHaveBeenCalledWith("p-1");
  });

  it("expands the comment thread from the comment chip", () => {
    renderBar();
    expect(screen.queryByTestId("thread-stub")).toBeNull();
    fireEvent.click(screen.getByText("Comments"));
    expect(screen.getByTestId("thread-stub")).toBeTruthy();
  });

  it("hides zero counts", () => {
    countsState.data = { kudos_count: 0, comment_count: 0, viewer_kudoed: false };
    renderBar();
    expect(screen.queryByText("0")).toBeNull();
  });
});
