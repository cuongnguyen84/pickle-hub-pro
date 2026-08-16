/** @vitest-environment jsdom */
// SellerHome state copy after the activation button shipped: the pending
// notice must stop promising "giai đoạn tiếp theo" (products are live), and
// the active notice must link the public page + the first product.
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SellerHome from "../SellerHome";

const myShop = vi.fn();
const myApp = vi.fn();
vi.mock("@/hooks/shop/useSellerApplication", () => ({
  useMyShop: () => myShop(),
  useMyApplication: () => myApp(),
}));

vi.mock("@/components/seo/DynamicMeta", () => ({ DynamicMeta: () => null }));
vi.mock("@/components/states/PageStates", () => ({
  LoadingState: () => <div>loading…</div>,
  ErrorState: () => <div>error</div>,
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
