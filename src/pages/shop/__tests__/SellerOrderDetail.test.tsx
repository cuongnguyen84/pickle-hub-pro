/** @vitest-environment jsdom */
/**
 * The seller's order page, and the three things on it that are easy to ship
 * broken and impossible to notice:
 *
 *   · the "Sao chép địa chỉ giao" button writes the four lines a courier form
 *     wants, in order, with real newlines. A missing separator is invisible
 *     until a parcel comes back;
 *   · the label says "Đã sao chép" for two seconds and then stops saying it,
 *     and a screen reader hears the same news through a live region;
 *   · `support` may read every order and press nothing. Rendering the buttons
 *     and letting Postgres answer 42501 is four dead controls per order.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ShopOrderDetail } from "@/integrations/supabase/shop-schema";

vi.mock("react-router-dom", () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...rest}>{children}</a>
  ),
  useParams: () => ({ code: "PH-2608-AB12" }),
}));

vi.mock("@/components/seo/DynamicMeta", () => ({ DynamicMeta: () => null }));
vi.mock("@/components/shop/ShopShell", () => ({
  ShopScrollShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SellerShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const state = {
  role: "owner" as "owner" | "support",
  order: null as ShopOrderDetail | null,
};

vi.mock("@/hooks/shop/useShopProfile", () => ({
  useMyShopMembership: () => ({
    data: { shop_id: "s1", role: state.role },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useShopProfile: () => ({
    data: { id: "s1", slug: "shop-a", name: "Shop A" },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

const transitionMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/hooks/shop/useOrders", () => ({
  useOrder: () => ({
    data: state.order,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useOrderTransition: () => ({ mutateAsync: transitionMock, isPending: false }),
}));

// P4b. The payment card has its own tests; here it only has to not pull a
// QueryClient into a tree that has none.
vi.mock("@/hooks/shop/useOrderPayment", () => ({
  useOrderPaymentInfo: () => ({ data: undefined, isPending: false, isError: false }),
  useConfirmPayment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMarkRefunded: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const { default: SellerOrderDetail } = await import("../SellerOrderDetail");

const order = (over: Partial<ShopOrderDetail> = {}): ShopOrderDetail =>
  ({
    id: "o1",
    code: "PH-2608-AB12",
    status: "pending",
    payment_method: "cod",
    recipient_name: "Nguyễn Văn A",
    recipient_phone: "0912345678",
    shipping_address: "Số 12 ngõ 5 Trần Duy Hưng, Trung Hoà, Cầu Giấy, Hà Nội",
    delivery_note: "Gọi trước khi tới",
    items_total_vnd: 1_450_000,
    shipping_fee_vnd: 30_000,
    total_vnd: 1_480_000,
    confirm_due_at: new Date(Date.now() + 6 * 3_600_000).toISOString(),
    tracking_code: null,
    cancel_reason: null,
    created_at: new Date(Date.now() - 3_600_000).toISOString(),
    updated_at: new Date(Date.now() - 3_600_000).toISOString(),
    shop: { slug: "shop-a", name: "Shop A", state: "active" },
    items: [
      {
        id: "i1",
        product_id: "p1",
        variant_id: "v1",
        qty: 1,
        product_title: "Vợt QA",
        variant_label: null,
        sku: null,
        unit_price_vnd: 1_450_000,
        line_total_vnd: 1_450_000,
      },
    ],
    events: [
      {
        id: "e1",
        action: "create",
        from_status: null,
        to_status: "pending",
        metadata: {},
        created_at: new Date(Date.now() - 3_600_000).toISOString(),
      },
    ],
    ...over,
  }) as ShopOrderDetail;

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  state.role = "owner";
  state.order = order();
  writeText.mockReset().mockResolvedValue(undefined);
  transitionMock.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the delivery address block", () => {
  it("calls the buyer on a number the database would have accepted", () => {
    render(<SellerOrderDetail />);
    expect(screen.getByText("Gọi người mua").closest("a")?.getAttribute("href")).toBe(
      "tel:0912345678",
    );
  });

  it("prints a number it cannot dial rather than making a dead link", () => {
    state.order = order({ recipient_phone: "+84912345678" });
    render(<SellerOrderDetail />);
    expect(screen.queryByText("Gọi người mua")).toBeNull();
    expect(screen.getByText("+84912345678")).toBeTruthy();
  });

  it("copies name, phone, address and note — four lines, in that order", async () => {
    render(<SellerOrderDetail />);
    fireEvent.click(screen.getByRole("button", { name: /Sao chép địa chỉ giao/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toBe(
      "Nguyễn Văn A\n0912345678\nSố 12 ngõ 5 Trần Duy Hưng, Trung Hoà, Cầu Giấy, Hà Nội\nGọi trước khi tới",
    );
  });

  it("drops the note line when there is no note, rather than pasting a blank", async () => {
    state.order = order({ delivery_note: null });
    render(<SellerOrderDetail />);
    fireEvent.click(screen.getByRole("button", { name: /Sao chép địa chỉ giao/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0].split("\n")).toHaveLength(3);
  });

  it("says 'Đã sao chép' for two seconds, out loud and on the button", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<SellerOrderDetail />);
    fireEvent.click(screen.getByRole("button", { name: /Sao chép địa chỉ giao/ }));

    await waitFor(() => expect(screen.getByRole("button", { name: /Đã sao chép/ })).toBeTruthy());
    const live = document.querySelector('[role="status"][aria-live="polite"]');
    expect(live?.textContent).toBe("Đã sao chép");

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(screen.getByRole("button", { name: /Sao chép địa chỉ giao/ })).toBeTruthy();
    expect(document.querySelector('[role="status"][aria-live="polite"]')?.textContent).toBe("");
  });

  it("tells the seller what to do when the browser refuses the clipboard", async () => {
    writeText.mockRejectedValue(new Error("NotAllowedError"));
    render(<SellerOrderDetail />);
    fireEvent.click(screen.getByRole("button", { name: /Sao chép địa chỉ giao/ }));
    await screen.findByText(/bôi đen phần địa chỉ ở trên rồi copy tay/);
  });

  it("says why the phone number is on screen at all", () => {
    render(<SellerOrderDetail />);
    expect(
      screen.getByText("Số điện thoại này chỉ hiện với shop vì có đơn hàng thật."),
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain("30 ngày");
  });
});

describe("the support role", () => {
  it("reads the order and is offered no way to change it", () => {
    state.role = "support";
    render(<SellerOrderDetail />);

    expect(screen.getByText(/Vai trò support chỉ xem được đơn/)).toBeTruthy();
    for (const label of ["Xác nhận đơn", "Từ chối đơn", "Đã gửi hàng", "Huỷ đơn", "Ghi nhận đã giao"]) {
      expect(screen.queryByRole("button", { name: label }), label).toBeNull();
    }
    // Still gets the two things reading an order is for.
    expect(screen.getByRole("button", { name: /Sao chép địa chỉ giao/ })).toBeTruthy();
    expect(screen.getByText("Gọi người mua")).toBeTruthy();
  });
});

describe("refusing an order", () => {
  it("asks for the reason in a field, not a confirm dialog, and blocks an empty one", () => {
    render(<SellerOrderDetail />);
    fireEvent.click(screen.getByRole("button", { name: "Từ chối đơn" }));

    const box = screen.getByLabelText("Lý do");
    expect(document.activeElement).toBe(box);
    expect(screen.queryByRole("alertdialog")).toBeNull();

    const send = screen.getByRole("button", { name: "Gửi từ chối" });
    expect(send.hasAttribute("disabled")).toBe(true);
    // A disabled button always says why, next to itself.
    const why = document.getElementById(send.getAttribute("aria-describedby") ?? "");
    expect(why?.textContent).toBe("Nhập lý do để người mua biết vì sao.");
    expect(screen.getByText("Người mua sẽ đọc đúng câu này.")).toBeTruthy();
    expect(transitionMock).not.toHaveBeenCalled();
  });

  it("sends the reason with the status the screen is showing", async () => {
    render(<SellerOrderDetail />);
    fireEvent.click(screen.getByRole("button", { name: "Từ chối đơn" }));
    fireEvent.change(screen.getByLabelText("Lý do"), {
      target: { value: "Sản phẩm tạm hết tại kho cửa hàng" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gửi từ chối" }));

    await waitFor(() => expect(transitionMock).toHaveBeenCalledTimes(1));
    expect(transitionMock.mock.calls[0][0]).toEqual({
      orderId: "o1",
      action: "cancel",
      expectedStatus: "pending",
      reason: "Sản phẩm tạm hết tại kho cửa hàng",
      trackingCode: null,
    });
  });
});

describe("shipping", () => {
  it("goes through with an empty tracking code", async () => {
    state.order = order({ status: "confirmed" });
    render(<SellerOrderDetail />);

    const send = screen.getByRole("button", { name: "Đã gửi hàng" });
    expect(send.hasAttribute("disabled")).toBe(false);
    fireEvent.click(send);

    await waitFor(() => expect(transitionMock).toHaveBeenCalledTimes(1));
    expect(transitionMock.mock.calls[0][0]).toMatchObject({
      action: "ship",
      expectedStatus: "confirmed",
      trackingCode: null,
    });
  });

  it("passes the code the seller typed", async () => {
    state.order = order({ status: "confirmed" });
    render(<SellerOrderDetail />);
    fireEvent.change(screen.getByLabelText("Mã vận đơn"), { target: { value: " QA-TRACK-001 " } });
    fireEvent.click(screen.getByRole("button", { name: "Đã gửi hàng" }));

    await waitFor(() => expect(transitionMock).toHaveBeenCalledTimes(1));
    expect(transitionMock.mock.calls[0][0].trackingCode).toBe("QA-TRACK-001");
  });
});

describe("an order somebody else moved first", () => {
  it("says so, and puts the button back", async () => {
    transitionMock.mockRejectedValue({
      code: "PT409",
      message: "Đơn vừa được cập nhật ở nơi khác.",
      details: JSON.stringify({ reason: "stale_status", expected: "pending", current: "cancelled" }),
    });
    render(<SellerOrderDetail />);
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đơn" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("có thể người mua vừa huỷ");
    const button = screen.getByRole("button", { name: "Xác nhận đơn" });
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.getAttribute("aria-busy")).toBeNull();
  });
});

describe("an order that is over", () => {
  it("offers nothing to press and says why", () => {
    state.order = order({ status: "delivered" });
    render(<SellerOrderDetail />);
    expect(screen.getByText("Đơn đã kết thúc. Không còn thao tác nào.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ghi nhận đã giao" })).toBeNull();
  });

  it("shows no deadline once the order is no longer waiting on the seller", () => {
    state.order = order({ status: "confirmed" });
    render(<SellerOrderDetail />);
    expect(document.body.textContent).not.toMatch(/Còn \d+ giờ để trả lời|Quá hạn/);
  });
});

describe("an order that is not this shop's", () => {
  it("answers exactly what a code that never existed answers", () => {
    state.order = order({ shop: { slug: "shop-b", name: "Shop B", state: "active" } });
    const { container } = render(<SellerOrderDetail />);
    expect(screen.getByText("Không tìm thấy đơn này.")).toBeTruthy();
    // Nothing about the buyer leaks on the way past.
    expect(container.textContent).not.toContain("0912345678");
    expect(container.textContent).not.toContain("Nguyễn Văn A");
    expect(screen.getByText("Về danh sách đơn")).toBeTruthy();
  });
});
