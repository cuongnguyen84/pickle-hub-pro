// @vitest-environment jsdom
// Render-floor contract: the viewer badge NEVER prints "0 đang xem" on a live
// card (the prod bug this branch fixes — 3 call sites passed viewerCount={0})
// and stays hidden below MIN_PUBLIC_VIEWERS. This is the only render rule in
// the live-viewer-count-comparison A' package; keep it pinned.

import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LiveCard, { MIN_PUBLIC_VIEWERS } from "../LiveCard";

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

afterEach(cleanup);

const renderCard = (props: Partial<React.ComponentProps<typeof LiveCard>> = {}) =>
  render(
    <MemoryRouter>
      <LiveCard id="ls-1" title="Chung kết" status="live" {...props} />
    </MemoryRouter>,
  );

describe("LiveCard viewer badge floor", () => {
  it("never renders '0 đang xem' when viewerCount is 0", () => {
    renderCard({ viewerCount: 0 });
    expect(screen.queryByText(/đang xem/)).toBeNull();
  });

  it("hides the badge below MIN_PUBLIC_VIEWERS", () => {
    renderCard({ viewerCount: MIN_PUBLIC_VIEWERS - 1 });
    expect(screen.queryByText(/đang xem/)).toBeNull();
  });

  it("shows the exact count at the floor, with an accessible label", () => {
    renderCard({ viewerCount: MIN_PUBLIC_VIEWERS });
    expect(screen.getByText(`${MIN_PUBLIC_VIEWERS} đang xem`)).toBeTruthy();
    expect(
      screen.getByLabelText(`${MIN_PUBLIC_VIEWERS} người đang xem trực tiếp`),
    ).toBeTruthy();
  });

  it("renders nothing viewer-related when viewerCount is undefined (list callers)", () => {
    renderCard();
    expect(screen.queryByText(/đang xem/)).toBeNull();
  });
});
