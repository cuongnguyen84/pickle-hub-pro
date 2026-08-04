// @vitest-environment jsdom
// DS-04 regression: a failed query on Live / News / TournamentDetail must
// render ErrorState, not an empty state or a 404.
//
// These three pages defaulted their query data to `[]` (or fell through to
// the not-found branch) and read only `isLoading`, so an outage rendered
// "no matches in this view" / "no news in this view" / "page not found" —
// telling the reader nothing is on, or that the thing they wanted is gone,
// when the truth was that we could not ask. After the PGRST002 outages that
// is the failure mode worth pinning.
//
// TheLineLayout is stubbed to a passthrough: these assertions are about the
// error branch, not about nav chrome, and the real layout drags in auth +
// router + SEO head machinery that would make the test about itself.

import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const refetchLive = vi.fn();
const refetchSched = vi.fn();
const refetchEnded = vi.fn();
const refetchNews = vi.fn();
const refetchTournament = vi.fn();

// Every hook these pages call, in its failed state.
const failed = (refetch: () => void) => ({
  data: undefined,
  isLoading: false,
  isError: true,
  refetch,
});

// TournamentDetail transitively imports useLivePresence, which constructs the
// real client at module load and needs env that a unit test has no business
// supplying (same stub as LivestreamGateOverlay's test).
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

vi.mock("@/components/layout/TheLineLayout", () => ({
  TheLineLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/i18n", async () => {
  const { vi: viDict } = await import("@/i18n/vi");
  return {
    useI18n: () => ({
      t: viDict,
      language: "vi",
      setLanguage: vi.fn(),
      setLanguageFromUrl: vi.fn(),
    }),
  };
});

vi.mock("@/hooks/useSupabaseData", () => ({
  useLivestreams: (status?: string) =>
    status === "live"
      ? failed(refetchLive)
      : status === "scheduled"
        ? failed(refetchSched)
        : failed(refetchEnded),
  useTournamentBySlug: () => failed(refetchTournament),
  useTournamentContent: () => ({ data: undefined, isLoading: false, isError: true }),
}));

vi.mock("@/hooks/useNewsItems", () => ({
  useNewsItems: () => failed(refetchNews),
}));

// Stub the child barrels. These assertions are about the pages' error branch,
// and the real barrels drag in the whole bracket + content-card cluster
// (DoublesEliminationBracket alone is ~280 statements) — code this test never
// exercises but which would land in the coverage denominator and pull the
// global number down for adding a test. Loading less is also faster.
vi.mock("@/components/tournament", () => ({
  TournamentHero: () => null,
  ContentSection: () => null,
  CourtTabs: () => null,
}));

vi.mock("@/components/content", () => ({
  ContentCard: () => null,
  LiveCard: () => null,
  EmptyState: () => null,
}));

vi.mock("@/hooks/usePullToRefresh", () => ({
  usePullToRefresh: () => ({ pullDistance: 0, isRefreshing: false, isPulling: false }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

const NETWORK_ERROR = "Lỗi kết nối";

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const renderPage = async (importer: () => Promise<{ default: React.ComponentType }>) => {
  const Page = (await importer()).default;
  render(
    <MemoryRouter initialEntries={["/x"]}>
      <Page />
    </MemoryRouter>,
  );
};

describe("query failure surfaces", () => {
  it("Live shows the network error, not 'no matches in this view'", async () => {
    await renderPage(() => import("../Live"));
    expect(screen.getByRole("alert").textContent).toContain(NETWORK_ERROR);
    expect(screen.queryByText(/Không có trận trong mục này/)).toBeNull();
  });

  it("Live hides the filter counts on error rather than showing fabricated zeros", async () => {
    await renderPage(() => import("../Live"));
    // "Trực tiếp 0 · Replay 0" above a connection error is the same lie the
    // body no longer tells.
    //
    // CAUTION: this assertion passes for `hidden={isError}` too, because
    // role queries honour the hidden attribute — while `.tl-filters` keeps
    // display:flex from the author stylesheet and the row stays on screen.
    // jsdom does not evaluate that stylesheet, so no unit test here can tell
    // the two apart. The row must stay UNMOUNTED, not hidden.
    expect(screen.queryByRole("button", { name: /Tất cả/ })).toBeNull();
  });

  it("Live retry refetches every one of the three queries", async () => {
    await renderPage(() => import("../Live"));
    fireEvent.click(screen.getByRole("button", { name: /Thử lại/ }));
    // A retry that refreshes only the live query leaves the counts stale.
    expect(refetchLive).toHaveBeenCalledTimes(1);
    expect(refetchSched).toHaveBeenCalledTimes(1);
    expect(refetchEnded).toHaveBeenCalledTimes(1);
  });

  it("News shows the network error, not 'no news in this view'", async () => {
    await renderPage(() => import("../News"));
    expect(screen.getByRole("alert").textContent).toContain(NETWORK_ERROR);
    expect(screen.queryByText(/Không có tin trong mục này/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Thử lại/ }));
    expect(refetchNews).toHaveBeenCalledTimes(1);
  });

  it("TournamentDetail shows the network error, not 'not found'", async () => {
    await renderPage(() => import("../TournamentDetail"));
    expect(screen.getByRole("alert").textContent).toContain(NETWORK_ERROR);
    // The old behaviour: a dead network was indistinguishable from a deleted
    // tournament, and sent the reader away instead of asking them to retry.
    expect(screen.queryByText(/Không tìm thấy trang/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Thử lại/ }));
    expect(refetchTournament).toHaveBeenCalledTimes(1);
  });
});
