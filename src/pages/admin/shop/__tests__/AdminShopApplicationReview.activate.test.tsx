/** @vitest-environment jsdom */
// The activation section, exercised through the REAL page and REAL hooks to a
// fake shop-client. The pilot lesson these tests encode: a test that protects
// the FUNCTION but not the CALL SITE goes green while the wiring is missing —
// so the assertions here are on shopRpc("shop_activate", …) leaving the page,
// with the exact parameter names the migration declares.
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminShopApplicationReview from "../AdminShopApplicationReview";

const rpc = vi.fn();
// per-table resolver so a test can hold the shops query pending or fail it
const tableFetch: Record<string, () => Promise<{ data: unknown; error: { message: string } | null }>> = {};

vi.mock("@/integrations/supabase/shop-client", () => ({
  shopRpc: async (name: string, args: unknown) => rpc(name, args),
  shopFrom: (table: string) => {
    const b = {
      select: () => b,
      eq: () => b,
      maybeSingle: () => tableFetch[table](),
    };
    return b;
  },
}));

// One controllable confirm — the section must respect a "Huỷ".
let confirmAnswer = true;
const confirmFn = vi.fn(async () => confirmAnswer);
vi.mock("@/hooks/useConfirm", () => ({ useConfirm: () => confirmFn }));

// Chrome only — the review screen is the subject, not the shells.
vi.mock("@/components/admin/AdminLayout", () => ({
  AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/seo/DynamicMeta", () => ({ DynamicMeta: () => null }));
vi.mock("@/components/states/PageStates", () => ({
  LoadingState: () => <div>loading…</div>,
  ErrorState: () => <div>error</div>,
}));
vi.mock("@/components/shop/SellerRulesReceiptPanel", () => ({ SellerRulesReceiptPanel: () => null }));
vi.mock("@/components/shop/ShopShell", () => ({
  AdminShopFrame: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DefList: ({ rows }: { rows: [string, React.ReactNode][] }) => (
    <dl>{rows.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}</dl>
  ),
}));

const APP_ID = "80010001-0000-4000-8000-000000000001";
const SHOP_ID = "80020001-0000-4000-8000-000000000001";

const appRow = (over: Partial<Record<string, unknown>> = {}) => ({
  id: APP_ID,
  status: "approved",
  shop_id: SHOP_ID,
  shop_name: "Shop Test",
  seller_type: "ca-nhan",
  full_name: "Nguyen Van T",
  phone: "0901234567",
  city: "Đà Nẵng",
  internal_note: null,
  ...over,
});

const shopRow = (over: Partial<Record<string, unknown>> = {}) => ({
  id: SHOP_ID,
  slug: "shop-test",
  name: "Shop Test",
  state: "pending_activation",
  verified_method: null,
  ...over,
});

const setRows = (app: unknown, shop: unknown) => {
  tableFetch["shop_applications_admin"] = () => Promise.resolve({ data: app, error: null });
  tableFetch["shops"] = () => Promise.resolve({ data: shop, error: null });
};

const mount = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/admin/shop/applications/${APP_ID}`]}>
        <Routes>
          <Route path="/admin/shop/applications/:id" element={<AdminShopApplicationReview />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const findActivateButton = () => screen.findByRole("button", { name: "Kích hoạt shop" });

beforeEach(() => {
  rpc.mockReset();
  confirmFn.mockClear();
  confirmAnswer = true;
});
afterEach(cleanup);

describe("section visibility", () => {
  it("renders for an approved application with a shop_id", async () => {
    setRows(appRow(), shopRow());
    mount();
    expect(await screen.findByRole("heading", { name: "Kích hoạt shop" })).toBeTruthy();
  });

  it("is absent while the application is still under review", async () => {
    setRows(appRow({ status: "under_review", shop_id: null }), shopRow());
    mount();
    await screen.findByText(/xét hồ sơ/i);
    expect(screen.queryByRole("heading", { name: "Kích hoạt shop" })).toBeNull();
  });

  it("is absent when approved but shop_id is missing", async () => {
    setRows(appRow({ shop_id: null }), shopRow());
    mount();
    await screen.findByText(/xét hồ sơ/i);
    expect(screen.queryByRole("heading", { name: "Kích hoạt shop" })).toBeNull();
  });
});

describe("shop-state query states", () => {
  it("shows the one-line loading hint while the shop row is in flight", async () => {
    tableFetch["shop_applications_admin"] = () => Promise.resolve({ data: appRow(), error: null });
    tableFetch["shops"] = () => new Promise(() => {}); // never settles
    mount();
    expect(await screen.findByText("Đang tải trạng thái shop…")).toBeTruthy();
  });

  it("shows the error + retry, and the retry refetches", async () => {
    let calls = 0;
    tableFetch["shop_applications_admin"] = () => Promise.resolve({ data: appRow(), error: null });
    tableFetch["shops"] = () => {
      calls += 1;
      return calls === 1
        ? Promise.resolve({ data: null, error: { message: "boom" } })
        : Promise.resolve({ data: shopRow(), error: null });
    };
    mount();
    expect(await screen.findByText(/chưa tải được trạng thái shop/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await findActivateButton()).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("pending_activation → activate", () => {
  it("cancelling the confirm makes zero RPC calls", async () => {
    setRows(appRow(), shopRow());
    confirmAnswer = false;
    mount();
    fireEvent.click(await findActivateButton());
    await waitFor(() => expect(confirmFn).toHaveBeenCalledTimes(1));
    expect(rpc).not.toHaveBeenCalled();
  });

  it("confirming calls shop_activate with the migration's exact parameter names", async () => {
    setRows(appRow(), shopRow());
    rpc.mockResolvedValue("active");
    mount();
    fireEvent.click(await findActivateButton());
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    expect(rpc).toHaveBeenCalledWith("shop_activate", {
      _shop_id: SHOP_ID,
      _verified_method: "gap-truc-tiep",
    });
  });

  it("choosing 'Chưa xác minh' sends _verified_method: null", async () => {
    setRows(appRow(), shopRow());
    rpc.mockResolvedValue("active");
    mount();
    await findActivateButton();
    fireEvent.change(screen.getByLabelText("Phương thức xác minh (tuỳ chọn)"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Kích hoạt shop" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    expect(rpc).toHaveBeenCalledWith("shop_activate", { _shop_id: SHOP_ID, _verified_method: null });
  });

  it("an RPC failure shows the mapped message, keeps the select value, and re-enables the button", async () => {
    setRows(appRow(), shopRow());
    rpc.mockRejectedValue(new Error("shop_not_activatable:suspended"));
    mount();
    await findActivateButton();
    const select = screen.getByLabelText("Phương thức xác minh (tuỳ chọn)") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "giay-phep-kinh-doanh" } });
    fireEvent.click(screen.getByRole("button", { name: "Kích hoạt shop" }));

    expect(await screen.findByText(/không còn ở trạng thái chờ kích hoạt/i)).toBeTruthy();
    expect(select.value).toBe("giay-phep-kinh-doanh");
    const btn = screen.getByRole("button", { name: "Kích hoạt shop" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });
});

describe("non-pending states", () => {
  it("active: the button is GONE and the done notice links the live page", async () => {
    setRows(appRow(), shopRow({ state: "active", verified_method: "gap-truc-tiep" }));
    mount();
    expect(await screen.findByText("Đã kích hoạt.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Kích hoạt shop" })).toBeNull();
    const link = screen.getByRole("link", { name: /xem trang shop \(mở tab mới\)/i }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/shop/store/shop-test");
    // recorded method surfaces in the DefList
    expect(screen.getByText("Gặp trực tiếp")).toBeTruthy();
  });

  it("suspended: runbook notice, no button", async () => {
    setRows(appRow(), shopRow({ state: "suspended" }));
    mount();
    expect(await screen.findByText(/xử lý theo runbook/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Kích hoạt shop" })).toBeNull();
  });
});
