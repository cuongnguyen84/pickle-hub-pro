/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  transition: vi.fn(),
  refetch: vi.fn(),
}));

const orderState = vi.hoisted(() => ({
  data: {
    id: "o1",
    code: "PH-2608-AB12",
    status: "shipped",
    payment_method: "bank_transfer",
    recipient_name: "Nguyễn Văn A",
    recipient_phone: "0912345678",
    shipping_address: "Hà Nội",
    delivery_note: null,
    items_total_vnd: 500_000,
    shipping_fee_vnd: 30_000,
    total_vnd: 530_000,
    confirm_due_at: "2026-08-30T00:00:00Z",
    tracking_code: "VN123",
    cancel_reason: null,
    payment_claimed_at: null,
    payment_confirmed_at: "2026-08-28T04:02:33Z",
    created_at: "2026-08-28T03:55:00Z",
    updated_at: "2026-08-28T05:00:00Z",
    shop: { slug: "shop-a", name: "Shop A", state: "active" },
    items: [{
      id: "i1",
      product_id: "p1",
      variant_id: "v1",
      qty: 1,
      product_title: "Vợt QA",
      variant_label: null,
      sku: null,
      unit_price_vnd: 500_000,
      line_total_vnd: 500_000,
    }],
    events: [],
  },
}));

vi.mock("react-router-dom", () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...rest}>{children}</a>
  ),
  useLocation: () => ({ state: null }),
  useParams: () => ({ code: "PH-2608-AB12" }),
}));
vi.mock("@/components/layout/TheLineLayout", () => ({
  TheLineLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/seo/DynamicMeta", () => ({ DynamicMeta: () => null }));
vi.mock("@/components/shop/CartLink", () => ({ ShopCartLink: () => null }));
vi.mock("@/components/shop/ShopNotice", () => ({ ShopErrorNotice: () => null }));
vi.mock("@/components/shop/OrderMoneyRows", () => ({ OrderMoneyRows: () => null }));
vi.mock("@/components/shop/OrderStatusLine", () => ({ OrderStatusLine: () => null }));
vi.mock("@/components/shop/OrderTimeline", () => ({ OrderTimeline: () => null }));
vi.mock("@/components/shop/OrderPaymentCard", () => ({ OrderPaymentCard: () => null }));
vi.mock("@/hooks/useConfirm", () => ({ useConfirm: () => mocks.confirm }));
vi.mock("@/hooks/shop/useOrderPayment", () => ({
  useOrderPaymentInfo: () => ({ data: null }),
  useClaimPayment: () => ({ mutateAsync: vi.fn() }),
  useSePayCheckout: () => ({
    data: undefined,
    isIdle: true,
    isPending: false,
    isError: false,
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
  }),
}));
vi.mock("@/hooks/shop/usePublicShop", () => ({
  usePublicShopPage: () => ({ data: { contacts: [] } }),
}));

vi.mock("@/hooks/shop/useOrders", () => ({
  useOrder: () => ({
    data: orderState.data,
    isPending: false,
    isError: false,
    refetch: mocks.refetch,
  }),
  useOrderTransition: () => ({ mutateAsync: mocks.transition }),
}));

const { default: OrderDetail } = await import("../OrderDetail");

beforeEach(() => {
  mocks.confirm.mockReset().mockResolvedValue(true);
  mocks.transition.mockReset().mockResolvedValue(undefined);
  mocks.refetch.mockReset();
});

afterEach(cleanup);

describe("buyer delivery confirmation", () => {
  it("moves a shipped order to delivered after the buyer confirms", async () => {
    render(<OrderDetail />);
    fireEvent.click(screen.getByRole("button", { name: "Tôi đã nhận hàng" }));

    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.transition).toHaveBeenCalledWith({
      orderId: "o1",
      action: "deliver",
      expectedStatus: "shipped",
    }));
  });

  it("does not move the order when the buyer says they have not received it", async () => {
    mocks.confirm.mockResolvedValue(false);
    render(<OrderDetail />);
    fireEvent.click(screen.getByRole("button", { name: "Tôi đã nhận hàng" }));

    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(1));
    expect(mocks.transition).not.toHaveBeenCalled();
  });
});
