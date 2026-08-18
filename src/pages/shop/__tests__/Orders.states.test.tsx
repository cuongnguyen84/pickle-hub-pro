/** @vitest-environment jsdom */
/**
 * /shop/orders — the four answers the page has to keep apart, and the numbers
 * on the tabs.
 *
 *   · "you have never ordered" and "nothing matched what you typed" are
 *     different problems with different ways out. The prototype had one empty
 *     state for both and it sent people looking for a filter they never set;
 *   · the counts are the counts of what pressing the tab would SHOW, search
 *     included — a tab that says 3 and then shows 0 is worse than no number;
 *   · no status pill. A pill is `white-space: nowrap` and five of them at
 *     375px is a page that scrolls sideways. The row says the sentence.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { OrderListRow } from "@/hooks/shop/useOrders";

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

const refetch = vi.fn();
const state: { data: OrderListRow[] | undefined; isPending: boolean; isError: boolean } = {
  data: [],
  isPending: false,
  isError: false,
};

vi.mock("@/hooks/shop/useOrders", () => ({
  useMyOrders: () => ({ ...state, refetch }),
}));

const { default: Orders } = await import("../Orders");

let n = 0;
const row = (over: Partial<OrderListRow> = {}): OrderListRow => {
  n += 1;
  return {
    id: `o${n}`,
    code: `PH-2608-000${n}`,
    shop_id: "s1",
    status: "pending",
    payment_method: "cod",
    recipient_name: "Nguyễn Văn A",
    total_vnd: 1_480_000,
    confirm_due_at: new Date().toISOString(),
    cancel_reason: null,
    created_at: `2026-08-1${(n % 9) + 1}T09:00:00Z`,
    shop: { slug: "shop-a", name: "Shop A" },
    items: [{ id: `i${n}`, product_title: "Vợt QA", qty: 1 }],
    events: [],
    ...over,
  };
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.data = [];
  state.isPending = false;
  state.isError = false;
});

describe("the four page-level answers stay distinct", () => {
  it("loading is not empty", () => {
    state.isPending = true;
    state.data = undefined;
    render(<Orders />);
    expect(screen.getByText("Đang tải danh sách đơn…")).toBeTruthy();
    expect(screen.queryByText("Anh/chị chưa có đơn hàng nào")).toBeNull();
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it("a failed load says nothing was lost and offers a retry that refetches", () => {
    state.isError = true;
    state.data = undefined;
    render(<Orders />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(
      "Chưa tải được danh sách đơn. Đơn của anh/chị vẫn còn nguyên.",
    );
    // The banned reassurance: there is no confirmation email anywhere in P3.
    expect(alert.textContent).not.toContain("email");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("never having ordered points at the marketplace", () => {
    state.data = [];
    render(<Orders />);
    expect(screen.getByText("Anh/chị chưa có đơn hàng nào")).toBeTruthy();
    expect(screen.getByText("Đặt đơn đầu tiên từ chợ nhé.")).toBeTruthy();
    expect(screen.getByText("Xem sản phẩm đang bán").getAttribute("href")).toBe("/shop");
  });

  it("a search that matched nothing is a DIFFERENT sentence, with a way back", () => {
    state.data = [row()];
    render(<Orders />);
    fireEvent.change(screen.getByLabelText("Tìm trong đơn của tôi"), {
      target: { value: "ZZZ-KHONG-CO" },
    });
    expect(screen.getByText("Không có đơn nào khớp “ZZZ-KHONG-CO”")).toBeTruthy();
    expect(screen.queryByText("Anh/chị chưa có đơn hàng nào")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Xoá tìm kiếm" }));
    expect(screen.getByText(/Vợt QA/)).toBeTruthy();
  });
});

describe("the tabs", () => {
  it("count what pressing them would show", () => {
    state.data = [
      row({ status: "pending" }),
      row({ status: "confirmed" }),
      row({ status: "shipped" }),
      row({ status: "delivered" }),
      row({ status: "cancelled" }),
    ];
    render(<Orders />);
    const count = (label: string) =>
      screen.getByRole("tab", { name: new RegExp(`^${label}`) }).textContent?.replace(/\D/g, "");
    expect(count("Tất cả")).toBe("5");
    expect(count("Đang tới")).toBe("3");
    expect(count("Đã xong")).toBe("1");
    expect(count("Đã huỷ")).toBe("1");
  });

  it("are real tabs, and exactly one is selected", () => {
    state.data = [row()];
    render(<Orders />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    expect(tabs.filter((t) => t.getAttribute("aria-selected") === "true")).toHaveLength(1);

    fireEvent.click(screen.getByRole("tab", { name: /Đã huỷ/ }));
    expect(screen.getByRole("tab", { name: /Đã huỷ/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: /Tất cả/ }).getAttribute("aria-selected")).toBe("false");
  });
});

describe("a row", () => {
  it("says what the buyer has to do, and does not use a pill", () => {
    state.data = [row({ status: "pending" })];
    render(<Orders />);
    expect(
      screen.getByText("Shop chưa xác nhận — chưa cần làm gì. Huỷ được nếu đổi ý."),
    ).toBeTruthy();
    expect(document.querySelector(".tl-shop-pill")).toBeNull();
  });

  it("names who cancelled it when the timeline says", () => {
    state.data = [
      row({
        status: "cancelled",
        events: [
          {
            action: "cancel",
            metadata: { actor_kind: "seller" },
            created_at: "2026-08-18T10:00:00Z",
          },
        ],
      }),
    ];
    render(<Orders />);
    expect(screen.getByText("Đã huỷ, do shop.")).toBeTruthy();
  });

  it("sends 'Tôi đã nhận hàng' to the order page rather than firing an RPC", () => {
    state.data = [row({ status: "shipped" })];
    render(<Orders />);
    const cta = screen.getByLabelText(/Tôi đã nhận hàng/);
    expect(cta.tagName).toBe("A");
    expect(cta.getAttribute("href")).toBe(`/shop/order/${state.data![0].code}`);
  });

  it("counts the other items instead of listing them", () => {
    state.data = [
      row({
        items: [
          { id: "a", product_title: "Vợt QA", qty: 1 },
          { id: "b", product_title: "Giày QA", qty: 1 },
          { id: "c", product_title: "Bóng QA", qty: 1 },
        ],
      }),
    ];
    render(<Orders />);
    expect(screen.getByText(/Vợt QA \+2 món khác/)).toBeTruthy();
    expect(screen.queryByText(/Giày QA/)).toBeNull();
  });
});

describe("paging", () => {
  it("shows ten, then offers the rest by name", () => {
    state.data = Array.from({ length: 23 }, () => row());
    render(<Orders />);
    expect(screen.getAllByRole("listitem")).toHaveLength(10);

    fireEvent.click(screen.getByRole("button", { name: "Xem thêm (13 đơn)" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(20);

    fireEvent.click(screen.getByRole("button", { name: "Xem thêm (3 đơn)" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(23);
    expect(screen.queryByRole("button", { name: /Xem thêm/ })).toBeNull();
  });

  it("starts over at ten when the tab changes", () => {
    state.data = Array.from({ length: 15 }, () => row({ status: "pending" }));
    render(<Orders />);
    fireEvent.click(screen.getByRole("button", { name: "Xem thêm (5 đơn)" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(15);

    fireEvent.click(screen.getByRole("tab", { name: /Đang tới/ }));
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
  });
});
