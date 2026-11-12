// @vitest-environment jsdom
// ChatFAB (Messenger/Zalo): hiện trên trang thường, ẩn nơi trợ lý giải giữ góc màn hình.
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/i18n", () => ({ useI18n: () => ({ language: "vi" }) }));

import ChatFAB from "../ChatFAB";

afterEach(cleanup);

const renderAt = (path: string) => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  return render(<MemoryRouter initialEntries={[path]}><ChatFAB /></MemoryRouter>);
};

describe("ChatFAB", () => {
  it("shows both contact buttons on a normal page", () => {
    renderAt("/vi/san");
    expect(screen.getByLabelText("Chat qua Messenger").getAttribute("href")).toContain("m.me");
    expect(screen.getByLabelText("Chat qua Zalo").getAttribute("href")).toContain("zalo.me");
  });

  it.each(["/rankings", "/tools/quick-tables/abc", "/tournament/x", "/admin"])("hides on %s", (path) => {
    const { container } = renderAt(path);
    expect(container.innerHTML).toBe("");
  });
});
