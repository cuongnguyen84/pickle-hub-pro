/** @vitest-environment jsdom */
/**
 * The cart page, and the four answers it must keep apart.
 *
 * What is tested here is what the SCREEN does with a cart, not what the RPC
 * returns — the hooks are stubbed. Four things earn a test because each one
 * has already been shipped wrong somewhere:
 *
 *   · one shop is not two. The "each shop is its own order" sentence must not
 *     appear when there is only one group, and there must never be a single
 *     button that orders everything.
 *   · a paused shop says "Shop đang tạm ngưng bán." — the string
 *     check-bundle-size.mjs bans is "Shop bị tạm ngưng", and the two are one
 *     word apart.
 *   · a line the buyer must fix blocks the group's order button WITH the
 *     reason next to it. A disabled button on its own is the failure mode the
 *     Hallmark audit named.
 *   · removing a line does NOT open a confirm dialog. It offers Hoàn tác, in
 *     a live region, because removing a line is reversible.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CartGroup } from "@/integrations/supabase/shop-schema";

vi.mock("react-router-dom", () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...rest}>{children}</a>
  ),
}));

vi.mock("@/components/layout/TheLineLayout", () => ({
  TheLineLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/seo/DynamicMeta", () => ({ DynamicMeta: () => null }));

vi.mock("@/components/shop/CartLink", () => ({
  ShopCartLink: () => <a href="/shop/cart">Giỏ hàng</a>,
}));

vi.mock("@/hooks/shop/usePublicShop", () => ({
  usePublicShopPage: () => ({
    data: { found: true, contacts: [{ id: "c1", type: "zalo", href: "https://zalo.me/123", label: null }] },
  }),
}));

const removeMock = vi.fn().mockResolvedValue(undefined);
const setQtyMock = vi.fn().mockResolvedValue(undefined);
const cartState: { data: CartGroup[] | undefined; isPending: boolean; isError: boolean } = {
  data: [],
  isPending: false,
  isError: false,
};

vi.mock("@/hooks/shop/useCart", () => ({
  CART_QTY_MAX: 10,
  useCartView: () => ({ ...cartState, refetch: vi.fn() }),
  useCartMutations: () => ({
    add: { mutateAsync: vi.fn(), isPending: false },
    setQty: { mutateAsync: setQtyMock, isPending: false },
    remove: { mutateAsync: removeMock, isPending: false },
    restore: { mutateAsync: vi.fn(), isPending: false },
    invalidate: vi.fn(),
  }),
}));

const { default: Cart } = await import("../Cart");

// ─── Fixtures ───────────────────────────────────────────────────────────────

const line = (over: Partial<CartGroup["lines"][number]> = {}): CartGroup["lines"][number] => ({
  cart_item_id: "ci1",
  variant_id: "v1",
  qty: 2,
  product_id: "p1",
  product_slug: "vot-qa",
  product_title: "Vợt QA",
  option_values: { "Màu": "Đen" },
  sku: "SKU-1",
  unit_price_vnd: 750000,
  line_total_vnd: 1500000,
  stock_on_hand: 5,
  cover: null,
  unavailable_reason: null,
  ...over,
});

const group = (over: Partial<CartGroup> = {}): CartGroup => ({
  shop: {
    slug: "shop-a",
    name: "Shop A",
    state: "active",
    ordering_enabled: true,
    shipping_fee_vnd: 30000,
  },
  lines: [line()],
  ...over,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  cartState.data = [];
  cartState.isPending = false;
  cartState.isError = false;
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("cart, one shop", () => {
  it("offers exactly one order button and none of the multi-shop wording", () => {
    cartState.data = [group()];
    render(<Cart />);

    const buttons = screen.getAllByText("Đặt hàng shop này");
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute("href")).toBe("/shop/checkout/shop-a");
    expect(screen.queryByText(/Giỏ có sản phẩm của/)).toBeNull();
    expect(screen.queryByText(/đặt tất cả/)).toBeNull();
    // The line total is qty × unit price, not the unit price — and with one
    // line the subtotal is the same number, so it appears twice.
    expect(screen.getAllByText("1.500.000₫")).toHaveLength(2);
    expect(screen.queryByText("750.000₫")).toBeNull();
  });

  it("says the shipping fee is charged later rather than showing it as due", () => {
    cartState.data = [group()];
    render(<Cart />);
    expect(screen.getByText(/Chưa gồm phí vận chuyển \(30\.000₫\)/)).toBeTruthy();
  });

  it("says FREE when the shop does not charge for shipping", () => {
    cartState.data = [
      group({ shop: { ...group().shop, shipping_fee_vnd: 0 } }),
    ];
    render(<Cart />);
    expect(screen.getByText("Shop này miễn phí vận chuyển.")).toBeTruthy();
    expect(screen.queryByText("0₫")).toBeNull();
    expect(screen.queryByText("—")).toBeNull();
  });
});

describe("cart, two shops", () => {
  it("gives each shop its own button and explains why", () => {
    cartState.data = [
      group(),
      group({
        shop: {
          slug: "shop-b",
          name: "Shop B",
          state: "active",
          ordering_enabled: true,
          shipping_fee_vnd: 0,
        },
        lines: [line({ cart_item_id: "ci2", variant_id: "v2", product_title: "Giày QA" })],
      }),
    ];
    render(<Cart />);

    expect(screen.getAllByText("Đặt hàng shop này")).toHaveLength(2);
    expect(screen.getByText(/Giỏ có sản phẩm của 2 shop/)).toBeTruthy();
    expect(screen.getByText(/Không có nút “đặt tất cả”/)).toBeTruthy();
  });
});

describe("a shop that has paused selling", () => {
  it("uses the allowed sentence, drops the order button and keeps a way to reach the shop", () => {
    cartState.data = [group({ shop: { ...group().shop, ordering_enabled: false } })];
    render(<Cart />);

    expect(screen.getByText("Shop đang tạm ngưng bán.")).toBeTruthy();
    expect(document.body.textContent).not.toContain("Shop bị tạm ngưng");
    expect(screen.queryByText("Đặt hàng shop này")).toBeNull();
    // The contact channel from the stubbed shop query.
    expect(screen.getByText("Nhắn Zalo").getAttribute("href")).toBe("https://zalo.me/123");
    // The goods stay in the cart.
    expect(screen.getByText("Vợt QA")).toBeTruthy();
  });
});

describe("a line the buyer has to fix", () => {
  it("blocks the group button and says how many items and why, next to it", () => {
    cartState.data = [group({ lines: [line({ unavailable_reason: "out_of_stock" })] })];
    render(<Cart />);

    const button = screen.getByRole("button", { name: "Đặt hàng shop này" });
    expect(button.hasAttribute("disabled")).toBe(true);
    const why = document.getElementById(button.getAttribute("aria-describedby") ?? "");
    expect(why?.textContent).toBe("Còn 1 món cần sửa trước khi đặt.");
    expect(screen.getByText(/vừa hết hàng/)).toBeTruthy();
  });
});

describe("removing a line", () => {
  it("removes it straight away, without a confirm dialog, and offers Hoàn tác", async () => {
    cartState.data = [group()];
    render(<Cart />);

    fireEvent.click(screen.getByRole("button", { name: "Bỏ Vợt QA khỏi giỏ" }));

    expect(removeMock).toHaveBeenCalledWith({ cartItemId: "ci1" });
    // No AlertDialog: nothing asked, because Hoàn tác is the answer.
    expect(screen.queryByRole("alertdialog")).toBeNull();

    const live = document.querySelector('[role="status"][aria-live="polite"]');
    expect(live?.textContent).toContain("Đã bỏ “Vợt QA” khỏi giỏ.");
    expect(screen.getByRole("button", { name: "Hoàn tác" })).toBeTruthy();
    // And the line is gone from the list without waiting for a refetch.
    expect(screen.queryByText("Giỏ hàng đang trống")).toBeTruthy();
  });
});

describe("the four page-level answers stay distinct", () => {
  it("loading is not empty", () => {
    cartState.isPending = true;
    cartState.data = undefined;
    render(<Cart />);
    expect(screen.getByText("Đang tải giỏ hàng…")).toBeTruthy();
    expect(screen.queryByText("Giỏ hàng đang trống")).toBeNull();
  });

  it("a failed load is not empty either, and says nothing was lost", () => {
    cartState.isError = true;
    cartState.data = undefined;
    render(<Cart />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Chưa tải được giỏ hàng");
    expect(alert.textContent).toContain("vẫn còn");
    expect(screen.queryByText("Giỏ hàng đang trống")).toBeNull();
  });

  it("empty says so, and points back at the marketplace", () => {
    cartState.data = [];
    render(<Cart />);
    expect(screen.getByText("Giỏ hàng đang trống")).toBeTruthy();
    expect(screen.getByText("Xem sản phẩm đang bán").getAttribute("href")).toBe("/shop");
    // Wishlist is cut — no link may promise it.
    expect(document.body.textContent).not.toContain("Đã lưu");
  });
});
