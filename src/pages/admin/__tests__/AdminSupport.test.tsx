/** @vitest-environment jsdom */
// Trang admin yêu cầu hỗ trợ: lọc mặc định "Mới", hiện liên hệ + link nhanh, đánh dấu đã xử lý.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const calls: { op: string; args: unknown[] }[] = [];
const rows = [{
  id: "11111111-2222-3333-4444-555555555555", created_at: "2026-11-12T03:00:00Z", user_id: null,
  name: "Lan", phone: "0912345678", email: "lan@example.com", zalo: null, message: "Không đăng ký được giải",
  page_type: "tournament", route: "/tournament/x", page_label: "Giải X", lang: "vi",
  transcript: [{ role: "user", text: "đăng ký lỗi" }, { role: "bot", text: "Mình mở form gửi admin nhé." }],
  status: "new", handled_at: null, admin_note: null,
}];
const chain = (): Record<string, unknown> => {
  const c: Record<string, unknown> = {};
  for (const op of ["select", "order", "limit", "eq", "update"]) c[op] = (...args: unknown[]) => { calls.push({ op, args }); return c; };
  c.then = (res: (v: unknown) => void) => res({ data: rows, error: null });
  return c;
};
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (t: string) => { calls.push({ op: "from", args: [t] }); return chain(); } } }));
vi.mock("@/components/admin/AdminLayout", () => ({ AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AdminSupport, { zaloHref } from "../AdminSupport";

afterEach(() => { cleanup(); calls.length = 0; });

const mount = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AdminSupport /></QueryClientProvider>,
);

describe("AdminSupport", () => {
  it("lists new requests newest first with contact quick links and transcript", async () => {
    mount();
    expect(await screen.findByText("Không đăng ký được giải")).toBeTruthy();
    expect(calls).toContainEqual({ op: "from", args: ["support_requests"] });
    expect(calls).toContainEqual({ op: "order", args: ["created_at", { ascending: false }] });
    expect(calls).toContainEqual({ op: "eq", args: ["status", "new"] });
    expect(screen.getByText("0912345678").closest("a")!.getAttribute("href")).toBe("tel:0912345678");
    expect(screen.getByText("lan@example.com").closest("a")!.getAttribute("href")).toBe("mailto:lan@example.com");
    expect(screen.getByText("Zalo (SĐT)").closest("a")!.getAttribute("href")).toBe("https://zalo.me/84912345678");
    expect(screen.getByText(/Hội thoại với trợ lý \(2 lượt\)/)).toBeTruthy();
  });

  it("marks a request handled through an RLS update (server stamps handled_at/by)", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Đánh dấu đã xử lý" }));
    await waitFor(() => expect(calls.some((c) => c.op === "update")).toBe(true));
    const upd = calls.find((c) => c.op === "update")!;
    expect(upd.args[0]).toEqual({ status: "handled", admin_note: "" });
    expect(calls).toContainEqual({ op: "eq", args: ["id", rows[0].id] });
  });
});

describe("zaloHref", () => {
  it("builds zalo.me from a VN phone only", () => {
    expect(zaloHref("0912 345 678")).toBe("https://zalo.me/84912345678");
    expect(zaloHref("+84912345678")).toBe("https://zalo.me/84912345678");
    expect(zaloHref(null)).toBeNull();
    expect(zaloHref("123")).toBeNull();
  });
});
