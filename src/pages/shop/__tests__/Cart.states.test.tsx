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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

// Mutable so a paused shop with NO approved channel can be rendered too — that
// is a different screen (no button at all) from a paused shop with a Zalo.
const ZALO = { id: "c1", type: "zalo", href: "https://zalo.me/123", label: null };
let shopContacts: unknown[] = [ZALO];
vi.mock("@/hooks/shop/usePublicShop", () => ({
  usePublicShopPage: () => ({ data: { found: true, contacts: shopContacts } }),
}));

const removeMock = vi.fn().mockResolvedValue(undefined);
const setQtyMock = vi.fn().mockResolvedValue(undefined);
const restoreMock = vi.fn().mockResolvedValue(undefined);
const noopRefetch = vi.fn();
const cartState: {
  data: CartGroup[] | undefined;
  isPending: boolean;
  isError: boolean;
  refetch?: () => void;
} = {
  data: [],
  isPending: false,
  isError: false,
};

vi.mock("@/hooks/shop/useCart", () => ({
  CART_QTY_MAX: 10,
  useCartView: () => ({ ...cartState, refetch: cartState.refetch ?? noopRefetch }),
  useCartMutations: () => ({
    add: { mutateAsync: vi.fn(), isPending: false },
    setQty: { mutateAsync: setQtyMock, isPending: false },
    remove: { mutateAsync: removeMock, isPending: false },
    restore: { mutateAsync: restoreMock, isPending: false },
    invalidate: vi.fn(),
  }),
}));

// jsdom has no IntersectionObserver, and without one the sticky bar effect
// bails out on its own guard — which is a real branch (SSR / old Safari) but
// not the one that decides whether the bar appears. This stub hands the
// callback back so a test can say "the group footer just scrolled away".
type IoCb = (entries: Array<{ isIntersecting: boolean }>) => void;
let ioCallbacks: IoCb[] = [];
class StubIO {
  constructor(cb: IoCb) {
    ioCallbacks.push(cb);
  }
  observe() {}
  disconnect() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
}
const scrollFootAway = (away: boolean) =>
  ioCallbacks.forEach((cb) => cb([{ isIntersecting: !away }]));

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

beforeEach(() => {
  removeMock.mockResolvedValue(undefined);
  setQtyMock.mockResolvedValue(undefined);
  restoreMock.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  cartState.data = [];
  cartState.isPending = false;
  cartState.isError = false;
  cartState.refetch = undefined;
  shopContacts = [ZALO];
  ioCallbacks = [];
  vi.unstubAllGlobals();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("cart, one shop", () => {
  it("offers exactly one order button and none of the multi-shop wording", () => {
    cartState.data = [group()];
    const { container } = render(<Cart />);

    // R5 #10: the sticky bar carries a SECOND copy of the same button for the
    // first orderable shop, aria-hidden until the real one scrolls away. The
    // invariant that matters is unchanged — one button per shop group, and no
    // button anywhere that orders every shop at once.
    const page = container.querySelector(".tl-shop-page") as HTMLElement;
    const buttons = Array.from(page.querySelectorAll("a")).filter(
      (a) => a.textContent === "Đặt hàng shop này",
    );
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute("href")).toBe("/shop/checkout/shop-a");
    const bar = container.querySelector(".tl-shop-buybar") as HTMLElement;
    expect(bar.getAttribute("aria-hidden")).toBe("true");
    expect(bar.querySelector("a")?.getAttribute("href")).toBe("/shop/checkout/shop-a");
    expect(screen.queryByText(/Giỏ có sản phẩm của/)).toBeNull();
    expect(screen.queryByText(/đặt tất cả/)).toBeNull();
    // The line total is qty × unit price, not the unit price — and with one
    // line the subtotal is the same number, so it appears twice in the page
    // and once more in the sticky bar.
    expect(screen.getAllByText("1.500.000₫")).toHaveLength(3);
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
  it("gives each shop its own button, and the sticky bar names ONE of them", () => {
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
    const { container } = render(<Cart />);

    const page = container.querySelector(".tl-shop-page") as HTMLElement;
    const buttons = Array.from(page.querySelectorAll("a")).filter(
      (a) => a.textContent === "Đặt hàng shop này",
    );
    expect(buttons).toHaveLength(2);
    expect(screen.getByText(/Giỏ có sản phẩm của 2 shop/)).toBeTruthy();
    // R5 (cắt chữ): the "Không có nút đặt tất cả" paragraph is gone — the
    // sentence above already says each shop is ordered and shipped on its own,
    // and there is still no button that would order both.
    expect(document.body.textContent).not.toContain("đặt tất cả");
    // The bar belongs to the FIRST orderable shop and says which one.
    const bar = container.querySelector(".tl-shop-buybar") as HTMLElement;
    expect(bar.textContent).toContain("Shop A");
    expect(bar.querySelector("a")?.getAttribute("href")).toBe("/shop/checkout/shop-a");
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
    // R5 #6: the sentence "Đang tải giỏ hàng…" is gone from the page — the
    // skeleton has the shape of a cart line and aria-busy + aria-label carry
    // the state for assistive tech.
    expect(screen.getByLabelText("Đang tải giỏ hàng…").getAttribute("aria-busy")).toBe("true");
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

  it("the retry on a failed load actually refetches", () => {
    const refetch = vi.fn();
    cartState.isError = true;
    cartState.data = undefined;
    cartState.refetch = refetch;
    render(<Cart />);
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(refetch).toHaveBeenCalledTimes(1);
    cartState.refetch = undefined;
  });
});

// ─── D-BUG2: two situations, one reason column ──────────────────────────────
// shop_cart_view() answers `out_of_stock` both when there is nothing left and
// when there is something left but less than the cart asks for. Printing "vừa
// hết hàng" for the second is a lie the buyer can see through — they are
// looking at three in stock. The two must not converge again.

describe("a line the server refused for “out_of_stock”", () => {
  it("says how many are LEFT when some are, and never claims none are", () => {
    cartState.data = [
      group({ lines: [line({ qty: 5, stock_on_hand: 3, unavailable_reason: "out_of_stock" })] }),
    ];
    render(<Cart />);
    expect(screen.getByText("Chỉ còn 3 cái. Giảm số lượng để đặt tiếp.")).toBeTruthy();
    expect(document.body.textContent).not.toContain("vừa hết hàng");
  });

  it("says sold out only when there really are none left", () => {
    cartState.data = [
      group({ lines: [line({ qty: 2, stock_on_hand: 0, unavailable_reason: "out_of_stock" })] }),
    ];
    render(<Cart />);
    expect(
      screen.getByText(
        "Phiên bản này vừa hết hàng. Bỏ ra để đặt phần còn lại, hoặc chọn phiên bản khác.",
      ),
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain("Chỉ còn");
  });

  it("a retired variant and a pulled product each get their own sentence", () => {
    cartState.data = [
      group({
        lines: [
          line({ unavailable_reason: "variant_retired" }),
          line({ cart_item_id: "ci2", variant_id: "v2", unavailable_reason: "product_unavailable" }),
        ],
      }),
    ];
    render(<Cart />);
    expect(screen.getByText(/vừa ngừng bán/)).toBeTruthy();
    expect(screen.getByText(/Shop vừa gỡ sản phẩm này/)).toBeTruthy();
    // Two broken lines, one count — not "Còn 1 món".
    const button = screen.getByRole("button", { name: "Đặt hàng shop này" });
    const why = document.getElementById(button.getAttribute("aria-describedby") ?? "");
    expect(why?.textContent).toBe("Còn 2 món cần sửa trước khi đặt.");
  });
});

// ─── ordering_disabled stops at the group boundary ──────────────────────────

describe("one shop pausing does not take the other down with it", () => {
  const shopB = () =>
    group({
      shop: {
        slug: "shop-b",
        name: "Shop B",
        state: "active",
        ordering_enabled: true,
        shipping_fee_vnd: 0,
      },
      lines: [line({ cart_item_id: "ci2", variant_id: "v2", product_title: "Giày QA" })],
    });

  it("leaves Shop B orderable and hands the sticky bar to it, not to the paused Shop A", () => {
    cartState.data = [group({ shop: { ...group().shop, ordering_enabled: false } }), shopB()];
    const { container } = render(<Cart />);

    // Said once, about one shop.
    expect(screen.getAllByText("Shop đang tạm ngưng bán.")).toHaveLength(1);
    const page = container.querySelector(".tl-shop-page") as HTMLElement;
    const buttons = Array.from(page.querySelectorAll("a")).filter(
      (a) => a.textContent === "Đặt hàng shop này",
    );
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute("href")).toBe("/shop/checkout/shop-b");

    const bar = container.querySelector(".tl-shop-buybar") as HTMLElement;
    expect(bar.textContent).toContain("Shop B");
    expect(bar.textContent).not.toContain("Shop A");
    expect(bar.querySelector("a")?.getAttribute("href")).toBe("/shop/checkout/shop-b");
  });

  it("skips a shop whose lines need fixing too — the bar means “this one is ready”", () => {
    cartState.data = [
      group({ lines: [line({ unavailable_reason: "out_of_stock", stock_on_hand: 0 })] }),
      shopB(),
    ];
    const { container } = render(<Cart />);
    const bar = container.querySelector(".tl-shop-buybar") as HTMLElement;
    expect(bar.querySelector("a")?.getAttribute("href")).toBe("/shop/checkout/shop-b");
  });

  it("shows no sticky bar at all when nothing in the cart can be ordered", () => {
    cartState.data = [group({ shop: { ...group().shop, ordering_enabled: false } })];
    const { container } = render(<Cart />);
    expect(container.querySelector(".tl-shop-buybar")).toBeNull();
  });

  it("a shop whose state is not active is paused too, even with ordering_enabled", () => {
    cartState.data = [group({ shop: { ...group().shop, state: "suspended" } })];
    render(<Cart />);
    expect(screen.getByText("Shop đang tạm ngưng bán.")).toBeTruthy();
    expect(screen.queryByText("Đặt hàng shop này")).toBeNull();
  });

  it("a paused shop with no approved channel shows no button rather than a dead one", () => {
    shopContacts = [];
    cartState.data = [group({ shop: { ...group().shop, ordering_enabled: false } })];
    const { container } = render(<Cart />);
    expect(screen.getByText("Shop đang tạm ngưng bán.")).toBeTruthy();
    const foot = container.querySelector(".tl-shop-sellergroup-foot") as HTMLElement;
    expect(foot.querySelector("a")).toBeNull();
    expect(foot.querySelector("button")).toBeNull();
  });
});

// ─── The sticky bar only exists while the real button is off screen ─────────

describe("the sticky order bar", () => {
  it("stays inert until the group footer scrolls away, then becomes the live button", () => {
    vi.stubGlobal("IntersectionObserver", StubIO);
    cartState.data = [group()];
    const { container } = render(<Cart />);

    const bar = container.querySelector(".tl-shop-buybar") as HTMLElement;
    expect(bar.getAttribute("data-shown")).toBe("false");
    expect(bar.getAttribute("aria-hidden")).toBe("true");
    // Inert means out of the tab order too — two identical buttons in a row is
    // the failure this replaced.
    expect(bar.querySelector("a")?.getAttribute("tabindex")).toBe("-1");

    act(() => scrollFootAway(true));
    expect(bar.getAttribute("data-shown")).toBe("true");
    expect(bar.getAttribute("aria-hidden")).toBeNull();
    expect(bar.querySelector("a")?.getAttribute("tabindex")).toBeNull();

    act(() => scrollFootAway(false));
    expect(bar.getAttribute("data-shown")).toBe("false");
  });
});

// ─── Undo, and what happens when the write says no ──────────────────────────

describe("Hoàn tác", () => {
  it("puts the line back by re-adding the same variant and quantity", async () => {
    cartState.data = [group()];
    render(<Cart />);

    fireEvent.click(screen.getByRole("button", { name: "Bỏ Vợt QA khỏi giỏ" }));
    fireEvent.click(screen.getByRole("button", { name: "Hoàn tác" }));

    await waitFor(() => expect(restoreMock).toHaveBeenCalledWith({ variantId: "v1", qty: 2 }));
    // The offer is withdrawn the moment it is taken, and the line is back.
    expect(screen.queryByRole("button", { name: "Hoàn tác" })).toBeNull();
    await waitFor(() => expect(screen.getByText("Vợt QA")).toBeTruthy());
  });

  it("expires after ten seconds instead of sitting there for ever", () => {
    vi.useFakeTimers();
    try {
      cartState.data = [group()];
      render(<Cart />);
      fireEvent.click(screen.getByRole("button", { name: "Bỏ Vợt QA khỏi giỏ" }));
      expect(screen.getByRole("button", { name: "Hoàn tác" })).toBeTruthy();

      act(() => void vi.advanceTimersByTime(10_000));
      expect(screen.queryByRole("button", { name: "Hoàn tác" })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("offers ONE undo after two removals in a row, for the line removed last", () => {
    cartState.data = [
      group({ lines: [line(), line({ cart_item_id: "ci2", variant_id: "v2", product_title: "Giày QA" })] }),
    ];
    render(<Cart />);

    fireEvent.click(screen.getByRole("button", { name: "Bỏ Vợt QA khỏi giỏ" }));
    fireEvent.click(screen.getByRole("button", { name: "Bỏ Giày QA khỏi giỏ" }));

    expect(screen.getAllByRole("button", { name: "Hoàn tác" })).toHaveLength(1);
    const live = document.querySelector('[role="status"][aria-live="polite"]');
    expect(live?.textContent).toContain("Đã bỏ “Giày QA” khỏi giỏ.");
    expect(live?.textContent).not.toContain("Vợt QA");
  });

  it("withdraws the offer and puts the line back when the removal was refused", async () => {
    removeMock.mockRejectedValue({ code: "42501", message: "permission denied for table cart_items" });
    cartState.data = [group()];
    render(<Cart />);

    fireEvent.click(screen.getByRole("button", { name: "Bỏ Vợt QA khỏi giỏ" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Bạn không có quyền thực hiện thay đổi này.");
    // The Postgres code and the table name stay out of the buyer's screen.
    expect(document.body.textContent).not.toContain("42501");
    expect(document.body.textContent).not.toContain("cart_items");
    // Nothing was removed, so nothing is offered back.
    expect(screen.queryByRole("button", { name: "Hoàn tác" })).toBeNull();
    expect(screen.getByText("Vợt QA")).toBeTruthy();
  });

  it("says so when the undo itself fails, rather than silently dropping it", async () => {
    restoreMock.mockRejectedValue({ code: "PT409" });
    cartState.data = [group()];
    render(<Cart />);

    fireEvent.click(screen.getByRole("button", { name: "Bỏ Vợt QA khỏi giỏ" }));
    fireEvent.click(screen.getByRole("button", { name: "Hoàn tác" }));

    await waitFor(() => expect(restoreMock).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Hoàn tác" })).toBeNull();

    // Hoàn tác hỏng thì món phải quay lại màn hình kèm câu lỗi. Trước khi sửa,
    // dòng ở lại trong `hidden` và câu lỗi được ghi dưới khoá variant_id trong
    // khi chỗ render đọc theo cart_item_id — nên món biến mất, không Hoàn tác,
    // không thông báo. Đỏ nếu ai đó đảo lại hai khoá đó.
    expect(await screen.findByText("Vợt QA")).toBeTruthy();
    const alerts = await screen.findAllByRole("alert");
    expect(alerts.some((a) => (a.textContent ?? "").trim().length > 0)).toBe(true);
    expect(document.body.textContent).not.toContain("PT409");
  });

  it("chỉ bỏ ẩn đúng dòng vừa hoàn tác, không làm món kia hiện lại", async () => {
    restoreMock.mockResolvedValue(undefined);
    cartState.data = [group({ lines: [line(), line({ cart_item_id: "ci2", variant_id: "v2", product_title: "Giày QA" })] })];
    render(<Cart />);

    // Bỏ cả hai, rồi chỉ hoàn tác món bỏ sau cùng.
    fireEvent.click(screen.getByRole("button", { name: "Bỏ Vợt QA khỏi giỏ" }));
    fireEvent.click(screen.getByRole("button", { name: "Bỏ Giày QA khỏi giỏ" }));
    fireEvent.click(screen.getByRole("button", { name: "Hoàn tác" }));

    await waitFor(() => expect(restoreMock).toHaveBeenCalledWith({ variantId: "v2", qty: 2 }));
    expect(await screen.findByText("Giày QA")).toBeTruthy();
    // Vợt QA vẫn phải ở trạng thái đã bỏ. `setHidden([])` làm nó nhấp nháy hiện lại.
    expect(screen.queryByText("Vợt QA")).toBeNull();
  });
});

// ─── The quantity stepper ───────────────────────────────────────────────────

describe("changing how many", () => {
  it("sends the new quantity and shows the new line total before the write lands", async () => {
    let settle: () => void = () => {};
    setQtyMock.mockImplementation(() => new Promise<void>((r) => { settle = r; }));
    cartState.data = [group()];
    render(<Cart />);

    fireEvent.click(screen.getByRole("button", { name: "Tăng số lượng — Vợt QA" }));

    expect(setQtyMock).toHaveBeenCalledWith({ cartItemId: "ci1", qty: 3 });
    // Optimistic: 3 × 750.000₫, on screen while the RPC is still in flight.
    expect(screen.getAllByText("2.250.000₫").length).toBeGreaterThan(0);
    expect((screen.getByLabelText("Số lượng — Vợt QA") as HTMLInputElement).value).toBe("3");
    // And both stepper buttons are held while it is.
    expect(screen.getByRole("button", { name: "Tăng số lượng — Vợt QA" }).hasAttribute("disabled")).toBe(true);

    await act(async () => { settle(); });
    expect(screen.getByRole("button", { name: "Tăng số lượng — Vợt QA" }).hasAttribute("disabled")).toBe(false);
  });

  it("counts down as well as up", async () => {
    cartState.data = [group()];
    render(<Cart />);
    fireEvent.click(screen.getByRole("button", { name: "Giảm số lượng — Vợt QA" }));
    await waitFor(() => expect(setQtyMock).toHaveBeenCalledWith({ cartItemId: "ci1", qty: 1 }));
  });

  it("cannot go below one or above the per-order cap", () => {
    cartState.data = [group({ lines: [line({ qty: 1 })] })];
    render(<Cart />);
    expect(screen.getByRole("button", { name: "Giảm số lượng — Vợt QA" }).hasAttribute("disabled")).toBe(true);

    cleanup();
    cartState.data = [group({ lines: [line({ qty: 10, stock_on_hand: 20 })] })];
    render(<Cart />);
    expect(screen.getByRole("button", { name: "Tăng số lượng — Vợt QA" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Mỗi phiên bản tối đa 10 cái trong một đơn.")).toBeTruthy();
  });

  it("puts the old number back and says why when the write is refused", async () => {
    setQtyMock.mockRejectedValue({ code: "PT409" });
    cartState.data = [group()];
    render(<Cart />);

    fireEvent.click(screen.getByRole("button", { name: "Tăng số lượng — Vợt QA" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "Bản ghi vừa được cập nhật ở nơi khác. Tải lại để xem bản mới nhất.",
    );
    expect(document.body.textContent).not.toContain("PT409");
    expect((screen.getByLabelText("Số lượng — Vợt QA") as HTMLInputElement).value).toBe("2");
  });
});
