/** @vitest-environment jsdom */
/**
 * The seller list's photo slot, all four states:
 *   (a) public_path  → <img> pointing at the public bucket, no mint at all
 *   (b) draft-only   → shimmer, then <img> once the ONE page-wide mint lands
 *   (c) no media     → ImageOff
 *   (d) mint refused → ImageOff, no notice, no retry
 * Plus: the cover is the LOWEST position, not the first row that arrived.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { SellerProductRow } from "@/integrations/supabase/shop-schema";

const createSignedUrls = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ createSignedUrls }) } },
}));

const listQuery = vi.fn();
vi.mock("@/hooks/shop/useSellerProducts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/shop/useSellerProducts")>();
  return {
    ...actual,
    useSellerProducts: () => listQuery(),
    useProductStatusCounts: () => ({ data: { approved: 1 }, isLoading: false, isError: false }),
  };
});

vi.mock("@/hooks/shop/useShopProfile", () => ({
  useMyShopMembership: () => ({
    data: { shop_id: "shop-1", role: "owner" },
    isLoading: false,
    isError: false,
  }),
  useShopProfile: () => ({ data: { state: "active" }, isLoading: false, isError: false }),
  useShopCategories: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock("@/components/seo/DynamicMeta", () => ({ DynamicMeta: () => null }));
vi.mock("@/components/states/PageStates", () => ({
  LoadingState: () => <div>loading…</div>,
  ErrorState: () => <div>error</div>,
}));
vi.mock("@/components/shop/ShopShell", () => ({
  ShopScrollShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SellerShell: ({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) => (
    <div>
      {actions}
      {children}
    </div>
  ),
}));

const SellerProducts = (await import("../SellerProducts")).default;

const row = (
  id: string,
  media: Array<{ id: string; position: number; public_path: string | null; draft_path: string }>,
): SellerProductRow =>
  ({
    id,
    title: `Sản phẩm ${id}`,
    status: "approved",
    applicant_note: null,
    updated_at: "2026-08-10T00:00:00Z",
    product_variants: [
      { id: `v-${id}`, price_vnd: 150000, stock_on_hand: 3, position: 0, sku: null, retired_at: null },
    ],
    product_media: media,
  }) as unknown as SellerProductRow;

const mount = (rows: SellerProductRow[]) => {
  listQuery.mockReturnValue({
    data: { rows, total: rows.length, pageCount: 1 },
    isLoading: false,
    isError: false,
  });
  return render(
    <MemoryRouter>
      <SellerProducts />
    </MemoryRouter>,
  );
};

const thumbImgs = (c: HTMLElement) =>
  Array.from(c.querySelectorAll<HTMLImageElement>("img.tl-shop-thumb-img"));
const thumbOffIcons = (c: HTMLElement) => c.querySelectorAll(".tl-shop-thumb svg");
const thumbSkeletons = (c: HTMLElement) => c.querySelectorAll(".tl-shop-thumb .tl-shop-sk");

beforeEach(() => {
  createSignedUrls.mockReset().mockResolvedValue({ data: [] });
  listQuery.mockReset();
});
afterEach(cleanup);

describe("Thumb", () => {
  it("(a) renders the public rendition straight away, without minting anything", async () => {
    const { container } = mount([
      row("p1", [{ id: "m1", position: 0, public_path: "shop-1/p1/cover.webp", draft_path: "shop-1/p1/d.webp" }]),
    ]);

    // Table row + mobile card each render the same thumb.
    const imgs = thumbImgs(container);
    expect(imgs.length).toBeGreaterThan(0);
    for (const img of imgs) {
      expect(img.src).toContain("/storage/v1/object/public/shop-product-media/shop-1/p1/cover.webp");
    }
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  it("(b) shows a shimmer for draft-only covers, then the image — one mint for the whole list", async () => {
    let resolveMint!: (v: unknown) => void;
    createSignedUrls.mockReturnValue(new Promise((r) => (resolveMint = r)));

    const { container } = mount([
      row("p1", [{ id: "m1", position: 0, public_path: null, draft_path: "shop-1/p1/d.webp" }]),
      // Rows arrive out of order: position 0 must win, position 2 never minted.
      row("p2", [
        { id: "m3", position: 2, public_path: null, draft_path: "shop-1/p2/hi.webp" },
        { id: "m2", position: 0, public_path: null, draft_path: "shop-1/p2/lo.webp" },
      ]),
    ]);

    // Not yet settled: shimmer, and NOT ImageOff (chưa-tải ≠ không-có).
    expect(thumbSkeletons(container).length).toBeGreaterThan(0);
    expect(thumbOffIcons(container).length).toBe(0);
    expect(thumbImgs(container).length).toBe(0);

    resolveMint({
      data: [
        { path: "shop-1/p1/d.webp", signedUrl: "https://signed.example/p1?token=a" },
        { path: "shop-1/p2/lo.webp", signedUrl: "https://signed.example/p2?token=b" },
      ],
    });

    await waitFor(() => expect(thumbImgs(container).length).toBeGreaterThan(0));
    expect(thumbImgs(container).some((i) => i.src.includes("signed.example/p1"))).toBe(true);
    expect(thumbImgs(container).some((i) => i.src.includes("signed.example/p2"))).toBe(true);

    // ONE call for the whole page, carrying only the lowest-position paths.
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    expect(createSignedUrls.mock.calls[0][0]).toEqual(["shop-1/p1/d.webp", "shop-1/p2/lo.webp"]);
    expect(createSignedUrls.mock.calls[0][1]).toBe(300);
  });

  it("(c) a product with no media shows ImageOff, not a shimmer", () => {
    const { container } = mount([row("p1", [])]);

    expect(thumbOffIcons(container).length).toBeGreaterThan(0);
    expect(thumbSkeletons(container).length).toBe(0);
    expect(thumbImgs(container).length).toBe(0);
    expect(createSignedUrls).not.toHaveBeenCalled();
    // The existing pill keeps saying it in words.
    expect(screen.getAllByText("Chưa có ảnh").length).toBeGreaterThan(0);
  });

  it("a failed list says it failed — error is not empty, and retry refetches", () => {
    const refetch = vi.fn();
    listQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: {}, refetch });
    render(
      <MemoryRouter>
        <SellerProducts />
      </MemoryRouter>,
    );

    expect(screen.getByRole("alert").textContent).toContain("Chưa tải được danh sách sản phẩm.");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("a loading list shows skeleton rows, not thumbs", () => {
    listQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { container } = render(
      <MemoryRouter>
        <SellerProducts />
      </MemoryRouter>,
    );
    expect(screen.getByText("Đang tải danh sách sản phẩm…")).toBeTruthy();
    expect(container.querySelectorAll(".tl-shop-thumb")).toHaveLength(0);
  });

  it("(d) a refused mint falls back to ImageOff — no notice, no retry", async () => {
    createSignedUrls.mockRejectedValue(new Error("storage down"));

    const { container } = mount([
      row("p1", [{ id: "m1", position: 0, public_path: null, draft_path: "shop-1/p1/d.webp" }]),
    ]);

    await waitFor(() => expect(thumbOffIcons(container).length).toBeGreaterThan(0));
    expect(thumbImgs(container).length).toBe(0);
    expect(thumbSkeletons(container).length).toBe(0);
  });
});
