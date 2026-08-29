/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

describe("floating cluster (mobile FAB)", () => {
  it("wraps exactly the two links, orders first, in one .tl-shop-fab", () => {
    const { container } = render(<ShopCartLink floating />);
    const fabs = container.querySelectorAll(".tl-shop-fab");
    expect(fabs).toHaveLength(1);
    const links = fabs[0].querySelectorAll("a");
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute("href")).toBe("/shop/orders");
    expect(links[1].getAttribute("href")).toBe("/shop/cart");
  });

  it("keeps the old inline markup when not floating", () => {
    const { container } = render(<ShopCartLink />);
    expect(container.querySelector(".tl-shop-fab")).toBeNull();
    expect(container.querySelectorAll("a")).toHaveLength(2);
  });

  it("renders nothing at all for a signed-out buyer", () => {
    state.signedIn = false;
    const { container } = render(<ShopCartLink floating />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector(".tl-shop-fab")).toBeNull();
  });

  it("lights the cart button only when the cart has items", () => {
    state.count = 3;
    render(<ShopCartLink floating />);
    const cart = screen.getByRole("link", { name: "Giỏ hàng, 3 món" });
    expect(screen.getByText("3")).toBeTruthy();
    expect(cart.classList.contains("tl-shop-iconbtn")).toBe(true);
    expect(cart.classList.contains("is-lit")).toBe(true);
  });

  it.each([0, null])("stays unlit and badge-less at count %s", (count) => {
    state.count = count;
    const { container } = render(<ShopCartLink floating />);
    expect(container.querySelector(".tl-shop-cart-count")).toBeNull();
    expect(container.querySelector(".is-lit")).toBeNull();
  });

  it("never lights the inline (desktop) variant", () => {
    state.count = 3;
    const { container } = render(<ShopCartLink />);
    expect(container.querySelector(".is-lit")).toBeNull();
  });

  it("keeps the three layout invariants in shop.css", () => {
    const css = readFileSync(resolve(__dirname, "../../../styles/shop.css"), "utf8");
    expect(css).toMatch(/\.tl-shop-fab\s*\{[^}]*z-index:\s*44/);
    expect(css).toMatch(
      /body:has\(\.tl-shop-buybar\[data-shown="true"\]\)\s*\.tl-shop-fab\s*\{\s*display:\s*none/,
    );
    expect(css).toMatch(
      /\.tl-shop-page\.tl-shop-has-fab\s*\{\s*padding-bottom:\s*calc\(96px \+ 132px\)/,
    );
  });
});
