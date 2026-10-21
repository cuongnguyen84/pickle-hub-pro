/** @vitest-environment jsdom */
// The P0 Wave 0 found: approving moved the state machine and NOTHING called
// the publish worker, so every approved product stayed invisible. These tests
// go through the REAL hooks to a fake shopRpc and a fake functions.invoke —
// asserting the wiring itself, which is the part that was missing.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminShopProductReview from "../AdminShopProductReview";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/shop-client", () => ({
  shopRpc: (name: string, args: unknown) => rpc(name, args),
}));

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));

// Chrome only — the review screen is the subject, not the admin shell.
vi.mock("@/components/admin/AdminLayout", () => ({
  AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/seo/DynamicMeta", () => ({ DynamicMeta: () => null }));
// PageStates pulls useI18n; the provider is app chrome, not the subject.
vi.mock("@/components/states/PageStates", () => ({
  LoadingState: () => <div>loading…</div>,
  ErrorState: () => <div>error</div>,
}));

const PRODUCT_ID = "60040001-0000-4000-8000-000000000001";

const detailRow = (over: Partial<Record<string, unknown>> = {}) => ({
  id: PRODUCT_ID,
  version: 3,
  status: "pending_review",
  is_published: false,
  submitted_at: "2026-08-15T02:00:00Z",
  moderation_state: { decided: false, media_published: false, publicly_visible: false },
  shop: {
    id: "70040001-0000-4000-8000-000000000001", slug: "shop-t", name: "Shop T", state: "active",
    region: null, verified: false, shipping_note: null, return_note: null, product_counts: {},
  },
  category: { slug: "vot", name: "Vợt pickleball", is_active: true },
  buyer_preview: { title: "Vợt test", slug: "vot-test", variants: [], media: [] },
  preflight: [],
  history: [],
  internal_note: null,
  allowed_decisions: ["approve", "request_changes", "reject"],
  ...over,
});

const mount = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/admin/shop/products/${PRODUCT_ID}`]}>
        <Routes>
          <Route path="/admin/shop/products/:id" element={<AdminShopProductReview />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

/** Radio → "đã xem lại" checkbox → submit: the minimum a real approve takes. */
const doApprove = async () => {
  await screen.findAllByText("Vợt test");
  fireEvent.click(screen.getByRole("radio", { name: "Duyệt" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /tôi đã xem lại/i }));
  fireEvent.click(screen.getByRole("button", { name: /gửi quyết định/i }));
};

beforeEach(() => {
  rpc.mockReset();
  invoke.mockReset();
});
afterEach(cleanup);

describe("approve → publish wiring", () => {
  it("a successful approve calls the worker publish exactly once, for this product", async () => {
    rpc.mockImplementation((name: string) => {
      if (name === "product_moderation_detail") return Promise.resolve(detailRow());
      if (name === "product_decide") return Promise.resolve({ ok: true, status: "approved" });
      throw new Error(`unexpected rpc ${name}`);
    });
    invoke.mockResolvedValue({ data: { ok: true, renditions: 1 }, error: null });

    mount();
    await doApprove();

    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    expect(invoke).toHaveBeenCalledWith("shop-media-lifecycle", {
      body: { action: "publish", product_id: PRODUCT_ID },
    });
    expect(await screen.findByText(/đã ghi nhận quyết định/i)).toBeTruthy();
  });

  it("a publish failure does NOT hide the recorded approve, and the retry re-invokes", async () => {
    // After the decide lands, the refetched row is approved-but-not-visible —
    // the exact state the retry button exists for.
    let decided = false;
    rpc.mockImplementation((name: string) => {
      if (name === "product_moderation_detail") {
        return Promise.resolve(decided ? detailRow({ status: "approved", allowed_decisions: ["suspend"] }) : detailRow());
      }
      if (name === "product_decide") { decided = true; return Promise.resolve({ ok: true, status: "approved" }); }
      throw new Error(`unexpected rpc ${name}`);
    });
    invoke.mockResolvedValueOnce({ data: null, error: new Error("edge runtime degraded") });

    mount();
    await doApprove();

    // The approve is still reported as recorded…
    expect(await screen.findByText(/đã ghi nhận quyết định/i)).toBeTruthy();
    // …the publish failure is its own visible message, not a swallowed one…
    expect(await screen.findByText(/chưa đưa lên sàn được/i)).toBeTruthy();
    // …and the retry button re-invokes the worker for the same product.
    invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    fireEvent.click(await screen.findByRole("button", { name: /đưa lên sàn/i }));
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));
    expect(invoke).toHaveBeenLastCalledWith("shop-media-lifecycle", {
      body: { action: "publish", product_id: PRODUCT_ID },
    });
  });

  it("request-changes never touches the publish worker", async () => {
    rpc.mockImplementation((name: string) => {
      if (name === "product_moderation_detail") return Promise.resolve(detailRow());
      if (name === "product_decide") return Promise.resolve({ ok: true, status: "needs_changes" });
      throw new Error(`unexpected rpc ${name}`);
    });

    mount();
    await screen.findAllByText("Vợt test");
    fireEvent.click(screen.getByRole("radio", { name: "Yêu cầu sửa" }));
    fireEvent.change(screen.getByPlaceholderText(/người bán đọc nguyên văn/i), {
      target: { value: "Bổ sung mô tả chất liệu cho đủ dài." },
    });
    // one structured target — request-changes requires it
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("checkbox", { name: /tôi đã xem lại/i }));
    fireEvent.click(screen.getByRole("button", { name: /gửi quyết định/i }));

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("product_decide", expect.objectContaining({ _decision: "request_changes" })),
    );
    expect(await screen.findByText(/đã ghi nhận quyết định/i)).toBeTruthy();
    expect(invoke).not.toHaveBeenCalled();
  });
});
