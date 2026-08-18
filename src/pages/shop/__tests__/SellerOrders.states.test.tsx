/** @vitest-environment jsdom */
/**
 * /seller/orders — the three empties, the two notices, and the one CSS trap.
 *
 * The trap: the table and the card list are BOTH in the DOM, and
 * `[data-desktop-only]` / `[data-mobile-only]` decide which is visible. An
 * inline `display` on either one beats the media query, which is exactly how
 * the card list ended up rendering underneath the table at 1440px on
 * /seller/products. jsdom cannot measure layout — but it can prove the inline
 * style is not there, which is the part that was wrong.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { OrderListRow } from "@/hooks/shop/useOrders";

vi.mock("react-router-dom", () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...rest}>{children}</a>
  ),
}));
vi.mock("@/components/seo/DynamicMeta", () => ({ DynamicMeta: () => null }));
vi.mock("@/components/shop/ShopShell", () => ({
  ShopScrollShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SellerShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/states/PageStates", () => ({
  LoadingState: () => <p>Đang tải…</p>,
  ErrorState: () => <p>Lỗi</p>,
}));

const state = {
  role: "owner" as "owner" | "support",
  orderingEnabled: true,
  rows: [] as OrderListRow[],
};

vi.mock("@/hooks/shop/useShopProfile", () => ({
  useMyShopMembership: () => ({
    data: { shop_id: "s1", role: state.role },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useShopProfile: () => ({
    data: { id: "s1", slug: "shop-a", name: "Shop A", ordering_enabled: state.orderingEnabled },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/shop/useOrders", () => ({
  useShopOrders: () => ({
    data: state.rows,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

const { default: SellerOrders } = await import("../SellerOrders");

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
    confirm_due_at: new Date(Date.now() + 6 * 3_600_000).toISOString(),
    cancel_reason: null,
    created_at: new Date(Date.now() - n * 3_600_000).toISOString(),
    shop: { slug: "shop-a", name: "Shop A" },
    items: [],
    events: [],
    ...over,
  };
};

afterEach(() => {
  cleanup();
  state.role = "owner";
  state.orderingEnabled = true;
  state.rows = [];
});

describe("the three empties", () => {
  it("a shop that has never sold anything says so", () => {
    render(<SellerOrders />);
    expect(screen.getByText("Shop chưa có đơn hàng nào")).toBeTruthy();
    expect(screen.getByText("Khi có người đặt, đơn sẽ hiện ở đây.")).toBeTruthy();
  });

  it("an empty Cần xử lý tab says what will appear there", () => {
    state.rows = [row({ status: "delivered" })];
    render(<SellerOrders />);
    expect(screen.getByText("Không có đơn nào đang chờ anh/chị")).toBeTruthy();
    expect(screen.getByText("Đơn mới sẽ hiện ở đây kèm hạn phải trả lời.")).toBeTruthy();
  });

  it("any other empty tab is a plainer sentence", async () => {
    const { fireEvent } = await import("@testing-library/react");
    state.rows = [row({ status: "delivered" })];
    render(<SellerOrders />);
    fireEvent.click(screen.getByRole("tab", { name: /Đang giao/ }));
    expect(screen.getByText("Không có đơn nào ở mục này")).toBeTruthy();
    expect(screen.queryByText("Đơn mới sẽ hiện ở đây kèm hạn phải trả lời.")).toBeNull();
  });
});

describe("the two notices", () => {
  it("a shop that paused selling is told its existing orders still work", () => {
    state.orderingEnabled = false;
    render(<SellerOrders />);
    expect(
      screen.getByText(
        "Shop đang tạm ngưng bán nên không nhận đơn mới. Đơn đang có vẫn xử lý bình thường.",
      ),
    ).toBeTruthy();
    // The sanctioned wording; check-bundle-size.mjs fails the build on the
    // prototype's "Shop bị tạm ngưng".
    expect(document.body.textContent).not.toContain("Shop bị tạm ngưng");
  });

  it("support is told what it can and cannot do", () => {
    state.role = "support";
    render(<SellerOrders />);
    expect(
      screen.getByText("Vai trò support chỉ xem được đơn. Chủ shop hoặc quản lý mới xử lý đơn."),
    ).toBeTruthy();
  });
});

describe("the two renderings of one list", () => {
  it("keeps the table and the cards free of an inline display", () => {
    state.rows = [row()];
    const { container } = render(<SellerOrders />);
    const desktop = container.querySelector("[data-desktop-only]") as HTMLElement;
    const mobile = container.querySelector("[data-mobile-only]") as HTMLElement;
    expect(desktop).toBeTruthy();
    expect(mobile).toBeTruthy();
    expect(desktop.style.display).toBe("");
    expect(mobile.style.display).toBe("");
  });

  it("puts the overdue order first in BOTH of them", () => {
    state.rows = [
      row({ code: "PH-LATER", confirm_due_at: new Date(Date.now() + 6 * 3_600_000).toISOString() }),
      row({ code: "PH-OVERDUE", confirm_due_at: new Date(Date.now() - 5 * 3_600_000).toISOString() }),
    ];
    const { container } = render(<SellerOrders />);
    const firstRowCode = container.querySelector("tbody tr th")?.textContent ?? "";
    expect(firstRowCode.startsWith("PH-OVERDUE")).toBe(true);
    const firstCardCode = container.querySelector("[data-mobile-only] li a")?.textContent;
    expect(firstCardCode).toBe("PH-OVERDUE");
    // Icon and words, not colour alone.
    expect(screen.getAllByText(/Quá hạn 5 giờ/).length).toBeGreaterThan(0);
  });

  it("shows no deadline on an order that is not waiting on the seller", async () => {
    const { fireEvent } = await import("@testing-library/react");
    state.rows = [row({ status: "shipped" })];
    render(<SellerOrders />);
    fireEvent.click(screen.getByRole("tab", { name: /Đang giao/ }));
    expect(document.body.textContent).not.toMatch(/Còn \d+ giờ để trả lời|Quá hạn/);
    expect(screen.getAllByText("Đang giao — chờ người mua xác nhận").length).toBeGreaterThan(0);
  });
});
