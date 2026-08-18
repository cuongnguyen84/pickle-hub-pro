/** @vitest-environment jsdom */
/**
 * The checkout screen, everywhere it is NOT the happy path.
 *
 * Checkout.conflict.test.tsx owns one narrow thing — a `price_changed` 409 must
 * not be retried and must not leave the button spinning. This file owns the
 * rest of the screen: the four page-level answers (loading / failed / nothing
 * of this shop's left / shop paused), the two payment methods, the three
 * validation sentences, and the two drift reasons that were never tested.
 *
 * Every module that would reach the supabase client is mocked WHOLE — no
 * `importActual` anywhere. CI has no `.env`, and a single real import of
 * shop-client kills the suite during the mocking phase, before the first test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CartGroup } from "@/integrations/supabase/shop-schema";

const navigateMock = vi.fn();
let shopSlug: string | undefined = "shop-a";

vi.mock("react-router-dom", () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...rest}>{children}</a>
  ),
  useNavigate: () => navigateMock,
  useParams: () => ({ shopSlug }),
}));

vi.mock("@/components/layout/TheLineLayout", () => ({
  TheLineLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/seo/DynamicMeta", () => ({ DynamicMeta: () => null }));
vi.mock("@/components/shop/CartLink", () => ({
  ShopCartLink: () => <a href="/shop/cart">Giỏ hàng</a>,
}));

let shopPage: Record<string, unknown> = { found: true, contacts: [], shop: { name: "Shop A" } };
vi.mock("@/hooks/shop/usePublicShop", () => ({
  usePublicShopPage: () => ({ data: shopPage }),
}));

const refetchMock = vi.fn();
const cartState: {
  data: CartGroup[] | undefined;
  isPending: boolean;
  isError: boolean;
} = { data: undefined, isPending: false, isError: false };

vi.mock("@/hooks/shop/useCart", () => ({
  cartGroupFor: (groups: CartGroup[] | undefined, slug: string | undefined) =>
    groups?.find((g) => g.shop.slug === slug) ?? null,
  useCartView: () => ({ ...cartState, refetch: refetchMock }),
}));

const createMock = vi.fn();
let lastAddress: Record<string, string> | undefined;
vi.mock("@/hooks/shop/useOrders", () => ({
  useOrderCreate: () => ({ mutateAsync: createMock, isPending: createPending }),
  useLastShippingAddress: () => ({ data: lastAddress }),
}));
let createPending = false;

// jsdom has no IntersectionObserver; the sticky bar's effect bails on its own
// guard without one, which would leave the second order button untested.
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

const { default: Checkout } = await import("../Checkout");

// ─── Fixtures ───────────────────────────────────────────────────────────────

const groupA = (over: Partial<CartGroup["shop"]> = {}): CartGroup => ({
  shop: {
    slug: "shop-a",
    name: "Shop A",
    state: "active",
    ordering_enabled: true,
    shipping_fee_vnd: 25_000,
    ...over,
  },
  lines: [
    {
      cart_item_id: "ci1",
      variant_id: "v1",
      qty: 2,
      product_id: "p1",
      product_slug: "vot-qa",
      product_title: "Vợt QA",
      option_values: { "Màu": "Đen" },
      sku: "SKU-1",
      unit_price_vnd: 500_000,
      line_total_vnd: 1_000_000,
      stock_on_hand: 5,
      cover: null,
      unavailable_reason: null,
    },
  ],
});

/** A shop_order_raise() body, as PostgREST hands it over: DETAIL is a STRING. */
const raise = (reason: string, extra: Record<string, unknown> = {}) => ({
  code: "PT409",
  message: "Không tạo được đơn.",
  details: JSON.stringify({ reason, ...extra }),
  hint: null,
});

const fill = (over: Partial<{ name: string; phone: string; address: string }> = {}) => {
  fireEvent.change(screen.getByLabelText("Họ tên người nhận"), {
    target: { value: over.name ?? "Nguyễn QA" },
  });
  fireEvent.change(screen.getByLabelText("Số điện thoại"), {
    target: { value: over.phone ?? "0912345678" },
  });
  fireEvent.change(screen.getByLabelText("Địa chỉ nhận hàng"), {
    target: { value: over.address ?? "Số 12 ngõ 5 Trần Duy Hưng, Trung Hoà, Cầu Giấy, Hà Nội" },
  });
};

const submit = () => fireEvent.click(screen.getAllByRole("button", { name: /Đặt đơn|Thử lại/ })[0]);

beforeEach(() => {
  shopSlug = "shop-a";
  shopPage = { found: true, contacts: [], shop: { name: "Shop A" } };
  cartState.data = [groupA()];
  cartState.isPending = false;
  cartState.isError = false;
  lastAddress = undefined;
  createPending = false;
  createMock.mockReset().mockResolvedValue({ code: "PH-0001" });
  navigateMock.mockReset();
  refetchMock.mockReset();
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  ioCallbacks = [];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─── The four page-level answers ────────────────────────────────────────────

describe("checkout, before there is anything to order", () => {
  it("loading has the shape of the form, and is not the empty answer", () => {
    cartState.isPending = true;
    cartState.data = undefined;
    render(<Checkout />);
    expect(screen.getByLabelText("Đang tải đơn hàng…").getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByText("Không còn món nào của shop này trong giỏ.")).toBeNull();
    expect(screen.queryByLabelText("Số điện thoại")).toBeNull();
  });

  it("a failed load says nothing was lost, and its retry refetches", () => {
    cartState.isError = true;
    cartState.data = undefined;
    render(<Checkout />);
    expect(screen.getByText(/Chưa tải được giỏ hàng/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(refetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Không còn món nào của shop này trong giỏ.")).toBeNull();
  });

  it("an empty group is its own answer, with a way back to the cart", () => {
    cartState.data = [];
    render(<Checkout />);
    expect(screen.getByText("Không còn món nào của shop này trong giỏ.")).toBeTruthy();
    expect(screen.getByText("Về giỏ hàng").getAttribute("href")).toBe("/shop/cart");
    expect(screen.queryByLabelText("Số điện thoại")).toBeNull();
  });

  it("a URL naming a shop the cart has nothing from lands on the same answer", () => {
    shopSlug = "shop-nobody";
    render(<Checkout />);
    expect(screen.getByText("Không còn món nào của shop này trong giỏ.")).toBeTruthy();
  });

  it("a group whose lines all vanished counts as empty, not as an orderable shop", () => {
    cartState.data = [{ ...groupA(), lines: [] }];
    render(<Checkout />);
    expect(screen.getByText("Không còn món nào của shop này trong giỏ.")).toBeTruthy();
  });
});

describe("a shop that paused selling while the form was open", () => {
  it("takes the whole form away rather than leaving a grey button", () => {
    cartState.data = [groupA({ ordering_enabled: false })];
    shopPage = {
      found: true,
      shop: { name: "Shop A" },
      contacts: [
        { id: "c1", type: "zalo", href: "https://zalo.me/123", label: null },
        { id: "c2", type: "phone", href: "+84912345678", label: null },
      ],
    };
    render(<Checkout />);

    expect(screen.getByText("Shop đang tạm ngưng bán.")).toBeTruthy();
    expect(document.body.textContent).not.toContain("Shop bị tạm ngưng");
    expect(screen.queryByLabelText("Số điện thoại")).toBeNull();
    expect(screen.queryByRole("button", { name: /Đặt đơn/ })).toBeNull();
    // The way out is the shop's own channels, plus the cart.
    expect(screen.getByText("Nhắn Zalo").getAttribute("href")).toBe("https://zalo.me/123");
    expect(screen.getByText("Gọi điện").getAttribute("href")).toBe("tel:+84912345678");
    expect(screen.getByText("Về giỏ hàng").getAttribute("href")).toBe("/shop/cart");
  });

  it("a shop that is not active is paused too, even with ordering_enabled", () => {
    cartState.data = [groupA({ state: "suspended" })];
    render(<Checkout />);
    expect(screen.getByText("Shop đang tạm ngưng bán.")).toBeTruthy();
  });
});

// ─── The form ───────────────────────────────────────────────────────────────

describe("what the buyer has to get right before ordering", () => {
  it("does not disable the button on arrival — an untouched form has no errors yet", () => {
    render(<Checkout />);
    const button = screen.getAllByRole("button", { name: /Đặt đơn/ })[0];
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(screen.queryByText("Nhập họ tên người nhận.")).toBeNull();
  });

  it("pressing it on an empty form says all three sentences and focuses the first", () => {
    render(<Checkout />);
    submit();

    expect(screen.getByText("Nhập họ tên người nhận.")).toBeTruthy();
    expect(screen.getByText(/Số điện thoại phải có 10 chữ số, bắt đầu bằng 0/)).toBeTruthy();
    expect(screen.getByText(/Ghi đủ số nhà, đường, phường\/xã, quận\/huyện và tỉnh\/thành/)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Họ tên người nhận"));
    expect(createMock).not.toHaveBeenCalled();
    // And now it IS disabled, with the reason tied to it.
    const button = screen.getAllByRole("button", { name: /Đặt đơn/ })[0];
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(document.getElementById(button.getAttribute("aria-describedby") ?? "")?.textContent)
      .toBe("Điền đủ và đúng thông tin nhận hàng ở trên rồi mới đặt được.");
  });

  it("moves focus to the phone when only the phone is wrong", () => {
    render(<Checkout />);
    fill({ phone: "0912" });
    submit();
    expect(document.activeElement).toBe(screen.getByLabelText("Số điện thoại"));
    expect(screen.getByText(/Số điện thoại phải có 10 chữ số/)).toBeTruthy();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("refuses an 11-digit number and a number that does not start with 0", () => {
    render(<Checkout />);
    fill({ phone: "09123456789" });
    submit();
    expect(screen.getByText(/Số điện thoại phải có 10 chữ số/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Số điện thoại"), { target: { value: "8412345678" } });
    expect(screen.getByText(/Số điện thoại phải có 10 chữ số/)).toBeTruthy();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("moves focus to the address when it is too short to post a parcel to", () => {
    render(<Checkout />);
    fill({ address: "Hà Nội" });
    submit();
    expect(document.activeElement).toBe(screen.getByLabelText("Địa chỉ nhận hàng"));
    // The hint is REPLACED by the error, not stacked under it.
    expect(screen.getByLabelText("Địa chỉ nhận hàng").getAttribute("aria-describedby"))
      .toBe("co-address-err");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("shows a field's error on blur, without waiting for the order button", () => {
    render(<Checkout />);
    fireEvent.change(screen.getByLabelText("Họ tên người nhận"), { target: { value: "N" } });
    expect(screen.queryByText("Nhập họ tên người nhận.")).toBeNull();
    fireEvent.blur(screen.getByLabelText("Họ tên người nhận"));
    expect(screen.getByText("Nhập họ tên người nhận.")).toBeTruthy();
    expect(screen.getByLabelText("Họ tên người nhận").getAttribute("aria-invalid")).toBe("true");
  });

  it("blurs the phone and the address the same way — one field at a time, not all three", () => {
    render(<Checkout />);
    fireEvent.change(screen.getByLabelText("Số điện thoại"), { target: { value: "091" } });
    fireEvent.blur(screen.getByLabelText("Số điện thoại"));
    expect(screen.getByText(/Số điện thoại phải có 10 chữ số/)).toBeTruthy();
    // Leaving the phone must not turn the other two red as well.
    expect(screen.queryByText("Nhập họ tên người nhận.")).toBeNull();

    fireEvent.change(screen.getByLabelText("Địa chỉ nhận hàng"), { target: { value: "Hà Nội" } });
    fireEvent.blur(screen.getByLabelText("Địa chỉ nhận hàng"));
    expect(screen.getByText(/Ghi đủ số nhà, đường/)).toBeTruthy();
    expect(screen.queryByText("Nhập họ tên người nhận.")).toBeNull();
  });

  it("prefills empty fields from the last order and marks none of them touched", () => {
    lastAddress = {
      recipient_name: "Nguyễn Cũ",
      recipient_phone: "0987654321",
      shipping_address: "Số 1 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội",
    };
    render(<Checkout />);
    expect((screen.getByLabelText("Họ tên người nhận") as HTMLInputElement).value).toBe("Nguyễn Cũ");
    expect((screen.getByLabelText("Số điện thoại") as HTMLInputElement).value).toBe("0987654321");
    // Nothing was touched, so nothing is red on arrival.
    expect(screen.queryByText("Nhập họ tên người nhận.")).toBeNull();
  });

  it("never overwrites what the buyer already typed", () => {
    render(<Checkout />);
    fireEvent.change(screen.getByLabelText("Họ tên người nhận"), { target: { value: "Nguyễn Mới" } });
    lastAddress = {
      recipient_name: "Nguyễn Cũ",
      recipient_phone: "0987654321",
      shipping_address: "Số 1 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội",
    };
    // Re-render with the prefill landing after first paint, as the query does.
    render(<Checkout />);
    const names = screen.getAllByLabelText("Họ tên người nhận") as HTMLInputElement[];
    expect(names[0].value).toBe("Nguyễn Mới");
  });
});

describe("the two ways to pay", () => {
  it("starts on COD and sends COD", async () => {
    render(<Checkout />);
    expect((screen.getByRole("radio", { name: /Trả khi nhận hàng/ }) as HTMLInputElement).checked)
      .toBe(true);
    fill();
    submit();
    await waitFor(() => expect(createMock).toHaveBeenCalled());
    expect(createMock.mock.calls[0][0].paymentMethod).toBe("cod");
  });

  it("switches to bank transfer and sends THAT — the radio is not decoration", async () => {
    render(<Checkout />);
    fireEvent.click(screen.getByRole("radio", { name: /Chuyển khoản trước/ }));

    expect((screen.getByRole("radio", { name: /Chuyển khoản trước/ }) as HTMLInputElement).checked)
      .toBe(true);
    expect((screen.getByRole("radio", { name: /Trả khi nhận hàng/ }) as HTMLInputElement).checked)
      .toBe(false);

    fill();
    submit();
    await waitFor(() => expect(createMock).toHaveBeenCalled());
    expect(createMock.mock.calls[0][0].paymentMethod).toBe("bank_transfer");
  });

  it("switches back, so a mis-tap is not a decision", () => {
    render(<Checkout />);
    fireEvent.click(screen.getByRole("radio", { name: /Chuyển khoản trước/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Trả khi nhận hàng/ }));
    expect((screen.getByRole("radio", { name: /Trả khi nhận hàng/ }) as HTMLInputElement).checked)
      .toBe(true);
  });

  it("says ThePickleHub holds no money — once, next to the button", () => {
    render(<Checkout />);
    const notes = screen.getAllByText(/ThePickleHub không nhận tiền và không giữ tiền/);
    expect(notes).toHaveLength(1);
  });
});

// ─── Sending it ─────────────────────────────────────────────────────────────

describe("a successful order", () => {
  it("sends the trimmed form plus the expected prices, then goes to the order page", async () => {
    render(<Checkout />);
    fill({ name: "  Nguyễn QA  " });
    fireEvent.change(screen.getByLabelText("Ghi chú cho người giao (không bắt buộc)"), {
      target: { value: "Giao giờ hành chính" },
    });
    submit();

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    const payload = createMock.mock.calls[0][0];
    expect(payload.recipientName).toBe("Nguyễn QA");
    expect(payload.deliveryNote).toBe("Giao giờ hành chính");
    expect(payload.expectedShippingFeeVnd).toBe(25_000);
    expect(payload.items).toEqual([
      { variant_id: "v1", qty: 2, expected_unit_price_vnd: 500_000 },
    ]);
    expect(typeof payload.clientToken).toBe("string");

    expect(navigateMock).toHaveBeenCalledWith("/shop/order/PH-0001", {
      replace: true,
      state: { justPlaced: true },
    });
    // The token is spent — keeping it would replay this order from the next
    // checkout of the same shop.
    expect(window.sessionStorage.getItem("shop.checkout.token.shop-a")).toBeNull();
  });

  it("sends null rather than an empty note", async () => {
    render(<Checkout />);
    fill();
    submit();
    await waitFor(() => expect(createMock).toHaveBeenCalled());
    expect(createMock.mock.calls[0][0].deliveryNote).toBeNull();
  });

  it("replays the SAME token across a reload of the same checkout", async () => {
    window.sessionStorage.setItem("shop.checkout.token.shop-a", "held-token-1");
    render(<Checkout />);
    fill();
    submit();
    await waitFor(() => expect(createMock).toHaveBeenCalled());
    expect(createMock.mock.calls[0][0].clientToken).toBe("held-token-1");
  });

  it("still orders when the browser refuses sessionStorage entirely", async () => {
    // Spied on the PROTOTYPE: jsdom's Storage is proxied, so assigning onto the
    // instance stores a storage ITEM called "getItem" and the real method keeps
    // running — the stub would look installed and do nothing.
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("The operation is insecure.");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("The operation is insecure.");
    });
    render(<Checkout />);
    fill();
    submit();
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(createMock.mock.calls[0][0].clientToken).toBeTruthy();
    expect(navigateMock).toHaveBeenCalled();
  });

  it("shows the total and holds the button while the RPC is in flight", () => {
    createPending = true;
    render(<Checkout />);
    const button = screen.getAllByRole("button", { name: "Đang gửi đơn…" })[0];
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
  });

  it("puts items + shipping on the button, not items alone", () => {
    render(<Checkout />);
    expect(screen.getAllByRole("button", { name: "Đặt đơn · 1.025.000₫" }).length)
      .toBeGreaterThan(0);
  });
});

// ─── Drift the server refuses the order over ────────────────────────────────

describe("when something moved between the cart and the button", () => {
  it("names the old and the new shipping fee, and reloads the cart", async () => {
    createMock.mockRejectedValue(
      raise("shipping_fee_changed", { expected: 25000, current: 40000 }),
    );
    render(<Checkout />);
    fill();
    submit();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Phí vận chuyển vừa thay đổi");
    expect(alert.textContent).toContain("25.000₫");
    expect(alert.textContent).toContain("40.000₫");
    expect(refetchMock).toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("PT409");
    // The button comes back, relabelled, and does not stay at "Đang gửi đơn…".
    expect(screen.getAllByRole("button", { name: /Thử lại/ })[0].hasAttribute("disabled"))
      .toBe(false);
  });

  it("names the product that sold out, not the variant id", async () => {
    createMock.mockRejectedValue(raise("insufficient_stock", { variant_id: "v1" }));
    render(<Checkout />);
    fill();
    submit();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Vợt QA vừa hết hàng");
    expect(alert.textContent).toContain("Về giỏ để bỏ món này ra");
    expect(alert.textContent).not.toContain("v1");
    expect(refetchMock).toHaveBeenCalled();
  });

  it("falls back to the generic name when the variant is not in this cart any more", async () => {
    createMock.mockRejectedValue(raise("insufficient_stock", { variant_id: "gone" }));
    render(<Checkout />);
    fill();
    submit();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Món này vừa hết hàng");
  });

  it("uses the reason's own sentence for a refusal with no numbers in it", async () => {
    createMock.mockRejectedValue(raise("too_many_pending"));
    render(<Checkout />);
    fill();
    submit();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("đang có 5 đơn chờ shop xác nhận");
    expect(refetchMock).toHaveBeenCalled();
  });

  it("says NO ORDER EXISTS when the connection dropped, and does not refetch", async () => {
    createMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<Checkout />);
    fill();
    submit();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Chưa có đơn nào được tạo");
    expect(alert.textContent).toContain("giỏ hàng của anh/chị vẫn nguyên");
    expect(refetchMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("Failed to fetch");
  });
});

// ─── The shop's own words, and the second button ────────────────────────────

describe("the rest of the page", () => {
  it("prints the shop's shipping and returns notes when it wrote them", () => {
    shopPage = {
      found: true,
      contacts: [],
      shop: { name: "Shop A", shipping_note: "Gửi trong 24h", return_note: "Đổi trong 7 ngày" },
    };
    render(<Checkout />);
    expect(screen.getByText("Gửi trong 24h")).toBeTruthy();
    expect(screen.getByText("Đổi trong 7 ngày")).toBeTruthy();
  });

  it("leaves the policy section out entirely when the shop wrote neither", () => {
    render(<Checkout />);
    expect(screen.queryByText("4. Chính sách của shop")).toBeNull();
  });

  it("keeps the sticky button inert until the real one scrolls off, then it orders", async () => {
    vi.stubGlobal("IntersectionObserver", StubIO);
    const { container } = render(<Checkout />);
    fill();

    const bar = container.querySelector(".tl-shop-buybar") as HTMLElement;
    expect(bar.getAttribute("data-shown")).toBe("false");
    expect(bar.getAttribute("aria-hidden")).toBe("true");
    expect(bar.querySelector("button")?.getAttribute("tabindex")).toBe("-1");

    act(() => ioCallbacks.forEach((cb) => cb([{ isIntersecting: false }])));
    expect(bar.getAttribute("data-shown")).toBe("true");
    expect(bar.querySelector("button")?.getAttribute("tabindex")).toBeNull();

    fireEvent.click(bar.querySelector("button") as HTMLButtonElement);
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(navigateMock).toHaveBeenCalled();
  });
});
