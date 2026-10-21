/** @vitest-environment jsdom */
// ============================================================================
// The bank-transfer card — what each side sees, and what it must never invent.
// ----------------------------------------------------------------------------
// The QR is an <img> whose src encodes the amount and the memo. That makes the
// URL itself the assertion worth making: a card that renders a beautiful
// matrix for the wrong amount, or with a friendly prefix on the memo, is a
// buyer who pays money the seller cannot match to an order.
// ============================================================================

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderPaymentCard } from "../OrderPaymentCard";
import type { OrderPaymentInfo } from "@/hooks/shop/useOrderPayment";

const BANK: OrderPaymentInfo = {
  found: true,
  method: "bank_transfer",
  amount_vnd: 1030000,
  memo: "PH-2608-AB12",
  claimed_at: null,
  confirmed_at: null,
  bank: { code: "MB", account_number: "0123456789", account_name: "NGUYEN VAN CUONG" },
};

const GATEWAY_PAYMENT = {
  qr_url: "https://vietqr.app/img?acc=0123456789&bank=MB&amount=1030000&des=PH-2608-AB12",
  bank_code: "MB",
  account_number: "0123456789",
  account_name: "THE PICKLE HUB",
  amount_vnd: 1030000,
  memo: "PH-2608-AB12",
  status: "initiated" as const,
};

// Not automatic in this repo's vitest setup — without it every getBy* after
// the first render finds two of everything.
afterEach(cleanup);

const qrSrc = () => (screen.getByAltText(/QR/i) as HTMLImageElement).src;

describe("OrderPaymentCard — the buyer", () => {
  it("puts the order's amount and the bare order code into the QR", async () => {
    render(<OrderPaymentCard info={BANK} side="buyer" onMark={vi.fn()} />);
    const url = new URL(qrSrc());
    expect(url.hostname).toBe("img.vietqr.io");
    expect(url.pathname).toContain("MB-0123456789");
    expect(url.searchParams.get("amount")).toBe("1030000");
    // The memo is the code and NOTHING else. A "Thanh toán đơn " prefix would
    // break the seller's search in their banking app, which is the only way
    // they match a bank line to an order.
    expect(url.searchParams.get("addInfo")).toBe("PH-2608-AB12");
    expect(url.searchParams.get("accountName")).toBe("NGUYEN VAN CUONG");
  });

  it("shows the account number as text too, not only inside the QR", () => {
    // A buyer on a desktop cannot scan their own screen.
    render(<OrderPaymentCard info={BANK} side="buyer" onMark={vi.fn()} />);
    expect(screen.getByText("0123456789")).toBeTruthy();
    expect(screen.getByText("NGUYEN VAN CUONG")).toBeTruthy();
    expect(screen.getByText("PH-2608-AB12")).toBeTruthy();
  });

  it("offers exactly one button, and it is the buyer's", async () => {
    const onMark = vi.fn().mockResolvedValue(undefined);
    render(<OrderPaymentCard info={BANK} side="buyer" onMark={onMark} />);
    fireEvent.click(screen.getByRole("button", { name: /Tôi đã chuyển khoản/ }));
    expect(onMark).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /Xác nhận đã nhận tiền/ })).toBeNull();
  });

  it("takes the button away once they have pressed it, and says what happens next", () => {
    render(
      <OrderPaymentCard info={{ ...BANK, claimed_at: "2026-08-18T10:00:00Z" }} side="buyer" onMark={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: /Tôi đã chuyển khoản/ })).toBeNull();
    expect(screen.getByText(/Shop sẽ đối soát/)).toBeTruthy();
    // …but the number stays on screen: a buyer who mis-typed the memo needs it.
    expect(screen.getByText("0123456789")).toBeTruthy();
  });

  it("says something useful when the shop never filled its bank details", () => {
    render(<OrderPaymentCard info={{ ...BANK, bank: null }} side="buyer" onMark={vi.fn()} />);
    expect(screen.queryByAltText(/QR/i)).toBeNull();
    expect(screen.getByText(/Liên hệ shop/)).toBeTruthy();
  });

  it("renders nothing at all for COD, and nothing for a cancelled order", () => {
    const { container: cod } = render(
      <OrderPaymentCard info={{ found: true, method: "cod", bank: null }} side="buyer" onMark={vi.fn()} />,
    );
    expect(cod.innerHTML).toBe("");

    const { container: dead } = render(
      <OrderPaymentCard info={BANK} side="buyer" cancelled onMark={vi.fn()} />,
    );
    expect(dead.innerHTML).toBe("");
  });

  it("surfaces a failure instead of pretending the claim landed", async () => {
    const onMark = vi.fn().mockRejectedValue(new Error("boom"));
    render(<OrderPaymentCard info={BANK} side="buyer" onMark={onMark} />);
    fireEvent.click(screen.getByRole("button", { name: /Tôi đã chuyển khoản/ }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    // And the button comes back, rather than leaving a dead screen.
    const btn = screen.getByRole("button", { name: /Tôi đã chuyển khoản/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("shows the inline QR automatically as the only money route", () => {
    render(
      <OrderPaymentCard
        info={{ ...BANK, bank: null, gateway: { enabled: true, provider: "sepay", status: "not_started" } }}
        side="buyer"
        onMark={vi.fn()}
        onGatewayCheckout={vi.fn()}
        gatewayPayment={GATEWAY_PAYMENT}
      />,
    );
    expect(screen.getByAltText("Mã QR thanh toán")).toBeTruthy();
    expect(screen.getByText("1.030.000₫")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Tôi đã chuyển khoản/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Thanh toán/ })).toBeNull();
  });

  it("explains the short IPN wait after checkout has started", () => {
    render(
      <OrderPaymentCard
        info={{ ...BANK, bank: null, gateway: { enabled: true, provider: "sepay", status: "initiated" } }}
        side="buyer"
        onMark={vi.fn()}
        onGatewayCheckout={vi.fn()}
        gatewayPayment={GATEWAY_PAYMENT}
      />,
    );
    expect(screen.getByText(/hệ thống đang kiểm tra giao dịch/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Thanh toán|Tiếp tục/ })).toBeNull();
  });
});

describe("OrderPaymentCard — the seller", () => {
  it("keeps its button until the money is confirmed, claim or no claim", async () => {
    const onMark = vi.fn().mockResolvedValue(undefined);
    render(<OrderPaymentCard info={BANK} side="seller" onMark={onMark} />);
    // Not gated on the buyer pressing anything first: the seller watches their
    // own bank feed, and money that has arrived must not sit marked unpaid.
    expect(screen.getByText(/Người mua chưa báo đã chuyển/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Xác nhận đã nhận tiền/ }));
    expect(onMark).toHaveBeenCalledTimes(1);
  });

  it("tells the seller to go and look when the buyer has claimed", () => {
    render(
      <OrderPaymentCard info={{ ...BANK, claimed_at: "2026-08-18T10:00:00Z" }} side="seller" onMark={vi.fn()} />,
    );
    expect(screen.getByText(/Kiểm tra tài khoản rồi xác nhận/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Xác nhận đã nhận tiền/ })).toBeTruthy();
  });

  it("closes down entirely once confirmed — no QR, no button, on either side", () => {
    for (const side of ["buyer", "seller"] as const) {
      const { unmount } = render(
        <OrderPaymentCard
          info={{ ...BANK, claimed_at: "2026-08-18T10:00:00Z", confirmed_at: "2026-08-18T11:00:00Z" }}
          side={side}
          onMark={vi.fn()}
        />,
      );
      expect(screen.queryByAltText(/QR/i), side).toBeNull();
      expect(screen.queryByRole("button", { name: /Xác nhận|Tôi đã/ }), side).toBeNull();
      expect(screen.getByText(/Shop đã xác nhận nhận được tiền/)).toBeTruthy();
      unmount();
    }
  });

  it("points the seller at their own settings when the trio is empty", () => {
    render(<OrderPaymentCard info={{ ...BANK, bank: null }} side="seller" onMark={vi.fn()} />);
    expect(screen.getByText(/Cài đặt shop/)).toBeTruthy();
  });

  it("does not ask the seller to reconcile a SePay payment", () => {
    render(
      <OrderPaymentCard
        info={{ ...BANK, bank: null, gateway: { enabled: true, provider: "sepay", status: "initiated" } }}
        side="seller"
        onMark={vi.fn()}
      />,
    );
    expect(screen.getByText(/tự động xác nhận/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
