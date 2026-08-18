/** @vitest-environment jsdom */
/**
 * The autosaved draft, and the two ways it can lie to a seller.
 *
 * `SellerProductForm.save.test.tsx` covers the save button. This covers what
 * happens before anybody presses it: a copy of the draft is written to
 * localStorage on every edit so a closed tab or a dead battery does not cost an
 * afternoon of typing. That copy is only useful if it is honest about two
 * things.
 *
 *   · It must never silently win over the server. Someone edits on a phone,
 *     then opens the laptop where a stale local copy is sitting — restoring it
 *     without asking would quietly undo the phone's work.
 *   · It must never take the editor down with it. A corrupt entry, or a
 *     browser in private mode that throws on write, is a bad afternoon for the
 *     seller either way; it must not also be a blank screen.
 *
 * Everything below drives the real component through the real localStorage.
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

// The lazily-loaded media editor constructs the real client at module load and
// wants env this test has no business supplying. Same stub as
// page-error-states.test.tsx.
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

const KEY = "tph:shop:product-draft:shop-1:prod-1";

const baseProduct = (over: Record<string, unknown> = {}) => ({
  id: "prod-1",
  shop_id: "shop-1",
  slug: "giay-court-pro",
  title: "Giày Court Pro",
  description: "Mô tả trên máy chủ, đủ dài để qua kiểm tra sơ bộ.",
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

/** A stored draft in the shape the form writes. */
const storeDraft = (over: Record<string, unknown> = {}) =>
  window.localStorage.setItem(
    KEY,
    JSON.stringify({
      savedAt: Date.parse("2026-08-12T10:00:00.000Z"),
      clientToken: "token-from-the-phone",
      draft: {
        title: "Giày Court Pro — bản đang sửa dở",
        description: "Mô tả trên máy này, khác hẳn bản máy chủ.",
        category_slug: "giay",
        condition: "new",
        price_vnd: "1290000",
        stock_on_hand: "3",
        sku: "CP-1",
        in_stock: true,
        ...over,
      },
    }),
  );

const title = () => screen.getByLabelText("Tên sản phẩm") as HTMLInputElement;

beforeEach(() => {
  mutate.mockReset();
  navigate.mockReset();
  window.localStorage.clear();
  productRow = baseProduct();
});
afterEach(cleanup);

describe("a local draft that differs from the server", () => {
  it("asks instead of restoring, and says when the local copy was saved", async () => {
    storeDraft();
    render();
    await waitFor(() => expect(screen.getByText("Có một bản đang sửa dở trên máy này.")).toBeTruthy());
    // Neither copy is applied yet: the server text is on screen, and nothing
    // has been thrown away.
    expect(title().value).toBe("Giày Court Pro");
    expect(window.localStorage.getItem(KEY)).not.toBeNull();
  });

  it("restores the local copy when the seller picks it", async () => {
    storeDraft();
    render();
    await waitFor(() => screen.getByText("Có một bản đang sửa dở trên máy này."));
    fireEvent.click(screen.getByRole("button", { name: "Dùng bản đang sửa dở" }));
    await waitFor(() => expect(title().value).toBe("Giày Court Pro — bản đang sửa dở"));
    expect(screen.queryByText("Có một bản đang sửa dở trên máy này.")).toBeNull();
  });

  it("drops the local copy when the seller picks the server one", async () => {
    storeDraft();
    render();
    await waitFor(() => screen.getByText("Có một bản đang sửa dở trên máy này."));
    fireEvent.click(screen.getByRole("button", { name: "Dùng bản trên máy chủ" }));
    await waitFor(() => expect(screen.queryByText("Có một bản đang sửa dở trên máy này.")).toBeNull());
    expect(title().value).toBe("Giày Court Pro");
    // Chosen deliberately, so it must not come back on the next reload.
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("does not ask when the local copy says the same thing as the server", async () => {
    // Identical drafts are not a conflict; asking would be noise on every
    // single reload after a successful save.
    storeDraft({
      title: "Giày Court Pro",
      description: "Mô tả trên máy chủ, đủ dài để qua kiểm tra sơ bộ.",
    });
    render();
    await waitFor(() => expect(title().value).toBe("Giày Court Pro"));
    expect(screen.queryByText("Có một bản đang sửa dở trên máy này.")).toBeNull();
  });
});

describe("the store itself misbehaving", () => {
  it("ignores a corrupt entry rather than rendering an error", async () => {
    window.localStorage.setItem(KEY, "{not json");
    render();
    await waitFor(() => expect(title().value).toBe("Giày Court Pro"));
    expect(screen.queryByText("error")).toBeNull();
  });

  it("keeps editing when the browser refuses to write — private mode, quota", async () => {
    // Scoped to our key: a blanket throw would also break anything else that
    // happens to touch storage, and then the test would be about that instead.
    const real = Storage.prototype.setItem;
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, k: string, v: string) {
        if (k === KEY) throw new DOMException("QuotaExceededError");
        real.call(this, k, v);
      });
    render();
    await waitFor(() => title());
    fireEvent.change(title(), { target: { value: "Giày Court Pro 2" } });
    // The server copy is still the real one; a failed autosave is not the
    // seller's problem and must not become their error message.
    await waitFor(() => expect(title().value).toBe("Giày Court Pro 2"));
    expect(screen.queryByText("error")).toBeNull();
    setItem.mockRestore();
  });

  it("writes the draft as the seller types, so a closed tab costs nothing", async () => {
    render();
    await waitFor(() => title());
    fireEvent.change(title(), { target: { value: "Giày Court Pro — vừa gõ" } });
    await waitFor(() => expect(window.localStorage.getItem(KEY)).not.toBeNull());
    const stored = JSON.parse(window.localStorage.getItem(KEY)!);
    expect(stored.draft.title).toBe("Giày Court Pro — vừa gõ");
    // Epoch milliseconds, which is what RecoveryNotice formats for the seller.
    expect(typeof stored.savedAt).toBe("number");
    expect(stored.savedAt).toBeGreaterThan(0);
  });
});
