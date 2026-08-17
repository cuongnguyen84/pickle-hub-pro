/** @vitest-environment jsdom */
// The monogram must survive Vietnamese: "Đạt" starts with "Đ", not a mangled
// surrogate half — and the accent must be a pure function of the name.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ShopMonogram, monogramAccent } from "../ShopMonogram";

afterEach(cleanup);

const letter = (name: string) => {
  const { container } = render(<ShopMonogram name={name} />);
  return container.querySelector(".tl-shop-monogram")!.textContent;
};

describe("ShopMonogram", () => {
  it("takes the first code point, uppercased — Vietnamese included", () => {
    expect(letter("Đạt Shop")).toBe("Đ");
    expect(letter("pickle store")).toBe("P");
  });

  it("falls back to ? for an empty or whitespace-only name", () => {
    expect(letter("")).toBe("?");
    expect(letter("   ")).toBe("?");
  });

  it("hashes the same name to the same accent, always a token", () => {
    expect(monogramAccent("Đạt Shop")).toBe(monogramAccent("Đạt Shop"));
    expect(monogramAccent("Đạt Shop")).toMatch(/^var\(--tl-/);

    const { container } = render(<ShopMonogram name="Đạt Shop" />);
    const el = container.querySelector(".tl-shop-monogram") as HTMLElement;
    expect(el.style.getPropertyValue("--mono-accent")).toBe(monogramAccent("Đạt Shop"));
    expect(el.getAttribute("aria-hidden")).toBe("true");
  });
});
