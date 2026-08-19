/** @vitest-environment jsdom */
/**
 * The buyer's grid — its four states, and the boundary it sits on.
 *
 * `publicCatalog.test.ts` owns the label and URL helpers. What is tested here
 * is what the grid does with a row, and the two ways a buyer surface goes
 * wrong:
 *
 *   · a failed request rendered as "no products". A shopper told the sàn is
 *     empty stops looking; a shopper told the load failed presses Thử lại.
 *     Loading, error, empty and data have to be four distinct answers.
 *   · a seller-only field reaching the DOM. The buyer row is a DTO, and the
 *     card renders from it — so anything extra the server ever adds to that
 *     row (a draft path, a stock count, an internal note) would be carried
 *     into the page by the same spread that carries the title. The test
 *     hands the grid a row salted with exactly those fields and asserts none
 *     of them reaches the document, in text, in an attribute, or in a URL.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render as rtlRender, screen } from "@testing-library/react";
import type { ProductCard as Card } from "@/hooks/shop/usePublicShop";

vi.mock("react-router-dom", () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...rest}>{children}</a>
  ),
}));

const { ResultsGrid } = await import("../CatalogResults");

// ─── Fixtures ───────────────────────────────────────────────────────────────

const card = (over: Partial<Card> = {}): Card =>
  ({
    id: "p1",
    slug: "giay-court-pro",
    title: "Giày Court Pro",
    condition: "new",
    created_at: "2026-08-01T00:00:00Z",
    category: { slug: "giay", name: "Giày" },
    shop: { slug: "shop-a", name: "Shop A", verified: false },
    price_min: 1290000,
    price_max: null,
    availability: "in_stock",
    cover: null,
    ...over,
  }) as Card;

/** The public row as it comes off the RPC, plus every seller-only column that
 *  lives on the same product in the database. None of these is in the DTO; the
 *  point is what happens if one arrives anyway. */
const SEEDED_PRIVATE = {
  draft_path: "draft/1f2e3d-secret.jpg",
  rendition_source_path: "draft/1f2e3d-secret-1600.webp",
  // Deliberately not a small number: "4" occurs inside widths and prices, so a
  // scalar stock count needs a value that can only have come from here.
  stock_on_hand: 4737,
  internal_note: "chỉ còn 4737 đôi, giữ cho khách quen",
  client_token: "tok-9c1f",
  signed_url: "https://x.supabase.co/object/sign/a?token=eyJhbGciOi",
  applicant_note: "đang chờ duyệt",
};

const grid = (over: Partial<Parameters<typeof ResultsGrid>[0]> = {}) =>
  rtlRender(
    <ResultsGrid
      rows={[card()]}
      total={1}
      isLoading={false}
      isError={false}
      onRetry={vi.fn()}
      emptyTitle="Chưa có sản phẩm nào"
      {...over}
    />,
  );

afterEach(cleanup);

// ─── Four states, four answers ──────────────────────────────────────────────

describe("the four states are four different answers", () => {
  it("says it is loading, and reserves the space", () => {
    grid({ isLoading: true, rows: [] });

    const list = screen.getByLabelText("Đang tải sản phẩm");
    expect(list.getAttribute("aria-busy")).toBe("true");
    expect(list.querySelectorAll("li")).toHaveLength(8);
    expect(document.body.textContent).not.toContain("Chưa có sản phẩm nào");
  });

  it("says a failed load is a failed load, never an empty catalogue", () => {
    const onRetry = vi.fn();
    grid({ isError: true, rows: [], onRetry });

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Chưa tải được danh sách");
    expect(alert.textContent).toContain("không phải sàn đang trống");
    // The words that would make a shopper give up must not be on this screen.
    expect(document.body.textContent).not.toContain("Chưa có sản phẩm nào");

    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("loading and error win over rows that are already in hand", () => {
    const { unmount } = grid({ isLoading: true, rows: [card()] });
    expect(screen.queryByText("Giày Court Pro")).toBeNull();
    unmount();

    grid({ isError: true, rows: [card()] });
    expect(screen.queryByText("Giày Court Pro")).toBeNull();
  });

  it("offers a way out of an empty result only when a filter caused it", () => {
    const onClearFilters = vi.fn();
    const { unmount } = grid({ rows: [], total: 0, emptyTitle: "Không có kết quả", onClearFilters });
    fireEvent.click(screen.getByRole("button", { name: "Bỏ bộ lọc" }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
    unmount();

    grid({ rows: [], total: 0, emptyTitle: "Chưa có sản phẩm nào" });
    expect(screen.queryByRole("button", { name: "Bỏ bộ lọc" })).toBeNull();
  });

  it("admits a thin catalogue instead of implying there is more", () => {
    // R3: the count line stays before the grid; the honest-sparse sentence
    // moved AFTER the grid, verbatim — demoted, never deleted.
    const { unmount } = grid({ rows: [card()], total: 3 });
    expect(screen.getByRole("status").textContent).toBe("3 sản phẩm");
    expect(document.body.textContent).toContain(
      "Sàn đang ở giai đoạn thử nghiệm — đây là toàn bộ những gì đang bán.",
    );
    unmount();

    grid({ rows: [card()], total: 40 });
    expect(screen.getByRole("status").textContent).toBe("40 sản phẩm");
    expect(document.body.textContent).not.toContain("giai đoạn thử nghiệm");
  });
});

// ─── The buyer boundary ─────────────────────────────────────────────────────

describe("a buyer card renders from the public DTO and nothing else", () => {
  it("carries no seller-only field into the document", () => {
    grid({ rows: [{ ...card(), ...SEEDED_PRIVATE } as Card] });

    // The public parts are there, so this is not passing by rendering nothing.
    expect(screen.getByText("Giày Court Pro")).toBeTruthy();
    expect(screen.getByText("Shop A")).toBeTruthy();

    // Text, attributes and URLs all at once: `outerHTML` is every place a
    // value could have leaked, including a src, an alt or a data- attribute.
    const html = document.body.outerHTML;
    for (const value of Object.values(SEEDED_PRIVATE)) {
      expect(html).not.toContain(String(value));
    }
    // The stock COUNT in particular: R3 cards say nothing when in stock
    // ("Hết hàng" is the only flag) — and the seller's number never appears.
    expect(document.body.textContent).not.toContain("Còn hàng");
    expect(document.body.textContent).not.toContain("4737");
  });

  it("shows a private draft image as no image at all", () => {
    grid({
      rows: [
        {
          ...card(),
          // What the seller's row looks like before the worker publishes a
          // rendition: the draft paths are populated, `public_path` is not.
          cover: {
            public_path: "",
            alt_text: null,
            width: null,
            height: null,
            draft_path: SEEDED_PRIVATE.draft_path,
            rendition_source_path: SEEDED_PRIVATE.rendition_source_path,
          },
        } as unknown as Card,
      ],
    });

    // The card must not fall back to either of them. Both live in the private
    // draft bucket, so the src would 403 for a buyer — and the path itself is
    // a filename the shop has not chosen to publish.
    expect(document.body.outerHTML).not.toContain("draft/");
  });

  it("does not treat unknown stock as sold out", () => {
    // R3 cards carry no availability text at all except the "Hết hàng" flag,
    // so unknown stock must simply not raise the flag. (The PDP still says
    // "Liên hệ shop để hỏi số lượng" in its own words.)
    grid({ rows: [card({ availability: null })] });

    expect(screen.getByText("Giày Court Pro")).toBeTruthy();
    expect(document.body.textContent).not.toContain("Hết hàng");
  });

  it("flags sold out once, without inventing a countdown", () => {
    grid({ rows: [card({ availability: "out_of_stock" })] });

    expect(screen.getAllByText("Hết hàng")).toHaveLength(1);
    expect(document.body.textContent).not.toMatch(/chỉ còn|sắp hết/i);
  });

  it("says there is no price rather than showing a zero", () => {
    grid({ rows: [card({ price_min: null, price_max: null })] });

    expect(screen.getByText("Chưa có giá")).toBeTruthy();
    expect(document.body.textContent).not.toContain("0 ₫");
  });

  it("offers no cart and no save — the whole card is one link to the product", () => {
    grid({ rows: [card()] });

    expect(screen.queryByRole("button")).toBeNull();
    // R4: no aria-label — the accessible name is the card's full text content
    // (title AND price/shop), so a screen reader hears everything the eye sees.
    const links = screen.getAllByRole("link", { name: /Giày Court Pro/ });
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("/shop/product/giay-court-pro");
  });

  it("loads only the first screenful eagerly", () => {
    const cover = { public_path: "pub/a.webp", alt_text: null, width: 800, height: 600 };
    grid({
      rows: Array.from({ length: 6 }, (_, i) => card({ id: `p${i}`, slug: `s${i}`, cover })),
      total: 6,
    });

    const loading = Array.from(document.querySelectorAll("img")).map((i) => i.getAttribute("loading"));
    expect(loading).toEqual(["eager", "eager", "eager", "eager", "lazy", "lazy"]);
  });
});
