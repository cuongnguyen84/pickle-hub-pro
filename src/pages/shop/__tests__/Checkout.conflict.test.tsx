/** @vitest-environment jsdom */
/**
 * The 409 that put the buyer in a dead end (round 2, TC10).
 *
 * The server answers PT409 / price_changed in milliseconds. On screen the
 * button sat at "Đang gửi đơn…" for ever: no alert, no order, no way out but
 * F5. The cause is not in the catch block — it is that the promise the catch
 * is waiting on never settles, because the mutation RETRIES.
 *
 * React Query's global mutation default is `retry: 1` (App.tsx). A retryer that
 * is going to retry sleeps first, and before it wakes it asks
 * `focusManager.isFocused()`; a tab that is not visible PAUSES the retryer
 * instead of failing it, and `mutateAsync` stays pending until the tab comes
 * back. A price conflict is a final answer, not a flaky network, so it must
 * never enter that path at all.
 *
 * The QueryClient below is built with the SAME mutation defaults as App.tsx on
 * purpose. Building it with `retry: false` would test the test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import type { CartGroup } from "@/integrations/supabase/shop-schema";

const navigateMock = vi.fn();

vi.mock("react-router-dom", () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...rest}>{children}</a>
  ),
  useNavigate: () => navigateMock,
  useParams: () => ({ shopSlug: "shop-a" }),
}));

vi.mock("@/components/layout/TheLineLayout", () => ({
  TheLineLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/seo/DynamicMeta", () => ({ DynamicMeta: () => null }));
vi.mock("@/components/shop/CartLink", () => ({
  ShopCartLink: () => <a href="/shop/cart">Giỏ hàng</a>,
}));

vi.mock("@/hooks/shop/usePublicShop", () => ({
  usePublicShopPage: () => ({ data: { found: true, contacts: [], shop: { name: "Shop A" } } }),
}));

const refetchMock = vi.fn();
const cartGroup: CartGroup = {
  shop: {
    slug: "shop-a",
    name: "Shop A",
    state: "active",
    ordering_enabled: true,
    shipping_fee_vnd: 25000,
  },
  lines: [
    {
      cart_item_id: "ci1",
      variant_id: "62b786f5-0000-4000-8000-000000000001",
      qty: 1,
      product_id: "p1",
      product_slug: "vot-qa",
      product_title: "Vợt QA",
      option_values: null,
      sku: "SKU-1",
      unit_price_vnd: 1_450_000,
      line_total_vnd: 1_450_000,
      stock_on_hand: 5,
      cover: null,
      unavailable_reason: null,
    },
  ],
};

// Mock trọn, KHÔNG `importActual`: module thật kéo theo supabase client, mà
// client đòi VITE_SUPABASE_URL lúc import — CI không có .env nên suite chết ở
// khâu mocking trước cả test đầu tiên. `cartGroupFor` là một dòng, chép rẻ hơn
// là kéo cả cây import vào.
vi.mock("@/hooks/shop/useCart", () => ({
  cartGroupFor: (groups: CartGroup[] | undefined, shopSlug: string | undefined) =>
    groups?.find((g) => g.shop.slug === shopSlug) ?? null,
  useCartView: () => ({
    data: [cartGroup],
    isPending: false,
    isError: false,
    refetch: refetchMock,
  }),
}));

/** The exact body the tester captured off the RPC with a buyer JWT. */
const PRICE_CHANGED = {
  code: "PT409",
  message: "Giá vừa thay đổi trong lúc anh/chị điền.",
  details: JSON.stringify({
    reason: "price_changed",
    current: 1550000,
    expected: 1450000,
    variant_id: "62b786f5-0000-4000-8000-000000000001",
  }),
  hint: null,
};

const rpcMock = vi.fn();
vi.mock("@/integrations/supabase/shop-client", () => ({
  shopRpc: (fn: string, args?: Record<string, unknown>) => rpcMock(fn, args),
  shopFrom: () => {
    throw new Error("checkout must not read tables directly");
  },
  escapeLike: (s: string) => s,
}));

const { default: Checkout } = await import("../Checkout");

const renderCheckout = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      // Same as App.tsx. This is the line under test.
      mutations: { retry: 1 },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <Checkout />
    </QueryClientProvider>,
  );
};

const fillAndSubmit = () => {
  fireEvent.change(screen.getByLabelText("Họ tên người nhận"), {
    target: { value: "Nguyễn QA" },
  });
  fireEvent.change(screen.getByLabelText("Số điện thoại"), {
    target: { value: "0912345678" },
  });
  fireEvent.change(screen.getByLabelText("Địa chỉ nhận hàng"), {
    target: { value: "Số 12 ngõ 5 Trần Duy Hưng, Trung Hoà, Cầu Giấy, Hà Nội" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Đặt đơn/ }));
};

beforeEach(() => {
  rpcMock.mockReset();
  rpcMock.mockRejectedValue(PRICE_CHANGED);
  navigateMock.mockReset();
  refetchMock.mockReset();
  window.sessionStorage.clear();
  // The buyer's tab is not the focused one — they tapped and looked away. This
  // is what turns "one retry" into "pending for ever".
  focusManager.setFocused(false);
});

afterEach(() => {
  focusManager.setFocused(undefined);
  cleanup();
});

describe("checkout, when the price moved while the form was open", () => {
  it("says which price changed, in a live region", async () => {
    renderCheckout();
    fillAndSubmit();

    const alert = await screen.findByRole("alert", {}, { timeout: 3000 });
    expect(alert.textContent).toContain("Vợt QA");
    expect(alert.textContent).toContain("1.450.000₫");
    expect(alert.textContent).toContain("1.550.000₫");
  });

  it("gives the button back instead of leaving it at Đang gửi đơn…", async () => {
    renderCheckout();
    fillAndSubmit();

    await screen.findByRole("alert", {}, { timeout: 3000 });
    const button = screen.getByRole("button", { name: /Thử lại/ });
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.getAttribute("aria-busy")).toBeNull();
    expect(document.body.textContent).not.toContain("Đang gửi đơn…");
  });

  it("does not send the order a second time — a conflict is an answer, not a blip", async () => {
    renderCheckout();
    fillAndSubmit();

    await screen.findByRole("alert", {}, { timeout: 3000 });
    // Give a retry every chance to fire before the count is read.
    await new Promise((r) => setTimeout(r, 1200));
    const creates = rpcMock.mock.calls.filter(([fn]) => fn === "shop_order_create");
    await waitFor(() => expect(creates).toHaveLength(1));
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
