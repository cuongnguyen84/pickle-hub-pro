/** @vitest-environment jsdom */
/**
 * The status IS the sentence.
 *
 * This component holds one design rule that a chip would quietly undo: the
 * buyer's question is "do I have to do anything", so every state answers it in
 * words. A refactor that swaps the five sentences for five status labels
 * ("Chờ xác nhận", "Đã gửi"…) is exactly the regression these tests exist to
 * turn red — length and distinctness are not enough on their own, so each
 * state is also asserted to name an action or the absence of one.
 *
 * The cancelled state is the §H.4 requirement: who cancelled, when, and the
 * seller's reason in their own words when there is one.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { OrderStatusLine } from "../OrderStatusLine";
import { ORDER_STATUSES } from "@/lib/shop/orderState";

afterEach(cleanup);

/** What the buyer is told to do, or told they need not do. A chip has none. */
const ACTIONABLE = /Chưa cần làm gì|bấm “Tôi đã nhận hàng”|liên hệ shop|huỷ được ngay/;

describe("the four live states each answer “do I have to do anything”", () => {
  const live = ["pending", "confirmed", "shipped", "delivered"] as const;

  it.each(live)("%s reads as a sentence about what happens next", (status) => {
    const { container } = render(<OrderStatusLine status={status} />);
    const text = container.textContent ?? "";
    // A status word is one or two words with no full stop. Anything this
    // component prints is a sentence the buyer can act on.
    expect(text).toMatch(ACTIONABLE);
    expect(text.trim().endsWith(".")).toBe(true);
    expect(text.trim().split(/\s+/).length).toBeGreaterThan(5);
  });

  it("gives the four states four DIFFERENT sentences", () => {
    const seen = live.map((status) => {
      const { container } = render(<OrderStatusLine status={status} />);
      return (container.textContent ?? "").trim();
    });
    expect(new Set(seen).size).toBe(4);
  });

  it("covers every status the order machine can be in — no state falls through blank", () => {
    for (const status of ORDER_STATUSES) {
      const { container } = render(
        <OrderStatusLine status={status} cancelledBy="buyer" />,
      );
      expect((container.textContent ?? "").trim().length).toBeGreaterThan(10);
    }
  });

  it("says nothing technical — no Postgres code reaches the buyer", () => {
    for (const status of ORDER_STATUSES) {
      const { container } = render(
        <OrderStatusLine
          status={status}
          cancelledBy="seller"
          shopName="Shop A"
          cancelReason="Hết hàng"
          cancelledAt="2026-08-18T10:30:00"
        />,
      );
      expect(container.textContent ?? "").not.toMatch(/PT409|42501|PGRST|23505|null|undefined/);
    }
  });
});

describe("a cancelled order names who cancelled it", () => {
  it("the seller, with the shop's name, the time and the reason they typed", () => {
    render(
      <OrderStatusLine
        status="cancelled"
        cancelledBy="seller"
        shopName="Shop A"
        cancelReason="Hết hàng, shop xin lỗi"
        cancelledAt="2026-08-18T10:30:00"
      />,
    );
    expect(screen.getByText("Shop A đã huỷ đơn này")).toBeTruthy();
    expect(document.body.textContent).toContain("lúc 18/08 10:30");
    expect(document.body.textContent).toContain("Lý do shop ghi: “Hết hàng, shop xin lỗi”.");
  });

  it("the buyer themselves — and does NOT invent a reason they never gave", () => {
    render(<OrderStatusLine status="cancelled" cancelledBy="buyer" cancelledAt={null} />);
    expect(screen.getByText("Anh/chị đã huỷ đơn này")).toBeTruthy();
    expect(document.body.textContent).not.toContain("Lý do");
    // No timestamp means no dangling "lúc" and no "—" standing in for one.
    expect(document.body.textContent).not.toContain("lúc");
    expect(document.body.textContent).not.toContain("—");
  });

  it("an admin, said plainly rather than as “hệ thống”", () => {
    render(<OrderStatusLine status="cancelled" cancelledBy="admin" shopName="Shop A" />);
    expect(screen.getByText("Quản trị viên ThePickleHub đã huỷ đơn này")).toBeTruthy();
    expect(document.body.textContent).not.toContain("Shop A");
  });

  it("flips the wording on the seller's side: the BUYER cancelled, not “anh/chị”", () => {
    render(<OrderStatusLine status="cancelled" side="seller" cancelledBy={null} />);
    expect(screen.getByText("Người mua đã huỷ đơn này")).toBeTruthy();
    expect(document.body.textContent).not.toContain("Anh/chị đã huỷ");
  });

  it("falls back to “Người bán” when the seller cancelled and the shop name is missing", () => {
    render(<OrderStatusLine status="cancelled" cancelledBy="seller" shopName={null} />);
    expect(screen.getByText("Người bán đã huỷ đơn này")).toBeTruthy();
  });

  it("is a warning block, not the same quiet line as the other four", () => {
    const { container } = render(<OrderStatusLine status="cancelled" cancelledBy="buyer" />);
    expect(container.querySelector(".tl-shop-notice--warn")).toBeTruthy();
    expect(container.querySelector(".tl-shop-sub")).toBeNull();
  });
});
