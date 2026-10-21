/** @vitest-environment jsdom */
/**
 * Badge % và giá gạch trên card: chỉ in thứ server trả, không suy diễn.
 * Giá gạch đứng dòng riêng phía trên giá bán (CSS) — layout kiểm bằng Chrome, không jsdom.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProductCard } from "../ProductCard";
import type { ProductCard as Card } from "@/hooks/shop/usePublicShop";

const card = (over: Partial<Card> = {}): Card => ({
  id: "p1",
  slug: "vot-x",
  title: "Vợt X",
  condition: "new",
  created_at: "2026-08-01T00:00:00Z",
  category: { slug: "vot", name: "Vợt" },
  shop: { slug: "s", name: "Shop S", verified: false },
  price_min: 1680000,
  price_max: 1680000,
  availability: "in_stock",
  cover: null,
  ...over,
});

const mount = (c: Card) =>
  render(
    <MemoryRouter>
      <ProductCard card={c} />
    </MemoryRouter>,
  );

afterEach(cleanup);

describe("badge giảm giá", () => {
  it("in -30% khi server trả discount_pct_max, kèm tên đọc được cho SR", () => {
    mount(card({ discount_pct_max: 30, compare_at_min: 2400000 }));
    const off = document.querySelector(".tl-pcard-off");
    expect(off?.textContent).toBe("giảm -30%");
    // accname gộp span inline không chèn khoảng trắng ("giảm-30%"), SR thật vẫn
    // đọc tách câu — regex chấp nhận cả hai.
    expect(screen.getByRole("link", { name: /giảm ?-30%/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /giá gốc ?2\.400\.000₫/ })).toBeTruthy();
  });

  it.each([null, undefined, 0])("không tạo node khi discount_pct_max = %s", (v) => {
    mount(card({ discount_pct_max: v as number | null }));
    expect(document.querySelector(".tl-pcard-off")).toBeNull();
  });

  it("đứng cạnh Hết hàng: cờ trái, badge phải", () => {
    mount(card({ availability: "out_of_stock", discount_pct_max: 15 }));
    expect(document.querySelector(".tl-pcard-flag")?.textContent).toBe("Hết hàng");
    expect(document.querySelector(".tl-pcard-off")?.textContent).toBe("giảm -15%");
  });
});

describe("giá gạch", () => {
  it("chỉ khi một giá và compare_at_min lớn hơn", () => {
    mount(card({ compare_at_min: 2400000 }));
    expect(document.querySelector(".tl-pcard-price .tl-shop-price-was")?.textContent).toBe("giá gốc 2.400.000₫");
  });
  it("không gạch khi là khoảng giá", () => {
    mount(card({ price_max: 1900000, compare_at_min: 2400000, discount_pct_max: 30 }));
    expect(document.querySelector(".tl-shop-price-was")).toBeNull();
  });
  it("không gạch khi compare_at_min không lớn hơn giá, hoặc thiếu", () => {
    mount(card({ compare_at_min: 1680000 }));
    expect(document.querySelector(".tl-shop-price-was")).toBeNull();
    cleanup();
    mount(card({ compare_at_min: null }));
    expect(document.querySelector(".tl-shop-price-was")).toBeNull();
  });
});
