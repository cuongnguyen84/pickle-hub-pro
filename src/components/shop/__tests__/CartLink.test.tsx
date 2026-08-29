/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const state = vi.hoisted(() => ({ signedIn: true, count: 0 as number | null }));

vi.mock("react-router-dom", () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...rest}>{children}</a>
  ),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: state.signedIn ? { id: "buyer-1" } : null }),
}));
vi.mock("@/hooks/shop/useCart", () => ({ useCartCount: () => state.count }));

const { CartAddedToast, ShopCartLink } = await import("../CartLink");

afterEach(() => {
  cleanup();
  state.signedIn = true;
  state.count = 0;
});

describe("buyer shortcuts", () => {
  it("gives a signed-in buyer a visible route back to purchase history", () => {
    render(<ShopCartLink />);
    expect(screen.getByRole("link", { name: "Đơn của tôi" }).getAttribute("href")).toBe(
      "/shop/orders",
    );
    expect(screen.getByRole("link", { name: "Giỏ hàng" }).getAttribute("href")).toBe(
      "/shop/cart",
    );
  });

  it("keeps both private shortcuts off signed-out catalogue pages", () => {
    state.signedIn = false;
    const { container } = render(<ShopCartLink />);
    expect(container.querySelector("a")).toBeNull();
  });

  it("keeps the cart count while adding the orders shortcut", () => {
    state.count = 12;
    render(<ShopCartLink />);
    expect(screen.getByRole("link", { name: "Giỏ hàng, 12 món" })).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
  });

  it("lets the buyer open or dismiss the added-to-cart notice", () => {
    const onClose = vi.fn();
    render(<CartAddedToast open onClose={onClose} />);

    expect(screen.getByRole("link", { name: "Xem giỏ" }).getAttribute("href")).toBe(
      "/shop/cart",
    );
    fireEvent.click(screen.getByRole("button", { name: "Đóng thông báo" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
