/** @vitest-environment jsdom */
/**
 * The rest of the product screen: the URL, the off-switch, and the gate.
 *
 * `SellerProductForm.save.test.tsx` covers the save button and
 * `SellerProductForm.draft-recovery.test.tsx` covers autosave. This covers the
 * three sections a seller reaches once the product exists, and each one has a
 * way of being quietly wrong:
 *
 *   · the slug is a URL somebody may already have. Changing it must be a
 *     deliberate, separate act with the consequence stated — not a side effect
 *     of renaming the product.
 *   · "ngừng bán" is destructive and must ask first, and a failure must not
 *     look like a success.
 *   · the submit gate is the SERVER's preflight, not a client re-derivation.
 *     A screen that offers a submit the server will refuse, or refuses one it
 *     would have taken, is worse than no checklist.
 *
 * Everything is driven through the real component and the DOM a seller uses.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";

const updateSlug = vi.fn();
const archive = vi.fn();
const submitProduct = vi.fn();
const refetchPreflight = vi.fn();
const navigate = vi.fn();

let productRow: Record<string, unknown> | null = null;
let preflightProblems: Array<Record<string, unknown>> = [];

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "prod-1" }),
  useNavigate: () => navigate,
  Link: ({ children, ...rest }: { children: React.ReactNode }) => <a {...rest}>{children}</a>,
}));

vi.mock("@/components/seo/DynamicMeta", () => ({ DynamicMeta: () => null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

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
  useSellerProduct: () => ({ data: productRow, isLoading: false, isError: false, refetch: vi.fn() }),
  useCreateProduct: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateProduct: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateProductSlug: () => ({ mutateAsync: updateSlug, isPending: false }),
  useArchiveProduct: () => ({ mutateAsync: archive, isPending: false }),
}));

vi.mock("@/hooks/shop/useProductVariants", () => ({
  useReconcileVariants: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/shop/useProductSubmit", () => ({
  useSubmitPreflight: () => ({ data: preflightProblems, isLoading: false, refetch: refetchPreflight }),
  useSubmitProduct: () => ({ mutateAsync: submitProduct, isPending: false }),
  useWithdrawSubmission: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useProductPreview: () => ({ data: null }),
}));

const { default: SellerProductForm } = await import("../SellerProductForm");

const render = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(
    <QueryClientProvider client={client}>
      <SellerProductForm />
    </QueryClientProvider>,
  );
};

const baseProduct = (over: Record<string, unknown> = {}) => ({
  id: "prod-1",
  shop_id: "shop-1",
  slug: "giay-court-pro",
  title: "Giày Court Pro",
  description: "Mô tả đủ dài để qua kiểm tra sơ bộ của biểu mẫu.",
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
  variants: [{ id: "v1", price_vnd: 1290000, stock_on_hand: 3, option_values: null, sku: "CP-1", position: 0 }],
  media: [],
  mediaCount: 0,
  ...over,
});

beforeEach(() => {
  updateSlug.mockReset().mockResolvedValue("giay-court-pro-2");
  archive.mockReset().mockResolvedValue({ ok: true });
  submitProduct.mockReset().mockResolvedValue({ ok: true });
  refetchPreflight.mockReset();
  navigate.mockReset();
  window.localStorage.clear();
  preflightProblems = [];
  productRow = baseProduct();
});
afterEach(cleanup);

// ─── The URL ────────────────────────────────────────────────────────────────

describe("the slug is a link somebody may already hold", () => {
  it("does not follow the title — renaming a product must not move its URL", async () => {
    render();
    await waitFor(() => screen.getByLabelText("Tên sản phẩm"));
    fireEvent.change(screen.getByLabelText("Tên sản phẩm"), { target: { value: "Giày Court Pro 2026" } });
    // The seller renamed the product. Nothing about the address changed, and
    // no slug RPC was called behind their back.
    expect(updateSlug).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("giay-court-pro");
  });

  it("goes through its own RPC, once, when the seller confirms", async () => {
    render();
    await waitFor(() => screen.getByRole("button", { name: "Đổi đường dẫn" }));
    fireEvent.click(screen.getByRole("button", { name: "Đổi đường dẫn" }));

    fireEvent.change(screen.getByLabelText("Đường dẫn mới"), { target: { value: "giay-court-pro-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đổi" }));

    await waitFor(() => expect(updateSlug).toHaveBeenCalledTimes(1));
    expect(updateSlug).toHaveBeenCalledWith("giay-court-pro-2");
  });

  it("cannot be edited at all once the product is approved", async () => {
    // Written expecting a louder warning; the screen turned out to be stricter
    // than that, and the stricter behaviour is the one worth pinning. An
    // approved product's address is not editable here, so the warning copy is
    // unreachable from this state — and a test asserting that copy would have
    // been asserting a branch no seller can get to.
    productRow = baseProduct({ is_published: true, status: "approved" });
    render();
    await waitFor(() => screen.getByRole("button", { name: "Đổi đường dẫn" }));
    fireEvent.click(screen.getByRole("button", { name: "Đổi đường dẫn" }));

    expect(screen.queryByLabelText("Đường dẫn mới")).toBeNull();
    expect(document.body.textContent).toContain("Sản phẩm đã qua duyệt nên chưa sửa nội dung");
    expect(updateSlug).not.toHaveBeenCalled();
  });

  it("says the milder truth while it has never been on sale", async () => {
    render();
    await waitFor(() => screen.getByRole("button", { name: "Đổi đường dẫn" }));
    fireEvent.click(screen.getByRole("button", { name: "Đổi đường dẫn" }));
    expect(document.body.textContent).toContain("gần như không ảnh hưởng ai");
  });

  it("shows the server's refusal and keeps the seller in the editor", async () => {
    updateSlug.mockRejectedValueOnce(new Error("slug đã được dùng"));
    render();
    await waitFor(() => screen.getByRole("button", { name: "Đổi đường dẫn" }));
    fireEvent.click(screen.getByRole("button", { name: "Đổi đường dẫn" }));
    fireEvent.change(screen.getByLabelText("Đường dẫn mới"), { target: { value: "trung-lap" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đổi" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    // The main draft is untouched: a rejected slug change must not cost the
    // seller the description they were in the middle of writing.
    expect((screen.getByLabelText("Tên sản phẩm") as HTMLInputElement).value).toBe("Giày Court Pro");
  });

  it("can be abandoned without calling anything", async () => {
    render();
    await waitFor(() => screen.getByRole("button", { name: "Đổi đường dẫn" }));
    fireEvent.click(screen.getByRole("button", { name: "Đổi đường dẫn" }));
    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));
    await waitFor(() => expect(screen.queryByLabelText("Đường dẫn mới")).toBeNull());
    expect(updateSlug).not.toHaveBeenCalled();
  });
});

// ─── The off-switch ─────────────────────────────────────────────────────────

describe("ngừng bán asks before it acts", () => {
  it("does nothing until the seller confirms", async () => {
    render();
    await waitFor(() => screen.getByRole("button", { name: "Ngừng bán sản phẩm này" }));
    fireEvent.click(screen.getByRole("button", { name: "Ngừng bán sản phẩm này" }));

    // The consequences are spelled out, and nothing has happened yet.
    expect(screen.getByText("Ngừng bán sẽ làm những việc sau:")).toBeTruthy();
    expect(archive).not.toHaveBeenCalled();
  });

  it("leaves everything alone when the seller backs out", async () => {
    render();
    await waitFor(() => screen.getByRole("button", { name: "Ngừng bán sản phẩm này" }));
    fireEvent.click(screen.getByRole("button", { name: "Ngừng bán sản phẩm này" }));
    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));

    await waitFor(() => expect(screen.queryByText("Ngừng bán sẽ làm những việc sau:")).toBeNull());
    expect(archive).not.toHaveBeenCalled();
  });

  it("archives the right product when confirmed", async () => {
    render();
    await waitFor(() => screen.getByRole("button", { name: "Ngừng bán sản phẩm này" }));
    fireEvent.click(screen.getByRole("button", { name: "Ngừng bán sản phẩm này" }));
    fireEvent.click(screen.getByRole("button", { name: "Vẫn ngừng bán" }));

    await waitFor(() => expect(archive).toHaveBeenCalledTimes(1));
    expect(archive).toHaveBeenCalledWith({ productId: "prod-1", archived: false });
  });

  it("🔴 does not pretend it worked when the server refuses", async () => {
    archive.mockRejectedValueOnce(new Error("không ngừng bán được"));
    render();
    await waitFor(() => screen.getByRole("button", { name: "Ngừng bán sản phẩm này" }));
    fireEvent.click(screen.getByRole("button", { name: "Ngừng bán sản phẩm này" }));
    fireEvent.click(screen.getByRole("button", { name: "Vẫn ngừng bán" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("không ngừng bán được"));
  });

  it("offers the way back only from an archived product", async () => {
    productRow = baseProduct({ status: "archived" });
    render();
    await waitFor(() => expect(screen.getByRole("button", { name: "Bán lại sản phẩm này" })).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Ngừng bán sản phẩm này" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Bán lại sản phẩm này" }));
    await waitFor(() => expect(archive).toHaveBeenCalledWith({ productId: "prod-1", archived: true }));
  });
});

// ─── The gate ───────────────────────────────────────────────────────────────

describe("the submit gate is the server's answer, not the screen's guess", () => {
  it("lists what the server said is wrong, one line each", async () => {
    // The screen renders the SERVER's codes through the shared copy table. A
    // `message` field in the fixture would let the screen invent its own
    // wording, which is the thing this panel exists not to do.
    preflightProblems = [
      { code: "no_media", section: "media" },
      { code: "price_missing", section: "variants", variant_id: "v1" },
    ];
    render();
    await waitFor(() => expect(document.body.textContent).toContain("Chưa có ảnh nào."));
    expect(document.body.textContent).toContain("Phiên bản này chưa có giá.");
    expect(document.body.textContent).toContain("Còn 2 chỗ chưa xong trước khi gửi duyệt:");
    // One "go to it" affordance per problem, so a checklist entry is never a
    // dead end the seller has to hunt for.
    expect(screen.getAllByRole("button", { name: "Đi tới chỗ cần sửa" })).toHaveLength(2);
  });

  it("does not submit while the server still has objections", async () => {
    preflightProblems = [{ code: "no_media", section: "media" }];
    render();
    await waitFor(() => expect(document.body.textContent).toContain("Chưa có ảnh nào."));
    const submit = screen.queryByRole("button", { name: /Gửi duyệt/ });
    if (submit) {
      expect(submit.hasAttribute("disabled")).toBe(true);
      fireEvent.click(submit);
    }
    expect(submitProduct).not.toHaveBeenCalled();
  });

  it("submits once the checklist is clean", async () => {
    preflightProblems = [];
    render();
    const submit = await waitFor(() => screen.getByRole("button", { name: /Gửi duyệt/ }));
    expect(submit.hasAttribute("disabled")).toBe(false);
    fireEvent.click(submit);
    await waitFor(() => expect(submitProduct).toHaveBeenCalledTimes(1));
  });

  it("🔴 a rejected submit does not move the product to pending review", async () => {
    submitProduct.mockRejectedValueOnce(new Error("preflight_failed"));
    render();
    const submit = await waitFor(() => screen.getByRole("button", { name: /Gửi duyệt/ }));
    fireEvent.click(submit);
    await waitFor(() => expect(submitProduct).toHaveBeenCalled());
    // Still the editable draft screen: no badge, no lock, no false comfort.
    expect(screen.getByLabelText("Tên sản phẩm")).toBeTruthy();
  });
});

describe("a product waiting for a moderator is not editable", () => {
  it("locks the editor while it is pending review", async () => {
    productRow = baseProduct({ status: "pending_review", submitted_at: "2026-08-12T00:00:00Z" });
    render();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Lưu thay đổi" })).toBeNull());
    // The screen says why, rather than silently disabling everything.
    expect(screen.getByLabelText("Tên sản phẩm").hasAttribute("disabled")).toBe(true);
  });
});
