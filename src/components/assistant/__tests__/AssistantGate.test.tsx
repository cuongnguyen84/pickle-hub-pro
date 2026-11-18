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

import AssistantGate, { labelCollapsed, OPENED_KEY } from "../AssistantGate";

afterEach(() => { cleanup(); vi.useRealTimers(); panelLoads.mockClear(); localStorage.clear(); });

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
    expect(screen.getByRole("button", { name: "Hỏi Trợ lý AI" })).toBeTruthy();
  });

  it("loads the panel only on click, in site mode with the page type", async () => {
    renderAt("/vi/san/abc");
    expect(panelLoads).not.toHaveBeenCalled();
    vi.useRealTimers();
    fireEvent.click(screen.getByRole("button", { name: "Hỏi Trợ lý AI" }));
    expect((await screen.findByRole("dialog")).textContent).toBe("site:venues");
    expect(panelLoads).toHaveBeenCalledTimes(1);
  });

  it("uses the tournament assistant on tournament routes", async () => {
    renderAt("/tools/quick-tables/abc");
    vi.useRealTimers();
    fireEvent.click(screen.getByRole("button", { name: "Mở Trợ lý AI giải đấu" }));
    expect((await screen.findByRole("dialog")).textContent).toBe("tournament:tournament");
  });

  it("shows a visible 'Trợ lý AI' label, and no Messenger/Zalo buttons anywhere", () => {
    const { container } = renderAt("/");
    const btn = screen.getByRole("button", { name: "Hỏi Trợ lý AI" });
    expect(btn.textContent).toContain("Trợ lý AI");
    expect(btn.getAttribute("data-collapsed")).toBe("false");
    expect(container.querySelector('a[href*="m.me"], a[href*="zalo.me"]')).toBeNull();
    expect(screen.queryByLabelText(/Messenger|Zalo/)).toBeNull();
  });

  it("collapses the label after scrolling", () => {
    renderAt("/san");
    const btn = screen.getByRole("button", { name: "Hỏi Trợ lý AI" });
    Object.defineProperty(window, "scrollY", { value: 200, configurable: true });
    act(() => { document.dispatchEvent(new Event("scroll")); });
    expect(btn.getAttribute("data-collapsed")).toBe("true");
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });

  it("remembers the first open and starts collapsed next time", () => {
    const first = renderAt("/san");
    fireEvent.click(screen.getByRole("button", { name: "Hỏi Trợ lý AI" }));
    expect(localStorage.getItem(OPENED_KEY)).toBe("1");
    first.unmount();
    renderAt("/san");
    expect(screen.getByRole("button", { name: "Hỏi Trợ lý AI" }).getAttribute("data-collapsed")).toBe("true");
  });
});

describe("labelCollapsed", () => {
  it("collapses once opened or scrolled past the threshold", () => {
    expect(labelCollapsed(false, 0)).toBe(false);
    expect(labelCollapsed(false, 80)).toBe(false);
    expect(labelCollapsed(false, 81)).toBe(true);
    expect(labelCollapsed(true, 0)).toBe(true);
  });
});
