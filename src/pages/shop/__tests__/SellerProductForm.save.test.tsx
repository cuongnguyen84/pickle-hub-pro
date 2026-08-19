/** @vitest-environment jsdom */
/**
 * The save button, and every way it can end.
 *
 * The question this file exists to answer is narrow and specific: can the
 * screen get stuck on "Đang lưu…" with nothing in flight? It could — there was
 * an early return after the state had already been set to "saving", so a
 * product query that had settled to null left the button disabled forever with
 * no error and no way back.
 *
 * It also locks the multi-variant payload at the level the seller actually
 * uses: the form, not the pure function.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";

const mutate = vi.fn();
const navigate = vi.fn();

let productRow: Record<string, unknown> | null = null;

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "prod-1" }),
  useNavigate: () => navigate,
  Link: ({ children, ...rest }: { children: React.ReactNode }) => <a {...rest}>{children}</a>,
}));

vi.mock("@/components/seo/DynamicMeta", () => ({ DynamicMeta: () => null }));

vi.mock("@/components/shop/ShopShell", () => ({
  ShopScrollShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SellerShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DefList: () => null,
}));

vi.mock("@/hooks/shop/useShopProfile", () => ({
  useMyShopMembership: () => ({ data: { shop_id: "shop-1", role: "owner" }, isLoading: false, isError: false, refetch: vi.fn() }),
  useShopProfile: () => ({ data: { id: "shop-1", state: "active" }, isLoading: false, isError: false, refetch: vi.fn() }),
  useShopCategories: () => ({ data: [{ slug: "giay", name_vi: "Giày" }] }),
}));

vi.mock("@/hooks/shop/useSellerProducts", () => ({
  useSellerProduct: () => ({
    data: productRow,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useCreateProduct: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateProduct: () => ({ mutateAsync: mutate, isPending: false }),
  useUpdateProductSlug: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useArchiveProduct: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/shop/useProductVariants", () => ({
  useReconcileVariants: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/shop/useProductSubmit", () => ({
  useSubmitPreflight: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
  useSubmitProduct: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useWithdrawSubmission: () => ({ mutateAsync: vi.fn(), isPending: false }),
  // P4c: đường quay lại cho hàng đang bán. Màn này gọi nó vô điều kiện.
  useEditAgain: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false, error: null }),
  useProductPreview: () => ({ data: null }),
}));

const { default: SellerProductForm } = await import("../SellerProductForm");

/** The lazy media and variant editors use React Query of their own, so the
 *  tree needs a client even though every hook this file cares about is mocked. */
const render = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

const baseProduct = (over: Record<string, unknown> = {}) => ({
  id: "prod-1",
  shop_id: "shop-1",
  slug: "giay-court-pro",
  title: "Giày Court Pro",
  description: "Mô tả cũ.",
  category_slug: "giay",
  condition: "new",
  status: "draft",
  is_published: false,
  in_stock: true,
  availability_updated_at: null,
  submitted_at: null,
  decided_at: null,
  applicant_note: null,
  requested_fields: [],
  version: 4,
  client_token: null,
  option_groups: [],
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
  variants: [
    { id: "v1", price_vnd: 1290000, stock_on_hand: 3, option_values: null, sku: "CP-1", position: 0 },
  ],
  media: [],
  mediaCount: 0,
  ...over,
});

/** Type a change so the form becomes dirty and the button enables. */
const editTitle = (value: string) => {
  fireEvent.change(screen.getByLabelText("Tên sản phẩm"), { target: { value } });
};

const saveButton = () => screen.getByRole("button", { name: "Lưu thay đổi" });

beforeEach(() => {
  mutate.mockReset();
  navigate.mockReset();
  window.localStorage.clear();
});
afterEach(cleanup);

describe("multi-variant save leaves the matrix alone", () => {
  it("sends no variant when the product has option groups", async () => {
    productRow = baseProduct({
      option_groups: [{ name: "Màu sắc", values: ["Trắng", "Đen"] }],
      variants: [
        { id: "v1", price_vnd: 1290000, stock_on_hand: 2, option_values: { "Màu sắc": "Trắng" }, sku: "W", position: 0 },
        { id: "v2", price_vnd: 1350000, stock_on_hand: 1, option_values: { "Màu sắc": "Đen" }, sku: "B", position: 1 },
      ],
    });
    mutate.mockResolvedValue({});
    render(<SellerProductForm />);

    editTitle("Giày Court Pro 2026");
    fireEvent.click(saveButton());

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    const payload = mutate.mock.calls[0][0];
    expect(payload.variant).toBeUndefined();
    // The strongest form: the numbers are not in the payload at all. Before the
    // fix they were, and product_update refused the whole save.
    expect(JSON.stringify(payload)).not.toContain("price_vnd");
    expect(JSON.stringify(payload)).not.toContain("stock_on_hand");
    expect(payload.patch.title).toBe("Giày Court Pro 2026");
    expect(payload.expectedVersion).toBe(4);
  });

  it("🔴 KHÔNG gửi giá cho sản phẩm đơn nữa — kể cả khi biểu mẫu vẫn cầm một con số", async () => {
    // Câu này trước đây khoá điều NGƯỢC LẠI: "vẫn gửi phiên bản mặc định cho
    // sản phẩm đơn". Nó xanh suốt trong khi một người bán thật mất hai lần sửa
    // giá ngày 18/08 — vì cái nó khoá chính là con đường gây lỗi.
    //
    // Ô giá đơn giản CHỈ hiện khi tạo mới. Ở màn sửa nó không tồn tại, nên
    // `draft.price_vnd` mãi là con số gieo từ lúc tải trang; gửi nó đi là ghi
    // đè lên đúng cái giá mà bảng phiên bản vừa lưu.
    productRow = baseProduct();
    mutate.mockResolvedValue({});
    render(<SellerProductForm />);

    editTitle("Giày Court Pro Mới");
    fireEvent.click(saveButton());

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    const payload = mutate.mock.calls[0][0];
    expect(payload.variant).toBeUndefined();
    // Con số gieo từ fixture (1290000) tuyệt đối không được đi kèm.
    expect(JSON.stringify(payload)).not.toContain("1290000");
    expect(JSON.stringify(payload)).not.toContain("price");
    expect(JSON.stringify(payload)).not.toContain("stock");
    // Nhưng phần chữ vẫn phải đi, nếu không thì "sửa tên" cũng hỏng theo.
    expect(payload.patch.title).toBe("Giày Court Pro Mới");
  });
});

describe("no save branch can strand the button on Đang lưu…", () => {
  it("leaves the saving state when the RPC rejects, and offers Retry", async () => {
    productRow = baseProduct();
    mutate.mockRejectedValueOnce({ code: "PGRST301", message: "boom" });
    render(<SellerProductForm />);

    editTitle("Tên mới");
    fireEvent.click(saveButton());

    await waitFor(() => expect(screen.getByText("Chưa lưu được")).toBeTruthy());
    expect(screen.queryByText("Đang lưu…")).toBeNull();
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeTruthy();
    // Recoverable: the primary button is usable again, not stuck disabled.
    expect(saveButton().hasAttribute("disabled")).toBe(false);
  });

  it("keeps what the seller typed through the failure", async () => {
    productRow = baseProduct();
    mutate.mockRejectedValueOnce({ code: "PGRST301", message: "boom" });
    render(<SellerProductForm />);

    editTitle("Tên chưa lưu được");
    fireEvent.click(saveButton());

    await waitFor(() => expect(screen.getByText("Chưa lưu được")).toBeTruthy());
    expect((screen.getByLabelText("Tên sản phẩm") as HTMLInputElement).value).toBe("Tên chưa lưu được");
  });

  it("retries successfully, and only one save lands", async () => {
    productRow = baseProduct();
    mutate.mockRejectedValueOnce({ code: "PGRST301", message: "boom" }).mockResolvedValueOnce({});
    render(<SellerProductForm />);

    editTitle("Tên mới");
    fireEvent.click(saveButton());
    await waitFor(() => expect(screen.getByRole("button", { name: "Thử lại" })).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(2));
    // Two attempts, one success — and the second carried the same edit.
    expect(mutate.mock.calls[1][0].patch.title).toBe("Tên mới");
    // The failure is cleared rather than left on screen next to a success.
    await waitFor(() => expect(screen.queryByText("Chưa lưu được")).toBeNull());
  });

  it("shows the conflict panel for a stale version, not the generic error", async () => {
    productRow = baseProduct();
    mutate.mockRejectedValueOnce({ code: "PT409", message: "sản phẩm đã được cập nhật ở nơi khác" });
    render(<SellerProductForm />);

    editTitle("Tên mới");
    fireEvent.click(saveButton());

    await waitFor(() =>
      expect(screen.getByText("Sản phẩm này vừa được sửa ở nơi khác.")).toBeTruthy(),
    );
    // A generic "Thử lại" here would send the same stale version again.
    expect(screen.queryByRole("button", { name: "Thử lại" })).toBeNull();
    expect(screen.getByRole("button", { name: "Dùng bản trên máy chủ" })).toBeTruthy();
  });

  it("says the product is gone instead of offering a save", async () => {
    // The in-flight version of this — the query settling to null between the
    // click and the await — is a narrow race, and the branch that handles it
    // now sets an error state rather than returning while the label still said
    // "Đang lưu…". What is reachable from outside is this: no product, no save
    // button, and a sentence saying so.
    productRow = null;
    render(<SellerProductForm />);

    expect(screen.getByText("Không tìm thấy sản phẩm")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Lưu thay đổi" })).toBeNull();
    expect(screen.queryByText("Đang lưu…")).toBeNull();
  });

  it("refuses to save an invalid draft without ever entering the saving state", async () => {
    productRow = baseProduct();
    render(<SellerProductForm />);

    editTitle("x");
    fireEvent.click(saveButton());

    await waitFor(() => expect(screen.getByText(/từ 3 đến 140 ký tự/)).toBeTruthy());
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.queryByText("Đang lưu…")).toBeNull();
    expect(saveButton().hasAttribute("disabled")).toBe(false);
  });
});
