/** @vitest-environment jsdom */
// SellerHome state copy after the activation button shipped: the pending
// notice must stop promising "giai đoạn tiếp theo" (products are live), and
// the active notice must link the public page + the first product.
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SellerHome from "../SellerHome";

const myShop = vi.fn();
const myApp = vi.fn();
vi.mock("@/hooks/shop/useSellerApplication", () => ({
  useMyShop: () => myShop(),
  useMyApplication: () => myApp(),
}));

// SellerHome now reads useProductStatusCounts — a react-query hook this file
// does not provide a QueryClient for, so the module is doubled.
const counts = vi.fn();
vi.mock("@/hooks/shop/useSellerProducts", () => ({
  useProductStatusCounts: () => counts(),
}));

beforeEach(() => {
  counts.mockReturnValue({ data: {}, isLoading: false, isError: false });
});

vi.mock("@/components/seo/DynamicMeta", () => ({ DynamicMeta: () => null }));
vi.mock("@/components/states/PageStates", () => ({
  LoadingState: () => <div>loading…</div>,
  ErrorState: ({ onRetry }: { onRetry?: () => void }) => (
    <button onClick={onRetry}>error</button>
  ),
}));
vi.mock("@/components/shop/ShopShell", () => ({
  ShopScrollShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SellerShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DefList: ({ rows }: { rows: [string, React.ReactNode][] }) => (
    <dl>{rows.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}</dl>
  ),
}));

const shopRow = (state: string) => ({
  id: "90010001-0000-4000-8000-000000000001",
  slug: "shop-test",
  name: "Shop Test",
  state,
  city: "Đà Nẵng",
  created_at: "2026-08-10T00:00:00Z",
});

const mount = (state: string) => {
  myShop.mockReturnValue({ data: shopRow(state), isLoading: false, isError: false });
  myApp.mockReturnValue({ data: null, isLoading: false });
  render(
    <MemoryRouter>
      <SellerHome />
    </MemoryRouter>,
  );
};

afterEach(cleanup);

describe("pending_activation", () => {
  it("says the admin will activate and Zalo will carry the news — no phase promise", () => {
    mount("pending_activation");
    expect(screen.getByText("Shop đã mở nhưng chưa hoạt động.")).toBeTruthy();
    expect(screen.getByText(/quản trị viên sẽ kích hoạt sau khi xác minh/i)).toBeTruthy();
    expect(screen.getByText(/báo trực tiếp qua zalo/i)).toBeTruthy();
    // the retired sentence must be GONE
    expect(screen.queryByText(/giai đoạn tiếp theo/i)).toBeNull();
  });

  it("renders the shared Vietnamese state label", () => {
    mount("pending_activation");
    expect(screen.getByText("Chờ kích hoạt")).toBeTruthy();
  });
});

describe("active", () => {
  it("links the public shop page (new tab) and the first-product step", () => {
    mount("active");
    expect(screen.getByText("Shop đang hoạt động")).toBeTruthy();

    const shopLink = screen.getByRole("link", { name: /trang shop của anh\/chị \(mở tab mới\)/i }) as HTMLAnchorElement;
    expect(shopLink.getAttribute("href")).toBe("/shop/store/shop-test");
    expect(shopLink.getAttribute("target")).toBe("_blank");
    expect(shopLink.getAttribute("rel")).toBe("noopener noreferrer");

    const productLink = screen.getByRole("link", { name: "đăng sản phẩm đầu tiên" }) as HTMLAnchorElement;
    expect(productLink.getAttribute("href")).toBe("/seller/products/new");
  });

  it("renders the shared Vietnamese state label", () => {
    mount("active");
    expect(screen.getByText("Đang hoạt động")).toBeTruthy();
  });
});

describe("dashboard CTA row + product stats", () => {
  it("active: 'Xem shop của tôi' opens the public page in a new tab, safely", () => {
    mount("active");

    const cta = screen.getByRole("link", { name: "Xem shop của tôi" }) as HTMLAnchorElement;
    expect(cta.getAttribute("href")).toBe("/shop/store/shop-test");
    expect(cta.getAttribute("target")).toBe("_blank");
    const rel = cta.getAttribute("rel") ?? "";
    expect(rel).toContain("noopener");
    expect(rel).toContain("noreferrer");

    const post = screen.getByRole("link", { name: "Đăng sản phẩm" }) as HTMLAnchorElement;
    expect(post.getAttribute("href")).toBe("/seller/products/new");
  });

  it("the CTA row does not render for a non-active shop", () => {
    mount("pending_activation");
    expect(screen.queryByRole("link", { name: "Xem shop của tôi" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Đăng sản phẩm" })).toBeNull();
  });

  it("stats: the four labels, with Cần sửa pooling needs_changes + rejected", () => {
    counts.mockReturnValue({
      data: { approved: 3, pending_review: 1, needs_changes: 2, rejected: 1, draft: 4 },
      isLoading: false,
      isError: false,
    });
    mount("active");

    for (const label of ["Đã duyệt", "Chờ duyệt", "Cần sửa", "Nháp"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    const fix = screen.getByRole("link", { name: /Cần sửa/ });
    expect(fix.textContent).toContain("3"); // 2 needs_changes + 1 rejected
    expect(fix.getAttribute("href")).toBe("/seller/products");
  });

  it("stats loading: four skeleton cells, marked busy", () => {
    counts.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    mount("active");
    const grid = document.querySelector(".tl-shop-stats[aria-busy='true']");
    expect(grid).toBeTruthy();
    expect(grid!.querySelectorAll(".tl-shop-sk")).toHaveLength(4);
  });

  it("stats error: one hint line with a retry, not a full-screen error", () => {
    const refetch = vi.fn();
    counts.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    mount("active");
    expect(screen.getByText(/Chưa tải được số liệu sản phẩm\./)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("stats empty: a small empty state pointing at the first product", () => {
    counts.mockReturnValue({ data: {}, isLoading: false, isError: false });
    mount("active");
    expect(screen.getByText("Chưa có sản phẩm nào")).toBeTruthy();
    const first = screen.getByRole("link", { name: "Đăng sản phẩm đầu tiên" }) as HTMLAnchorElement;
    expect(first.getAttribute("href")).toBe("/seller/products/new");
  });
});

describe("loading / error / no shop yet", () => {
  const mountRaw = (shopValue: unknown, appValue: unknown) => {
    myShop.mockReturnValue(shopValue);
    myApp.mockReturnValue(appValue);
    render(
      <MemoryRouter>
        <SellerHome />
      </MemoryRouter>,
    );
  };

  it("shows the loading state while either query is in flight", () => {
    mountRaw({ data: null, isLoading: true, isError: false }, { data: null, isLoading: false });
    expect(screen.getByText("loading…")).toBeTruthy();
  });

  it("shows the error state and retry refetches the shop", () => {
    const refetch = vi.fn();
    mountRaw({ data: null, isLoading: false, isError: true, refetch }, { data: null, isLoading: false });
    fireEvent.click(screen.getByText("error"));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("no shop, no application → points at the registration form", () => {
    mountRaw({ data: null, isLoading: false, isError: false }, { data: null, isLoading: false });
    expect(screen.getByText("Chưa có hồ sơ đăng ký nào.")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Đăng ký bán hàng" }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/shop/sell");
  });

  it("no shop but a pending application → points at the status page", () => {
    mountRaw({ data: null, isLoading: false, isError: false }, { data: { id: "a1" }, isLoading: false });
    expect(screen.getByText("Hồ sơ đăng ký của anh/chị chưa được duyệt xong.")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Xem trạng thái hồ sơ" }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/seller/application/status");
  });
});

describe("round-2 fixes: total from displayed groups, CTA gated on state", () => {
  it("F1: archived-only counts still land in the empty state — archived is 'đã cất đi'", () => {
    counts.mockReturnValue({ data: { archived: 3 }, isLoading: false, isError: false });
    mount("active");
    expect(screen.getByText("Chưa có sản phẩm nào")).toBeTruthy();
    // Not the four zero cells.
    expect(document.querySelector(".tl-shop-stats")).toBeNull();
  });

  it("F2: a non-active shop gets the empty line but NOT the first-product button", () => {
    counts.mockReturnValue({ data: {}, isLoading: false, isError: false });
    mount("pending_activation");
    expect(screen.getByText("Chưa có sản phẩm nào")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Đăng sản phẩm đầu tiên" })).toBeNull();
  });
});
