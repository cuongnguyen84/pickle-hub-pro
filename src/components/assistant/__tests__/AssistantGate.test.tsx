// @vitest-environment jsdom
// Nút trợ lý: không hiện ở route ẩn, chỉ vẽ sau idle, khung chat chỉ tải khi bấm.
import { describe, it, expect, afterEach, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const panelLoads = vi.fn();
vi.mock("../AssistantPanel", () => {
  panelLoads();
  return { default: ({ mode, page, open }: { mode: string; page: string; open: boolean }) => (open ? <div role="dialog">{`${mode}:${page}`}</div> : null) };
});
vi.mock("@/i18n", () => ({ useI18n: () => ({ language: "vi" }) }));

import AssistantGate from "../AssistantGate";

afterEach(() => { cleanup(); vi.useRealTimers(); panelLoads.mockClear(); });

const renderAt = (path: string) => {
  vi.useFakeTimers();
  const r = render(<MemoryRouter initialEntries={[path]}><AssistantGate /></MemoryRouter>);
  act(() => { vi.advanceTimersByTime(2500); });
  return r;
};

describe("AssistantGate", () => {
  it.each(["/tools/quick-tables/chat", "/live/abc", "/embed/video/1", "/admin", "/auth/callback", "/shop/cart"])(
    "renders nothing on %s", (path) => {
      const { container } = renderAt(path);
      expect(container.innerHTML).toBe("");
    },
  );

  it("waits for idle before drawing the button", () => {
    vi.useFakeTimers();
    render(<MemoryRouter initialEntries={["/san"]}><AssistantGate /></MemoryRouter>);
    expect(screen.queryByRole("button")).toBeNull();
    act(() => { vi.advanceTimersByTime(2500); });
    expect(screen.getByRole("button", { name: "Hỏi trợ lý AI" })).toBeTruthy();
  });

  it("loads the panel only on click, in site mode with the page type", async () => {
    renderAt("/vi/san/abc");
    expect(panelLoads).not.toHaveBeenCalled();
    vi.useRealTimers();
    fireEvent.click(screen.getByRole("button", { name: "Hỏi trợ lý AI" }));
    expect((await screen.findByRole("dialog")).textContent).toBe("site:venues");
    expect(panelLoads).toHaveBeenCalledTimes(1);
  });

  it("uses the tournament assistant on tournament routes", async () => {
    renderAt("/tools/quick-tables/abc");
    vi.useRealTimers();
    fireEvent.click(screen.getByRole("button", { name: "Mở trợ lý giải đấu" }));
    expect((await screen.findByRole("dialog")).textContent).toBe("tournament:tournament");
  });
});
